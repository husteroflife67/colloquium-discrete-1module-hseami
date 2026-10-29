import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Cloud,
  CloudOff,
  Check,
  Mail,
  RefreshCw,
  Download,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { supabase, syncConfigured, configurationError } from "./supabase";
import { items as calculusItems } from "./calculus/content";
import { calculusCodec } from "./calculus/sync-model";
import { SyncEngine } from "./sync-engine";
import {
  validateBackup,
  mergeBackup,
  type ProgressBackup,
} from "./progress-backup";
import { saveProgress } from "./progress-events";
import { localKeys, type LocalKey, type CloudValue } from "./sync-model";
import course from "./data/course.json";
import { practice, statusLabels } from "./practice-model";
import { preparationPlan } from "./plan-model";
const Context = createContext<{
  engine: SyncEngine;
  calculusEngine: SyncEngine;
  session: Session | null;
  authError: string;
} | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new SyncEngine(supabase));
  const [calculusEngine] = useState(() => new SyncEngine(supabase, calculusCodec));
  const [session, setSession] = useState<Session | null>(null),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    engine.start();
    calculusEngine.start();
    if (!supabase) return () => { engine.stop(); calculusEngine.stop(); };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSession(session);
      engine.setUser(session?.user.id ?? null);
      calculusEngine.setUser(session?.user.id ?? null);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error)
        setAuthError("Не удалось восстановить вход. Попробуйте войти снова.");
      setSession(data.session);
      engine.setUser(data.session?.user.id ?? null);
      calculusEngine.setUser(data.session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      engine.stop();
      calculusEngine.stop();
    };
  }, [engine, calculusEngine]);
  return (
    <Context.Provider value={{ engine, calculusEngine, session, authError }}>
      {children}
    </Context.Provider>
  );
}
function useSync() {
  const value = useContext(Context);
  if (!value) throw Error("Missing SyncProvider");
  const snapshot = useSyncExternalStore(
    value.engine.subscribe,
    value.engine.getSnapshot,
  );
  return { ...value, snapshot };
}
function calculusConflictLabel(key: string) {
  const [kind, id] = key.split("/");
  const title = calculusItems.find(i => i.id === id)?.title ?? calculusItems.flatMap(i => i.questions).find(q => q.id === id)?.prompt ?? (kind === "checklist" ? `Тема ${id}` : "Сохранённый результат");
  const field = ({ rating: "Самооценка", question: "Ответ на уточнение", draft: "Черновик", schedule: "Повторение", history: "Билет", checklist: "Чек-лист", setting: "Оформление" } as Record<string, string>)[kind];
  return `${field} · ${title}`;
}
function calculusValueLabel(value: CloudValue): string {
  if (typeof value === "string") return ({ known: "Знаю", unknown: "Не знаю", partial: "Частично", repeat: "Повторить", light: "Светлая тема", dark: "Тёмная тема" } as Record<string, string>)[value] ?? value;
  if (typeof value !== "object" || !value) return String(value);
  if (value.deleted) return "Запись удалена";
  if (typeof value.due === "number") return `Повторить ${new Date(value.due).toLocaleString("ru-RU")}; интервал ${value.intervalDays} суток`;
  if (Array.isArray(value.values)) {
    const labels = ["Определения", "Формулировки", "Доказательства", "Самостоятельное воспроизведение", "Уточнения", "Практика", "Повторение"];
    return labels.filter((_, n) => value.values instanceof Array && value.values[n]).join(", ") || "Пункты не отмечены";
  }
  if (typeof value.base === "number") return `Билет от ${new Date(String(value.date)).toLocaleString("ru-RU")}; ${value.base} баллов + ${value.extra} дополнительных`;
  return "Сохранённая запись";
}
export function PlatformSyncSummary() {
  const value = useContext(Context)!;
  const discrete = useSyncExternalStore(value.engine.subscribe, value.engine.getSnapshot);
  const calculus = useSyncExternalStore(value.calculusEngine.subscribe, value.calculusEngine.getSnapshot);
  if (!value.session) return <p>Прогресс сохраняется на этом устройстве. Для переноса используйте резервную копию или общий аккаунт.</p>;
  return <div className="platform-status"><p><a href="#/discrete/sync">Дискретная математика</a>: {discrete.message}<br /><a href="#/calculus/sync">Матанализ</a>: {calculus.message}</p></div>;
}
export function CalculusSyncSettings() {
  const value = useContext(Context)!;
  const engine = value.calculusEngine;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return <section className="panel">
    <h2>Синхронизация матанализа</h2>
    <p>Один аккаунт для обоих курсов. Оценки, черновики, чек-листы, расписания повторений, уточнения и завершённые билеты матанализа сохраняются отдельно от дискретной математики. Закладки пока хранятся на устройстве и входят в общую резервную копию.</p>
    <p role="status">{snapshot.message}</p>
    {!value.session && <p><a href="#/discrete/sync">Войти в общий аккаунт</a></p>}
    {value.session && <button className="secondary" onClick={() => void engine.sync()}>Синхронизировать матанализ</button>}
    <p><a href="#/home">Экспорт и импорт обоих курсов</a></p>
    {snapshot.conflicts.map(c => <div className="hint" data-conflict={c.key} key={c.key}><h3>{calculusConflictLabel(c.key)}</h3><p>На устройстве: {calculusValueLabel(c.local)}</p><p>В аккаунте: {calculusValueLabel(c.remote)}</p><button className="secondary" onClick={() => engine.resolve(c.key, "local")}>Оставить на устройстве</button>{" "}<button className="secondary" onClick={() => engine.resolve(c.key, "cloud")}>Взять из аккаунта</button></div>)}
  </section>;
}
export function SyncBadge({ onOpen }: { onOpen: () => void }) {
  const { session, snapshot } = useSync();
  return (
    <button
      className={`sync-badge sync-${snapshot.phase}`}
      onClick={onOpen}
      aria-label="Открыть синхронизацию прогресса"
    >
      {session ? <Cloud size={14} /> : <CloudOff size={14} />}
      <span>
        {!session
          ? "Прогресс на устройстве"
          : snapshot.phase === "synced"
            ? "Прогресс синхронизирован"
            : snapshot.phase === "conflict"
              ? "Нужна проверка отметок"
              : snapshot.phase === "syncing"
                ? "Синхронизация…"
                : "Прогресс ожидает отправки"}
      </span>
    </button>
  );
}
function conflictLabel(key: string) {
  const [type, id] = key.split("/");
  if (type === "theory")
    return `Теория · вопрос ${id}: ${course.questions.find((q) => q.id === id)?.title ?? ""}`;
  if (type === "practice")
    return `Задачи · ${practice.items.find((q) => q.id === id)?.number ?? id}`;
  if (type === "plan") {
    const point = preparationPlan.stages
      .flatMap((s) => s.items)
      .find((i) => i.id === id);
    return `План · ${point?.label ?? id}`;
  }
  return "Результат тренировочного билета";
}
function valueLabel(value: CloudValue) {
  if (typeof value === "boolean") return value ? "Выполнено" : "Не выполнено";
  if (typeof value === "string")
    return statusLabels[value as keyof typeof statusLabels] ?? value;
  if ("status" in value)
    return (
      { new: "Не изучал", learning: "Изучаю", known: "Знаю" }[
        value.status as "new" | "learning" | "known"
      ] + (value.review ? " · повторить" : "")
    );
  return "Сохранённый результат билета";
}
export function SyncSettings() {
  const { engine, session, snapshot, authError } = useSync();
  const [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [loginMethod, setLoginMethod] = useState<"link" | "password">("link");
  const [backup, setBackup] = useState<{
    backup: ProgressBackup;
    count: number;
  } | null>(null);
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (loginMethod === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
        setNotice("Вход выполнен. Объединяем прогресс.");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin)
            .href,
        },
      });
      if (error) throw error;
      setNotice(
        "Ссылка для входа отправлена. Откройте письмо в браузере на том устройстве, которое подключаете. На остальных устройствах войдите с тем же email.",
      );
    } catch {
      setError(
        "Не удалось войти. Проверьте email, пароль и подключение; для писем также действует ограничение частоты отправки.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setNotice(
        "Вы вышли на этом устройстве. Локальный прогресс сохранён. Для отправки новых отметок снова войдите в тот же аккаунт.",
      );
    } catch {
      setError(
        "Не удалось выйти из аккаунта. Проверьте подключение и повторите.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setAccountPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword("");
      setNotice(
        "Пароль сохранён. На остальных устройствах выберите «Email и пароль» и войдите с тем же email.",
      );
    } catch {
      setError(
        "Не удалось сохранить пароль. Попробуйте войти по свежей ссылке из письма и повторить.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function selectBackup(file?: File) {
    setError("");
    setBackup(null);
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error("Too large");
      setBackup(validateBackup(JSON.parse(await file.text())));
    } catch {
      setError(
        "Файл не подходит: выберите JSON-копию прогресса этого приложения размером до 2 МБ.",
      );
    }
  }
  function importBackup() {
    if (!backup) return;
    try {
      const cache = Object.fromEntries(
        Object.values(localKeys).map((key) => [key, localStorage.getItem(key)]),
      ) as Record<LocalKey, string | null>;
      const updates = mergeBackup(backup.backup, cache);
      for (const [key, raw] of Object.entries(updates))
        if (raw !== undefined) saveProgress(key, JSON.parse(raw));
      setBackup(null);
      setNotice(
        "Недостающие отметки и билеты добавлены. Существующие значения сохранены; при входе в аккаунт новые записи отправятся в облако.",
      );
    } catch {
      setError(
        "Импорт прерван: проверьте свободное место в браузере. Уже добавленные отметки сохранены; повторный импорт безопасен.",
      );
    }
  }
  function exportProgress() {
    try {
      const data = {
        format: "discrete-progress-backup",
        version: 1,
        data: Object.fromEntries(
          Object.entries(localKeys).map(([name, key]) => [
            name,
            JSON.parse(localStorage.getItem(key) ?? "null"),
          ]),
        ),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "discrete-progress.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "Резервная копия скачана. Она содержит только учебный прогресс, без ключей и данных входа.",
      );
    } catch {
      setError("Не удалось прочитать прогресс для резервной копии.");
    }
  }
  return (
    <section className="sync-settings">
      <div className="page-kicker">ОДИН ПРОГРЕСС НА ВСЕХ УСТРОЙСТВАХ</div>
      <h1>Синхронизация</h1>
      <p className="subtitle">
        Войдите с одним email на телефоне, планшете и ноутбуке.
      </p>
      <div className="sync-info-card">
        <Cloud size={30} />
        <div>
          <h2>Продолжайте с того же места</h2>
          <p>
            Сохраняются статусы теории и задач, результаты завершённых билетов и
            отметки плана. Без интернета можно продолжать учиться: изменения
            отправятся после подключения. Просмотр решения по-прежнему не
            подтверждает знание.
          </p>
        </div>
      </div>
      {configurationError && (
        <div className="notice" role="alert">
          {configurationError}
        </div>
      )}
      {!syncConfigured ? (
        <div className="notice neutral">
          <strong>Облачная синхронизация пока не подключена.</strong>
          <p>
            Приложение сохраняет прогресс в браузере. Владельцу сайта нужно
            создать проект Supabase, подготовить таблицу по инструкции в
            репозитории и добавить публичные настройки при сборке. После этого
            здесь появится вход по email.
          </p>
        </div>
      ) : session ? (
        <div className="sync-account">
          <div>
            <span className="eyebrow">ВАШ АККАУНТ</span>
            <strong>{session.user.email ?? "Вход выполнен"}</strong>
            <p role="status">{snapshot.message}</p>
            {snapshot.pending > 0 && (
              <small>Отметок и результатов в очереди: {snapshot.pending}</small>
            )}
            {snapshot.lastSync && (
              <small>
                Последняя успешная синхронизация:{" "}
                {new Date(snapshot.lastSync).toLocaleTimeString("ru-RU")}
              </small>
            )}
          </div>
          <div className="sync-actions">
            <button
              className="primary"
              disabled={snapshot.phase === "syncing"}
              onClick={() => void engine.sync()}
            >
              <RefreshCw size={16} />
              Синхронизировать сейчас
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={signOut}
            >
              <LogOut size={16} />
              Выйти на этом устройстве
            </button>
          </div>
        </div>
      ) : (
        <form className="sync-login" onSubmit={signIn}>
          <h2>Подключить устройство</h2>
          <div
            className="sync-login-methods"
            role="group"
            aria-label="Способ входа"
          >
            <button
              type="button"
              className={loginMethod === "link" ? "active" : ""}
              onClick={() => setLoginMethod("link")}
            >
              Ссылка из письма
            </button>
            <button
              type="button"
              className={loginMethod === "password" ? "active" : ""}
              onClick={() => setLoginMethod("password")}
            >
              Email и пароль
            </button>
          </div>
          <p>
            Для первого входа выберите ссылку из письма. Затем можно задать
            пароль для остальных устройств. При первом входе текущие отметки
            предложат объединиться с аккаунтом; несовпадения можно разрешить
            вручную.
          </p>
          <label htmlFor="sync-email">Email</label>
          <input
            id="sync-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <>
            {loginMethod === "password" && (
              <>
                <label htmlFor="sync-password">Пароль</label>
                <input
                  id="sync-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            )}
            <button className="primary" disabled={busy} type="submit">
              <Mail size={16} />
              {busy
                ? "Подождите…"
                : loginMethod === "password"
                  ? "Войти"
                  : "Отправить ссылку для входа"}
            </button>
          </>
        </form>
      )}
      {session && (
        <details className="sync-password-settings">
          <summary>Задать пароль для входа на других устройствах</summary>
          <p>
            Тогда не придётся запрашивать отдельное письмо для каждого
            устройства. В случае забытого пароля можно снова войти по ссылке из
            письма.
          </p>
          <form onSubmit={setAccountPassword}>
            <label htmlFor="new-sync-password">
              Новый пароль (не менее 8 символов)
            </label>
            <input
              id="new-sync-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" className="secondary-button" disabled={busy}>
              Сохранить пароль
            </button>
          </form>
        </details>
      )}
      {(error || authError) && (
        <div className="notice" role="alert">
          {error || authError}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {session && snapshot.conflicts.length > 0 && (
        <section className="sync-conflicts">
          <h2>Выберите отметку для общего прогресса</h2>
          <p className="muted">
            Этот пункт был независимо изменён на двух устройствах. Пока вы не
            выберете версию, на этом устройстве остаётся ваша отметка.
          </p>
          {snapshot.conflicts.map((c) => (
            <article key={c.key} className="sync-conflict">
              <h3>{conflictLabel(c.key)}</h3>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => engine.resolve(c.key, "local")}
                >
                  Оставить на устройстве: {valueLabel(c.local)}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => engine.resolve(c.key, "cloud")}
                >
                  Взять из аккаунта: {valueLabel(c.remote)}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="sync-backup">
        <ShieldCheck size={21} />
        <div>
          <h3>Текущие отметки останутся с вами</h3>
          <p>
            Перед первым подключением можно скачать резервную копию. Черновики и
            незавершённые билеты в синхронизацию не входят. При смене аккаунта
            прогресс предыдущего пользователя хранится отдельно в этом браузере.
          </p>
          <button className="secondary-button" onClick={exportProgress}>
            <Download size={16} />
            Скачать резервную копию
          </button>
          <div className="sync-import">
            <label htmlFor="progress-backup-file">
              Перенести копию с другого адреса или устройства
            </label>
            <input
              id="progress-backup-file"
              type="file"
              accept="application/json,.json"
              onChange={(e) => void selectBackup(e.target.files?.[0])}
            />
            {backup && (
              <>
                <p>
                  В копии {backup.count} отметок и результатов. Импорт добавит
                  только отсутствующие записи; существующие не заменит.
                </p>
                <button className="secondary-button" onClick={importBackup}>
                  Добавить прогресс из копии
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
