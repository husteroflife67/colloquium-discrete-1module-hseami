import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();
let configurationError = "";
function configuredClient() {
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      throw Error("URL");
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      throw Error("URL");
    let privateKey = key.startsWith("sb_secret_");
    try {
      privateKey ||=
        JSON.parse(
          atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
        ).role === "service_role";
    } catch {
      /* Publishable keys need not be JWTs. */
    }
    if (privateKey) {
      configurationError =
        "В настройках сборки указан приватный ключ. Удалите его, перевыпустите в Supabase и используйте только Publishable/anon key.";
      return null;
    }
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  } catch {
    configurationError =
      "Публичные настройки синхронизации заполнены неверно. Проверьте URL проекта и Publishable/anon key.";
    return null;
  }
}
export const supabase = configuredClient();
export const syncConfigured = Boolean(supabase);
export { configurationError };
