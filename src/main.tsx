import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SyncProvider } from "./Sync";
import Home from "./platform/Home";
import courseTheme from "./platform/course-theme.css?inline";
import platformStyle from "./platform/platform.css?inline";
import "katex/dist/katex.min.css";
import "@fontsource-variable/onest";
const Discrete = lazy(() => import("./DiscreteApp"));
const Calculus = lazy(() => import("./calculus/main"));
function Platform() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const course = hash.startsWith("#/calculus/") ? "calculus" : hash.startsWith("#/discrete/") ? "discrete" : null;
  const view = hash === "#/bookmarks" ? "bookmarks" : hash === "#/mistakes" ? "mistakes" : "home";
  useEffect(() => { document.title = course === "calculus" ? "Коллоквиум · Математический анализ" : course === "discrete" ? "Коллоквиум · Дискретная математика" : "Коллоквиум · два курса"; if (course !== "calculus") delete document.documentElement.dataset.theme; }, [course]);
  return <><Suspense fallback={<p className="platform-page" role="status">Загружаем курс…</p>}>
    {course ? <div className={`platform-course platform-course-${course}`} key={course}>{course === "calculus" ? <Calculus /> : <Discrete />}</div> : <Home key={hash} view={view} />}
  </Suspense><style>{`${platformStyle}\n${courseTheme}`}</style></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><SyncProvider><Platform /></SyncProvider></React.StrictMode>);
