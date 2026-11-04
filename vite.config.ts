import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// These callbacks are serialized into the generated worker, not executed by Node.
declare const self: { location: { origin: string } };
declare const caches: {
  keys(): Promise<string[]>;
  open(name: string): Promise<{ match(url: string, options: { ignoreSearch: boolean }): Promise<Response | undefined> }>;
};

// Build version: v3 - Force cache invalidation
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ['.manus.computer'],
  },
  plugins: [react(), mode === "development" && componentTagger(), VitePWA({
    strategies: "generateSW", filename: "sw.js", scope: "/punch/", manifest: false,
    injectRegister: null, registerType: "autoUpdate", devOptions: { enabled: false },
    workbox: {
      clientsClaim: true, skipWaiting: true, navigateFallback: null,
      globPatterns: ["**/*.{js,css,html,woff2}"], maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      runtimeCaching: [{
        urlPattern: ({ url, request }) => url.origin === self.location.origin && url.pathname.startsWith("/punch/") && !url.pathname.startsWith("/~oauth") && request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "site-punch-shell", networkTimeoutSeconds: 4,
          plugins: [{
            cacheKeyWillBeUsed: async () => new URL("/punch/", self.location.origin).href,
            handlerDidError: async () => {
              for (const name of await caches.keys()) {
                if (!name.includes("precache")) continue;
                const response = await (await caches.open(name)).match(new URL("/index.html", self.location.origin).href, { ignoreSearch: true });
                if (response) return response;
              }
              return Response.error();
            },
          }],
        },
      }],
    },
  })].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["pdf-lib", "exceljs", "jspdf"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "pdf-libs": ["pdf-lib", "jspdf"],
          "excel-libs": ["exceljs", "xlsx"],
          "map-libs": ["mapbox-gl"],
          "vendor": ["react", "react-dom", "react-router-dom"],
          "ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs"],
        },
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
}));
