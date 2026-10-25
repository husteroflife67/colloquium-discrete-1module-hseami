import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const key = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  let privateKey = key.startsWith("sb_secret_");
  try {
    privateKey ||=
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role === "service_role";
  } catch {
    /* Public publishable keys are not JWTs. */
  }
  if (privateKey)
    throw Error(
      "Only a public Supabase Publishable/anon key may be used in a browser build. Remove the private key and rotate it in Supabase.",
    );
  return { base: env.VITE_BASE_PATH || "/", plugins: [react(), tailwindcss()] };
});
