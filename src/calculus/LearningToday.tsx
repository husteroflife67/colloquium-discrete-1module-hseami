import { useEffect, useRef, useState } from "react";
import type { Item } from "./content/types";
import type { Rating } from "./engine";
import { MathText } from "./MathText";
import { dueItems, scheduleReview } from "./repetition";
import type { ReviewSchedule } from "./repetition";

type Props = {
  items: Item[];
  schedules: Record<string, ReviewSchedule>;
  onReview: (id: string, rating: Rating) => void;
  onOpen: (item: Item) => void;
};
const labels: Record<Rating, string> = {
  unknown: "Не знаю",
  partial: "Частично",
  known: "Знаю",
  repeat: "Повторить",
};
const kindLabels = {
  definition: "Устный вопрос",
  theory: "Теория и доказательство",
  practice: "Задача",
};
function intervalLabel(days: number) {
  return days < 1
    ? "через 10 минут"
    : days === 1
      ? "через сутки"
      : `через ${days} суток`;
}
function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LearningToday({ items, schedules, onReview, onOpen }: Props) {
  const [now, setNow] = useState(Date.now);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [sessionCount, setSessionCount] = useState(0);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const queue = dueItems(items, schedules, now);
  const active = queue.find((item) => !skipped.has(item.id));
  const activeId = active?.id;
  const revealed = !!active && revealedId === active.id;
  useEffect(() => {
    setRevealedId(null);
    heading.current?.focus();
  }, [activeId]);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = Object.values(schedules).filter(
    (schedule) =>
      schedule.lastReviewed >= startOfDay.getTime() &&
      schedule.lastReviewed <= Date.now(),
  ).length;
  const scheduledDue = queue.filter((item) => schedules[item.id]).length;
  const unseen = queue.length - scheduledDue;
  const upcoming = items
    .filter((item) => schedules[item.id]?.due > now)
    .sort((a, b) => schedules[a.id].due - schedules[b.id].due);

  function rate(rating: Rating) {
    if (!active || !revealed) return;
    const reviewTime = Date.now();
    const next = scheduleReview(schedules[active.id], rating, reviewTime);
    onReview(active.id, rating);
    setSessionCount((n) => n + 1);
    setLastAction(
      `${labels[rating]}. Следующее повторение: ${dateLabel(next.due)}.`,
    );
    setRevealedId(null);
    setNow(reviewTime);
  }

  return (
    <div className="learning-today">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">РАСПРЕДЕЛЁННАЯ ПРАКТИКА</span>
            <h2>Учить сегодня</h2>
          </div>
          <span className="status-pill">Оценено за сеанс: {sessionCount}</span>
        </div>
        <p>
          К повторению сейчас: <strong>{scheduledDue}</strong>. Новых
          материалов: {unseen}. Карточек оценено сегодня: {todayCount} (по
          времени устройства).
        </p>
        <p className="muted">
          Сначала идут просроченные карточки, затем определения официального
          списка в порядке курса, обязательные доказательства и задачи. Открытие
          ответа не означает освоение.
        </p>
        <details>
          <summary>Как назначается следующее повторение</summary>
          <p>
            «Знаю» после самостоятельного воспроизведения: через 1, 3, 7, 14,
            затем 30 суток при последовательных успешных ответах. «Не знаю» —
            через 10 минут, «Частично» и «Повторить» — через сутки; эти три
            оценки сбрасывают серию успешных ответов. Интервалы отсчитываются от
            момента оценки, сутки — это 24 часа. Это прозрачный учебный
            алгоритм, а не оценка преподавателя.
          </p>
          <p>
            Дополнительные определения и факты без обязательного доказательства
            сами не добавляются в новую очередь. Если вы уже назначили им
            повторение, оно сохраняется.
          </p>
        </details>
      </section>
      <p role="status" aria-live="polite" className="muted">
        {lastAction}
      </p>
      {active ? (
        <section className="panel" aria-label="Карточка повторения">
          <div className="section-heading">
            <span className="eyebrow">
              {kindLabels[active.kind]} · тема {active.topic}
            </span>
            <span className="status-pill">
              {schedules[active.id] ? "Пора повторить" : "Новый материал"}
            </span>
          </div>
          <h2 ref={heading} tabIndex={-1}>
            <MathText
              text={`${active.definitionNumber !== undefined ? active.definitionNumber + ". " : ""}${active.title}`}
            />
          </h2>
          <p>
            {active.kind === "definition"
              ? "Произнесите определение или формулировку теоремы с условиями, затем сравните с ответом."
              : active.kind === "theory"
                ? "Прочитайте утверждение и воспроизведите доказательство до открытия ответа."
                : "Решите задачу самостоятельно, затем откройте решение для сверки."}
          </p>
          {active.officialPrompt && (
            <p>
              <MathText text={active.officialPrompt} />
            </p>
          )}
          {active.kind !== "definition" && (
            <p>
              <MathText text={active.statement} />
            </p>
          )}
          {!revealed ? (
            <button
              className="primary"
              onClick={() => setRevealedId(active.id)}
            >
              {active.kind === "definition"
                ? "Вспомнил — открыть ответ"
                : active.kind === "theory"
                  ? "Доказал — сверить"
                  : "Решил — сверить"}
            </button>
          ) : (
            <div>
              {active.kind === "definition" && (
                <p>
                  <MathText text={active.statement} />
                </p>
              )}
              {active.proof.length > 0 && (
                <details>
                  <summary>
                    {active.kind === "practice"
                      ? "Решение для сверки"
                      : "Доказательство для сверки"}
                  </summary>
                  {active.origin === "generated" && (
                    <p className="muted">
                      Доказательство или решение составлено ИИ по материалам
                      курса.
                    </p>
                  )}
                  <ol>
                    {active.proof.map((step, index) => (
                      <li key={index}>
                        <MathText text={step} />
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <p className="muted">
                Оцените именно самостоятельное воспроизведение до открытия
                ответа.
              </p>
              <div className="ratings" aria-label="Самооценка воспроизведения">
                {(["unknown", "partial", "known", "repeat"] as Rating[]).map(
                  (rating) => (
                    <button key={rating} onClick={() => rate(rating)}>
                      {labels[rating]} ·{" "}
                      {intervalLabel(
                        scheduleReview(schedules[active.id], rating, now)
                          .intervalDays,
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          <div className="topic-links">
            <button onClick={() => onOpen(active)}>
              Открыть материал целиком
            </button>
            <button
              onClick={() => {
                setSkipped((previous) => new Set(previous).add(active.id));
                setLastAction(
                  "Карточка пропущена только в этом сеансе; её оценка и срок не изменились.",
                );
              }}
            >
              Пропустить сейчас
            </button>
          </div>
        </section>
      ) : (
        <section className="panel empty">
          <h2>
            {skipped.size > 0 && queue.length > 0
              ? "Остались пропущенные карточки"
              : "На сейчас очередь пройдена"}
          </h2>
          <p>
            {skipped.size > 0 && queue.length > 0
              ? "Пропуск не меняет расписание и не засчитывается как освоение. Можно вернуться к карточкам сейчас."
              : upcoming.length > 0
                ? `Ближайшее повторение: ${dateLabel(schedules[upcoming[0].id].due)}.`
                : "Карточек к повторению пока нет. Оцените материал в библиотеке, чтобы назначить повторение."}
          </p>
          {skipped.size > 0 && queue.length > 0 && (
            <button className="primary" onClick={() => setSkipped(new Set())}>
              Вернуть пропущенные
            </button>
          )}
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="panel">
          <button
            aria-expanded={showUpcoming}
            onClick={() => setShowUpcoming((shown) => !shown)}
          >
            {showUpcoming ? "Скрыть" : "Показать"} ближайшие повторения (
            {upcoming.length})
          </button>
          {showUpcoming && (
            <ul>
              {upcoming.slice(0, 10).map((item) => (
                <li key={item.id}>
                  <button onClick={() => onOpen(item)}>
                    <MathText text={item.title} />
                  </button>
                  {" — "}
                  {dateLabel(schedules[item.id].due)}
                </li>
              ))}
            </ul>
          )}
          {showUpcoming && upcoming.length > 10 && (
            <p className="muted">Показаны ближайшие 10 карточек.</p>
          )}
        </section>
      )}
    </div>
  );
}
