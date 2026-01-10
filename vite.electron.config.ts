import { defineConfig } from "vite";
import path from "path";
import electron from "vite-plugin-electron";

// This config is specifically for building Electron main/preload files
export default defineConfig({
  base: "./", // Use relative paths for file:// protocol in packaged Electron app
  plugins: [
    electron([
      {
        // Main process entry file
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: false,
            rollupOptions: {
              external: ["electron", "electron-updater", "electron-log"],
            },
          },
        },
      },
      {
        // Preload scripts
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: false,
            rollupOptions: {
              external: ["electron"],
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
