import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // NOTE: this used to hand-split vendor code into fixed chunks
    // (vendor-react / vendor-radix / vendor-supabase / vendor-charts) via
    // `manualChunks`. That forced Rollup to generate several *output*
    // chunks that all reference each other (e.g. the lazy-loaded
    // OperatorScreen/PublicScoreboard route chunks import from
    // vendor-radix, which itself imports from vendor-react, which is also
    // imported directly by the route chunk) — a circular relationship at
    // the bundled-chunk level, even though there's no circular import in
    // the source. `madge` won't catch this because it only looks at
    // source imports, not generated chunks.
    // In the browser (dev server / hosted build) this is usually masked
    // because HTTP/2 fetches all chunks in parallel and the ES module
    // loader resolves the graph correctly regardless of arrival order.
    // But the desktop app loads index.html via `file://`
    // (electron/main.cjs `win.loadFile`), where chunk fetches are
    // sequential and far more order-sensitive — under the wrong load
    // order a chunk's top-level code can run before a chunk it depends on
    // has finished initializing, which throws exactly the app's crash:
    // "Cannot access 'X' before initialization" (a TDZ ReferenceError),
    // caught by ErrorBoundary and shown as the "حدث خطأ غير متوقع" screen.
    // Removing the manual split lets Rollup compute chunk boundaries from
    // the real dependency graph, which never produces this circularity.
    chunkSizeWarningLimit: 1000,
  },
}));
