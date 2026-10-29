import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, SlidersHorizontal, X, BookOpen, Sparkles } from "lucide-react";
import { CourseTools } from "./course-tools";
import { courses, type CourseId } from "./catalog";
import { searchAll, searchDocuments, normalize, type SearchKind } from "./search";
import { MathText } from "../calculus/MathText";
const labels = { definition: "Определение", theory: "Теория и доказательства", practice: "Практика", oral: "Уточняющий вопрос" };
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let start = 0, index: number;
    while ((index = normalize(text).indexOf(term, start)) >= 0) { ranges.push([index, index + term.length]); start = index + term.length; }
  }
  const merged: [number, number][] = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else merged.push([...range]);
  }
  const nodes = []; let cursor = 0;
  for (const [start, end] of merged) { nodes.push(text.slice(cursor, start), <mark key={start}>{text.slice(start, end)}</mark>); cursor = end; }
  nodes.push(text.slice(cursor)); return <>{nodes}</>;
}
export default function SearchPage() {
  const params = () => new URLSearchParams(location.hash.split("?")[1] ?? "");
  const [query, setQuery] = useState(() => params().get("q") ?? "");
  const [course, setCourse] = useState<"all" | CourseId>(() => params().get("course") === "calculus" ? "calculus" : params().get("course") === "discrete" ? "discrete" : "all");
  const getKind = () => Object.keys(labels).includes(params().get("kind") ?? "") ? params().get("kind") as SearchKind : "all";
  const [kind, setKind] = useState<"all" | SearchKind>(getKind);
  const [limit, setLimit] = useState(12);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); const update = () => { setQuery(params().get("q") ?? ""); setCourse(params().get("course") === "calculus" ? "calculus" : params().get("course") === "discrete" ? "discrete" : "all"); setKind(getKind()); }; window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  useEffect(() => { setLimit(12); const p = new URLSearchParams(); if (query) p.set("q", query); if (course !== "all") p.set("course", course); if (kind !== "all") p.set("kind", kind); history.replaceState(null, "", `#/search${p.size ? "?" + p.toString() : ""}`); }, [query, course, kind]);
  const results = useMemo(() => searchAll(query, course, kind), [query, course, kind]);
  return <><CourseTools /><main className="platform-page study-search-page">
    <div className="study-page-heading"><span className="platform-overline">ОДИН ЗАПРОС — ДВА КУРСА</span><h1>Найти <span>понимание.</span></h1><p>Определения, доказательства, задачи и вопросы принимающего — в одном поиске.</p></div>
    <div className="study-search-box"><Search size={23} /><input ref={input} aria-label="Поиск по всем материалам" maxLength={200} value={query} placeholder="Например, критерий Коши или индукция" onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Очистить поиск" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={18} /></button>}<kbd>Ctrl K</kbd></div>
    <div className="study-search-filters"><span><SlidersHorizontal size={15} /> Искать в</span><select aria-label="Курс поиска" value={course} onChange={e => setCourse(e.target.value as typeof course)}><option value="all">Оба курса</option><option value="discrete">Дискретная математика</option><option value="calculus">Матанализ</option></select><select aria-label="Вид материала поиска" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="all">Все материалы</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {!query.trim() ? <section className="study-search-start"><div className="study-empty-orbit" aria-hidden="true"><Search /><span>∑</span><span>∀</span></div><h2>Какой вопрос разберём?</h2><p>Поиск охватывает {searchDocuments.length} материалов и уточнений. Можно искать по названию, номеру или тексту ответа.</p><div className="study-suggestions">{["Коши", "индукция", "предел", "комбинаторика"].map(term => <button key={term} onClick={() => setQuery(term)}><Sparkles size={14} />{term}</button>)}</div></section> : <>
      <p className="study-results-count" role="status">Найдено: {results.length}{results.length > limit && ` · показаны первые ${limit}`}</p>
      <div className="study-search-results">{results.slice(0, limit).map(result => <article className={`study-result study-result-${result.material.course}`} key={result.key}><div className="study-result-meta"><span>{courses[result.material.course].title}</span><span>{labels[result.kind]}</span></div><a href={result.href}><h2><MathText text={result.title} /></h2><ArrowUpRight size={21} /></a><p><Highlight text={result.snippet} query={query} /></p><small><BookOpen size={13} />{result.topic}</small></article>)}</div>
      {!results.length && <div className="study-empty"><Search size={30} /><h2>Пока ничего не нашлось</h2><p>Попробуй более короткий запрос или убери фильтр курса и типа материала.</p></div>}
      {results.length > limit && <button className="study-load-more" onClick={() => setLimit(n => n + 12)}>Показать ещё {Math.min(12, results.length - limit)}</button>}
    </>}
  </main></>;
}
