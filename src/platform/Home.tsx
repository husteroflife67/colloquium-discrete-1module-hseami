import { useEffect, useState } from "react";
import { courses, materials, materialKey, materialLink, type CourseId, type Material } from "./catalog";
import { readPlatform, CourseTools, Bookmark } from "./course-tools";
import { exportBackup, parseBackup, prepareImport, commitImport } from "./backup";
import { PlatformSyncSummary } from "../Sync";
import { MathText } from "../calculus/MathText";
import courseData from "../data/course.json";
import { practice as practiceCatalog } from "../practice-model";
import { progressChanged } from "../progress-events";
import { items } from "../calculus/content";
import { dueItems } from "../calculus/repetition";
import { emptyData, validateImport } from "../calculus/engine";
import { readSaved } from "../model";
import { loadPractice } from "../practice-model";
import { loadPlan, planProgress } from "../plan-model";
import { ArrowUpRight, ArrowRight, Bookmark as BookmarkIcon, BookOpen, Layers3, Route, NotebookPen, ShieldCheck, Download, Upload, Sparkles } from "lucide-react";
import { LearningArt } from "./LearningArt";

function ProgressMeter({ value, total, label }: { value: number; total: number; label: string }) {
  const percent = Math.round(value / total * 100);
  return <div className="platform-meter"><div><span>{label}</span><strong>{percent}%</strong></div><div className="platform-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}><i style={{ width: `${percent}%` }} /></div></div>;
}

function readSnapshot() {
  const errors: string[] = [];
  const safe = <T,>(read: () => T, empty: T, label: string) => { try { return read(); } catch { errors.push(label); return empty; } };
  const discrete = safe(readSaved, { version: 1 as const, progress: {}, results: [] }, "теория дискретной математики");
  const practice = safe(loadPractice, { version: 1 as const, progress: {}, results: [] }, "задачи дискретной математики");
  const plan = safe(loadPlan, { version: 1 as const, done: {} }, "план дискретной математики");
  const calculus = safe(() => {
    const raw = localStorage.getItem("predel-v1");
    return raw ? validateImport(JSON.parse(raw), new Set(items.map(i => i.id)), items) : emptyData();
  }, emptyData(), "матанализ");
  const platform = safe(readPlatform, { version: 1 as const, bookmarks: [] }, "закладки");
  return { discrete, practice, plan, calculus, platform, errors };
}
export default function Home({ view }: { view: string }) {
  const [snapshot, refresh] = useState(readSnapshot);
  useEffect(() => {
    const update = () => refresh(readSnapshot());
    for (const event of ["storage", "platform-bookmarks-changed", progressChanged]) window.addEventListener(event, update);
    return () => { for (const event of ["storage", "platform-bookmarks-changed", progressChanged]) window.removeEventListener(event, update); };
  }, []);
  const [notice, setNotice] = useState("");
  const [incoming, setIncoming] = useState<Record<string, unknown> | null>(null);
  const [choice, setChoice] = useState<"local" | "import">("local");
  const [filter, setFilter] = useState<"all" | CourseId>("all");
  const preview = incoming ? prepareImport(incoming, choice) : null;
  const bookmarks = materials.filter(m => snapshot.platform.bookmarks.includes(materialKey(m)));
  const journal: { material: Material; date: string; label: string; ticketId: string }[] = [];
  for (const h of snapshot.discrete.results) for (const id of h.questionIds) if (h.ratings[id] !== "known") {
    const material = materials.find(m => m.course === "discrete" && m.kind === "theory" && m.id === id);
    if (material) journal.push({ material, date: h.date, label: h.ratings[id] === "repeat" ? "Нужно повторить" : "Не помню", ticketId: h.id });
  }
  for (const h of snapshot.practice.results) for (const id of h.itemIds) if (h.ratings[id] !== "independent") {
    const material = materials.find(m => m.course === "discrete" && m.kind === "practice" && m.id === id);
    if (material) journal.push({ material, date: h.date, label: "Пока не доказано самостоятельно", ticketId: h.id });
  }
  for (const h of snapshot.calculus.history) for (const id of h.weak) {
    const material = materials.find(m => m.course === "calculus" && m.id === id);
    if (material) journal.push({ material, date: h.date, label: "Самооценка ниже максимума", ticketId: h.id });
  }
  journal.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const list = view === "bookmarks" ? bookmarks : [];
  const discreteKnown = courseData.questions.filter(q => snapshot.discrete.progress[q.id]?.status === "known").length;
  const practiceKnown = practiceCatalog.items.filter(q => snapshot.practice.progress[q.id] === "independent").length;
  const calculusKnown = items.filter(i => snapshot.calculus.ratings[i.id] === "known").length;
  const reviewDue = dueItems(items, snapshot.calculus.schedules ?? {}, Date.now()).filter(i => snapshot.calculus.schedules?.[i.id]).length;
  const entry = (m: Material) => <><a href={materialLink(m)}><MathText text={m.title} /></a><small>{courses[m.course].title} · {m.kind === "practice" ? "Практика" : m.kind === "definition" ? "Формулировка" : "Теория"}</small></>;
  return <>
    <CourseTools />
    <main className="platform-page">
      <section className={`platform-intro ${view === "home" ? "platform-intro-home" : ""}`}>
        <div className="platform-intro-copy">
          <div className="platform-kicker"><span /><span>{view === "home" ? "МЕСТО, ГДЕ СТАНОВИТСЯ ПОНЯТНО" : "ТВОЁ УЧЕБНОЕ ПРОСТРАНСТВО"}</span></div>
          <h1>{view === "bookmarks" ? "Закладки" : view === "mistakes" ? "Журнал ошибок" : <>Продолжить <span>подготовку</span></>}</h1>
          <p className="platform-lead">{view === "home" ? "От первого «что это?» до уверенного ответа у доски. Два курса, понятный маршрут и твой собственный темп." : view === "bookmarks" ? "Всё, к чему хочется вернуться. Важные определения, непростые доказательства и хорошие идеи." : "Затруднение — тоже точка роста. Вернись к сложному и попробуй ещё раз."}</p>
          {view === "home" && <div className="platform-hero-tags"><span><BookOpen size={15} /> 2 курса</span><span><Layers3 size={15} /> {materials.length} материалов</span><span><Sparkles size={15} /> Учиться понимать</span></div>}
        </div>
        {view === "home" ? <div className="platform-intro-art"><LearningArt /><span className="platform-art-note">Из маленьких шагов<br /><b>складывается понимание.</b></span></div> : <div className="platform-view-symbol" aria-hidden="true">{view === "bookmarks" ? <BookmarkIcon /> : <NotebookPen />}</div>}
      </section>
      <nav className="platform-sections" aria-label="Разделы платформы"><a className={view === "home" ? "is-active" : ""} aria-current={view === "home" ? "page" : undefined} href="#/home"><Layers3 size={17} />Оба курса</a><a className={view === "bookmarks" ? "is-active" : ""} aria-current={view === "bookmarks" ? "page" : undefined} href="#/bookmarks"><BookmarkIcon size={17} />Закладки <span>{bookmarks.length}</span></a><a className={view === "mistakes" ? "is-active" : ""} aria-current={view === "mistakes" ? "page" : undefined} href="#/mistakes"><NotebookPen size={17} />Журнал <span>{journal.length}</span></a><a href="#/discrete/sync"><ShieldCheck size={17} />Аккаунт и синхронизация <ArrowUpRight size={14} /></a></nav>
      {snapshot.errors.length > 0 && <p role="alert">Не удалось прочитать: {snapshot.errors.join(", ")}. Исходные записи сохранены. Экспортируйте их со старого сайта перед восстановлением.</p>}
      {view === "home" && <>
        <div className="platform-section-title"><div><span className="platform-overline">ОДИН ШАГ БЛИЖЕ К КОЛЛОКВИУМУ</span><h2>Твои курсы<span className="platform-title-dot">.</span></h2></div><span className="platform-section-caption">Выбирай, с чего начнём сегодня</span></div>
        <div className="platform-courses">
          <section className="platform-card platform-card-discrete"><div className="platform-course-art"><span className="platform-module">01 / МОДУЛЬ</span><LearningArt variant="discrete" /></div><div className="platform-card-body"><div className="platform-course-meta"><span>ЛОГИКА · СТРУКТУРЫ · ДОКАЗАТЕЛЬСТВА</span><ArrowUpRight size={20} /></div><h2>{courses.discrete.title}</h2><p className="platform-card-description">От логических связок до красивых комбинаторных идей.</p>
            <div className="platform-card-stats"><div><strong>{discreteKnown} / 46</strong><span>Знаю вопросов</span></div><div><strong>{practiceKnown} / 145</strong><span>Могу доказать</span></div><div><strong>{planProgress(snapshot.plan.done).completed} / 84</strong><span>Пунктов плана</span></div></div>
            <ProgressMeter value={discreteKnown} total={46} label="Освоение вопросов дискретной математики" />
            <a className="platform-action" href="#/discrete/plan">Продолжить дискретную математику <ArrowRight size={18} /></a>
            </div>
          </section>
          <section className="platform-card platform-card-calculus"><div className="platform-course-art"><span className="platform-module">02 / МОДУЛЬ</span><LearningArt variant="calculus" /></div><div className="platform-card-body"><div className="platform-course-meta"><span>ПРЕДЕЛЫ · РЯДЫ · НЕПРЕРЫВНОСТЬ</span><ArrowUpRight size={20} /></div><h2>{courses.calculus.title}</h2><p className="platform-card-description">Точные формулировки. Осмысленные доказательства.</p>
            <div className="platform-card-stats"><div><strong>{calculusKnown} / {items.length}</strong><span>Знаю материалов</span></div><div><strong>{reviewDue}</strong><span>Пора повторить</span></div><div><strong>{snapshot.calculus.history.length}</strong><span>Билетов пройдено</span></div></div>
            <ProgressMeter value={calculusKnown} total={items.length} label="Освоение материалов матанализа" />
            <a className="platform-action" href="#/calculus/today">Продолжить матанализ <ArrowRight size={18} /></a>
            </div>
          </section>
        </div>
        <div className="platform-next-steps"><div><span className="platform-overline">ХОРОШАЯ ПРИВЫЧКА</span><h2>Немного практики.<br /> Больше уверенности.</h2><p>Начни с понятного шага — остальное сложится.</p></div><a href="#/discrete/plan"><span className="platform-shortcut-icon"><Route /></span><span><b>Пройти по маршруту</b><small>План дискретной математики</small></span><ArrowUpRight /></a><a href="#/calculus/oral"><span className="platform-shortcut-icon"><BookOpen /></span><span><b>Ответить у доски</b><small>Устный экзаменатор матанализа</small></span><ArrowUpRight /></a></div>
        <section className="platform-section platform-backup-section"><div className="platform-backup-heading"><span className="platform-backup-icon"><ShieldCheck size={26} /></span><div><span className="platform-overline">ПРОГРЕСС С ТОБОЙ</span><h2>Резервная копия обоих курсов</h2></div></div><p>Сохрани оценки, билеты, черновики и закладки одним файлом. Можно загрузить и прежние копии обоих приложений.</p>
          <div className="platform-backup"><button onClick={() => {
            try {
              const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "colloquium-platform-progress-v1.json"; a.click(); URL.revokeObjectURL(url);
            } catch { setNotice("Не удалось экспортировать данные. Проверьте сообщение об ошибке чтения сохранений."); }
          }}><Download size={17} /> Экспорт обоих курсов</button>
          <label className="platform-file"><Upload size={17} /> Выбрать файл прогресса<input aria-label="Импорт прогресса платформы" type="file" accept=".json,application/json" onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            setIncoming(null); setNotice("");
            try { if (file.size > 20_000_000) throw Error("Файл больше 20 МБ"); const parsed = parseBackup(JSON.parse(await file.text())); prepareImport(parsed); setIncoming(parsed); }
            catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось прочитать файл"); }
            e.target.value = "";
          }} /></label></div>
          {preview && <div className="platform-status"><p>Новых записей: {preview.added}. Различающихся записей: {preview.conflicts}. Истории объединяются по ID, закладки — без повторов.</p>
            <label>При различиях <select aria-label="Разрешение конфликтов импорта" value={choice} onChange={e => setChoice(e.target.value as typeof choice)}><option value="local">Сохранить текущую запись</option><option value="import">Взять запись из файла</option></select></label>{" "}
            <button onClick={() => { try { commitImport(preview.updates); setIncoming(null); refresh(readSnapshot()); setNotice("Данные объединены. Исходная копия сохранена на этом устройстве."); } catch { setNotice("Не удалось сохранить импорт. Исходные данные сохранены; проверьте свободное место в браузере."); } }}>Объединить прогресс</button>
          </div>}
          {notice && <p role="status" className="platform-status">{notice}</p>}
        </section>
        <div className="platform-sync-note"><ShieldCheck size={16} /><PlatformSyncSummary /></div>
      </>}
      {view !== "home" && <><label>Курс <select aria-label="Фильтр курса" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">Оба курса</option><option value="discrete">Дискретная математика</option><option value="calculus">Матанализ</option></select></label>
        {view === "bookmarks" ? <><p>Закладка сохраняется отдельно от самооценки и не меняет прогресс.</p><ul className="platform-list">{list.filter(m => filter === "all" || m.course === filter).map(m => <li key={materialKey(m)}>{entry(m)}<Bookmark {...m} /></li>)}</ul>{!list.length && <p>Закладок пока нет. Добавьте материал кнопкой «В закладки» в его карточке.</p>}</> : <><p>Здесь собраны низкие самооценки из завершённых билетов. Это история затруднений, а не автоматическая проверка. Новая оценка материала не изменяет прошлый результат.</p><ul className="platform-list">{journal.filter(j => filter === "all" || j.material.course === filter).map((j, n) => <li key={`${j.material.course}-${j.ticketId}-${n}`}>{entry(j.material)}<small>{new Date(j.date).toLocaleString("ru-RU")} · {j.label}</small></li>)}</ul>{!journal.length && <p>Пока нет завершённых билетов с низкими самооценками.</p>}</>}
      </>}
      <footer className="platform-footer"><a href="#/home">Коллоквиум<span>↗</span></a><span>Понимать. Доказывать. Получать удовольствие.</span><span>Дискретная математика + матанализ</span></footer>
    </main>
  </>;
}
