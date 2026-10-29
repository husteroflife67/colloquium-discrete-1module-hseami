import type { SupabaseClient } from "@supabase/supabase-js";
import {
  announceProgress,
  progressWritten,
  type ProgressWrite,
} from "./progress-events";
import {
  localKeys,
  journalKey,
  newJournal,
  readJournal,
  flatten,
  changesBetween,
  applyRows,
  validCloudRow,
  type Journal,
  type LocalKey,
  type Mutation,
  type CloudRow,
  type Conflict,
} from "./sync-model";
export type SyncSnapshot = {
  phase: "local" | "syncing" | "synced" | "offline" | "error" | "conflict";
  message: string;
  pending: number;
  conflicts: Conflict[];
  lastSync: number | null;
};
export type SyncCodec = {
  localKeys: Record<string, string>;
  journalKey: string;
  newJournal: typeof newJournal;
  readJournal: typeof readJournal;
  flatten: typeof flatten;
  changesBetween: typeof changesBetween;
  applyRows: typeof applyRows;
  validCloudRow: typeof validCloudRow;
  rpc: string;
  accountPrefix: string;
};
const defaultCodec: SyncCodec = { localKeys, journalKey, newJournal, readJournal, flatten, changesBetween, applyRows, validCloudRow, rpc: "sync_study_progress", accountPrefix: "discrete-account-" };
export class SyncEngine {
  private journal: Journal = newJournal();
  private userId: string | null = null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private started = false;
  private generation = 0;
  private controller: AbortController | null = null;
  private healthy = true;
  private snapshot: SyncSnapshot = {
    phase: "local",
    message: "Прогресс сохраняется на этом устройстве",
    pending: 0,
    conflicts: [],
    lastSync: null,
  };
  private get keys() { return Object.values(this.codec.localKeys); }
  constructor(private client: SupabaseClient | null, private codec: SyncCodec = defaultCodec) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<SyncSnapshot> = {}) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      pending: Object.keys(this.journal.pending).length,
      conflicts: Object.values(this.journal.conflicts),
    };
    for (const listener of this.listeners) listener();
  }
  private persist() {
    localStorage.setItem(this.codec.journalKey, JSON.stringify(this.journal));
  }
  private readCache() {
    return Object.fromEntries(
      this.keys.map((k) => [k, localStorage.getItem(k)]),
    ) as Record<LocalKey, string | null>;
  }
  private writeCache(updates: Partial<Record<LocalKey, string | null>>) {
    for (const key of this.keys) {
      if (!(key in updates)) continue;
      const value = updates[key];
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    for (const key of this.keys) if (key in updates) announceProgress(key);
  }
  start() {
    if (this.started) return;
    this.started = true;
    if (!this.client) return;
    try {
      this.journal = this.codec.readJournal();
    } catch {
      this.healthy = false;
      this.update({
        phase: "error",
        message:
          "Повреждена очередь синхронизации. Локальные отметки сохранены; восстановление описано в инструкции подключения.",
      });
    }
    window.addEventListener(progressWritten, this.onWrite as EventListener);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("focus", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisible);
    this.interval = setInterval(() => {
      if (document.visibilityState === "visible") void this.sync();
    }, 10000);
  }
  stop() {
    this.started = false;
    this.generation++;
    this.controller?.abort();
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    window.removeEventListener(progressWritten, this.onWrite as EventListener);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("focus", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisible);
  }
  private onOnline = () => {
    void this.sync();
  };
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.sync();
  };
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.sync();
    }, 350);
  }
  private onWrite = (event: CustomEvent<ProgressWrite>) => {
    if (!this.keys.includes(event.detail.key as LocalKey) || !this.healthy) return;
    try {
      for (const [key, value] of this.codec.changesBetween(
        event.detail.key,
        event.detail.before,
        event.detail.after,
      )) {
        const existing = this.journal.pending[key];
        this.journal.pending[key] = {
          key,
          value,
          base_revision:
            existing?.base_revision ?? this.journal.revisions[key] ?? 0,
          mutation_id: crypto.randomUUID(),
        };
        delete this.journal.conflicts[key];
      }
      this.persist();
      this.update({
        phase: this.userId ? "syncing" : "local",
        message: this.userId
          ? "Изменения ожидают отправки"
          : "Изменения сохраняются локально до входа в аккаунт",
      });
      this.schedule();
    } catch {
      this.update({
        phase: "error",
        message:
          "Не удалось сохранить очередь отправки. Локальный прогресс остался на устройстве; освободите место в браузере.",
      });
    }
  };
  setUser(id: string | null) {
    if (!this.client || !this.healthy) return;
    if (this.userId === id) {
      if (id) this.schedule();
      return;
    }
    this.generation++;
    this.controller?.abort();
    this.userId = null;
    if (!id) {
      this.update({
        phase: "local",
        message: "Вход не выполнен. Прогресс остаётся на устройстве",
      });
      return;
    }
    try {
      if (this.journal.owner && this.journal.owner !== id) {
        const previous = this.readCache();
        const oldJournal = this.journal;
        localStorage.setItem(
          `${this.codec.accountPrefix}${this.journal.owner}`,
          JSON.stringify({ journal: this.journal, cache: previous }),
        );
        const other = localStorage.getItem(`${this.codec.accountPrefix}${id}`);
        const restored = other ? JSON.parse(other) : null;
        const cache =
          restored?.cache ?? Object.fromEntries(this.keys.map((k) => [k, null]));
        try {
          this.writeCache(cache);
          this.journal = restored?.journal ?? { ...newJournal(), owner: id };
          this.persist();
        } catch (e) {
          this.journal = oldJournal;
          this.writeCache(previous);
          this.persist();
          throw e;
        }
      }
      if (!this.journal.owner) {
        this.journal.owner = id;
        for (const key of this.keys)
          for (const [field, value] of Object.entries(
            this.codec.flatten(key, localStorage.getItem(key)),
          ))
            if (!this.journal.pending[field])
              this.journal.pending[field] = {
                key: field,
                value,
                base_revision: 0,
                mutation_id: crypto.randomUUID(),
              };
      }
      this.persist();
      this.userId = id;
      this.update({
        phase: "syncing",
        message: "Объединяем прогресс аккаунта и этого устройства",
      });
      this.schedule();
    } catch {
      this.update({
        phase: "error",
        message:
          "Не удалось подготовить локальный прогресс к входу. Данные не отправлены; проверьте доступность хранилища браузера.",
      });
    }
  }
  async sync() {
    if (!this.client || !this.userId || !this.started || !this.healthy) return;
    if (this.running) {
      this.schedule();
      return;
    }
    if (!navigator.onLine) {
      this.update({
        phase: "offline",
        message: "Нет интернета. Изменения отправятся после подключения",
      });
      return;
    }
    const generation = this.generation;
    const owner = this.userId;
    const batch = Object.values(this.journal.pending)
      .filter((m) => !this.journal.conflicts[m.key])
      .slice(0, 100);
    this.running = true;
    this.controller = new AbortController();
    this.update({ phase: "syncing", message: "Синхронизируем прогресс" });
    try {
      const { data, error } = await this.client
        .rpc(this.codec.rpc, { p_changes: batch })
        .abortSignal(this.controller.signal);
      if (
        generation !== this.generation ||
        owner !== this.userId ||
        !this.started
      )
        return;
      if (error) throw error;
      if (
        !data ||
        !Array.isArray(data.rows) ||
        !data.rows.every(this.codec.validCloudRow) ||
        !Array.isArray(data.accepted) ||
        !Array.isArray(data.conflicts)
      )
        throw Error("Invalid server response");
      const rows = data.rows as CloudRow[];
      const byKey = new Map(rows.map((r) => [r.key, r]));
      for (const sent of batch) {
        const pending = this.journal.pending[sent.key],
          remote = byKey.get(sent.key);
        if (data.accepted.includes(sent.mutation_id)) {
          if (pending?.mutation_id === sent.mutation_id) {
            delete this.journal.pending[sent.key];
            delete this.journal.conflicts[sent.key];
          } else if (pending && remote) pending.base_revision = remote.revision;
        } else if (data.conflicts.includes(sent.key) && pending && remote) {
          this.journal.conflicts[sent.key] = {
            key: sent.key,
            local: pending.value,
            remote: remote.value,
            revision: remote.revision,
          };
        }
      }
      // Keep the cloud side of unresolved conflicts current when another device changes it again.
      for (const row of rows) {
        this.journal.revisions[row.key] = row.revision;
        const c = this.journal.conflicts[row.key];
        if (c) {
          c.remote = row.value;
          c.revision = row.revision;
        }
      }
      const updates = this.codec.applyRows(rows, this.journal.pending, this.readCache());
      this.writeCache(updates);
      this.persist();
      const conflicts = Object.keys(this.journal.conflicts).length;
      const pending = Object.keys(this.journal.pending).length;
      this.update({
        phase: conflicts ? "conflict" : pending ? "syncing" : "synced",
        message: conflicts
          ? "Есть разные отметки одного пункта — выберите версию"
          : pending
            ? "Отправляем оставшиеся изменения"
            : "Все изменения сохранены в аккаунте",
        lastSync: Date.now(),
      });
      if (pending > conflicts) this.schedule();
    } catch (e) {
      if (generation !== this.generation || !this.started) return;
      const code = (e as { code?: string })?.code;
      this.update({
        phase: "error",
        message:
          code === "PGRST202" || code === "42P01"
            ? "Облачное хранилище ещё не подготовлено. Выполните SQL из инструкции подключения."
            : "Не удалось связаться с облаком. Локальные изменения сохранены; повторим при подключении или по кнопке.",
      });
    } finally {
      this.running = false;
    }
  }
  resolve(key: string, choice: "local" | "cloud") {
    const conflict = this.journal.conflicts[key];
    if (!conflict) return;
    try {
      if (choice === "local") {
        this.journal.pending[key] = {
          key,
          value: conflict.local,
          base_revision: conflict.revision,
          mutation_id: crypto.randomUUID(),
        };
      } else {
        delete this.journal.pending[key];
        this.writeCache(
          this.codec.applyRows(
            [
              {
                key,
                value: conflict.remote,
                revision: conflict.revision,
                mutation_id: crypto.randomUUID(),
              },
            ],
            {},
            this.readCache(),
          ),
        );
      }
      delete this.journal.conflicts[key];
      this.persist();
      this.update({ phase: "syncing", message: "Сохраняем выбранную версию" });
      this.schedule();
    } catch {
      this.update({
        phase: "error",
        message:
          "Не удалось сохранить выбранную версию. Освободите место в хранилище браузера.",
      });
    }
  }
}
