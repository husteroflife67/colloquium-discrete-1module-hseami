import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { courses, materialKey, type CourseId, type Material } from "./catalog";
export const platformKey = "colloquium-platform-v1";
export type PlatformSaved = { version: 1; bookmarks: string[] };
export function readPlatform(): PlatformSaved {
  const raw = localStorage.getItem(platformKey);
  if (!raw) return { version: 1, bookmarks: [] };
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.bookmarks) || !data.bookmarks.every((v: unknown) => typeof v === "string")) throw Error("Некорректные закладки платформы");
  return data;
}
export function useCoursePage<T extends string>(course: CourseId, initial: T, allowed: readonly string[]): [T, Dispatch<SetStateAction<T>>] {
  const get = () => {
    const parts = location.hash.slice(2).split("?")[0].split("/");
    return parts[0] === course && allowed.includes(parts[1]) ? parts[1] as T : initial;
  };
  const [page, setPage] = useState<T>(get);
  useEffect(() => {
    const update = () => setPage(get());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [course]);
  const navigate: Dispatch<SetStateAction<T>> = next => {
    const value = typeof next === "function" ? next(page) : next;
    setPage(value);
    const hash = `#/${course}/${value}`;
    if (location.hash !== hash) location.hash = hash;
  };
  return [page, navigate];
}
export function CourseTools({ course }: { course?: CourseId }) {
  return <header className="platform-bar" aria-label="Выбор курса">
    <a className="platform-home" href="#/home">Коллоквиум<span> · два курса</span></a>
    <label>Курс <select aria-label="Выбрать курс" value={course ?? ""} onChange={e => {
      const id = e.target.value as CourseId;
      location.hash = `#/${id}/${courses[id].start}`;
    }}>
      {!course && <option value="" disabled>Выберите курс</option>}
      {Object.entries(courses).map(([id, c]) => <option key={id} value={id}>{c.title}</option>)}
    </select></label>
    <a href="#/bookmarks">Закладки</a><a href="#/mistakes">Журнал</a>
  </header>;
}
export function Bookmark(material: Material) {
  const key = materialKey(material);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { try { setActive(readPlatform().bookmarks.includes(key)); } catch { setError("Не удалось прочитать закладки. Сохраните резервную копию."); } }, [key]);
  return <div className="platform-bookmark"><button type="button" aria-pressed={active} onClick={() => {
    try {
      const data = readPlatform();
      const next = !data.bookmarks.includes(key);
      data.bookmarks = next ? [...data.bookmarks, key] : data.bookmarks.filter(k => k !== key);
      localStorage.setItem(platformKey, JSON.stringify(data));
      setActive(next); setError("");
      window.dispatchEvent(new Event("platform-bookmarks-changed"));
    } catch { setError("Не удалось сохранить закладку. Хранилище недоступно или заполнено."); }
  }}>{active ? "★ Убрать из закладок" : "☆ В закладки"}</button>{error && <p role="alert">{error}</p>}</div>;
}
