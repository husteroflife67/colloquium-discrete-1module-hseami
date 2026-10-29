import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SyncProvider } from "./Sync";
import Home from "./platform/Home";
import studyToolsStyle from "./platform/study-tools.css?inline";
import courseTheme from "./platform/course-theme.css?inline";
import platformStyle from "./platform/platform.css?inline";
import "katex/dist/katex.min.css";
import "@fontsource-variable/onest";
const SearchPage = lazy(() => import("./platform/SearchPage"));
const Recovery = lazy(() => import("./platform/Recovery"));
const Discrete = lazy(() => import("./DiscreteApp"));
const Calculus = lazy(() => import("./calculus/main"));
function Platform() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.repeat && e.key.toLowerCase() === "k") { e.preventDefault(); if (location.hash.startsWith("#/search")) document.querySelector<HTMLInputElement>('[aria-label="Поиск по всем материалам"]')?.focus(); else location.hash = "#/search"; } };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const route = hash.split("?")[0];
  const course = hash.startsWith("#/calculus/") ? "calculus" : hash.startsWith("#/discrete/") ? "discrete" : null;
  const view = hash === "#/bookmarks" ? "bookmarks" : hash === "#/mistakes" ? "mistakes" : "home";
  useEffect(() => { document.title = course === "calculus" ? "Коллоквиум · Математический анализ" : course === "discrete" ? "Коллоквиум · Дискретная математика" : "Коллоквиум · два курса"; if (course !== "calculus") delete document.documentElement.dataset.theme; }, [course]);
  return <><Suspense fallback={<p className="platform-page" role="status">Загружаем курс…</p>}>
    {course ? <div className={`platform-course platform-course-${course}`} key={course}>{course === "calculus" ? <Calculus /> : <Discrete />}</div> : route === "#/search" ? <SearchPage /> : route === "#/recovery" ? <Recovery /> : <Home key={hash} view={view} />}
  </Suspense><style>{`${platformStyle}\n${courseTheme}\n${studyToolsStyle}`}</style></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><SyncProvider><Platform /></SyncProvider></React.StrictMode>);
