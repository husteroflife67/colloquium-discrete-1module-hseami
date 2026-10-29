import { LearningArt } from "../platform/LearningArt";
import React, { useState, useEffect, useRef } from "react";

import { MathText } from "./MathText";
import { LearningToday } from "./LearningToday";
import { OralExaminer } from "./OralExaminer";
import { scheduleReview, dueItems } from "./repetition";
import {
  BookOpen,
  LayoutDashboard,
  Map,
  Layers,
  MessageCircle,
  PenLine,
  Timer,
  History,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Check,
  Sun,
  Moon,
  Search,
  ChevronRight,
  Menu,
  Download,
  Upload,
  RotateCcw,
  GraduationCap,
  X,
} from "lucide-react";
import "katex/dist/katex.min.css";
import courseStyle from "./style.css?inline";
import { CourseTools, useCoursePage, Bookmark } from "../platform/course-tools";
import { CalculusSyncSettings } from "../Sync";
import { saveProgress, useProgressReload } from "../progress-events";
import { items, topics } from "./content";
import type { Item, OralQuestion, SourceReference } from "./content/types";
import {
  emptyData,
  validateImport,
  generateTicket,
  baseScore,
  availableExtra,
  chooseExtra,
  timerState,
  maxima,
} from "./engine";
import type { Data, Rating, Ticket, Stage } from "./engine";
const ids = new Set(items.map((i) => i.id));
const byId = (id: string) => items.find((i) => i.id === id)!;
const KEY = "predel-v1";
const questionIds = new Set(items.flatMap((i) => i.questions.map((q) => q.id)));
function loadQuestions(): Record<string, Rating> {
  try {
    const r = JSON.parse(localStorage.getItem(KEY + "-questions") ?? "{}");
    return Object.fromEntries(
      Object.entries(r).filter(
        ([k, v]) =>
          questionIds.has(k) && Object.keys(ratingLabels).includes(String(v)),
      ),
    ) as Record<string, Rating>;
  } catch {
    return {};
  }
}
let loadError = "";
function load() {
  try {
    const s = localStorage.getItem(KEY);
    const value = s ? validateImport(JSON.parse(s), ids, items) : emptyData();
    loadError = "";
    return value;
  } catch {
    loadError = "Не удалось прочитать сохранение матанализа. Исходная запись оставлена на устройстве; восстановите прогресс через импорт JSON.";
    return emptyData();
  }
}
const ratingLabels: Record<Rating, string> = {
  unknown: "Не знаю",
  partial: "Частично",
  known: "Знаю",
  repeat: "Повторить",
};
const nav = [
  ["dashboard", "Обзор", LayoutDashboard],
  ["plan", "Тематический план", Map],
  ["today", "На сегодня", RotateCcw],
  ["definition", "Определения", Layers],
  ["theory", "Теория и доказательства", BookOpen],
  ["questions", "Вопросы принимающего", MessageCircle],
  ["oral", "Устный экзаменатор", MessageCircle],
  ["practice", "Практика", PenLine],
  ["simulation", "Пробный коллоквиум", Timer],
  ["history", "История", History],
  ["sync", "Синхронизация", Settings],
  ["settings", "Настройки", Settings],
] as const;
const checklist = [
  "Изучил определения",
  "Понял формулировки",
  "Разобрал доказательства",
  "Воспроизвёл самостоятельно",
  "Ответил на уточнения",
  "Попрактиковался",
  "Повторил",
];
export default function CalculusApp() {
  const [queue, setQueue] = useState<string[]>([]);
  const [questionRatings, setQuestionRatings] =
    useState<Record<string, Rating>>(loadQuestions);
  useEffect(() => {
    try {
      saveProgress(KEY + "-questions", questionRatings);
    } catch {
      /* main export remains available */
    }
  }, [questionRatings]);
  const [data, setData] = useState<Data>(load);
  const previousData = useRef<Data | undefined>(undefined);
  useProgressReload(KEY, load, value => setData(old => JSON.stringify(old) === JSON.stringify(value) ? old : value));
  useProgressReload(KEY + "-questions", loadQuestions, value => setQuestionRatings(old => JSON.stringify(old) === JSON.stringify(value) ? old : value));
  const [page, setPage] = useCoursePage<string>("calculus", "dashboard", nav.map(n => n[0]));
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(0);
  const [filter, setFilter] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [definitionScope, setDefinitionScope] = useState("official");
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (loadError) { setNotice(loadError); return; }
    try {
      saveProgress(KEY, data, previousData.current);
      previousData.current = data;
    } catch {
      setNotice(
        "Не удалось сохранить данные: хранилище заполнено или недоступно. Экспортируйте JSON.",
      );
    }
    document.documentElement.dataset.theme = data.theme;
  }, [data]);
  const rate = (id: string, r: Rating) =>
    setData((d) => ({
      ...d,
      ratings: { ...d.ratings, [id]: r },
      schedules: {
        ...(d.schedules ?? {}),
        [id]: scheduleReview(d.schedules?.[id], r, Date.now()),
      },
    }));
  const navigate = (p: string) => {
    setPage(p);
    setSelected(null);
    setSearch("");
    setMobile(false);
    setFlash(false);
  };
  const mastered = items.filter((i) => data.ratings[i.id] === "known").length;
  const percent = Math.round((mastered / items.length) * 100);
  const weak = items.filter(
    (i) => data.ratings[i.id] === "repeat" || data.ratings[i.id] === "unknown",
  );
  const topicStatus = (id: number) =>
    items
      .filter((i) => i.topic === id)
      .some((i) => data.ratings[i.id] === "repeat")
      ? "Повторить"
      : topicProgress(id) === 100
        ? "Освоено"
        : (data.checklists[id] ?? []).some(Boolean) ||
            items.some((i) => i.topic === id && data.ratings[i.id])
          ? "В процессе"
          : "Не начато";
  const topicProgress = (id: number) => {
    const a = items.filter((i) => i.topic === id);
    return Math.round(
      (a.filter((i) => data.ratings[i.id] === "known").length / a.length) * 100,
    );
  };
  const open = (i: Item) => {
    setPage(i.kind);
    setSelected(i.id);
    setFlash(false);
  };
  useEffect(() => {
    const target = new URLSearchParams(location.hash.split("?")[1] ?? "").get("item");
    if (target && byId(target)) { setSelected(target); setFlash(false); }
  }, [page]);
  const visible = items
    .filter(
      (i) =>
        i.kind === page &&
        (page !== "definition" ||
          definitionScope === "all" ||
          (definitionScope === "official"
            ? i.definitionNumber !== undefined
            : i.definitionNumber === undefined)) &&
        (!topic || i.topic === topic) &&
        (filter === "all" ||
          (filter === "weak"
            ? ["unknown", "partial", "repeat"].includes(
                data.ratings[i.id] ?? "unknown",
              )
            : data.ratings[i.id] === filter)) &&
        (origin === "all" || i.origin === origin) &&
        (
          i.title +
          " " +
          i.statement +
          " " +
          (i.officialPrompt ?? "") +
          " " +
          (i.definitionNumber ?? "") +
          " " +
          i.program.join(" ")
        )
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      page === "definition"
        ? (a.definitionNumber ?? 1000) - (b.definitionNumber ?? 1000)
        : 0,
    );
  const detail = selected ? items.find((i) => i.id === selected) : undefined;
  const ratings = (id: string) => (
    <div className="ratings" aria-label="Самооценка">
      {(Object.keys(ratingLabels) as Rating[]).map((r) => (
        <button
          key={r}
          className={data.ratings[id] === r ? "active" : ""}
          onClick={() => rate(id, r)}
        >
          {r === "known" && <Check size={14} />} {ratingLabels[r]}
        </button>
      ))}
    </div>
  );
  return (
    <div className="shell">
      <style>{courseStyle}</style>
      <CourseTools course="calculus" />
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-symbol">∴</span>
          <span>
            предел<span className="brand-sub">МАТЕМАТИЧЕСКИЙ АНАЛИЗ</span>
          </span>
        </a>
        <div className="course">
          <span className="eyebrow">ВАШ КУРС</span>
          <b>Коллоквиум I</b>
          <span>ПМИ · 1 курс · 2026/27</span>
        </div>
        <nav>
          {nav.map(([p, l, Icon]) => (
            <button
              key={p}
              className={page === p ? "nav active" : "nav"}
              onClick={() => navigate(p)}
            >
              <Icon size={19} />
              <span>{l}</span>
              {p === "simulation" && <span className="dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-progress">
            <span>Ваш прогресс</span>
            <b>{percent}%</b>
          </div>
          <div className="track">
            <i style={{ width: percent + "%" }} />
          </div>
          <p>
            {mastered} из {items.length} объектов освоено
          </p>
          <button
            className="theme-toggle"
            onClick={() =>
              setData((d) => ({
                ...d,
                theme: d.theme === "light" ? "dark" : "light",
              }))
            }
          >
            {data.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}{" "}
            {data.theme === "light" ? "Тёмная тема" : "Светлая тема"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-button icon-button"
            aria-label="Меню"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={22} />
          </button>
          <span>
            Математический анализ <ChevronRight size={13} /> <b>Коллоквиум I</b>
          </span>
          <div className="header-right">
            <span className="local-dot" /> Данные на этом устройстве{" "}
            <span className="avatar">Я</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ПОДГОТОВКА К КОЛЛОКВИУМУ I</div>
              <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
              <p>
                {page === "dashboard"
                  ? "Большая теория начинается с понятных шагов."
                  : page === "plan"
                    ? "Связанные темы и ясные шаги — в вашем темпе."
                    : page === "simulation"
                      ? "Потренируйте не только знания, но и сам ответ."
                      : "Вспоминайте, объясняйте и проверяйте себя."}
              </p>
            </div>
            <a
              className="source-link"
              href={`${import.meta.env.BASE_URL}sources/program.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Программа курса <ArrowUpRight size={16} />
            </a>
          </div>
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                aria-label="Закрыть сообщение"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">НЕ ЗАЗУБРИТЬ. ПОНЯТЬ.</span>
                  <h2>
                    От определения
                    <br />к уверенному ответу.
                  </h2>
                  <p>
                    21 вопрос программы, доказательства и практика.
                    <br />
                    Всё, чтобы у доски вы знали, с чего начать.
                  </p>
                  <button className="primary" onClick={() => navigate("plan")}>
                    Начать подготовку <ArrowRight size={17} />
                  </button>
                  <span className="hero-note">
                    Без расписания. В своём темпе.
                  </span>
                </div>
                <div className="hero-art course-illustration" aria-hidden="true">
                  <LearningArt variant="calculus" />
                  <span className="art-caption">Маленькие шаги. Определённый предел.</span>
                </div>
              </section>
              <div className="stats">
                {[
                  {
                    label: "Общая готовность",
                    value: percent + "%",
                    sub: "Только ваша самооценка",
                    icon: GraduationCap,
                  },
                  {
                    label: "Определения",
                    value: `${items.filter((i) => i.definitionNumber !== undefined && data.ratings[i.id] === "known").length} / ${items.filter((i) => i.definitionNumber !== undefined).length}`,
                    sub: "Официальные определения и формулировки",
                    icon: Layers,
                  },
                  {
                    label: "Доказательства",
                    value: `${items.filter((i) => i.kind === "theory" && i.required && data.ratings[i.id] === "known").length} / ${items.filter((i) => i.kind === "theory" && i.required).length}`,
                    sub: "Обязательное воспроизведение",
                    icon: BookOpen,
                  },
                  {
                    label: "Пробные билеты",
                    value: String(data.history.length),
                    sub: data.history.length
                      ? `Средний балл: ${(data.history.reduce((s, h) => s + h.base, 0) / data.history.length).toFixed(1)} / 8`
                      : "Первый ответ ещё впереди",
                    icon: Timer,
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <s.icon size={20} />
                    <span>{s.label}</span>
                    <strong>{s.value}</strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </div>
              <section className="panel today-shortcut">
                <div>
                  <h3>Что повторить сегодня</h3>
                  <p>
                    {
                      dueItems(items, data.schedules ?? {}, Date.now()).filter(
                        (i) => data.schedules?.[i.id],
                      ).length
                    }{" "}
                    назначенных повторений доступно сейчас. Новые материалы — в
                    порядке официального перечня.
                  </p>
                </div>
                <button className="secondary" onClick={() => navigate("today")}>
                  Открыть очередь <ArrowRight size={16} />
                </button>
              </section>
              <div className="learning-summary">
                <span>
                  Практика:{" "}
                  <b>
                    {
                      items.filter(
                        (i) =>
                          i.kind === "practice" &&
                          data.ratings[i.id] === "known",
                      ).length
                    }{" "}
                    / {items.filter((i) => i.kind === "practice").length}
                  </b>
                </span>
                <span>
                  Уточнения:{" "}
                  <b>
                    {
                      Object.values(questionRatings).filter(
                        (r) => r === "known",
                      ).length
                    }{" "}
                    / {questionIds.size}
                  </b>
                </span>
                <span>
                  На повторение: <b>{weak.length}</b>
                </span>
              </div>
              <div className="dashboard-grid">
                <section>
                  <div className="section-heading">
                    <h2>Ваш маршрут</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("plan")}
                    >
                      Все темы <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="topic-list">
                    {topics.slice(0, 4).map((t, i) => (
                      <button
                        className="topic-row"
                        key={t.id}
                        onClick={() => {
                          navigate("plan");
                          setTopic(t.id);
                        }}
                      >
                        <span className="topic-number">0{i + 1}</span>
                        <span className="topic-row-text">
                          <b>{t.title}</b>
                          <small>{t.subtitle}</small>
                        </span>
                        <span className="status-pill">{topicStatus(t.id)}</span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="exam-card">
                  <span className="eyebrow">ПРОВЕРКА БЕЗ СТРЕССА</span>
                  <div className="exam-icon">
                    <MessageCircle size={28} />
                  </div>
                  <h2>
                    Как на коллоквиуме.
                    <br />
                    Только можно ещё раз.
                  </h2>
                  <p>
                    Случайный билет, устные определения и таймер. Учебный режим
                    поможет разобраться в формате.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => navigate("simulation")}
                  >
                    Собрать тренировочный билет <ArrowUpRight size={16} />
                  </button>
                  <small>Авторские задания · не официальный пул</small>
                </section>
              </div>
              <div className="bottom-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h3>Вернуться к сложному</h3>
                    <span className="count">{weak.length}</span>
                  </div>
                  {weak.length ? (
                    weak.slice(0, 3).map((i) => (
                      <button
                        className="weak-item"
                        key={i.id}
                        onClick={() => open(i)}
                      >
                        {i.title}
                        <ArrowRight size={15} />
                      </button>
                    ))
                  ) : (
                    <p>
                      Отмечайте «Не знаю» или «Повторить» — эти объекты появятся
                      здесь.
                    </p>
                  )}
                </section>
                <section className="panel content-health">
                  <span className="eyebrow">ПРОЗРАЧНОСТЬ МАТЕРИАЛОВ</span>
                  <h3>По программе. С указанием источников.</h3>
                  <p>
                    Покрытие: {new Set(items.flatMap((i) => i.program)).size} /
                    21 вопроса. Самопроверено:{" "}
                    {items.filter((i) => i.review === "self_reviewed").length} /{" "}
                    {items.length}. Это полнота материалов, а не ваша
                    готовность.
                  </p>
                  <a
                    href={`${import.meta.env.BASE_URL}sources/notes.pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть конспект лекций <ArrowUpRight size={14} />
                  </a>
                </section>
              </div>
            </>
          )}
          {page === "plan" && (
            <>
              <div className="info-strip">
                Освоение = доля объектов с оценкой «Знаю». Чек-лист помогает
                организовать работу; просмотр и галочки не повышают процент.
              </div>
              <div className="plan-grid">
                {topics.map((t) => {
                  const related = items.filter((i) => i.topic === t.id);
                  const checks = data.checklists[t.id] ?? Array(7).fill(false);
                  return (
                    <section
                      className={
                        "panel topic-card " +
                        (topic === t.id ? "highlight" : "")
                      }
                      key={t.id}
                    >
                      <div className="section-heading">
                        <span className="topic-number">0{t.id}</span>
                        <span className="status-pill">
                          {related.some((i) => data.ratings[i.id] === "repeat")
                            ? "Повторить"
                            : topicProgress(t.id) === 100
                              ? "Освоено"
                              : checks.some(Boolean) ||
                                  related.some((i) => data.ratings[i.id])
                                ? "В процессе"
                                : "Не начато"}
                        </span>
                      </div>
                      <h2>{t.title}</h2>
                      <p>{t.subtitle}</p>
                      <div className="mini-progress">
                        <span>
                          {
                            related.filter(
                              (i) => data.ratings[i.id] === "known",
                            ).length
                          }{" "}
                          / {related.length} объектов
                        </span>
                        <b>{topicProgress(t.id)}%</b>
                      </div>
                      <div className="track">
                        <i style={{ width: topicProgress(t.id) + "%" }} />
                      </div>
                      <div className="checklist">
                        {checklist.map((label, j) => (
                          <label key={label}>
                            <input
                              type="checkbox"
                              checked={checks[j]}
                              onChange={() =>
                                setData((d) => ({
                                  ...d,
                                  checklists: {
                                    ...d.checklists,
                                    [t.id]: checks.map((v, k) =>
                                      k === j ? !v : v,
                                    ),
                                  },
                                }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div className="topic-links">
                        {(["definition", "theory", "practice"] as const).map(
                          (k) => (
                            <button
                              key={k}
                              onClick={() => {
                                navigate(k);
                                setTopic(t.id);
                              }}
                            >
                              {k === "definition"
                                ? "Определения"
                                : k === "theory"
                                  ? "Доказательства"
                                  : "Практика"}{" "}
                              <ArrowUpRight size={12} />
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {["definition", "theory", "practice"].includes(page) && (
            <>
              {!detail && (
                <>
                  <div className="filters">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Поиск материалов"
                        placeholder="Название, формулировка или номер вопроса"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Тема"
                      value={topic}
                      onChange={(e) => setTopic(+e.target.value)}
                    >
                      <option value={0}>Все темы</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Прогресс"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Любой прогресс</option>
                      <option value="weak">Слабые карточки</option>
                      <option value="known">Знаю</option>
                      <option value="repeat">Повторить</option>
                    </select>
                    <select
                      aria-label="Происхождение"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                    >
                      <option value="all">Все источники</option>
                      <option value="generated">Авторские / ИИ</option>
                      <option value="source">Материал курса</option>
                      <option value="external">Внешние</option>
                    </select>
                  </div>
                  {page === "practice" && (
                    <div className="info-strip">
                      Официальный закрытый пул и семинарские листки не
                      предоставлены. Здесь — авторская учебная имитация, без
                      официальных номеров.
                    </div>
                  )}
                  {page === "definition" && (
                    <>
                      <div className="info-strip">
                        Официальный перечень: 43 вопроса на определения и
                        формулировки. Шесть вспомогательных карточек сохранены
                        отдельно; новые билеты используют только официальный
                        перечень. Процент может снизиться из-за добавленных
                        материалов — старые оценки и история сохранены.{" "}
                        <a
                          href={`${import.meta.env.BASE_URL}sources/definitions.pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть перечень (PDF) ↗
                        </a>
                      </div>
                      <label className="field-label">
                        Состав карточек
                        <select
                          aria-label="Состав карточек"
                          value={definitionScope}
                          onChange={(e) => setDefinitionScope(e.target.value)}
                        >
                          <option value="official">Официальные 43</option>
                          <option value="support">Вспомогательные 6</option>
                          <option value="all">Все карточки</option>
                        </select>
                      </label>
                    </>
                  )}
                  {page === "definition" && definitionScope !== "support" && (
                    <button
                      className="secondary random-button"
                      disabled={
                        visible.filter((i) => i.definitionNumber !== undefined)
                          .length < 4
                      }
                      onClick={() => {
                        const shuffled = visible
                          .filter((i) => i.definitionNumber !== undefined)
                          .slice();
                        for (let i = shuffled.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [shuffled[i], shuffled[j]] = [
                            shuffled[j],
                            shuffled[i],
                          ];
                        }
                        const a = shuffled.slice(0, 4);
                        if (a.length) {
                          setSelected(a[0].id);
                          setQueue(a.map((i) => i.id));
                          setFlash(true);
                        }
                      }}
                    >
                      Случайные 4 официальные карточки <Layers size={16} />
                    </button>
                  )}
                  <p className="result-count">
                    {visible.length} объектов · просмотр не меняет прогресс
                  </p>
                  <div className="library-grid">
                    {visible.map((i) => (
                      <button
                        className="library-card"
                        key={i.id}
                        onClick={() => {
                          setSelected(i.id);
                          setQueue([]);
                          setFlash(page === "definition");
                        }}
                      >
                        <div className="section-heading">
                          <span className="eyebrow">
                            {i.definitionNumber !== undefined
                              ? `ОФИЦИАЛЬНЫЙ ВОПРОС ${i.definitionNumber} · ТЕМА ${i.topic}`
                              : `ТЕМА ${i.topic} · № ${i.program.join(", ")}`}
                          </span>
                          <span className="tiny-status">
                            {data.ratings[i.id]
                              ? ratingLabels[data.ratings[i.id]]
                              : "Не начато"}
                          </span>
                        </div>
                        <h3>{i.title}</h3>
                        <p>{topics.find((t) => t.id === i.topic)?.title}</p>
                        <div className="card-bottom">
                          <span>
                            {i.origin === "generated"
                              ? "Авторский материал"
                              : "Материал курса"}{" "}
                            ·{" "}
                            {i.review === "needs_review"
                              ? "Требует проверки"
                              : "Самопроверен"}
                          </span>
                          <ArrowUpRight size={17} />
                        </div>
                      </button>
                    ))}
                  </div>
                  {!visible.length && (
                    <div className="empty">
                      По этим условиям ничего не найдено. Попробуйте другую тему
                      или очистите поиск.
                    </div>
                  )}
                </>
              )}
              {detail && (
                <>
                  <button
                    className="text-button back"
                    onClick={() => setSelected(null)}
                  >
                    ← К списку
                  </button>
                  <article className="reading panel">
                    <div className="eyebrow">
                      ТЕМА {detail.topic} · ВОПРОСЫ ПРОГРАММЫ ДОКАЗАТЕЛЬСТВ{" "}
                      {detail.program.join(", ")}
                    </div>
                    <h2>
                      {detail.definitionNumber !== undefined &&
                        `${detail.definitionNumber}. `}
                      {detail.title}
                    </h2>
                    <Bookmark course="calculus" kind={detail.kind} id={detail.id} title={detail.title} />
                    {detail.officialPrompt && (
                      <div className="official-prompt">
                        <b>Вопрос из официального перечня:</b>
                        <p>
                          <MathText text={detail.officialPrompt} />
                        </p>
                      </div>
                    )}
                    {!flash && (
                      <nav
                        onClick={e => { const a = (e.target as HTMLElement).closest("a"); if (a?.hash) { e.preventDefault(); document.getElementById(a.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }); } }}
                        className="reading-toc"
                        aria-label="Оглавление материала"
                      >
                        <a href="#statement">Формулировка</a>
                        {detail.kind !== "definition" && (
                          <a href={`#${detail.id}-proof`}>
                            Доказательство / решение
                          </a>
                        )}
                        <a href="#board">План ответа</a>
                        <a href="#oral">Уточнения</a>
                      </nav>
                    )}
                    <div className="provenance">
                      {detail.origin === "generated"
                        ? detail.kind === "definition"
                          ? "Ответ и пояснения составлены ИИ по формулировкам курса"
                          : "Авторский материал · Доказательство составлено ИИ по формулировке курса"
                        : "Материал курса"}
                      <br />
                      {detail.source}
                      <br />
                      <SourceLinks references={detail.references ?? []} />
                      Статус: {detail.review} ·{" "}
                      {detail.required
                        ? "Требуется воспроизведение"
                        : "Без обязательного доказательства"}
                    </div>
                    {page === "definition" && flash ? (
                      <div className="flash-cover">
                        <Layers size={30} />
                        <h3>Сначала вспомните формулировку</h3>
                        <p>Произнесите вслух. Проверьте кванторы и условия.</p>
                        <button
                          className="primary"
                          onClick={() => setFlash(false)}
                        >
                          Открыть карточку
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 id="statement">Формулировка</h3>
                        <div className="statement">
                          <MathText text={detail.statement} />
                        </div>
                        {detail.examples.length > 0 && (
                          <>
                            <h3>Примеры и контрпримеры</h3>
                            {detail.examples.map((p, j) => (
                              <p key={j}>
                                <MathText text={p} />
                              </p>
                            ))}
                          </>
                        )}
                        {detail.dependencies.length > 0 && (
                          <>
                            <h3>На что опираемся</h3>
                            <div className="dependency-links">
                              {detail.dependencies.map((id) => (
                                <button
                                  className="text-button"
                                  key={id}
                                  onClick={() => open(byId(id))}
                                >
                                  {byId(id)?.title ?? id} ↗
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        {page !== "definition" && <Proof item={detail} />}
                        {detail.supplements?.map((supplement) => (
                          <details key={supplement.id} className="supplement">
                            <summary>
                              Дополнительный разбор: {supplement.title}
                            </summary>
                            <p className="muted">
                              Другой способ разобрать тот же факт. Отдельно в
                              прогрессе не учитывается. Объяснение составлено ИИ
                              по дополнительному конспекту; статус:{" "}
                              {supplement.review}.
                            </p>
                            <SourceLinks references={[supplement.source]} />
                            <Proof item={{ ...supplement, kind: "theory" }} />
                            <h3>План этого разбора</h3>
                            <ol>
                              {supplement.board.map((step, j) => (
                                <li key={j}>
                                  <MathText text={step} />
                                </li>
                              ))}
                            </ol>
                            <p className="muted">{supplement.review_notes}</p>
                          </details>
                        ))}
                        <h3 id="board">План ответа у доски</h3>
                        <ol>
                          {detail.board.map((p, j) => (
                            <li key={j}>
                              <MathText text={p} />
                            </li>
                          ))}
                        </ol>
                        <h3>Типичные ошибки</h3>
                        <ul>
                          {detail.mistakes.map((p, j) => (
                            <li key={j}>
                              <MathText text={p} />
                            </li>
                          ))}
                        </ul>
                        <label className="draft-label">
                          Мой черновик{" "}
                          <small>
                            Сохраняется локально. Автоматическая проверка
                            произвольного ответа не выполняется.
                          </small>
                          <textarea
                            value={data.drafts[detail.id] ?? ""}
                            onChange={(e) =>
                              setData((d) => ({
                                ...d,
                                drafts: {
                                  ...d.drafts,
                                  [detail.id]: e.target.value,
                                },
                              }))
                            }
                            placeholder="Попробуйте воспроизвести ответ без подсказок…"
                          />
                        </label>
                        <h3 id="oral">Поговорим как у доски</h3>
                        <p className="muted">
                          Авторские учебные вопросы, не официальный список
                          преподавателя.
                        </p>
                        {detail.questions.map((q) => (
                          <Question
                            key={q.id}
                            q={q}
                            rating={questionRatings[q.id]}
                            onRate={(r) =>
                              setQuestionRatings((d) => ({ ...d, [q.id]: r }))
                            }
                            separate
                          />
                        ))}
                        <details>
                          <summary>Заметки математической проверки</summary>
                          <p>{detail.review_notes}</p>
                        </details>
                        {ratings(detail.id)}
                        {queue.length > 0 && (
                          <button
                            className="primary"
                            onClick={() => {
                              const n = queue.indexOf(detail.id);
                              if (n < queue.length - 1) {
                                setSelected(queue[n + 1]);
                                setFlash(true);
                              } else {
                                setQueue([]);
                                setSelected(null);
                              }
                            }}
                          >
                            {queue.indexOf(detail.id) + 1} / {queue.length} ·
                            Следующая карточка <ArrowRight size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </article>
                </>
              )}
            </>
          )}
          {page === "questions" && (
            <>
              <div className="info-strip">
                Авторские учебные уточнения. Не официальный список
                преподавателя. Самооценка вопроса учитывается отдельно от
                освоения исходной теоремы.
              </div>
              <div className="filters">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Поиск вопроса"
                    aria-label="Поиск вопроса"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Тема вопросов"
                  value={topic}
                  onChange={(e) => setTopic(+e.target.value)}
                >
                  <option value={0}>Все темы</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters">
                <select
                  aria-label="Прогресс вопросов"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Любой прогресс</option>
                  <option value="weak">Слабые вопросы</option>
                  <option value="known">Знаю</option>
                  <option value="repeat">Повторить</option>
                </select>
                <select
                  aria-label="Происхождение вопросов"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                >
                  <option value="all">Все источники</option>
                  <option value="generated">Авторские / ИИ</option>
                  <option value="source">Материал курса</option>
                </select>
              </div>
              {items
                .filter(
                  (i) =>
                    (!topic || i.topic === topic) &&
                    (origin === "all" || i.origin === origin),
                )
                .flatMap((i) =>
                  i.questions
                    .filter(
                      (q) =>
                        q.prompt.toLowerCase().includes(search.toLowerCase()) &&
                        (filter === "all" ||
                          (filter === "weak"
                            ? questionRatings[q.id] !== "known"
                            : questionRatings[q.id] === filter)),
                    )
                    .map((q) => (
                      <Question
                        key={q.id}
                        q={q}
                        label={i.title}
                        rating={questionRatings[q.id]}
                        onRate={(r) =>
                          setQuestionRatings((d) => ({ ...d, [q.id]: r }))
                        }
                      />
                    )),
                )}
            </>
          )}
          {page === "today" && (
            <LearningToday
              items={items}
              schedules={data.schedules ?? {}}
              onReview={rate}
              onOpen={open}
            />
          )}
          {page === "oral" && (
            <OralExaminer
              items={items}
              questionRatings={questionRatings}
              onRateQuestion={(id, r) =>
                setQuestionRatings((d) => ({ ...d, [id]: r }))
              }
              drafts={data.drafts}
              onDraft={(id, text) =>
                setData((d) => ({ ...d, drafts: { ...d.drafts, [id]: text } }))
              }
            />
          )}
          {page === "simulation" && (
            <Simulation
              data={data}
              onSave={(h) =>
                setData((d) => ({ ...d, history: [h, ...d.history] }))
              }
              onNotice={setNotice}
            />
          )}
          {page === "history" && (
            <>
              {!data.history.length ? (
                <div className="empty">
                  <History size={34} />
                  <h2>История начинается с первого ответа</h2>
                  <p>
                    Завершите тренировочный билет. Здесь появятся реальные
                    результаты и темы для повторения.
                  </p>
                  <button
                    className="primary"
                    onClick={() => navigate("simulation")}
                  >
                    Попробовать билет
                  </button>
                </div>
              ) : (
                data.history.map((h) => (
                  <section className="panel history-card" key={h.id}>
                    <div className="section-heading">
                      <h3>{new Date(h.date).toLocaleString("ru-RU")}</h3>
                      <strong>
                        {h.base} / 8 <small>+ {h.extra} доп.</small>
                      </strong>
                    </div>
                    <p>
                      Seed {h.ticket.seed} · {Math.ceil(h.duration / 60)} мин ·
                      подсказки: {h.hints}
                    </p>
                    <ul>
                      {[
                        ...h.ticket.definitionIds,
                        h.ticket.taskId,
                        h.ticket.theoryId,
                        h.ticket.shortId,
                      ].map((id) => (
                        <li key={id}>{byId(id)?.title}</li>
                      ))}
                    </ul>
                    <p>
                      Баллы по пунктам: {h.scores.join(" / ")}. Слабые места:{" "}
                      {h.weak.map((id) => byId(id)?.title).join("; ") ||
                        "не отмечены"}
                      .
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        sessionStorage.setItem(
                          "repeat-ticket",
                          JSON.stringify(h.ticket),
                        );
                        navigate("simulation");
                      }}
                    >
                      Повторить состав <RotateCcw size={14} />
                    </button>
                  </section>
                ))
              )}
            </>
          )}
          {page === "sync" && <CalculusSyncSettings />}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>Ваши данные принадлежат вам</h2>
                <p>
                  Регистрация не нужна. Данные хранятся в localStorage этого
                  браузера. Экспортируйте резервную копию перед сменой
                  устройства.
                </p>
                <div className="settings-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      const b = new Blob(
                        [JSON.stringify({ ...data, questionRatings }, null, 2)],
                        { type: "application/json" },
                      );
                      const u = URL.createObjectURL(b);
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = "predel-progress-v1.json";
                      a.click();
                      URL.revokeObjectURL(u);
                    }}
                  >
                    <Download size={17} /> Экспорт JSON
                  </button>
                  <label className="secondary file-button">
                    <Upload size={17} /> Импорт JSON
                    <input
                      aria-label="Импорт JSON"
                      type="file"
                      accept="application/json,.json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (file.size > 10_000_000)
                            throw Error("Файл больше 10 МБ");
                          const raw = JSON.parse(await file.text());
                          const next = validateImport(raw, ids, items);
                          if (raw.questionRatings) {
                            if (
                              typeof raw.questionRatings !== "object" ||
                              Array.isArray(raw.questionRatings)
                            )
                              throw Error("Некорректные оценки вопросов");
                            for (const [id, r] of Object.entries(
                              raw.questionRatings,
                            ))
                              if (
                                !questionIds.has(id) ||
                                !Object.keys(ratingLabels).includes(String(r))
                              )
                                throw Error("Некорректные оценки вопросов");
                          }
                          loadError = "";
                          setData(next);
                          setQuestionRatings(raw.questionRatings ?? {});
                          setNotice("Данные проверены и импортированы.");
                        } catch (e) {
                          setNotice(
                            e instanceof Error
                              ? e.message
                              : "Не удалось прочитать JSON",
                          );
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <hr />
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Удалить весь прогресс, черновики, ответы и историю на этом устройстве?",
                      )
                    ) {
                      setData(emptyData());
                      setQuestionRatings({});
                      setNotice("Прогресс сброшен.");
                    }
                  }}
                >
                  Сбросить прогресс
                </button>
              </section>
              <section className="panel">
                <h2>Источники и честные границы</h2>
                <p>
                  Перечень устной части: 43 вопроса из «определения-1.pdf»,
                  включая формулировки теорем. Номер в нём отличается от номера
                  в программе доказательств (21 вопрос). Официальность относится
                  к вопросу; развёрнутые ответы и уточнения составлены ИИ и
                  проверены отдельно.
                </p>
                <a
                  href={`${import.meta.env.BASE_URL}sources/definitions.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Официальные 43 вопроса (PDF)
                </a>
                <p>
                  Программа и конспект предоставлены пользователем. Программа
                  определяет нумерацию 21 вопроса. Семинарские листки,
                  официальный закрытый пул и отдельные правила не загружены;
                  формат симуляции взят из вашего задания.
                </p>
                <p>
                  Объяснения, доказательства, вопросы и задачи составлены ИИ.
                  Статус self_reviewed означает математическую самопроверку, а
                  не формальную верификацию и не авторство преподавателя.
                </p>
                <p>
                  Покрытие программы:{" "}
                  {new Set(items.flatMap((i) => i.program)).size} / 21. Требуют
                  проверки:{" "}
                  {items.filter((i) => i.review === "needs_review").length}. Все
                  вопросы программы и состав материалов доступны в тематическом
                  плане.
                </p>
                <a href={`${import.meta.env.BASE_URL}sources/program.pdf`}>
                  Программа (PDF)
                </a>{" "}
                ·{" "}
                <a href={`${import.meta.env.BASE_URL}sources/notes.pdf`}>
                  Конспект (PDF)
                </a>
                <p>
                  Дополнительно подключён исправленный конспект по материалам Н.
                  Белянко от 19 октября 2026 года. Это учебный источник для
                  сверки, а не подтверждение официального пула. Его нумерация
                  отличается от программы; разделы вне программы не включены в
                  обязательные билеты. Ссылки ведут к конкретным разделам и
                  страницам PDF.
                </p>
                <a
                  href={`${import.meta.env.BASE_URL}sources/corrected-guide.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Исправленный конспект (PDF)
                </a>
              </section>
            </div>
          )}
          <footer>
            предел <span>Понимание важнее запоминания.</span>
            <span>Коллоквиум I · Учебный тренажёр</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function SourceLinks({ references }: { references: SourceReference[] }) {
  if (!references.length) return null;
  return (
    <div className="source-references">
      <span>Источники и сверка:</span>
      {references.map((ref) => (
        <div key={ref.id}>
          <a
            href={`${import.meta.env.BASE_URL}${ref.path}#page=${ref.page}`}
            target="_blank"
            rel="noreferrer"
          >
            {ref.title} ·{" "}
            {ref.section.startsWith("вопрос") ? ref.section : `§${ref.section}`}
            , с. {ref.page} ↗
          </a>
          {ref.note && <div>{ref.note}</div>}
        </div>
      ))}
    </div>
  );
}
function Proof({
  item,
}: {
  item: Pick<Item, "id" | "kind" | "idea" | "proof">;
}) {
  const [mode, setMode] = useState("hidden");
  const [steps, setSteps] = useState(1);
  useEffect(() => {
    setMode("hidden");
    setSteps(1);
  }, [item.id]);
  return (
    <section className="proof" id={`${item.id}-proof`}>
      <h3>{item.kind === "practice" ? "Решение" : "Доказательство"}</h3>
      <div className="segmented">
        {[
          ["hidden", "Скрыто"],
          ["idea", "Идея"],
          ["steps", "По шагам"],
          ["full", "Полностью"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={mode === k ? "active" : ""}
            onClick={() => setMode(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === "hidden" ? (
        <p className="muted">Попробуйте сначала самостоятельно.</p>
      ) : (
        <>
          <div className="hint">
            <b>Идея</b>
            <p>
              <MathText text={item.idea} />
            </p>
          </div>
          {mode !== "idea" && (
            <ol className="proof-steps">
              {item.proof
                .slice(0, mode === "full" ? undefined : steps)
                .map((p, j) => (
                  <li key={j}>
                    <MathText text={p} />
                  </li>
                ))}
            </ol>
          )}
          {mode === "steps" && steps < item.proof.length && (
            <button
              className="secondary"
              onClick={() => setSteps((s) => s + 1)}
            >
              Следующий шаг ({steps}/{item.proof.length}){" "}
              <ChevronRight size={16} />
            </button>
          )}
        </>
      )}
    </section>
  );
}
function Question({
  q,
  label,
  rating,
  onRate,
}: {
  q: OralQuestion;
  label?: string;
  rating?: Rating;
  onRate: (r: Rating) => void;
  separate?: boolean;
}) {
  const [show, setShow] = useState(0);
  return (
    <section className="question panel">
      <div className="eyebrow">
        {q.difficulty} {label && "· " + label}
      </div>
      <h3>
        <MathText text={q.prompt} />
      </h3>
      <div className="question-actions">
        <button
          className="text-button"
          onClick={() => setShow((s) => (s === 1 ? 0 : 1))}
        >
          {show === 1 ? "Скрыть подсказку" : "Подсказка"}
        </button>
        <button
          className="text-button"
          onClick={() => setShow((s) => (s === 2 ? 0 : 2))}
        >
          {show === 2 ? "Скрыть ответ" : "Открыть ответ"}
        </button>
      </div>
      {show === 1 && (
        <p className="hint">
          <MathText text={q.hint} />
        </p>
      )}
      {show === 2 && (
        <>
          <p>
            <MathText text={q.answer} />
          </p>
          <p>
            <b>Достаточно сказать: </b>
            <MathText text={q.criteria} />
          </p>
          <p>
            <b>Типичная ошибка: </b>
            <MathText text={q.mistake} />
          </p>
          <div className="ratings">
            {(Object.keys(ratingLabels) as Rating[]).map((r) => (
              <button
                key={r}
                className={rating === r ? "active" : ""}
                onClick={() => onRate(r)}
              >
                {ratingLabels[r]}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
type Run = {
  ticket: Ticket;
  mode: "learn" | "exam";
  stage: Stage;
  started: number;
  stageStarted: number;
  pausedAt: number | null;
  pauseTotal: number;
  defsDone: boolean;
  shortDone: boolean;
  scores: number[];
  choice: number | null;
  extraScore: number;
  hints: number;
  extraId: string;
};
const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function Simulation({
  data,
  onSave,
  onNotice,
}: {
  data: Data;
  onSave: (h: Data["history"][number]) => void;
  onNotice: (s: string) => void;
}) {
  const [run, setRun] = useState<Run | null>(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem("predel-run") ?? "null");
      return r &&
        r.ticket &&
        r.ticket.definitionIds.every((id: string) => ids.has(id))
        ? r
        : null;
    } catch {
      return null;
    }
  });
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<"learn" | "exam">("learn");
  const [strategy, setStrategy] = useState("uniform");
  const [chosen, setChosen] = useState<number[]>(topics.map((t) => t.id));
  const [seed, setSeed] = useState("");
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (run) sessionStorage.setItem("predel-run", JSON.stringify(run));
    else sessionStorage.removeItem("predel-run");
  }, [run]);
  const elapsed = run
    ? Math.max(
        0,
        Math.floor(
          ((run.pausedAt ?? now) - run.started - run.pauseTotal) / 1000,
        ),
      )
    : 0;
  const clock = run
    ? timerState(elapsed, run.stage, run.stageStarted, run.defsDone)
    : null;
  useEffect(() => {
    if (
      !run ||
      run.pausedAt ||
      !clock ||
      run.stage === "grade" ||
      run.stage === "done"
    )
      return;
    if (clock.next !== run.stage) {
      setRun((r) =>
        r
          ? {
              ...r,
              stage: clock.next,
              stageStarted: clock.limit
                ? 7200
                : r.stage === "prep"
                  ? clock.next === "definitions"
                    ? 1500
                    : 1800
                  : r.stage === "definitions"
                    ? Math.min(r.stageStarted + 300, 1800)
                    : r.stage === "second"
                      ? r.stageStarted + 2400
                      : r.stage === "extraSolve"
                        ? r.stageStarted + 1200
                        : r.stageStarted + 600,
              defsDone: r.defsDone || r.stage === "definitions",
              shortDone: r.shortDone || r.stage === "second",
            }
          : r,
      );
      setShowHint(false);
    }
  }, [elapsed, run?.stage, run?.pausedAt]);
  const update = (p: Partial<Run>) => setRun((r) => (r ? { ...r, ...p } : r));
  function start() {
    try {
      let ticket: Ticket;
      const repeat = sessionStorage.getItem("repeat-ticket");
      if (repeat) {
        ticket = JSON.parse(repeat);
        sessionStorage.removeItem("repeat-ticket");
      } else {
        const n = seed.trim()
          ? Number(seed)
          : Math.floor(Math.random() * 0xffffffff);
        if (!Number.isInteger(n) || n < 0 || n > 0xffffffff)
          throw Error("Seed должен быть целым от 0 до 4294967295");
        ticket = generateTicket(items, n, strategy, data.ratings, chosen);
      }
      const extraId = items.find(
        (i) =>
          i.kind === "practice" &&
          i.id !== ticket.taskId &&
          i.id !== ticket.shortId,
      )!.id;
      setRun({
        ticket,
        mode,
        stage: "prep",
        started: Date.now(),
        stageStarted: 0,
        pausedAt: null,
        pauseTotal: 0,
        defsDone: false,
        shortDone: false,
        scores: Array(7).fill(0),
        choice: null,
        extraScore: 0,
        hints: 0,
        extraId,
      });
      setNow(Date.now());
    } catch (e) {
      onNotice((e as Error).message);
    }
  }
  function finish() {
    if (!run) return;
    onSave({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      ticket: run.ticket,
      scores: run.scores,
      base: baseScore(run.scores),
      extra: run.extraScore,
      duration: elapsed,
      hints: run.hints,
      weak: [
        ...run.ticket.definitionIds,
        run.ticket.taskId,
        run.ticket.theoryId,
        run.ticket.shortId,
      ].filter((_, i) => run.scores[i] < maxima[i]),
    });
    setRun(null);
    onNotice(
      "Билет завершён. Результат сохранён в истории. Баллы — ваша самооценка по шкале тренажёра.",
    );
  }
  const statement = (id: string) => (
    <div className="sim-item" key={id}>
      <span className="eyebrow">
        {byId(id).definitionNumber !== undefined
          ? `ОФИЦИАЛЬНЫЙ УСТНЫЙ ВОПРОС ${byId(id).definitionNumber}`
          : "УЧЕБНОЕ ЗАДАНИЕ"}{" "}
        · ТЕМА {byId(id).topic}
      </span>
      <h3>{byId(id).title}</h3>
      <p>
        <MathText
          text={
            byId(id).kind === "definition"
              ? (byId(id).officialPrompt ??
                `Сформулируйте понятие «${byId(id).title}».`)
              : byId(id).statement
          }
        />
      </p>
    </div>
  );
  if (!run)
    return (
      <>
        <div className="info-strip">
          Все билеты тренировочные: официальный закрытый пул не предоставлен.
          Уточнения не добавляют баллы. Итоговая оценка по неизвестной шкале не
          рассчитывается.
        </div>
        <div className="simulation-setup">
          <section className="panel">
            <h2>Соберите свой билет</h2>
            <label className="field-label">
              Режим
              <select
                aria-label="Режим"
                value={mode}
                onChange={(e) => setMode(e.target.value as "learn" | "exam")}
              >
                <option value="learn">Учебный — подсказки и пауза</option>
                <option value="exam">Симуляция — таймер без подсказок</option>
              </select>
            </label>
            <label className="field-label">
              Подбор материала
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="uniform">Равномерно</option>
                <option value="weak">Слабые темы и объекты</option>
                <option value="selected">Выбранные темы</option>
              </select>
            </label>
            {strategy === "selected" &&
              topics.map((t) => (
                <label className="check-row" key={t.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(t.id)}
                    onChange={() =>
                      setChosen((c) =>
                        c.includes(t.id)
                          ? c.filter((id) => id !== t.id)
                          : [...c, t.id],
                      )
                    }
                  />
                  {t.title}
                </label>
              ))}
            <label className="field-label">
              Seed для повторения <small>Можно оставить пустым</small>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Например, 2026"
              />
            </label>
            <button className="primary" onClick={start}>
              Начать тренировку <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel rules">
            <span className="eyebrow">ФОРМАТ ОТВЕТА</span>
            <h2>8 базовых баллов</h2>
            <p>
              4 определения × 0,5 · теоретическая задача 1 · доказательство 3 ·
              короткое утверждение 2.
            </p>
            <p>
              Первый принимающий: определения. Второй: короткое утверждение без
              подготовки в начале ответа, затем задача, доказательство и
              допзадача.
            </p>
            <ol>
              <li>
                Подготовка и определения: общий бюджет 30 минут. Обычно 25 + 5.
                На определения можно вызвать раньше; сэкономленное время
                остаётся для подготовки.
              </li>
              <li>Вторая часть: до 40 минут.</li>
              <li>Допзадача: решение до 20 минут, сдача до 10.</li>
              <li>Общий предел: 2 часа.</li>
            </ol>
            <p>
              При базе ≤ 6: допзадача на 1 балл. При 6,5–8: на 1 или 2. Выбор
              окончателен.
            </p>
          </section>
        </div>
      </>
    );
  const base = baseScore(run.scores);
  const stageLabels: Record<Stage, string> = {
    prep: "Подготовка",
    definitions: "Устные определения",
    second: "Второй принимающий",
    grade: "Самооценка",
    extraSolve: "Решение допзадачи",
    extraAnswer: "Сдача допзадачи",
    done: "Завершено",
  };
  return (
    <>
      <div className="sim-toolbar">
        <div>
          <span className="eyebrow">
            {run.mode === "learn" ? "УЧЕБНЫЙ РЕЖИМ" : "СИМУЛЯЦИЯ"} · SEED{" "}
            {run.ticket.seed}
          </span>
          <h2>{stageLabels[run.stage]}</h2>
        </div>
        <div className="timer">
          <Timer size={21} />
          <strong>{formatTime(clock?.remaining ?? 0)}</strong>
          <small>Общее время {formatTime(elapsed)} / 120:00</small>
        </div>
      </div>
      <div className="sim-controls">
        {run.mode === "learn" && (
          <button
            className="secondary"
            onClick={() =>
              run.pausedAt
                ? update({
                    pausedAt: null,
                    pauseTotal: run.pauseTotal + Date.now() - run.pausedAt,
                  })
                : update({ pausedAt: Date.now() })
            }
          >
            {run.pausedAt ? "Продолжить" : "Пауза"}
          </button>
        )}
        <button
          className="text-button"
          onClick={() => {
            if (confirm("Прервать билет без сохранения результата?"))
              setRun(null);
          }}
        >
          Прервать
        </button>
      </div>
      {run.pausedAt && <div className="notice">Таймер на паузе.</div>}
      <section className="panel sim-content">
        {run.stage === "prep" && (
          <>
            <div className="info-strip">
              Определения и короткое утверждение скрыты.{" "}
              {run.defsDone
                ? "Определения сданы; остаток общего бюджета доступен для подготовки."
                : "Вызовите себя на определения сейчас или дождитесь автоматического вызова на 25-й минуте."}
            </div>
            {statement(run.ticket.taskId)}
            {statement(run.ticket.theoryId)}
            {!run.defsDone ? (
              <button
                className="primary"
                onClick={() => {
                  update({ stage: "definitions", stageStarted: elapsed });
                  setShowHint(false);
                }}
              >
                Вызов на определения
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  update({ stage: "second", stageStarted: elapsed });
                  setShowHint(false);
                }}
              >
                Ко второму принимающему <ArrowRight size={16} />
              </button>
            )}
          </>
        )}
        {run.stage === "definitions" && (
          <>
            <p>До 5 минут. Четыре определения задаёт первый принимающий.</p>
            {run.ticket.definitionIds.map(statement)}
            <button
              className="primary"
              onClick={() =>
                update({
                  defsDone: true,
                  stage: elapsed >= 1800 ? "second" : "prep",
                  stageStarted: elapsed,
                })
              }
            >
              Определения сданы
            </button>
          </>
        )}
        {run.stage === "second" && (
          <>
            {!run.shortDone ? (
              <>
                <div className="info-strip">
                  Сначала докажите короткое утверждение без подготовки.
                </div>
                {statement(run.ticket.shortId)}
                <button
                  className="primary"
                  onClick={() => {
                    update({ shortDone: true });
                    setShowHint(false);
                  }}
                >
                  Короткое утверждение сдано
                </button>
              </>
            ) : (
              <>
                {statement(run.ticket.taskId)}
                {statement(run.ticket.theoryId)}
                <button
                  className="primary"
                  onClick={() => {
                    update({ stage: "grade", stageStarted: elapsed });
                    setShowHint(false);
                  }}
                >
                  Завершить базовый ответ
                </button>
              </>
            )}
          </>
        )}
        {(run.stage === "extraSolve" || run.stage === "extraAnswer") && (
          <>
            <div className="info-strip">
              Авторская допзадача на {run.choice}{" "}
              {run.choice === 1 ? "балл" : "балла"}. Уровень и оценку выставляет
              сам пользователь.
            </div>
            {statement(run.extraId)}
            <button
              className="primary"
              onClick={() => {
                update({
                  stage: run.stage === "extraSolve" ? "extraAnswer" : "grade",
                  stageStarted: elapsed,
                });
                setShowHint(false);
              }}
            >
              {run.stage === "extraSolve"
                ? "Перейти к сдаче"
                : "Завершить сдачу"}
            </button>
          </>
        )}
        {run.stage === "grade" && (
          <>
            <h2>Оцените свой ответ</h2>
            <p>
              Шкала тренажёра с шагом 0,5. Это самооценка, не оценка
              преподавателя. База фиксируется при выборе допзадачи.
            </p>
            <div className="score-grid">
              {[
                "Определение 1",
                "Определение 2",
                "Определение 3",
                "Определение 4",
                "Теоретическая задача",
                "Доказательство",
                "Короткое утверждение",
              ].map((l, j) => (
                <label key={l}>
                  {l}
                  <select
                    disabled={run.choice !== null}
                    value={run.scores[j]}
                    onChange={(e) =>
                      update({
                        scores: run.scores.map((s, k) =>
                          k === j ? +e.target.value : s,
                        ),
                      })
                    }
                  >
                    {Array.from(
                      { length: maxima[j] * 2 + 1 },
                      (_, k) => k / 2,
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s} / {maxima[j]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="total-score">
              Базовый результат <strong>{base} / 8</strong>
              <span>Дополнительные баллы: {run.extraScore}</span>
            </div>
            {run.choice === null ? (
              <>
                <p>
                  Выбор стоимости окончательный. После выбора базовые баллы
                  изменить нельзя.
                </p>
                <div className="settings-actions">
                  {availableExtra(base).map((n) => (
                    <button
                      disabled={elapsed >= 7200}
                      className="secondary"
                      key={n}
                      onClick={() => {
                        try {
                          update({
                            choice: chooseExtra(run.choice, n, base),
                            stage: "extraSolve",
                            stageStarted: elapsed,
                          });
                          setShowHint(false);
                        } catch (e) {
                          onNotice((e as Error).message);
                        }
                      }}
                    >
                      Взять допзадачу на {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <label className="field-label">
                Допзадача (максимум {run.choice})
                <select
                  value={run.extraScore}
                  onChange={(e) => update({ extraScore: +e.target.value })}
                >
                  {Array.from(
                    { length: run.choice * 2 + 1 },
                    (_, k) => k / 2,
                  ).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="primary" onClick={finish}>
              Сохранить результат <Check size={16} />
            </button>
          </>
        )}
        {run.mode === "learn" && run.stage !== "grade" && (
          <div className="sim-hint">
            <button
              className="text-button"
              onClick={() => {
                if (!showHint) update({ hints: run.hints + 1 });
                setShowHint(!showHint);
              }}
            >
              {showHint ? "Скрыть помощь" : "Учебная помощь — идея и решение"}
            </button>
            {showHint &&
              [
                ...(run.stage === "definitions"
                  ? run.ticket.definitionIds
                  : run.stage === "second" && !run.shortDone
                    ? [run.ticket.shortId]
                    : run.stage.startsWith("extra")
                      ? [run.extraId]
                      : [run.ticket.taskId, run.ticket.theoryId]),
              ].map((id) =>
                byId(id).kind === "definition" ? (
                  <div className="hint" key={id}>
                    <h3>{byId(id).title}</h3>
                    <MathText text={byId(id).statement} />
                  </div>
                ) : (
                  <Proof key={id} item={byId(id)} />
                ),
              )}
          </div>
        )}
      </section>
    </>
  );
}
