import { app, BrowserWindow, shell, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initAutoUpdater } from "./updater";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine if we're running in a packaged app or development
const isPackaged = app.isPackaged;

// Path resolution differs between dev and production
// In development:
//   __dirname = /project/dist-electron
//   dist = /project/dist
// In production (packaged):
//   __dirname = /path/to/app.asar/dist-electron
//   dist = /path/to/app.asar/dist

let RENDERER_DIST: string;
let VITE_PUBLIC: string;

if (isPackaged) {
  // In packaged app, dist-electron contains the web app files (index.html and assets)
  // since vite.electron.config.ts builds the renderer output there
  RENDERER_DIST = __dirname;
  VITE_PUBLIC = RENDERER_DIST;
} else {
  // In development, use the standard structure
  process.env.APP_ROOT = path.join(__dirname, "..");
  RENDERER_DIST = path.join(process.env.APP_ROOT, "dist-electron");
  VITE_PUBLIC = process.env["VITE_DEV_SERVER_URL"]
    ? path.join(process.env.APP_ROOT, "public")
    : RENDERER_DIST;
}

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(__dirname);

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#000000",
    show: false,
  });

  // Debug logging for path resolution
  console.log("[Electron] isPackaged:", isPackaged);
  console.log("[Electron] __dirname:", __dirname);
  console.log("[Electron] RENDERER_DIST:", RENDERER_DIST);

  win.once("ready-to-show", () => {
    win?.show();
    if (!VITE_DEV_SERVER_URL) {
      initAutoUpdater(win!);
    }
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, "index.html");
    console.log("[Electron] Loading:", indexPath);
    win.loadFile(indexPath);
  }
}

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle IPC calls from renderer
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-platform", () => {
  return process.platform;
});

app.whenReady().then(createWindow);
