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
  const entry = (m: Material) => <><a href={materialLink(m)}><MathText text={m.title} /></a><small>{courses[m.course].title} · {m.kind === "practice" ? "Практика" : m.kind === "definition" ? "Формулировка" : "Теория"}</small></>;
  return <>
    <CourseTools />
    <main className="platform-page">
      <p>ВАШЕ УЧЕБНОЕ ПРОСТРАНСТВО</p>
      <h1>{view === "bookmarks" ? "Закладки" : view === "mistakes" ? "Журнал ошибок" : "Продолжить подготовку"}</h1>
      <div className="platform-sections"><a href="#/home">Оба курса</a><a href="#/bookmarks">Закладки · {bookmarks.length}</a><a href="#/mistakes">Журнал · {journal.length}</a><a href="#/discrete/sync">Аккаунт и синхронизация</a></div>
      {snapshot.errors.length > 0 && <p role="alert">Не удалось прочитать: {snapshot.errors.join(", ")}. Исходные записи сохранены. Экспортируйте их со старого сайта перед восстановлением.</p>}
      {view === "home" && <>
        <p>Выберите курс. Прогресс формулировок, самостоятельных доказательств и плана учитывается отдельно.</p>
        <PlatformSyncSummary />
        <div className="platform-courses">
          <section className="platform-card"><h2>{courses.discrete.title}</h2><p>{courses.discrete.subtitle}</p>
            <p>Знаю: {courseData.questions.filter(q => snapshot.discrete.progress[q.id]?.status === "known").length} / 46 вопросов<br />Могу доказать: {practiceCatalog.items.filter(q => snapshot.practice.progress[q.id] === "independent").length} / 145 материалов<br />План: {planProgress(snapshot.plan.done).completed} / 84 пунктов</p>
            <a className="platform-action" href="#/discrete/plan">Продолжить дискретную математику</a>
          </section>
          <section className="platform-card"><h2>{courses.calculus.title}</h2><p>{courses.calculus.subtitle}</p>
            <p>Знаю: {items.filter(i => snapshot.calculus.ratings[i.id] === "known").length} / {items.length} материалов<br />Пора повторить: {dueItems(items, snapshot.calculus.schedules ?? {}, Date.now()).filter(i => snapshot.calculus.schedules?.[i.id]).length}<br />Завершено билетов: {snapshot.calculus.history.length}</p>
            <a className="platform-action" href="#/calculus/today">Продолжить матанализ</a>
          </section>
        </div>
        <section className="platform-section"><h2>Резервная копия обоих курсов</h2><p>Включает оценки, истории билетов, черновики матанализа, расписания повторений и закладки. Поддерживаются прежние экспорты обоих приложений.</p>
          <div className="platform-backup"><button onClick={() => {
            try {
              const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "colloquium-platform-progress-v1.json"; a.click(); URL.revokeObjectURL(url);
            } catch { setNotice("Не удалось экспортировать данные. Проверьте сообщение об ошибке чтения сохранений."); }
          }}>Экспорт обоих курсов</button>
          <label className="platform-file">Выбрать файл прогресса<input aria-label="Импорт прогресса платформы" type="file" accept=".json,application/json" onChange={async e => {
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
      </>}
      {view !== "home" && <><label>Курс <select aria-label="Фильтр курса" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">Оба курса</option><option value="discrete">Дискретная математика</option><option value="calculus">Матанализ</option></select></label>
        {view === "bookmarks" ? <><p>Закладка сохраняется отдельно от самооценки и не меняет прогресс.</p><ul className="platform-list">{list.filter(m => filter === "all" || m.course === filter).map(m => <li key={materialKey(m)}>{entry(m)}<Bookmark {...m} /></li>)}</ul>{!list.length && <p>Закладок пока нет. Добавьте материал кнопкой «В закладки» в его карточке.</p>}</> : <><p>Здесь собраны низкие самооценки из завершённых билетов. Это история затруднений, а не автоматическая проверка. Новая оценка материала не изменяет прошлый результат.</p><ul className="platform-list">{journal.filter(j => filter === "all" || j.material.course === filter).map((j, n) => <li key={`${j.material.course}-${j.ticketId}-${n}`}>{entry(j.material)}<small>{new Date(j.date).toLocaleString("ru-RU")} · {j.label}</small></li>)}</ul>{!journal.length && <p>Пока нет завершённых билетов с низкими самооценками.</p>}</>}
      </>}
    </main>
  </>;
}
