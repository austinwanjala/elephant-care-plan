import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
      // The shim satisfies requirements of @digitalpersona packages if they are ever loaded,
      // though we are now using globals via /src/lib/digitalpersona.ts
      "WebSdk": path.resolve(__dirname, "./src/shims/WebSdk.js"),
    },
  },
}));
