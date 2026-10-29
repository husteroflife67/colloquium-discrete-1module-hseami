import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Flag, X, Copy, ArrowUpRight } from "lucide-react";
import type { Material } from "./catalog";
import { materialURL, feedbackContext, feedbackBody, feedbackURL } from "./material-links";

export function MaterialActions({ material, questionId }: { material: Material; questionId?: string }) {
  const [mode, setMode] = useState<"share" | "report" | null>(null);
  const [notice, setNotice] = useState("");
  const [description, setDescription] = useState("");
  const [quote, setQuote] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const url = materialURL(material, location.origin, import.meta.env.BASE_URL, questionId);
  useEffect(() => {
    if (mode && dialog.current) { dialog.current.showModal(); return () => dialog.current?.close(); }
  }, [mode]);
  const close = () => { dialog.current?.close(); setMode(null); opener.current?.focus(); };
  const open = (value: "share" | "report", target: HTMLElement) => { opener.current = target; setNotice(""); setMode(value); setDescription(""); setQuote(feedbackContext(material, questionId).excerpt); };
  async function copy(text: string) {
    try { if (!navigator.clipboard) throw Error(); await navigator.clipboard.writeText(text); setNotice("Скопировано"); }
    catch { setNotice("Автоматическое копирование недоступно. Выделите текст в поле и скопируйте вручную."); }
  }
  return <span className="study-material-actions">
    <button type="button" onClick={e => open("share", e.currentTarget)}><Share2 size={14} />Поделиться карточкой</button>
    <button type="button" onClick={e => open("report", e.currentTarget)}><Flag size={14} />Сообщить о неточности</button>
    {mode && createPortal(<dialog ref={dialog} className="study-dialog" aria-labelledby="study-dialog-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } }}>
      <div className="study-dialog-heading"><span className="study-dialog-icon">{mode === "share" ? <Share2 /> : <Flag />}</span><button type="button" aria-label="Закрыть окно" onClick={close}><X size={20} /></button></div>
      <h2 id="study-dialog-title">{mode === "share" ? "Обсудить — значит понять" : "Поможем ответу стать точнее"}</h2><p className="study-dialog-material">{feedbackContext(material, questionId).title}</p>
      {mode === "share" ? <><p>Ссылка откроет именно этот материал, включая выбранное уточнение.</p><label>Ссылка на карточку<input aria-label="Ссылка на карточку" readOnly value={url} onFocus={e => e.target.select()} /></label><button className="study-solid-button" onClick={() => void copy(url)}><Copy size={16} />Скопировать ссылку</button></> : <>
        <label>Фрагмент ответа<textarea aria-label="Фрагмент ответа" maxLength={300} value={quote} onChange={e => setQuote(e.target.value)} rows={3} /></label>
        <label>Что нужно исправить?<textarea aria-label="Описание неточности" maxLength={600} value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Укажи неточный переход, пропущенное условие или предложи правильную формулировку." /></label>
        <p className="study-dialog-help">Номер материала и ссылка уже добавлены. GitHub откроется с черновиком обращения; отправить его нужно самостоятельно.</p>
        <div className="study-dialog-buttons"><a className="study-solid-button" aria-disabled={!description.trim()} href={description.trim() ? feedbackURL(material, url, description, quote, questionId) : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!description.trim()) e.preventDefault(); }}><ArrowUpRight size={16} />Открыть черновик в GitHub</a><button onClick={() => void copy(feedbackBody(material, url, description, quote, questionId))}><Copy size={15} />Скопировать обращение</button></div>
        <details><summary>Текст обращения</summary><textarea aria-label="Текст обращения" readOnly value={feedbackBody(material, url, description, quote, questionId)} rows={8} onFocus={e => e.target.select()} /></details>
      </>}
      {notice && <p className="study-copy-notice" role="status">{notice}</p>}
    </dialog>, document.body)}
  </span>;
}
