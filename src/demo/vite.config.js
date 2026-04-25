import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// Load ANTHROPIC_API_KEY (and friends) from the repo-root .env so the demo
// can call Claude directly from the browser during the live demo.
function loadRootEnv() {
  const p = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

const rootEnv = loadRootEnv();

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: 5173,
    open: true,
    fs: { allow: [path.resolve(__dirname, "../..")] },
  },
  resolve: { alias: { "@dataset": path.resolve(__dirname, "../../dataset") } },
  define: {
    "import.meta.env.VITE_ANTHROPIC_API_KEY": JSON.stringify(rootEnv.ANTHROPIC_API_KEY || ""),
  },
});
