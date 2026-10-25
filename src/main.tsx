import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  LayoutGrid,
  RotateCcw,
  Ticket,
  ChartNoAxesCombined,
  ArrowUpRight,
  ArrowRight,
  Search,
  ChevronRight,
  Check,
  Plus,
  Minus,
  Layers,
  Braces,
  GitBranch,
  Sigma,
  Shapes,
  Lightbulb,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowLeft,
  Menu,
  X,
  CheckCheck,
  GraduationCap,
  Clock3,
  Route,
  Cloud,
} from "lucide-react";
import { assetUrl } from "./asset-url";
import { MathText } from "./RichText";
import { PracticeLibrary, ProofTicket, PracticeProgress } from "./Practice";
import { SyncProvider, SyncSettings, SyncBadge } from "./Sync";
import { saveProgress, useProgressReload } from "./progress-events";
import { PreparationPlan } from "./PreparationPlan";
import type { PlanTarget } from "./plan-model";
import "katex/dist/katex.min.css";
import "./style.css";
import course from "./data/course.json";
import {
  emptySaved,
  readSaved,
  storageKey,
  sample,
  ratedEntry,
  type Status,
  type Rating,
  type Saved,
  type Result,
} from "./model";
type Question = (typeof course.questions)[number];
type Page =
  "course" | "review" | "ticket" | "progress" | "proofs" | "plan" | "sync";
const statusNames: Record<Status, string> = {
  new: "Не изучал",
  learning: "Изучаю",
  known: "Знаю",
};
const total = course.questions.length;
const icons = [Braces, GitBranch, Layers, Shapes, Sigma, Plus];
function App() {
  const [initial] = useState(() => {
    try {
      return { saved: readSaved(), error: "" };
    } catch {
      return {
        saved: emptySaved,
        error:
          "Не удалось прочитать сохранённый прогресс. Новые изменения заменят недоступные данные.",
      };
    }
  });
  const [saved, setSaved] = useState<Saved>(initial.saved);
  useProgressReload(storageKey, readSaved, setSaved);
  const [warning, setWarning] = useState(initial.error);
  const [ticketMode, setTicketMode] = useState<"theory" | "proof">("theory");
  const [page, setPage] = useState<Page>("course");
  const [practiceInitialId, setPracticeInitialId] = useState<string>();
  const [planOrigin, setPlanOrigin] = useState<string | null>(null);
  const [planFocus, setPlanFocus] = useState<string>();
  const [topic, setTopic] = useState("all");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [topics, setTopics] = useState(course.topics.map((t) => t.id));
  const [count, setCount] = useState(6);
  const [ticket, setTicket] = useState<Question[]>([]);
  const [finished, setFinished] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [ticketError, setTicketError] = useState("");
  const [resultSaved, setResultSaved] = useState(false);
  const [history, setHistory] = useState<Result | null>(null);
  function persist(next: Saved) {
    setSaved(next);
    try {
      saveProgress(storageKey, next, saved);
      setWarning("");
    } catch {
      setWarning(
        "Хранилище браузера недоступно или заполнено. Изменения действуют только до перезагрузки.",
      );
    }
  }
  const entry = (id: string) =>
    saved.progress[id] ?? { status: "new" as Status, review: false };
  function status(id: string, s: Status) {
    persist({
      ...saved,
      progress: {
        ...saved.progress,
        [id]: { status: s, review: s === "learning" },
      },
    });
  }
  function rate(id: string, r: Rating) {
    persist({ ...saved, progress: { ...saved.progress, [id]: ratedEntry(r) } });
  }
  const known = course.questions.filter(
    (q) => entry(q.id).status === "known",
  ).length;
  const learning = course.questions.filter(
    (q) => entry(q.id).status === "learning",
  ).length;
  const review = course.questions.filter((q) => entry(q.id).review);
  function navigate(p: Page) {
    setPlanOrigin(null);
    setPracticeInitialId(undefined);
    setPage(p);
    setSelected(null);
    setSearch("");
    setFilter("all");
    setMobile(false);
    setHistory(null);
    window.scrollTo(0, 0);
  }
  function open(q: Question) {
    setSelected(q);
    setRevealed(false);
    window.scrollTo(0, 0);
  }
  function openPlanMaterial(target: PlanTarget, itemId: string) {
    navigate(target.kind === "theory" ? "course" : "proofs");
    setPlanOrigin(itemId);
    setPlanFocus(itemId);
    if (target.kind === "theory") {
      const question = course.questions.find((q) => q.id === target.id);
      if (question) open(question);
    } else setPracticeInitialId(target.id);
  }
  const filtered = course.questions.filter(
    (q) =>
      (page !== "review" || entry(q.id).review) &&
      (topic === "all" || page === "review" || q.topicId === topic) &&
      (filter === "all" || entry(q.id).status === filter) &&
      (
        q.title +
        " " +
        q.number +
        " " +
        course.topics.find((t) => t.id === q.topicId)?.title
      )
        .toLocaleLowerCase("ru")
        .includes(search.toLocaleLowerCase("ru")),
  );
  function generate() {
    try {
      setTicket(
        sample(
          course.questions.filter((q) => topics.includes(q.topicId)),
          count,
        ),
      );
      setTicketError("");
      setFinished(false);
      setRatings({});
      setResultSaved(false);
      setHistory(null);
    } catch (e) {
      setTicketError((e as Error).message);
    }
  }
  function saveResult() {
    const result: Result = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      questionIds: ticket.map((q) => q.id),
      ratings,
    };
    const progress = { ...saved.progress };
    for (const q of ticket) progress[q.id] = ratedEntry(ratings[q.id]);
    persist({ ...saved, progress, results: [result, ...saved.results] });
    setResultSaved(true);
  }
  const ratingButtons = (
    id: string,
    onRate: (r: Rating) => void,
    value?: Rating,
  ) => (
    <div className="rating-buttons">
      {(
        [
          ["forgot", "Не помню"],
          ["repeat", "Нужно повторить"],
          ["known", "Знаю"],
        ] as const
      ).map(([r, label]) => (
        <button
          key={r}
          className={`rating ${r} ${value === r ? "chosen" : ""}`}
          onClick={() => onRate(r)}
        >
          {r === "known" ? (
            <Check size={16} />
          ) : r === "repeat" ? (
            <RotateCcw size={16} />
          ) : (
            <Minus size={16} />
          )}{" "}
          {label}
        </button>
      ))}
    </div>
  );
  const answer = (q: Question) => (
    <div className="answer">
      <div className="answer-short">
        <span className="eyebrow">КРАТКИЙ ОТВЕТ</span>
        <p>
          <MathText text={q.short || "Ответ нужно добавить."} />
        </p>
      </div>
      <h3>Разберём подробнее</h3>
      <p>
        <MathText
          text={q.explanation || "Подробное объяснение нужно добавить."}
        />
      </p>
      <div className="example">
        <h4>
          <Lightbulb size={17} /> Пример
        </h4>
        <p>
          <MathText text={q.example || "Пример нужно добавить."} />
        </p>
      </div>
      <h3>Доказательство и обоснование</h3>
      <p>
        <MathText text={q.proof || "Доказательство нужно добавить."} />
      </p>
      <a
        className="source"
        href={assetUrl(`/materials/DMlec-base.pdf#page=${q.sourcePage}`)}
        target="_blank"
        rel="noreferrer"
      >
        Конспект М. Н. Вялого · с. {q.sourcePage} <ExternalLink size={14} />
      </a>
    </div>
  );
  return (
    <div className="app">
      <button
        className="mobile-toggle"
        aria-label="Открыть меню"
        onClick={() => setMobile(!mobile)}
      >
        {mobile ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("course");
            setTopic("all");
          }}
        >
          <span className="brand-icon">
            <Braces size={25} />
          </span>
          дискретно<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ТВОЁ УЧЕБНОЕ ПРОСТРАНСТВО</div>
        <nav>
          {(
            [
              { id: "course", icon: LayoutGrid, name: "Темы и вопросы" },
              { id: "review", icon: RotateCcw, name: "Повторение" },
              { id: "plan", icon: Route, name: "План подготовки" },
              { id: "proofs", icon: GraduationCap, name: "Доказательства" },
              { id: "ticket", icon: Ticket, name: "Пробный билет" },
              {
                id: "progress",
                icon: ChartNoAxesCombined,
                name: "Мой прогресс",
              },
              { id: "sync", icon: Cloud, name: "Синхронизация" },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.name}
              {n.id === "review" && review.length > 0 && (
                <span className="nav-count">{review.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-course">
          <span className="eyebrow">ТЕКУЩИЙ КУРС</span>
          <div className="course-icon">
            <BookOpen size={20} />
          </div>
          <strong>
            Дискретная
            <br />
            математика
          </strong>
          <span>Коллоквиум № 1</span>
          <div className="sidebar-progress">
            <i style={{ width: `${(known / total) * 100}%` }} />
          </div>
          <small>
            {known} из {total} вопросов изучено
          </small>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">Σ</span>
          <div>
            <strong>В своём темпе</strong>
            <small>Шаг за шагом к пониманию</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            ПМИ ФКН ВШЭ <span>/</span> Подготовка к коллоквиуму
          </div>
          <SyncBadge onOpen={() => navigate("sync")} />
        </header>
        <div className="content">
          {warning && (
            <div role="alert" className="notice">
              {warning}
            </div>
          )}
          {page === "ticket" && (
            <div
              className="ticket-mode-switch"
              role="group"
              aria-label="Режим билета"
            >
              <button
                className={ticketMode === "theory" ? "active" : ""}
                onClick={() => setTicketMode("theory")}
              >
                По программе
              </button>
              <button
                className={ticketMode === "proof" ? "active" : ""}
                onClick={() => setTicketMode("proof")}
              >
                На доказательство
              </button>
            </div>
          )}
          {planOrigin && page !== "plan" && (
            <div className="plan-return-banner">
              <button onClick={() => navigate("plan")}>
                <ArrowLeft size={16} /> Вернуться к пункту плана
              </button>
              <span>Просмотр не отмечает пункт выполненным</span>
            </div>
          )}
          {page === "sync" ? (
            <SyncSettings />
          ) : page === "plan" ? (
            <PreparationPlan
              onOpen={openPlanMaterial}
              initialFocusId={planFocus}
            />
          ) : page === "proofs" ? (
            <PracticeLibrary
              key={practiceInitialId ?? "library"}
              initialSelectedId={practiceInitialId}
            />
          ) : page === "ticket" && ticketMode === "proof" ? (
            <ProofTicket />
          ) : selected ? (
            <>
              <button className="back" onClick={() => setSelected(null)}>
                <ArrowLeft size={16} /> К списку вопросов
              </button>
              <div className="page-kicker">
                {course.topics.find((t) => t.id === selected.topicId)?.title} ·
                ВОПРОС {selected.number}
              </div>
              <h1 className="question-heading">
                <MathText text={selected.title} />
              </h1>
              <div className="question-tools">
                <label>
                  Статус{" "}
                  <select
                    value={entry(selected.id).status}
                    onChange={(e) =>
                      status(selected.id, e.target.value as Status)
                    }
                  >
                    {Object.entries(statusNames).map(([s, n]) => (
                      <option value={s} key={s}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <span>Сначала попробуйте ответить своими словами</span>
              </div>
              <div className="detail-card">
                <label className="draft-label" htmlFor="draft">
                  Ваш ответ{" "}
                  <small>
                    Черновик · не сохраняется и не проверяется автоматически
                  </small>
                </label>
                <textarea
                  key={selected.id}
                  id="draft"
                  placeholder="Сформулируйте определение, вспомните пример или ход доказательства…"
                  rows={4}
                />
                <button
                  className="primary"
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? <EyeOff size={17} /> : <Eye size={17} />}{" "}
                  {revealed ? "Скрыть ответ" : "Показать ответ"}
                </button>
                {revealed && (
                  <>
                    {answer(selected)}
                    <div className="self-assessment">
                      <h3>Как вы ответили?</h3>
                      <p>Сравните свой ответ с материалом и оцените себя.</p>
                      {ratingButtons(
                        selected.id,
                        (r) => rate(selected.id, r),
                        entry(selected.id).status === "known"
                          ? "known"
                          : entry(selected.id).status === "learning"
                            ? "repeat"
                            : entry(selected.id).review
                              ? "forgot"
                              : undefined,
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                className="text-button next"
                onClick={() =>
                  open(
                    course.questions[
                      (course.questions.findIndex((q) => q.id === selected.id) +
                        1) %
                        course.questions.length
                    ],
                  )
                }
              >
                Следующий вопрос <ArrowRight size={17} />
              </button>
            </>
          ) : page === "course" || page === "review" ? (
            <>
              <div className="page-kicker">
                ДИСКРЕТНАЯ МАТЕМАТИКА · КОЛЛОКВИУМ № 1
              </div>
              <div className="heading-row">
                <div>
                  <h1>
                    {page === "review"
                      ? "Время повторить"
                      : "Большие знания. Маленькие шаги."}
                  </h1>
                  <p className="subtitle">
                    {page === "review"
                      ? "Здесь вопросы, к которым стоит вернуться. Вспомните ответ, прежде чем открыть подсказку."
                      : "Разбирайтесь в теории, проверяйте себя и приходите на коллоквиум уверенно."}
                  </p>
                </div>
                <span className="year-tag">2026 / 27</span>
              </div>
              {page === "course" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span /> ОТ ТЕОРИИ К УВЕРЕННОМУ ОТВЕТУ
                      </span>
                      <h2>
                        Понять. Вспомнить.
                        <br />
                        <em>Рассказать своими словами.</em>
                      </h2>
                      <p>
                        {total} вопросов, {course.topics.length} тем и один
                        понятный маршрут.
                        <br />
                        Начните с темы или испытайте себя в пробном билете.
                      </p>
                      <button onClick={() => navigate("ticket")}>
                        Собрать пробный билет <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <div className="math-art" aria-hidden="true">
                      <span className="art-label">
                        НЕМНОГО МАТЕМАТИЧЕСКОЙ МАГИИ
                      </span>
                      <div className="venn">
                        <i />
                        <i />
                        <i />
                        <span>A</span>
                        <b>B</b>
                      </div>
                      <span className="art-formula">
                        |A ∪ B| = |A| + |B| − |A ∩ B|
                      </span>
                      <span className="art-spark">✳</span>
                    </div>
                  </section>
                  <section className="stats-row">
                    <div>
                      <span className="stat-icon green">
                        <CheckCheck size={21} />
                      </span>
                      <div>
                        <strong>
                          {known}
                          <small> / {total}</small>
                        </strong>
                        <span>Уверенно знаю</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon amber">
                        <BookOpen size={21} />
                      </span>
                      <div>
                        <strong>{learning}</strong>
                        <span>Сейчас изучаю</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon coral">
                        <RotateCcw size={21} />
                      </span>
                      <div>
                        <strong>{review.length}</strong>
                        <span>Нужно повторить</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon violet">
                        <Ticket size={21} />
                      </span>
                      <div>
                        <strong>{saved.results.length}</strong>
                        <span>Билетов пройдено</span>
                      </div>
                    </div>
                  </section>
                  <div className="section-title">
                    <h2>
                      Карта курса <span>{course.topics.length} тем</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setTopic("all");
                        document
                          .getElementById("questions")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Все вопросы <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="topics-grid">
                    {course.topics.map((t, i) => {
                      const qs = course.questions.filter(
                        (q) => q.topicId === t.id,
                      );
                      const k = qs.filter(
                        (q) => entry(q.id).status === "known",
                      ).length;
                      const Icon = icons[i % icons.length];
                      return (
                        <button
                          key={t.id}
                          className={`topic-card tone-${i} ${topic === t.id ? "selected" : ""}`}
                          onClick={() => {
                            setTopic(topic === t.id ? "all" : t.id);
                            setFilter("all");
                            document
                              .getElementById("questions")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <div className="topic-top">
                            <span className="topic-icon">
                              <Icon size={23} />
                            </span>
                            <span className="topic-num">
                              {t.label} <ArrowUpRight size={17} />
                            </span>
                          </div>
                          <h3>{t.title}</h3>
                          <p>{t.description}</p>
                          <div className="topic-progress">
                            <i style={{ width: `${(k / qs.length) * 100}%` }} />
                          </div>
                          <div className="topic-meta">
                            <span>{qs.length} вопросов</span>
                            <span>
                              {k} из {qs.length} изучено
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {page === "review" && (
                <div className="notice neutral">
                  Повторение теории показано ниже. Задачи и доказательства имеют
                  отдельные статусы —{" "}
                  <button
                    className="text-button inline-link"
                    onClick={() => navigate("proofs")}
                  >
                    откройте раздел «Доказательства» → «Повторение»
                  </button>
                  .
                </div>
              )}
              <section id="questions" className="questions-section">
                <div className="section-title">
                  <h2>
                    {page === "review"
                      ? "Список повторения"
                      : topic === "all"
                        ? "Все вопросы"
                        : course.topics.find((t) => t.id === topic)?.title}
                    <span>{filtered.length}</span>
                  </h2>
                  {topic !== "all" && page === "course" && (
                    <button
                      className="text-button"
                      onClick={() => setTopic("all")}
                    >
                      Сбросить тему <X size={14} />
                    </button>
                  )}
                </div>
                <div className="list-toolbar">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      aria-label="Поиск по вопросам"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Найти вопрос или понятие…"
                    />
                    {search && (
                      <button
                        aria-label="Очистить поиск"
                        onClick={() => setSearch("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Фильтр по статусу"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Все статусы</option>
                    {Object.entries(statusNames).map(([s, n]) => (
                      <option key={s} value={s}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="question-list">
                  {filtered.map((q) => (
                    <div className="question-row" key={q.id}>
                      <span className="question-number">
                        {String(q.number).padStart(2, "0")}
                      </span>
                      <button className="question-link" onClick={() => open(q)}>
                        <span>
                          <MathText text={q.title} />
                        </span>
                        <small>
                          {course.topics.find((t) => t.id === q.topicId)?.title}
                        </small>
                      </button>
                      <label className={`status-select ${entry(q.id).status}`}>
                        <span className="sr-only">
                          Статус вопроса {q.number}
                        </span>
                        <select
                          aria-label={`Статус вопроса ${q.number}`}
                          value={entry(q.id).status}
                          onChange={(e) =>
                            status(q.id, e.target.value as Status)
                          }
                        >
                          {Object.entries(statusNames).map(([s, n]) => (
                            <option key={s} value={s}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="row-arrow"
                        aria-label={`Открыть вопрос ${q.number}`}
                        onClick={() => open(q)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div className="empty">
                    <BookOpen />
                    <h3>
                      {page === "review" && !search
                        ? "Пока нечего повторять"
                        : "Ничего не найдено"}
                    </h3>
                    <p>
                      {page === "review" && !search
                        ? "Отмечайте трудные вопросы после самопроверки — они появятся здесь."
                        : "Попробуйте другой запрос или измените фильтр."}
                    </p>
                  </div>
                )}
              </section>
              <div className="course-note">
                <BookOpen size={20} />
                <p>
                  По программе коллоквиума и конспектам М. Н. Вялого.
                  <br />
                  <span>
                    Нумерация сохранена. Краткие ответы помогают повторить
                    материал; полные формулировки сверяйте с конспектом.
                  </span>
                </p>
                <a
                  href={assetUrl("/materials/colloq-base26f.pdf")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Программа <ExternalLink size={14} />
                </a>
              </div>
            </>
          ) : page === "ticket" ? (
            <>
              <div className="page-kicker">ПРАКТИКА БЕЗ ПОДСКАЗОК</div>
              <h1>Пробный билет</h1>
              <p className="subtitle">
                Проверьте, что осталось в памяти. Ответы откроются после
                завершения.
              </p>
              <div className="notice neutral">
                Учебный режим: случайные пункты программы. Официальный билет
                содержит 3 вопроса на определения и 3 на доказательства, включая
                задачи. Для лекционных доказательств, классных и домашних задач
                выберите режим «На доказательство». Оценку из 10 приложение не
                выставляет.
              </div>
              {ticket.length === 0 && !history ? (
                <div className="ticket-setup">
                  <h2>Соберите свой билет</h2>
                  <p className="muted">
                    Выберите темы, которые хотите проверить
                  </p>
                  <div className="check-topics">
                    {course.topics.map((t) => (
                      <label key={t.id}>
                        <input
                          type="checkbox"
                          checked={topics.includes(t.id)}
                          onChange={(e) =>
                            setTopics(
                              e.target.checked
                                ? [...topics, t.id]
                                : topics.filter((x) => x !== t.id),
                            )
                          }
                        />
                        <span>
                          {t.title}
                          <small>
                            {
                              course.questions.filter((q) => q.topicId === t.id)
                                .length
                            }{" "}
                            вопросов
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="count-label">
                    Количество вопросов{" "}
                    <input
                      aria-label="Количество вопросов"
                      type="number"
                      min="1"
                      max={total}
                      value={Number.isNaN(count) ? "" : count}
                      onChange={(e) =>
                        setCount(
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <p className="muted">
                    Доступно в выбранных темах:{" "}
                    {
                      course.questions.filter((q) => topics.includes(q.topicId))
                        .length
                    }
                  </p>
                  {ticketError && (
                    <p role="alert" className="error">
                      {ticketError}
                    </p>
                  )}
                  <button className="primary" onClick={generate}>
                    Сгенерировать билет <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="ticket-bar">
                    <h2>
                      {history
                        ? "Результат билета"
                        : finished
                          ? "Сверьте ответы"
                          : "Ваш билет"}{" "}
                      <span className="muted">
                        · {(history?.questionIds ?? ticket).length} вопросов
                      </span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setTicket([]);
                        setHistory(null);
                      }}
                    >
                      К настройкам <ArrowLeft size={16} />
                    </button>
                  </div>
                  {history && (
                    <p className="muted">
                      {new Date(history.date).toLocaleString("ru-RU")} ·
                      сохранённая самооценка
                    </p>
                  )}
                  {(history
                    ? history.questionIds
                        .map((id) => course.questions.find((q) => q.id === id))
                        .filter((q): q is Question => !!q)
                    : ticket
                  ).map((q, i) => (
                    <article key={q.id} className="ticket-question">
                      <span className="eyebrow">
                        ВОПРОС {i + 1} · ПУНКТ ПРОГРАММЫ {q.number}
                      </span>
                      <h3>
                        <MathText text={q.title} />
                      </h3>
                      {!finished && !history && (
                        <textarea
                          aria-label={`Ответ на вопрос ${i + 1}`}
                          placeholder="Ваш ответ… (черновик, без автоматической проверки)"
                          rows={3}
                        />
                      )}{" "}
                      {(finished || history) && (
                        <>
                          {answer(q)}
                          {history ? (
                            <p className="saved-rating">
                              Самооценка:{" "}
                              {
                                {
                                  forgot: "Не помню",
                                  repeat: "Нужно повторить",
                                  known: "Знаю",
                                }[history.ratings[q.id]]
                              }
                            </p>
                          ) : (
                            <>
                              <p className="muted">Ваша самооценка</p>
                              {resultSaved ? (
                                <p>
                                  {
                                    {
                                      forgot: "Не помню",
                                      repeat: "Нужно повторить",
                                      known: "Знаю",
                                    }[ratings[q.id]]
                                  }
                                </p>
                              ) : (
                                ratingButtons(
                                  q.id,
                                  (r) => setRatings({ ...ratings, [q.id]: r }),
                                  ratings[q.id],
                                )
                              )}
                            </>
                          )}
                        </>
                      )}
                    </article>
                  ))}
                  {!history &&
                    (!finished ? (
                      <button
                        className="primary"
                        onClick={() => setFinished(true)}
                      >
                        Завершить и открыть ответы <Eye size={17} />
                      </button>
                    ) : resultSaved ? (
                      <div className="success" role="status">
                        <Check size={18} /> Результат сохранён. Прогресс и
                        список повторения обновлены.
                      </div>
                    ) : (
                      <>
                        <p className="muted">
                          Оценено {Object.keys(ratings).length} из{" "}
                          {ticket.length}. Оцените каждый ответ, чтобы сохранить
                          результат.
                        </p>
                        <button
                          className="primary"
                          disabled={
                            Object.keys(ratings).length !== ticket.length
                          }
                          onClick={saveResult}
                        >
                          Сохранить результат <Check size={17} />
                        </button>
                      </>
                    ))}
                </>
              )}
            </>
          ) : (
            <>
              <div className="page-kicker">ВИДНО КАЖДЫЙ ШАГ</div>
              <h1>Мой прогресс</h1>
              <p className="subtitle">
                Только ваши отметки и самооценки. Данные хранятся в этом
                браузере.
              </p>
              <div className="progress-overview">
                <div
                  className="progress-ring"
                  style={{
                    background: `conic-gradient(var(--green) ${(known / total) * 360}deg, #e7ebe6 0)`,
                  }}
                >
                  <div>
                    <strong>{Math.round((known / total) * 100)}%</strong>
                    <span>курса изучено</span>
                  </div>
                </div>
                <div>
                  <h2>
                    {known} из {total} вопросов — «Знаю»
                  </h2>
                  <p className="muted">
                    Изучаю: {learning} · Не изучал: {total - known - learning}
                    <br />В списке повторения: {review.length}
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      navigate(review.length ? "review" : "course")
                    }
                  >
                    {review.length
                      ? "Перейти к повторению"
                      : "Продолжить изучение"}{" "}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <div className="progress-topics">
                {course.topics.map((t) => {
                  const qs = course.questions.filter((q) => q.topicId === t.id),
                    k = qs.filter((q) => entry(q.id).status === "known").length,
                    l = qs.filter(
                      (q) => entry(q.id).status === "learning",
                    ).length;
                  return (
                    <div key={t.id}>
                      <div>
                        <strong>{t.title}</strong>
                        <span>
                          {k} / {qs.length}
                        </span>
                      </div>
                      <div className="topic-progress">
                        <i style={{ width: `${(k / qs.length) * 100}%` }} />
                      </div>
                      <small>
                        Знаю: {k} · Изучаю: {l} · Не изучал: {qs.length - k - l}
                      </small>
                    </div>
                  );
                })}
              </div>
              <PracticeProgress />
              <div className="section-title">
                <h2>
                  История билетов <span>{saved.results.length}</span>
                </h2>
              </div>
              {!saved.results.length ? (
                <div className="empty">
                  <Ticket />
                  <h3>Первый билет ещё впереди</h3>
                  <p>
                    Пройдите билет и сохраните самооценку — результат появится
                    здесь.
                  </p>
                  <button
                    className="primary"
                    onClick={() => navigate("ticket")}
                  >
                    Собрать билет <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                saved.results.map((r) => (
                  <button
                    key={r.id}
                    className="history-row"
                    onClick={() => {
                      navigate("ticket");
                      setHistory(r);
                    }}
                  >
                    <span className="stat-icon violet">
                      <Ticket size={20} />
                    </span>
                    <div>
                      <strong>
                        Учебный билет · {r.questionIds.length} вопросов
                      </strong>
                      <small>
                        {new Date(r.date).toLocaleString("ru-RU")} · Знаю:{" "}
                        {
                          Object.values(r.ratings).filter((x) => x === "known")
                            .length
                        }
                      </small>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))
              )}
            </>
          )}
          <footer>
            <span>
              <Braces size={16} /> дискретно <span>· Учиться понимать</span>
            </span>
            <a
              href={assetUrl("/materials/DMlec-base.pdf")}
              target="_blank"
              rel="noreferrer"
            >
              Конспект курса <ArrowUpRight size={14} />
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SyncProvider>
      <App />
    </SyncProvider>
  </React.StrictMode>,
);
