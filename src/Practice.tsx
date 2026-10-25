import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  Lightbulb,
  Search,
  ShieldCheck,
  Ticket,
  TriangleAlert,
  X,
} from "lucide-react";
import { MathText } from "./RichText";
import {
  practice,
  practiceKey,
  loadPractice,
  emptyPractice,
  statusLabels,
  sourceLabels,
  typeLabels,
  isOptionalClass,
  eligibleProofs,
  generateProofTicket,
  sourceText,
  type StudyStatus,
  type PracticeItem,
  type PracticeSaved,
  type PracticeResult,
} from "./practice-model";
function usePractice() {
  const [initial] = useState(() => {
    try {
      return { data: loadPractice(), error: "" };
    } catch {
      return {
        data: emptyPractice,
        error:
          "Не удалось прочитать прогресс задач. Новые отметки заменят повреждённые данные; прогресс основного курса не затронут.",
      };
    }
  });
  const [data, setData] = useState(initial.data);
  const [error, setError] = useState(initial.error);
  function save(next: PracticeSaved) {
    setData(next);
    try {
      localStorage.setItem(practiceKey, JSON.stringify(next));
      setError("");
    } catch {
      setError(
        "Хранилище недоступно или заполнено. Отметки задач действуют только до перезагрузки.",
      );
    }
  }
  function mark(id: string, status: StudyStatus) {
    save({ ...data, progress: { ...data.progress, [id]: status } });
  }
  return { data, error, save, mark };
}
function Badges({ q }: { q: PracticeItem }) {
  return (
    <div className="material-badges">
      <span>{typeLabels[q.type]}</span>
      {q.proofEligible && q.type !== "proof" && (
        <span className="proof-badge">Подходит для обоснования</span>
      )}
      {isOptionalClass(q) && (
        <span className="optional-badge">★ Необязательная классная</span>
      )}
      {q.starred && q.source === "homework" && (
        <span>★ Домашняя — не исключается</span>
      )}
      {q.outOfScope && <span>Вне программы № 1</span>}
      {q.reviewNotes.length > 0 && (
        <span className="check-badge">Нужна сверка</span>
      )}
      {q.solutionOrigin === "missing" && <span>Разбор нужно добавить</span>}
    </div>
  );
}
function Source({ q }: { q: PracticeItem }) {
  return (
    <a
      className="source material-source"
      href={q.sourceUrl}
      target="_blank"
      rel="noreferrer"
    >
      {sourceText(q)} <ExternalLink size={13} />
    </a>
  );
}
function Condition({ q }: { q: PracticeItem }) {
  return (
    <div className="condition-block">
      <h3>Исходная формулировка</h3>
      {q.part === "б" && (
        <p className="condition-text">
          <MathText text={q.statement.split("\nб*)")[0]} />
        </p>
      )}
      <div className="condition-images">
        {(q.originalImages ?? [q.originalImage]).map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Оригинал условия ${q.number}${i ? " — продолжение" : ""}`}
            loading="lazy"
          />
        ))}
      </div>
      <details className="transcript">
        <summary>Текстовая расшифровка для поиска и чтения</summary>
        <p className="condition-text">
          <MathText text={q.statement} />
        </p>
      </details>
      <Source q={q} />
      {q.reviewNotes.map((note, i) => (
        <div key={i} className="notice material-warning">
          <TriangleAlert size={17} />
          <span>{note}</span>
        </div>
      ))}
      {isOptionalClass(q) && (
        <div className="notice neutral">
          Необязательная классная задача со звёздочкой. Доступна для изучения,
          но исключена из тренировочных билетов.
        </div>
      )}
    </div>
  );
}
function StudyStatusPicker({
  value,
  onChange,
  label = "Статус изучения",
}: {
  value: StudyStatus;
  onChange: (s: StudyStatus) => void;
  label?: string;
}) {
  return (
    <label className="practice-status-label">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as StudyStatus)}
      >
        {Object.entries(statusLabels).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Solution({
  q,
  showIdea,
  showFull,
  onIdea,
  onFull,
}: {
  q: PracticeItem;
  showIdea: boolean;
  showFull: boolean;
  onIdea: () => void;
  onFull: () => void;
}) {
  return (
    <>
      <div className="solution-actions">
        <button className="secondary-button" onClick={onIdea}>
          <Lightbulb size={17} />
          {showIdea ? "Скрыть идею" : "Показать идею"}
        </button>
        <button className="primary" onClick={onFull}>
          <Eye size={17} />
          {showFull ? "Скрыть решение" : "Показать решение"}
        </button>
      </div>
      {showIdea && (
        <div className="example">
          <h4>
            <Lightbulb size={17} /> Идея
          </h4>
          <p>
            <MathText
              text={
                q.idea ||
                "Надёжная идея решения пока не добавлена. Условие сохранено без выдуманного ответа."
              }
            />
          </p>
        </div>
      )}
      {showFull && (
        <div className="practice-solution">
          <div className="solution-credit">
            <ShieldCheck size={18} />
            <div>
              <strong>
                {q.solutionOrigin === "source"
                  ? "Конспект + авторское объяснение"
                  : q.solutionOrigin === "prepared"
                    ? "Авторское учебное решение"
                    : "Решение пока не добавлено"}
              </strong>
              <p>{q.solutionNote}</p>
            </div>
          </div>
          {q.steps.length > 0 ? (
            <>
              <h3>
                {q.source === "lecture"
                  ? "Ход рассуждения / план"
                  : "Пошаговое решение"}
              </h3>
              <ol className="proof-steps">
                {q.steps.map((s, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    <p>
                      <MathText text={s} />
                    </p>
                  </li>
                ))}
              </ol>
              {q.transitions.length > 0 && (
                <div className="key-transition">
                  <h4>Почему работают ключевые переходы</h4>
                  {q.transitions.map((s, i) => (
                    <p key={i}>
                      <MathText text={s} />
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">
              {q.source === "lecture"
                ? "Структурированный разбор пока не добавлен. Прочитайте доказательство в оригинальном конспекте по ссылке ниже."
                : "В приложенном листке нет решений. Надёжное решение для приложения пока не подготовлено."}
            </p>
          )}
          {q.source === "lecture" && (
            <div className="original-proof">
              <h4>Доказательство в первоисточнике</h4>
              <p className="muted">
                Это запись преподавателя; авторское объяснение выше может быть
                короче полного доказательства. Для формул и всех переходов
                сверяйтесь с оригиналом.
              </p>
              <a
                className="source"
                href={`/materials/DMlec-base.pdf#page=${q.sourceProofPage ?? q.page}`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть доказательство · стр. {q.sourceProofPage ?? q.page}{" "}
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
function StudyCard({
  q,
  value,
  onMark,
}: {
  q: PracticeItem;
  value: StudyStatus;
  onMark: (s: StudyStatus) => void;
}) {
  const [idea, setIdea] = useState(false),
    [full, setFull] = useState(false);
  return (
    <>
      <div className="page-kicker">
        {practice.topics.find((t) => t.id === q.topicId)?.title}
      </div>
      <div className="study-detail-heading">
        <h1>
          {q.number}
          {q.starred ? "*" : ""}
        </h1>
        <StudyStatusPicker value={value} onChange={onMark} />
      </div>
      <Badges q={q} />
      <article className="detail-card practice-detail">
        <Condition q={q} />
        <section className="prerequisites">
          <h3>Что нужно знать</h3>
          <ul>
            {q.prerequisites.map((p, i) => (
              <li key={i}>
                <MathText text={p} />
              </li>
            ))}
          </ul>
        </section>
        <label className="draft-label" htmlFor="practice-draft">
          Попробуйте самостоятельно{" "}
          <small>Черновик не сохраняется. Автоматической проверки нет.</small>
        </label>
        <textarea
          id="practice-draft"
          rows={5}
          placeholder="Запишите идею, проверьте крайние случаи, обоснуйте каждый переход…"
        />
        <Solution
          q={q}
          showIdea={idea}
          showFull={full}
          onIdea={() => setIdea(!idea)}
          onFull={() => setFull(!full)}
        />
        {full && (
          <div className="self-assessment">
            <h3>Оцените свой ответ</h3>
            <p>
              Просмотр решения сам по себе не меняет статус. Выберите отметку
              после сравнения.
            </p>
            <div className="practice-assessment">
              {(
                ["unseen", "working", "independent", "repeat"] as StudyStatus[]
              ).map((s) => (
                <button
                  key={s}
                  className={`assessment-option ${value === s ? "selected" : ""}`}
                  onClick={() => onMark(s)}
                >
                  {value === s && <Check size={15} />} {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
}
export function PracticeLibrary({
  initialSelectedId,
}: { initialSelectedId?: string } = {}) {
  const { data, error, mark } = usePractice();
  const [selected, setSelected] = useState<PracticeItem | null>(
    () => practice.items.find((q) => q.id === initialSelectedId) ?? null,
  );
  const [query, setQuery] = useState(""),
    [topic, setTopic] = useState("all"),
    [source, setSource] = useState("all"),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all");
  const [view, setView] = useState<"proof" | "all" | "review">("proof"),
    [optional, setOptional] = useState(false),
    [outside, setOutside] = useState(false),
    [limit, setLimit] = useState(24);
  const filtered = practice.items.filter(
    (q) =>
      (view !== "proof" || q.proofEligible) &&
      (view !== "review" || data.progress[q.id] === "repeat") &&
      (topic === "all" || q.topicId === topic) &&
      (source === "all" || q.source === source) &&
      (kind === "all" || q.type === kind) &&
      (status === "all" || (data.progress[q.id] ?? "unseen") === status) &&
      (optional || !isOptionalClass(q)) &&
      (outside || !q.outOfScope) &&
      `${q.number} ${q.statement} ${q.file} ${sourceText(q)}`
        .toLocaleLowerCase("ru")
        .includes(query.trim().toLocaleLowerCase("ru")),
  );
  const open = (q: PracticeItem) => {
    setSelected(q);
    window.scrollTo(0, 0);
  };
  const proofCount = practice.items.filter((q) => q.proofEligible).length;
  return (
    <div className="practice-workspace">
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      {selected ? (
        <>
          <button className="back" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} /> К материалам
          </button>
          <StudyCard
            key={selected.id}
            q={selected}
            value={data.progress[selected.id] ?? "unseen"}
            onMark={(s) => mark(selected.id, s)}
          />
        </>
      ) : (
        <>
          <div className="page-kicker">ОТ ИДЕИ К СТРОГОМУ РАССУЖДЕНИЮ</div>
          <h1>Доказательства и задачи</h1>
          <p className="subtitle">
            Лекции, классные и домашние работы — с оригинальными условиями и
            честной самооценкой.
          </p>
          <div className="practice-intro">
            <div>
              <span className="hero-label">
                <span /> МАТЕРИАЛЫ В ОДНОМ МЕСТЕ
              </span>
              <h2>
                Сначала найдите идею.
                <br />
                <em>Потом обоснуйте каждый шаг.</em>
              </h2>
              <p>
                Принадлежность к материалам не означает, что задача обязательно
                попадётся в билете. Вычислительные задачи сохранены отдельно от
                доказательств.
              </p>
            </div>
            <div className="practice-numbers">
              <strong>
                95<small>задач из листков</small>
              </strong>
              <strong>
                49<small>лекционных утверждений</small>
              </strong>
            </div>
          </div>
          <div
            className="practice-tabs"
            role="group"
            aria-label="Вид материалов"
          >
            {(
              [
                ["proof", "На доказательство"],
                ["all", "Все задания"],
                ["review", "Повторение"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => {
                  setView(id);
                  setLimit(24);
                }}
              >
                {name}
                <span>
                  {id === "proof"
                    ? proofCount
                    : id === "all"
                      ? practice.items.length
                      : Object.values(data.progress).filter(
                          (s) => s === "repeat",
                        ).length}
                </span>
              </button>
            ))}
          </div>
          <div className="material-filters">
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Поиск по номеру и тексту задания"
                placeholder="К3.1, Д6.5, инъекция…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(24);
                }}
              />
              {query && (
                <button
                  aria-label="Очистить поиск заданий"
                  onClick={() => setQuery("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              aria-label="Тема задания"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setLimit(24);
              }}
            >
              <option value="all">Все темы</option>
              {practice.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Источник задания"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setLimit(24);
              }}
            >
              <option value="all">Все источники</option>
              {Object.entries(sourceLabels).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
            <select
              aria-label="Тип задания"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLimit(24);
              }}
            >
              <option value="all">Все типы</option>
              {Object.entries(typeLabels).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
            <select
              aria-label="Статус задания"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setLimit(24);
              }}
            >
              <option value="all">Все статусы</option>
              {Object.entries(statusLabels).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="scope-toggles">
            <label>
              <input
                type="checkbox"
                checked={optional}
                onChange={(e) => setOptional(e.target.checked)}
              />
              Показать необязательные классные ★
            </label>
            <label>
              <input
                type="checkbox"
                checked={outside}
                onChange={(e) => setOutside(e.target.checked)}
              />
              Показать материалы вне программы № 1
            </label>
          </div>
          <div className="material-count" role="status">
            Найдено: {filtered.length} · отображается{" "}
            {Math.min(limit, filtered.length)}
            <span>Прогресс подтверждается только вашей отметкой</span>
          </div>
          <div className="material-grid">
            {filtered.slice(0, limit).map((q) => (
              <article className="material-card" key={q.id}>
                <div className="material-card-top">
                  <button className="material-number" onClick={() => open(q)}>
                    {q.number}
                    {q.starred ? "*" : ""} <ChevronRight size={16} />
                  </button>
                  <span
                    className={`study-status ${data.progress[q.id] ?? "unseen"}`}
                  >
                    {statusLabels[data.progress[q.id] ?? "unseen"]}
                  </span>
                </div>
                <Source q={q} />
                <button className="material-title" onClick={() => open(q)}>
                  <MathText text={q.statement.split("\n")[0]} />
                </button>
                <Badges q={q} />
                <div className="material-card-footer">
                  <span>
                    {practice.topics.find((t) => t.id === q.topicId)?.title}
                  </span>
                  <button
                    className="text-button"
                    aria-label={`Разобрать ${q.number}`}
                    onClick={() => open(q)}
                  >
                    Разобрать <ArrowRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty">
              <Search />
              <h3>Подходящих материалов не найдено</h3>
              <p>
                Проверьте запрос и фильтры. Звёздочные классные и темы вне
                программы скрыты по умолчанию.
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setTopic("all");
                  setSource("all");
                  setKind("all");
                  setStatus("all");
                }}
              >
                Сбросить фильтры
              </button>
            </div>
          )}
          {limit < filtered.length && (
            <button
              className="secondary-button load-more"
              onClick={() => setLimit(limit + 24)}
            >
              Показать ещё {Math.min(24, filtered.length - limit)}
            </button>
          )}
          <details className="material-audit">
            <summary>Что перенесено и что требует сверки</summary>
            <p>{practice.coverageNote}</p>
            <p>
              8 необязательных классных карточек (включая только б* из К7.4)
              исключаются из билетов. Домашняя звёздочка сама по себе не
              исключает задание. Вне программы: занятие 9, Д7 и лекция 9;
              доступны отдельно.
            </p>
            <ul>
              {practice.items
                .filter((q) => q.reviewNotes.length > 0)
                .map((q) => (
                  <li key={q.id}>
                    <button className="text-button" onClick={() => open(q)}>
                      {q.number}
                    </button>{" "}
                    {q.reviewNotes.join(" ")}
                  </li>
                ))}
            </ul>
            <p>
              Листки содержат условия, но не готовые решения. Авторские
              объяснения подписаны отдельно. Карточки без готового разбора
              доступны; для билетов можно включить соответствующий режим.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
function TicketQuestion({
  q,
  index,
  rating,
  onRate,
  completed,
  locked,
}: {
  q: PracticeItem;
  index: number;
  rating?: StudyStatus;
  onRate: (s: StudyStatus) => void;
  completed: boolean;
  locked: boolean;
}) {
  const [idea, setIdea] = useState(false),
    [full, setFull] = useState(false);
  return (
    <article className="proof-ticket-question">
      <span className="eyebrow">
        ВОПРОС {index + 1} · {q.number}
      </span>
      <Badges q={q} />
      <Condition q={q} />
      {!completed && (
        <textarea
          aria-label={`Черновик доказательства ${index + 1}`}
          rows={3}
          placeholder="Ваше рассуждение… Черновик не сохраняется."
        />
      )}
      <details className="prerequisites">
        <summary>Необходимые определения и теоремы</summary>
        <ul>
          {q.prerequisites.map((s, i) => (
            <li key={i}>
              <MathText text={s} />
            </li>
          ))}
        </ul>
      </details>
      <Solution
        q={q}
        showIdea={idea}
        showFull={full}
        onIdea={() => setIdea(!idea)}
        onFull={() => setFull(!full)}
      />
      {(full || completed) && (
        <div className="self-assessment">
          <h3>Самооценка</h3>
          <p>
            Сравните ответ с решением. Отметка «Нужно повторить» добавит
            материал в повторение после сохранения билета.
          </p>
          {locked ? (
            <p>{rating ? statusLabels[rating] : "Нет отметки"}</p>
          ) : (
            <div className="practice-assessment">
              {(
                ["unseen", "working", "independent", "repeat"] as StudyStatus[]
              ).map((s) => (
                <button
                  key={s}
                  className={`assessment-option ${rating === s ? "selected" : ""}`}
                  onClick={() => onRate(s)}
                >
                  {rating === s && <Check size={15} />} {statusLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
export function ProofTicket() {
  const { data, error, save } = usePractice();
  const [topics, setTopics] = useState(
    practice.topics.filter((t) => t.id !== "infinite").map((t) => t.id),
  );
  const [count, setCount] = useState(3),
    [outside, setOutside] = useState(false),
    [ready, setReady] = useState(true),
    [ticket, setTicket] = useState<PracticeItem[]>([]),
    [message, setMessage] = useState(""),
    [finished, setFinished] = useState(false),
    [ratings, setRatings] = useState<Record<string, StudyStatus>>({}),
    [stored, setStored] = useState(false),
    [run, setRun] = useState(""),
    [history, setHistory] = useState<PracticeResult | null>(null);
  const options = {
    topicIds: topics,
    includeOutside: outside,
    onlyReady: ready,
  };
  const pool = eligibleProofs(practice.items, options);
  function generate() {
    try {
      const next = generateProofTicket(practice.items, count, options);
      setTicket(next);
      setMessage("");
      setFinished(false);
      setRatings({});
      setStored(false);
      setHistory(null);
      setRun(crypto.randomUUID());
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function complete() {
    const result = {
      id: run,
      date: new Date().toISOString(),
      itemIds: ticket.map((q) => q.id),
      ratings,
    };
    save({
      ...data,
      progress: { ...data.progress, ...ratings },
      results: [result, ...data.results],
    });
    setStored(true);
  }
  return (
    <div className="proof-ticket">
      <div className="page-kicker">ТРЕНИРОВОЧНЫЙ РЕЖИМ</div>
      <h1>Билет на доказательство</h1>
      <p className="subtitle">
        Лекционные доказательства и подходящие задачи. Сначала условие, затем
        идея и решение — по вашему запросу.
      </p>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <div className="notice neutral">
        Это тренировочный билет, а не копия экзаменационного. Официальная
        программа описывает 3 определения и 3 доказательства с задачами; здесь
        вы задаёте состав самостоятельно. Конкретные задания не гарантированы на
        коллоквиуме. Необязательные классные ★ никогда не участвуют.
      </div>
      {ticket.length === 0 && !history ? (
        <div className="ticket-setup">
          <h2>Что будем доказывать?</h2>
          <div className="check-topics">
            {practice.topics.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={topics.includes(t.id)}
                  onChange={(e) =>
                    setTopics(
                      e.target.checked
                        ? [...topics, t.id]
                        : topics.filter((id) => id !== t.id),
                    )
                  }
                />
                <span>
                  {t.title}
                  <small>
                    {
                      eligibleProofs(practice.items, {
                        ...options,
                        topicIds: [t.id],
                      }).length
                    }{" "}
                    подходящих материалов
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="scope-toggles stacked">
            <label>
              <input
                type="checkbox"
                checked={outside}
                onChange={(e) => setOutside(e.target.checked)}
              />
              Разрешить материалы вне программы № 1 (также выберите тему)
            </label>
            <label>
              <input
                type="checkbox"
                checked={ready}
                onChange={(e) => setReady(e.target.checked)}
              />
              Только с готовым разбором или доказательством в конспекте
            </label>
          </div>
          <label className="count-label">
            Количество вопросов
            <input
              type="number"
              min="1"
              value={Number.isNaN(count) ? "" : count}
              aria-label="Количество доказательств"
              onChange={(e) =>
                setCount(e.target.value === "" ? NaN : Number(e.target.value))
              }
            />
          </label>
          <p className="muted">
            Доступно: {pool.length}. Неоднозначные условия, помеченные для
            уточнения, не участвуют.
          </p>
          {message && (
            <p className="error" role="alert">
              {message}
            </p>
          )}
          <button className="primary" onClick={generate}>
            Собрать тренировочный билет <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="ticket-bar">
            <h2>
              {history
                ? "Сохранённый билет"
                : finished
                  ? "Самопроверка"
                  : "Ваш тренировочный билет"}
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
          {history ? (
            <>
              {history.itemIds.map((id, i) => {
                const q = practice.items.find((v) => v.id === id);
                return q ? (
                  <TicketQuestion
                    key={history.id + id}
                    q={q}
                    index={i}
                    rating={history.ratings[id]}
                    onRate={() => {}}
                    completed
                    locked
                  />
                ) : (
                  <div className="notice" key={id}>
                    Материал {id} отсутствует в текущей базе. История сохранена.
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {ticket.map((q, i) => (
                <TicketQuestion
                  key={run + q.id}
                  q={q}
                  index={i}
                  rating={ratings[q.id]}
                  onRate={(s) => setRatings({ ...ratings, [q.id]: s })}
                  completed={finished}
                  locked={stored}
                />
              ))}
              {!finished ? (
                <button className="primary" onClick={() => setFinished(true)}>
                  Завершить ответ и перейти к самооценке <Check size={17} />
                </button>
              ) : stored ? (
                <div role="status" className="success">
                  <Check size={17} />
                  Билет сохранён. Отметки и повторение обновлены.
                </div>
              ) : (
                <>
                  <p className="muted">
                    Оценено {Object.keys(ratings).length} из {ticket.length}.
                    Открытие решения не считается знанием.
                  </p>
                  <button
                    className="primary"
                    disabled={Object.keys(ratings).length !== ticket.length}
                    onClick={complete}
                  >
                    Сохранить самооценку билета <Check size={16} />
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      {data.results.length > 0 && (
        <section className="practice-history">
          <div className="section-title">
            <h2>
              История тренировок <span>{data.results.length}</span>
            </h2>
          </div>
          {data.results.map((r) => (
            <button
              className="history-row"
              key={r.id}
              onClick={() => {
                setHistory(r);
                window.scrollTo(0, 0);
              }}
            >
              <span className="stat-icon green">
                <Ticket size={20} />
              </span>
              <div>
                <strong>На доказательство · {r.itemIds.length} вопросов</strong>
                <small>
                  {new Date(r.date).toLocaleString("ru-RU")} · Самостоятельно:{" "}
                  {
                    Object.values(r.ratings).filter((v) => v === "independent")
                      .length
                  }
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
export function PracticeProgress() {
  const { data, error } = usePractice();
  const count = (s: StudyStatus) =>
    practice.items.filter((q) => (data.progress[q.id] ?? "unseen") === s)
      .length;
  return (
    <section className="practice-progress-summary">
      <div className="section-title">
        <h2>Задачи и доказательства</h2>
        <BookOpen size={20} />
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="practice-progress-counts">
        {Object.entries(statusLabels).map(([s, n]) => (
          <div key={s}>
            <strong>{count(s as StudyStatus)}</strong>
            <span>{n}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        {practice.items.length} карточек · {data.results.length} сохранённых
        тренировок. У основного курса и задач отдельные отметки: знание
        формулировки не означает умения доказать её.
      </p>
    </section>
  );
}
