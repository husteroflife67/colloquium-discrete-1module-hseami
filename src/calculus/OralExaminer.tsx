import { useEffect, useRef, useState } from "react";
import { topics } from "./content";
import type { Item, OralQuestion } from "./content/types";
import type { Rating } from "./engine";
import { MathText } from "./MathText";
import { oralRatingLabels, oralSummary, selectOralQuestions } from "./oral";

type Props = {
  items: Item[];
  onRateQuestion: (id: string, rating: Rating) => void;
  questionRatings: Record<string, Rating>;
  drafts: Record<string, string>;
  onDraft: (id: string, text: string) => void;
};
type Stage = "select" | "initial" | "questions" | "summary";
const originLabels = {
  source: "Материал источника",
  generated: "Авторский учебный материал",
  external: "Внешний источник",
};
const reviewLabels = {
  unchecked: "Ещё не проверено",
  self_reviewed: "Проверено при подготовке",
  needs_review: "Требует проверки",
};

export function OralExaminer({
  items,
  onRateQuestion,
  questionRatings,
  drafts,
  onDraft,
}: Props) {
  const bases = items.filter(
    (item) =>
      (item.kind === "theory" && item.required) ||
      (item.kind === "definition" && item.definitionNumber !== undefined),
  );
  const initialTopic = bases[0]?.topic ?? topics[0].id;
  const [topic, setTopic] = useState(initialTopic);
  const [baseId, setBaseId] = useState(
    bases.find((i) => i.topic === initialTopic)?.id ?? "",
  );
  const [stage, setStage] = useState<Stage>("select");
  const [conversation, setConversation] = useState<OralQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionRatings, setSessionRatings] = useState<Record<string, Rating>>(
    {},
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const base = bases.find((i) => i.id === baseId);
  const question = conversation[step];
  const result = oralSummary(conversation, sessionRatings);
  const selection = bases.filter((i) => i.topic === topic);
  const available = base ? selectOralQuestions(base, items) : [];

  useEffect(() => {
    if (stage !== "select") headingRef.current?.focus();
  }, [stage, step]);

  function start() {
    if (!base || available.length < 3) return;
    setConversation(available);
    setSessionRatings({});
    setStep(0);
    setShowAnswer(false);
    setShowHint(false);
    setStage("initial");
  }
  function next() {
    if (!question || !sessionRatings[question.id]) return;
    if (step + 1 >= conversation.length) {
      setStage("summary");
    } else {
      setStep((n) => n + 1);
      setShowHint(false);
      setShowAnswer(false);
    }
  }
  function rate(rating: Rating) {
    if (!question || !showAnswer) return;
    onRateQuestion(question.id, rating);
    setSessionRatings((old) => ({ ...old, [question.id]: rating }));
  }
  function provenance(item: Item | OralQuestion) {
    return (
      <p className="muted">
        <small>
          {originLabels[item.origin]} · {reviewLabels[item.review]}
          <br />
          {item.source}
        </small>
      </p>
    );
  }

  return (
    <section className="oral-examiner" aria-label="Устный экзаменатор">
      <div className="panel">
        <p className="eyebrow">Тренировка ответа у доски</p>
        <h2>Устная беседа</h2>
        <p>
          Сначала сформулируйте определение или докажите факт, затем ответьте на
          связанные уточнения. Можно отвечать вслух или вести черновик.
        </p>
        <p className="muted">
          Это авторская учебная беседа, а не официальный список преподавателя.
          Ответы оцениваете вы сами: приложение не распознаёт речь и не
          проверяет произвольное доказательство. Самооценки не добавляют баллы к
          билету.
        </p>
      </div>

      {stage === "select" && (
        <div className="panel">
          <h3>Выберите, что будете отвечать</h3>
          <label className="field-label">
            Тема
            <select
              aria-label="Тема беседы"
              value={topic}
              onChange={(event) => {
                const nextTopic = Number(event.target.value);
                setTopic(nextTopic);
                setBaseId(bases.find((i) => i.topic === nextTopic)?.id ?? "");
              }}
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Определение или факт программы
            <select
              aria-label="Основа беседы"
              value={baseId}
              onChange={(event) => setBaseId(event.target.value)}
            >
              {selection.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.kind === "definition"
                    ? `Устный вопрос ${i.definitionNumber} · `
                    : "Доказательство · "}
                  {i.title}
                </option>
              ))}
            </select>
          </label>
          {base && (
            <>
              {provenance(base)}
              <p>
                {available.length} связанных уточнений. Каждый вопрос
                открывается отдельно; строгий ответ — только по вашему запросу.
              </p>
            </>
          )}
          {available.length < 3 && (
            <p role="status">
              В этой теме пока недостаточно связанных уточнений. Выберите другой
              факт или тему.
            </p>
          )}
          <button
            className="primary"
            disabled={!base || available.length < 3}
            onClick={start}
          >
            Начать беседу
          </button>
        </div>
      )}

      {base && stage === "initial" && (
        <div className="panel">
          <p className="eyebrow">Основной ответ</p>
          <h3 ref={headingRef} tabIndex={-1}>
            {base.title}
          </h3>
          {base.officialPrompt && (
            <p>
              <MathText text={base.officialPrompt} />
            </p>
          )}
          <p>
            {base.kind === "definition"
              ? "Дайте определение или полную формулировку утверждения. Укажите условия и кванторы, приведите пример."
              : "Сформулируйте утверждение, перечислите условия и докажите его. Объясняйте, почему применим каждый используемый результат."}
          </p>
          {provenance(base)}
          <label className="field-label">
            Ваш черновик
            <textarea
              value={drafts[base.id] ?? ""}
              onChange={(event) => onDraft(base.id, event.target.value)}
              rows={6}
              placeholder="Запишите ход ответа или отвечайте вслух. Черновик сохраняется автоматически."
            />
          </label>
          <div className="ratings">
            <button
              className="secondary"
              onClick={() => setShowHint((v) => !v)}
              aria-expanded={showHint}
            >
              {showHint ? "Скрыть идею" : "Подсказка: идея ответа"}
            </button>
            <button
              className="secondary"
              onClick={() => setShowAnswer((v) => !v)}
              aria-expanded={showAnswer}
            >
              {showAnswer ? "Скрыть образец" : "Открыть образец ответа"}
            </button>
          </div>
          {showHint && (
            <div className="question">
              <MathText
                text={
                  base.idea ||
                  "Начните с точной формулировки и проверьте все условия."
                }
              />
            </div>
          )}
          {showAnswer && (
            <div className="question">
              <h3>Формулировка</h3>
              <MathText text={base.statement} />
              {base.kind === "theory" && (
                <>
                  <h3>Доказательство</h3>
                  {base.origin === "generated" && (
                    <p className="muted">
                      Доказательство составлено ИИ по формулировке курса.
                    </p>
                  )}
                  {base.proof.map((part, index) => (
                    <div key={index}>
                      <MathText text={part} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          <div className="ratings">
            <button
              className="primary"
              onClick={() => {
                setShowHint(false);
                setShowAnswer(false);
                setStage("questions");
              }}
            >
              Я закончил основной ответ → к уточнениям
            </button>
            <button className="secondary" onClick={() => setStage("summary")}>
              Завершить досрочно
            </button>
          </div>
        </div>
      )}

      {base && stage === "questions" && question && (
        <div className="panel">
          <p className="eyebrow">
            Уточнение {step + 1} из {conversation.length} ·{" "}
            {question.difficulty}
          </p>
          <h3 ref={headingRef} tabIndex={-1}>
            Вопрос принимающего
          </h3>
          <MathText text={question.prompt} />
          {provenance(question)}
          {questionRatings[question.id] && (
            <p className="muted">
              <small>
                Ранее: {oralRatingLabels[questionRatings[question.id]]}. Для
                этой беседы оцените ответ заново.
              </small>
            </p>
          )}
          <div className="ratings">
            <button
              className="secondary"
              aria-expanded={showHint}
              onClick={() => setShowHint((v) => !v)}
            >
              {showHint ? "Скрыть подсказку" : "Подсказка"}
            </button>
            <button
              className="secondary"
              aria-expanded={showAnswer}
              onClick={() => setShowAnswer((v) => !v)}
            >
              {showAnswer ? "Скрыть ответ" : "Открыть строгий ответ"}
            </button>
          </div>
          {showHint && (
            <div className="question">
              <h3>Подсказка</h3>
              <MathText text={question.hint} />
            </div>
          )}
          {showAnswer && (
            <div className="question">
              <h3>Строгий ответ</h3>
              <MathText text={question.answer} />
              <h3>Достаточно для устного ответа</h3>
              <MathText text={question.criteria} />
              <h3>Типичная ошибка</h3>
              <MathText text={question.mistake} />
              <p className="muted">
                <small>{question.review_notes}</small>
              </p>
              <div
                className="ratings"
                role="group"
                aria-label="Самооценка текущего ответа"
              >
                {(Object.keys(oralRatingLabels) as Rating[]).map((rating) => (
                  <button
                    key={rating}
                    aria-pressed={sessionRatings[question.id] === rating}
                    className={
                      sessionRatings[question.id] === rating ? "active" : ""
                    }
                    onClick={() => rate(rating)}
                  >
                    {oralRatingLabels[rating]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ratings">
            <button
              className="primary"
              disabled={!sessionRatings[question.id]}
              onClick={next}
            >
              {step + 1 === conversation.length
                ? "Итоги беседы"
                : "Следующий вопрос"}
            </button>
            <button className="secondary" onClick={() => setStage("summary")}>
              Завершить досрочно
            </button>
          </div>
          {!sessionRatings[question.id] && (
            <p className="muted">
              <small>
                Ответьте, откройте образец и выберите самооценку, чтобы
                продолжить.
              </small>
            </p>
          )}
        </div>
      )}

      {stage === "summary" && (
        <div className="panel">
          <h3 ref={headingRef} tabIndex={-1}>
            Итоги этой беседы
          </h3>
          <p>{base?.title}</p>
          <p>
            Оценено уточнений: {result.answered} из {result.total}. Неотвеченные
            вопросы не считаются освоенными.
          </p>
          <ul>
            {(Object.keys(oralRatingLabels) as Rating[]).map((rating) => (
              <li key={rating}>
                {oralRatingLabels[rating]}: {result.counts[rating]}
              </li>
            ))}
          </ul>
          {result.entries.length > 0 && (
            <>
              <h3>Ваши ответы</h3>
              {result.entries.map(({ question: q, rating }) => (
                <div className="question" key={q.id}>
                  <MathText text={q.prompt} />
                  <p>
                    <strong>{oralRatingLabels[rating]}</strong>
                  </p>
                </div>
              ))}
            </>
          )}
          <p className="muted">
            Уточнения сохранены в общем прогрессе по вопросам. Это ваши
            самооценки, а не подтверждённая проверка знаний; балл из 8 здесь не
            рассчитывается. Черновик основного ответа сохранён вместе с
            выбранным материалом.
          </p>
          <div className="ratings">
            <button className="primary" onClick={start}>
              Повторить эту беседу
            </button>
            <button className="secondary" onClick={() => setStage("select")}>
              Выбрать другую тему или факт
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
