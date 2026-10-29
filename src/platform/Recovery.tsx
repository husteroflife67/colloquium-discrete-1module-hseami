import { useState } from "react";
import { ArrowRight, ArrowUpRight, RotateCcw, Check, Lightbulb, Eye, Target, Flag, CheckCircle2 } from "lucide-react";
import { CourseTools } from "./course-tools";
import { courses, materialKey, materialLink, type CourseId } from "./catalog";
import { recoveryQueue, type JournalEntry } from "./journal";
import { studyContent, materialByKey } from "./study-content";
import { readRecoveryState, saveRecovery } from "./recovery-storage";
import { readPlatform, type RecoveryRating } from "./platform-state";
import { MathText } from "../calculus/MathText";
import { MaterialActions } from "./MaterialActions";
type Run = { id: string; started: string; queue: JournalEntry[]; index: number };
const runKey = "colloquium-recovery-run-v1";
function loadRun(): Run | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(runKey) ?? "null");
    if (!r || typeof r.id !== "string" || !Number.isFinite(Date.parse(r.started)) || !Number.isInteger(r.index) || !Array.isArray(r.queue) || !r.queue.length || r.queue.length > 10 || r.index < 0 || r.index > r.queue.length || new Set(r.queue.map((j: JournalEntry) => materialKey(j.material))).size !== r.queue.length) return null;
    for (const j of r.queue) if (!j?.material || !materialByKey.has(materialKey(j.material)) || typeof j.ticketId !== "string" || !Number.isFinite(Date.parse(j.date))) return null;
    return { ...r, queue: r.queue.map((j: JournalEntry) => ({ ...j, material: materialByKey.get(materialKey(j.material))! })) };
  } catch { return null; }
}
export default function Recovery() {
  const [state, setState] = useState(() => { try { return { ...readRecoveryState(), error: "" }; } catch { return { journal: [], platform: { version: 1 as const, bookmarks: [] }, error: "Не удалось прочитать прогресс. Исходные записи сохранены; восстановите резервную копию." }; } });
  const [run, setRun] = useState<Run | null>(loadRun);
  const [course, setCourse] = useState<"all" | CourseId>(() => { const value = new URLSearchParams(location.hash.split("?")[1] ?? "").get("course"); return value === "discrete" || value === "calculus" ? value : "all"; });
  const [count, setCount] = useState(5);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false), [answer, setAnswer] = useState(false), [draft, setDraft] = useState("");
  const pool = recoveryQueue(state.journal, state.platform).filter(j => course === "all" || j.material.course === course);
  const current = run?.queue[run.index];
  const content = current ? studyContent(current.material) : null;
  const results = state.platform.sessions?.find(s => s.id === run?.id)?.entries ?? [];
  const alreadyRated = current && results.find(e => e.materialKey === materialKey(current.material));
  function updateRun(next: Run | null) {
    try { next ? sessionStorage.setItem(runKey, JSON.stringify(next)) : sessionStorage.removeItem(runKey); }
    catch { setError("Сеанс не удаётся сохранить после перезагрузки. Оценки сохраняются отдельно; продолжайте в этой вкладке."); }
    setRun(next); setHint(false); setAnswer(false); setDraft("");
  }
  function start() {
    try {
      const fresh = readRecoveryState(); setState({ ...fresh, error: "" });
      const queue = recoveryQueue(fresh.journal, fresh.platform).filter(j => course === "all" || j.material.course === course).slice(0, count);
      if (!queue.length) { setError("В этой подборке нет неразобранных затруднений."); return; }
      setError(""); updateRun({ id: crypto.randomUUID(), started: new Date().toISOString(), queue, index: 0 });
    } catch { setError("Не удалось прочитать прогресс. Текущие данные не изменены."); }
  }
  function rate(rating: RecoveryRating) {
    if (!run || !current || !answer || alreadyRated) return;
    try {
      saveRecovery(run, current.material, current.ticketId, rating);
      setState(old => ({ ...old, platform: readPlatform() })); setError("");
    } catch { setError("Не удалось сохранить оценку. Освободите место в браузере и попробуйте снова; следующий материал пока не открыт."); }
  }
  return <><CourseTools /><main className="platform-page recovery-page">
    <div className="study-page-heading"><span className="platform-overline">СЛОЖНОЕ СТАНОВИТСЯ ЗНАКОМЫМ</span><h1>Разобрать <span>сложное.</span></h1><p>Короткая тренировка по твоим затруднениям. Сначала вспомни сам, затем сверь ответ и оцени результат.</p></div>
    {(error || state.error) && <p role="alert" className="platform-status">{error || state.error}</p>}
    {!run ? <section className="recovery-setup"><div className="recovery-orbit" aria-hidden="true"><Target size={50} /><span>↗</span></div><div><span className="platform-overline">ОТ ОШИБКИ К ПОНИМАНИЮ</span><h2>{pool.length ? `${pool.length} материалов ждут нового подхода` : state.journal.length ? "В этой подборке всё разобрано" : "Начни с пробного билета"}</h2><p>Подборка собирается из низких самооценок завершённых билетов. Один материал встречается в сеансе один раз.</p><div className="study-search-filters"><select aria-label="Курс тренировки" value={course} onChange={e => setCourse(e.target.value as typeof course)}><option value="all">Оба курса</option><option value="discrete">Дискретная математика</option><option value="calculus">Матанализ</option></select><select aria-label="Длина тренировки" value={count} onChange={e => setCount(Number(e.target.value))}><option value={3}>До 3 материалов</option><option value={5}>До 5 материалов</option><option value={10}>До 10 материалов</option></select></div><button className="study-solid-button" disabled={!pool.length || !!state.error} onClick={start}>Начать тренировку <ArrowRight size={18} /></button><a href="#/mistakes">Открыть журнал ошибок <ArrowUpRight size={14} /></a>{!pool.length && <div className="recovery-empty-links"><a href="#/discrete/ticket">Билет по дискретной математике <ArrowUpRight size={13} /></a><a href="#/calculus/simulation">Пробный коллоквиум по матанализу <ArrowUpRight size={13} /></a></div>}</div></section> : current && content ? <>
      <div className="recovery-session-bar"><span>Материал {run.index + 1} из {run.queue.length}</span><span>{courses[current.material.course].title}</span><button onClick={() => updateRun({ ...run, index: run.queue.length })}>Завершить сеанс</button></div>
      <div className="recovery-session-track" role="progressbar" aria-label="Пройдено в тренировке" aria-valuemin={0} aria-valuemax={run.queue.length} aria-valuenow={results.length}><i style={{ width: `${results.length / run.queue.length * 100}%` }} /></div>
      <article className="recovery-card" key={materialKey(current.material)}><span className="platform-overline">{content.topic}</span><h2><MathText text={current.material.title} /></h2><div className="recovery-prompt"><MathText text={content.prompt} /></div><label>Попробуй ответить самостоятельно<textarea aria-label="Мой ответ в тренировке" value={draft} onChange={e => setDraft(e.target.value)} rows={4} placeholder="Вспомни условия, формулировку и основные шаги. Черновик не сохраняется после перезагрузки." /></label><div className="recovery-reveal"><button onClick={() => setHint(!hint)}><Lightbulb size={17} />{hint ? "Скрыть подсказку" : "Нужна подсказка"}</button><button onClick={() => setAnswer(!answer)}><Eye size={17} />{answer ? "Скрыть разбор" : "Сверить с разбором"}</button><a href={materialLink(current.material)}>Открыть материал <ArrowUpRight size={14} /></a></div>
        {hint && <div className="recovery-hint"><MathText text={content.hint || "Проверь определения и все условия в исходной формулировке."} /></div>}
        {answer && <div className="recovery-answer"><span className="platform-overline">ОБРАЗЕЦ ДЛЯ САМОПРОВЕРКИ</span>{content.answer.map((text, n) => <p key={n}><MathText text={text} /></p>)}{content.example.length > 0 && <details><summary>Примеры и пояснения</summary>{content.example.map((text, n) => <p key={n}><MathText text={text} /></p>)}</details>}<small>{content.note}</small>{content.source && <a href={`${import.meta.env.BASE_URL}${content.source.path.replace(/^\//, "")}`} target="_blank" rel="noreferrer">{content.source.title} <ArrowUpRight size={14} /></a>}</div>}
        <MaterialActions material={current.material} />
        <div className="recovery-assessment"><h3>{alreadyRated ? "Новая оценка сохранена" : "Как получилось на этот раз?"}</h3><p>Самооценка обновит текущую карточку. Старые баллы и история билетов сохранятся.</p>{alreadyRated ? <><span className={`recovery-rating recovery-rating-${alreadyRated.rating}`}>{alreadyRated.rating === "understood" ? <CheckCircle2 size={17} /> : <RotateCcw size={17} />}{alreadyRated.rating === "understood" ? "Разобрался" : "Нужно ещё повторить"}</span><button className="study-solid-button" onClick={() => updateRun({ ...run, index: run.index + 1 })}>Дальше <ArrowRight size={17} /></button></> : <><button disabled={!answer} onClick={() => rate("again")}><RotateCcw size={16} />Нужно ещё повторить</button><button className="study-solid-button" disabled={!answer} onClick={() => rate("understood")}><Check size={17} />Разобрался</button>{!answer && <small>Сначала открой разбор и сравни свой ответ.</small>}</>}</div>
      </article>
    </> : <section className="recovery-summary"><span className="recovery-summary-icon"><Flag size={34} /></span><span className="platform-overline">ЕЩЁ ОДИН ШАГ СДЕЛАН</span><h2>Сеанс завершён</h2><p>Оценено {results.length} из {run.queue.length} материалов. Пропущенные материалы остались в подборке.</p><div className="recovery-summary-counts"><div><b>{results.filter(e => e.rating === "understood").length}</b><span>Разобрался</span></div><div><b>{results.filter(e => e.rating === "again").length}</b><span>Вернусь ещё раз</span></div></div><p>История тренировки сохранена на этом устройстве и включена в общий экспорт. Это самооценка, а не автоматическая проверка доказательств.</p><button className="study-solid-button" onClick={() => { updateRun(null); try { setState({ ...readRecoveryState(), error: "" }); } catch { setError("Не удалось обновить подборку."); } }}>К новой подборке <ArrowRight size={17} /></button><a href="#/mistakes">Вернуться к журналу</a></section>}
    {!run && (state.platform.sessions?.length ?? 0) > 0 && <section className="recovery-history"><h2>Последние тренировки</h2>{state.platform.sessions!.slice(0, 5).map(s => <div key={s.id}><time>{new Date(s.started).toLocaleString("ru-RU")}</time><span>{s.entries.filter(e => e.rating === "understood").length} разобрано · {s.entries.filter(e => e.rating === "again").length} повторить</span></div>)}</section>}
  </main></>;
}
