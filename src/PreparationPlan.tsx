import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  Lightbulb,
  Map,
  MessageCircle,
  PencilLine,
  Route,
  ShieldCheck,
} from "lucide-react";
import { MathText } from "./RichText";
import course from "./data/course.json";
import { practice, sourceText } from "./practice-model";
import {
  preparationPlan,
  planStorageKey,
  emptyPlan,
  loadPlan,
  planProgress,
  firstUnfinished,
  type PlanTarget,
  type PlanItemKind,
} from "./plan-model";
const groups: { kind: PlanItemKind; title: string; icon: typeof BookOpen }[] = [
  { kind: "learn", title: "Что изучить", icon: BookOpen },
  { kind: "proof", title: "Какие доказательства разобрать", icon: ShieldCheck },
  { kind: "class", title: "Классные задачи", icon: PencilLine },
  { kind: "homework", title: "Домашние задания", icon: GraduationCap },
  {
    kind: "mastery",
    title: "Могу объяснить самостоятельно",
    icon: MessageCircle,
  },
];
function materialLabel(target: PlanTarget) {
  if (target.kind === "theory") {
    const q = course.questions.find((q) => q.id === target.id);
    return {
      label: `Пункт ${q?.number ?? target.id}`,
      title: q?.title ?? "Материал не найден",
    };
  }
  const q = practice.items.find((q) => q.id === target.id);
  return {
    label: q?.number ?? target.id,
    title: q ? sourceText(q) : "Материал не найден",
  };
}
export function PreparationPlan({
  onOpen,
  initialFocusId,
}: {
  onOpen: (target: PlanTarget, itemId: string) => void;
  initialFocusId?: string;
}) {
  const [initial] = useState(() => {
    try {
      return { data: loadPlan(), error: "" };
    } catch {
      return {
        data: emptyPlan,
        error:
          "Не удалось прочитать отметки плана. Новая отметка заменит повреждённые данные плана; прогресс теории и задач сохранится.",
      };
    }
  });
  const [saved, setSaved] = useState(initial.data),
    [error, setError] = useState(initial.error);
  const [expanded, setExpanded] = useState(
    () =>
      new Set([
        preparationPlan.stages.find((s) =>
          s.items.some((i) => i.id === initialFocusId),
        )?.id ??
          firstUnfinished(initial.data.done)?.stage.id ??
          preparationPlan.stages[0].id,
      ]),
  );
  const [focus, setFocus] = useState({
    id: initialFocusId ?? "",
    kind: "item" as "item" | "stage",
    request: 0,
  });
  const progress = planProgress(saved.done),
    next = firstUnfinished(saved.done);
  useEffect(() => {
    if (!focus.id) return;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById(
        `${focus.kind === "item" ? "plan-check-" : "plan-stage-heading-"}${focus.id}`,
      );
      node?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      node?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);
  function toggleItem(id: string, checked: boolean) {
    const updated = {
      version: 1 as const,
      done: { ...saved.done, [id]: checked },
    };
    setSaved(updated);
    try {
      localStorage.setItem(planStorageKey, JSON.stringify(updated));
      setError("");
    } catch {
      setError(
        "Не удалось сохранить отметки плана: хранилище недоступно или заполнено. Изменения действуют только до перезагрузки.",
      );
    }
  }
  function reveal(stageId: string, itemId?: string) {
    setExpanded((old) => new Set([...old, stageId]));
    setFocus((prev) => ({
      id: itemId ?? stageId,
      kind: itemId ? "item" : "stage",
      request: prev.request + 1,
    }));
  }
  function toggleStage(id: string) {
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <div className="preparation-plan">
      <div className="page-kicker">ПОНЯТИЯ → ДОКАЗАТЕЛЬСТВА → ПРАКТИКА</div>
      <h1>План подготовки</h1>
      <p className="subtitle">
        Не расписание, а последовательный маршрут. Каждый следующий шаг
        опирается на предыдущие.
      </p>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <section className="plan-overview">
        <div className="plan-overview-copy">
          <span className="hero-label">
            <span /> ОТ ОСНОВ К САМОСТОЯТЕЛЬНОМУ ОТВЕТУ
          </span>
          <h2>
            Знать, с чего начать.
            <br />
            <em>Понимать, куда двигаться дальше.</em>
          </h2>
          <p>
            {preparationPlan.stages.length} этапов по программе первого
            коллоквиума. Только существующие материалы; необязательные классные
            задачи со звёздочкой исключены.
          </p>
        </div>
        <div className="plan-overall-progress">
          <span className="plan-percentage">
            {progress.percent}
            <small>%</small>
          </span>
          <strong>
            {progress.completed} из {progress.total} пунктов
          </strong>
          <progress
            aria-label="Прогресс всего плана"
            value={progress.completed}
            max={progress.total}
          />
          <small>Отмечайте выполненное самостоятельно</small>
        </div>
      </section>
      <section
        className={`plan-continue-card ${next ? "" : "all-done"}`}
        aria-label="Следующий шаг"
      >
        <span className="plan-next-icon">
          {next ? <Route size={23} /> : <Check size={23} />}
        </span>
        <div>
          <span className="eyebrow">
            {next ? "ПЕРВЫЙ НЕЗАВЕРШЁННЫЙ ПУНКТ" : "ВСЕ ЭТАПЫ ПРОЙДЕНЫ"}
          </span>
          <strong>
            {next
              ? `${String(preparationPlan.stages.indexOf(next.stage) + 1).padStart(2, "0")} · ${next.stage.title}`
              : "Маршрут завершён"}
          </strong>
          <p>
            {next?.item.label ??
              "Все пункты отмечены. Можно вернуться к любому этапу, снять отметку или проверить себя в тренировочном билете."}
          </p>
        </div>
        <button
          className="primary"
          disabled={!next}
          onClick={() => {
            if (next) reveal(next.stage.id, next.item.id);
          }}
        >
          {next ? "Продолжить" : "План выполнен"}{" "}
          {next ? <ArrowRight size={17} /> : <Check size={17} />}
        </button>
      </section>
      <div className="plan-legend">
        <Lightbulb size={17} />
        <p>
          Галочка отмечает пункт целиком, включая все перечисленные материалы.
          Просмотр материала не ставит галочку и не меняет самооценку знаний.
          «Продолжить» раскрывает и выделяет первый незавершённый пункт.
        </p>
      </div>
      <div className="section-title">
        <h2>
          Ваш маршрут <span>{preparationPlan.stages.length} этапов</span>
        </h2>
        <span className="plan-stage-tally">
          Завершено этапов:{" "}
          {
            preparationPlan.stages.filter((s) =>
              s.items.every((i) => saved.done[i.id]),
            ).length
          }{" "}
          / {preparationPlan.stages.length}
        </span>
      </div>
      <div className="plan-stages">
        {preparationPlan.stages.map((stage, index) => {
          const completed = stage.items.filter((i) => saved.done[i.id]).length;
          const total = stage.items.length;
          const isOpen = expanded.has(stage.id);
          const isDone = completed === total;
          return (
            <section
              key={stage.id}
              className={`plan-stage ${isDone ? "complete" : ""} ${next?.stage.id === stage.id ? "current" : ""}`}
              aria-labelledby={`plan-stage-heading-${stage.id}`}
            >
              <button
                id={`plan-stage-heading-${stage.id}`}
                className="plan-stage-heading"
                aria-expanded={isOpen}
                aria-controls={`plan-stage-body-${stage.id}`}
                onClick={() => toggleStage(stage.id)}
              >
                <span className="plan-stage-index">
                  {isDone ? (
                    <Check size={20} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  <h3>{stage.title}</h3>
                  <p>{stage.summary}</p>
                </div>
                <span className="plan-stage-meter">
                  <span>
                    {completed} / {total}
                  </span>
                  <progress
                    aria-label={`Прогресс этапа ${index + 1}`}
                    value={completed}
                    max={total}
                  />
                </span>
                <ChevronDown size={18} className={isOpen ? "rotated" : ""} />
              </button>
              <div
                id={`plan-stage-body-${stage.id}`}
                hidden={!isOpen}
                className="plan-stage-body"
              >
                {stage.dependsOn.length > 0 && (
                  <div className="plan-dependencies">
                    <Map size={14} />
                    <span>Опора:</span>
                    {stage.dependsOn.map((id) => {
                      const prerequisite = preparationPlan.stages.find(
                        (s) => s.id === id,
                      )!;
                      return (
                        <button key={id} onClick={() => reveal(id)}>
                          {prerequisite.title}
                          {prerequisite.items.every(
                            (i) => saved.done[i.id],
                          ) && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {stage.notes.length > 0 && (
                  <div className="plan-source-notes">
                    {stage.notes.map((note, i) => (
                      <p key={i}>{note}</p>
                    ))}
                  </div>
                )}
                {groups.map(({ kind, title, icon: Icon }) => {
                  const items = stage.items.filter((i) => i.kind === kind);
                  if (items.length === 0) return null;
                  return (
                    <section
                      key={kind}
                      className={`plan-item-group group-${kind}`}
                    >
                      <h4>
                        <Icon size={16} />
                        {title}
                      </h4>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          id={`plan-item-${item.id}`}
                          className={`plan-item ${saved.done[item.id] ? "is-checked" : ""} ${focus.id === item.id ? "is-highlighted" : ""}`}
                        >
                          <input
                            type="checkbox"
                            id={`plan-check-${item.id}`}
                            checked={saved.done[item.id] === true}
                            onChange={(e) =>
                              toggleItem(item.id, e.target.checked)
                            }
                          />
                          <div>
                            <label htmlFor={`plan-check-${item.id}`}>
                              <MathText text={item.label} />
                            </label>
                            <div className="plan-material-links">
                              {item.targets.map((target, i) => {
                                const link = materialLabel(target);
                                return (
                                  <button
                                    key={`${target.kind}-${target.id}-${i}`}
                                    className={`plan-material-link ${target.kind}`}
                                    title={link.title}
                                    aria-label={`Открыть ${target.kind === "theory" ? "пункт программы" : "материал"} ${target.kind === "theory" ? target.id : link.label}`}
                                    onClick={() => onOpen(target, item.id)}
                                  >
                                    {target.kind === "theory" ? (
                                      <BookOpen size={12} />
                                    ) : (
                                      <PencilLine size={12} />
                                    )}
                                    <span>{link.label}</span>
                                    <ArrowRight size={11} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="plan-bottom-note">
        <ShieldCheck size={18} />
        <p>
          Статусы теории и доказательств остаются независимыми от плана. Номера
          источников сохранены. Материалы вне программы и остальные задачи
          доступны в библиотеке, но не добавлены к этому маршруту.
        </p>
      </div>
    </div>
  );
}
