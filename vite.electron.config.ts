import { defineConfig } from "vite";
import path from "path";
import electron from "vite-plugin-electron";

// This config is specifically for building Electron main/preload files
export default defineConfig({
  base: "./", // Use relative paths for file:// protocol in packaged Electron app
  plugins: [
    electron([
      {
        // Main process entry file - must be CommonJS for Electron
        // Using .cjs extension to override "type": "module" in package.json
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: false,
            lib: {
              entry: "electron/main.ts",
              formats: ["cjs"],
            },
            rollupOptions: {
              external: ["electron", "electron-updater", "electron-log"],
              output: {
                entryFileNames: "main.cjs",
              },
            },
          },
        },
      },
      {
        // Preload scripts - must be CommonJS for Electron
        // Using .cjs extension to override "type": "module" in package.json
        entry: "electron/preload.ts",
        onstart(options) {
          // Notify renderer
          options.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            minify: false,
            lib: {
              entry: "electron/preload.ts",
              formats: ["cjs"],
            },
            rollupOptions: {
              external: ["electron"],
              output: {
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-electron",
  },
});
