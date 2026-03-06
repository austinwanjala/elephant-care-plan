// vite.config.ts
import { defineConfig } from "file:///C:/Users/AUSTY/dyad-apps/elephant-care-plann/node_modules/.pnpm/vite@5.4.21_@types+node@22.19.7/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/AUSTY/dyad-apps/elephant-care-plann/node_modules/.pnpm/@vitejs+plugin-react-swc@3._169e0fd9ef335513015f93764fd52c59/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/AUSTY/dyad-apps/elephant-care-plann/node_modules/.pnpm/lovable-tagger@1.1.13_vite@5.4.21_@types+node@22.19.7_/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\AUSTY\\dyad-apps\\elephant-care-plann";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  define: {
    // Map the bare 'WebSdk' import in @digitalpersona/devices to the global
    // loaded by the real WebSdk script tag in index.html
    "WebSdk": "window.WebSdk"
  },
  optimizeDeps: {
    // We don't need to force inclusion if we have proper ESM aliases
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      // Force ESM versions to avoid UMD/named-export issues in Vite
      "@digitalpersona/core": path.resolve(__vite_injected_original_dirname, "./node_modules/@digitalpersona/core/dist/es6/index.js"),
      "@digitalpersona/devices": path.resolve(__vite_injected_original_dirname, "./node_modules/@digitalpersona/devices/dist/es6/index.js"),
      // Shim satisfies bare `import 'WebSdk'` in @digitalpersona/devices.
      // The shim defers to the real window.WebSdk loaded via <script> in index.html.
      "WebSdk": path.resolve(__vite_injected_original_dirname, "./src/shims/WebSdk.js")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBVVNUWVxcXFxkeWFkLWFwcHNcXFxcZWxlcGhhbnQtY2FyZS1wbGFublwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQVVTVFlcXFxcZHlhZC1hcHBzXFxcXGVsZXBoYW50LWNhcmUtcGxhbm5cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0FVU1RZL2R5YWQtYXBwcy9lbGVwaGFudC1jYXJlLXBsYW5uL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MCxcclxuICAgIGhtcjoge1xyXG4gICAgICBvdmVybGF5OiBmYWxzZSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBkZWZpbmU6IHtcclxuICAgIC8vIE1hcCB0aGUgYmFyZSAnV2ViU2RrJyBpbXBvcnQgaW4gQGRpZ2l0YWxwZXJzb25hL2RldmljZXMgdG8gdGhlIGdsb2JhbFxyXG4gICAgLy8gbG9hZGVkIGJ5IHRoZSByZWFsIFdlYlNkayBzY3JpcHQgdGFnIGluIGluZGV4Lmh0bWxcclxuICAgIFwiV2ViU2RrXCI6IFwid2luZG93LldlYlNka1wiLFxyXG4gIH0sXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGZvcmNlIGluY2x1c2lvbiBpZiB3ZSBoYXZlIHByb3BlciBFU00gYWxpYXNlc1xyXG4gIH0sXHJcbiAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAvLyBGb3JjZSBFU00gdmVyc2lvbnMgdG8gYXZvaWQgVU1EL25hbWVkLWV4cG9ydCBpc3N1ZXMgaW4gVml0ZVxyXG4gICAgICBcIkBkaWdpdGFscGVyc29uYS9jb3JlXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9ub2RlX21vZHVsZXMvQGRpZ2l0YWxwZXJzb25hL2NvcmUvZGlzdC9lczYvaW5kZXguanNcIiksXHJcbiAgICAgIFwiQGRpZ2l0YWxwZXJzb25hL2RldmljZXNcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9AZGlnaXRhbHBlcnNvbmEvZGV2aWNlcy9kaXN0L2VzNi9pbmRleC5qc1wiKSxcclxuICAgICAgLy8gU2hpbSBzYXRpc2ZpZXMgYmFyZSBgaW1wb3J0ICdXZWJTZGsnYCBpbiBAZGlnaXRhbHBlcnNvbmEvZGV2aWNlcy5cclxuICAgICAgLy8gVGhlIHNoaW0gZGVmZXJzIHRvIHRoZSByZWFsIHdpbmRvdy5XZWJTZGsgbG9hZGVkIHZpYSA8c2NyaXB0PiBpbiBpbmRleC5odG1sLlxyXG4gICAgICBcIldlYlNka1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL3NoaW1zL1dlYlNkay5qc1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdVLFNBQVMsb0JBQW9CO0FBQzdWLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQTtBQUFBO0FBQUEsSUFHTixVQUFVO0FBQUEsRUFDWjtBQUFBLEVBQ0EsY0FBYztBQUFBO0FBQUEsRUFFZDtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLGlCQUFpQixnQkFBZ0IsQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQzlFLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQTtBQUFBLE1BRXBDLHdCQUF3QixLQUFLLFFBQVEsa0NBQVcsdURBQXVEO0FBQUEsTUFDdkcsMkJBQTJCLEtBQUssUUFBUSxrQ0FBVywwREFBMEQ7QUFBQTtBQUFBO0FBQUEsTUFHN0csVUFBVSxLQUFLLFFBQVEsa0NBQVcsdUJBQXVCO0FBQUEsSUFDM0Q7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
