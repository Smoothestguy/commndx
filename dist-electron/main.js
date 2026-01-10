import { ipcMain, app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pkg from "electron-updater";
import electronLog from "electron-log";
const { autoUpdater } = pkg;
const log = electronLog.default || electronLog;
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
let mainWindow = null;
let isInitialized = false;
function initAutoUpdater(win2) {
  mainWindow = win2;
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  const sendStatusToWindow = (status, data) => {
    if (mainWindow) {
      mainWindow.webContents.send("update-status", { status, data });
    }
  };
  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("checking");
    log.info("Checking for updates...");
  });
  autoUpdater.on("update-available", (info) => {
    sendStatusToWindow("available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
    log.info("Update available:", info.version);
  });
  autoUpdater.on("update-not-available", (info) => {
    sendStatusToWindow("not-available", { version: info.version });
    log.info("Update not available. Current version is latest.");
  });
  autoUpdater.on("error", (err) => {
    sendStatusToWindow("error", { message: err.message });
    log.error("Update error:", err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    sendStatusToWindow("downloading", {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
    log.info(`Download progress: ${progressObj.percent.toFixed(1)}%`);
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendStatusToWindow("downloaded", {
      version: info.version,
      releaseDate: info.releaseDate
    });
    log.info("Update downloaded:", info.version);
  });
  ipcMain.handle("check-for-updates", async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      log.error("Check for updates failed:", err);
      return null;
    }
  });
  ipcMain.handle("download-update", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (err) {
      log.error("Download update failed:", err);
      return false;
    }
  });
  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("Initial update check failed:", err);
    });
  }, 3e3);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPackaged = app.isPackaged;
let RENDERER_DIST;
let VITE_PUBLIC;
if (isPackaged) {
  RENDERER_DIST = __dirname;
  VITE_PUBLIC = RENDERER_DIST;
} else {
  process.env.APP_ROOT = path.join(__dirname, "..");
  RENDERER_DIST = path.join(process.env.APP_ROOT, "dist-electron");
  VITE_PUBLIC = process.env["VITE_DEV_SERVER_URL"] ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
}
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(__dirname);
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#000000",
    show: false
  });
  console.log("[Electron] isPackaged:", isPackaged);
  console.log("[Electron] __dirname:", __dirname);
  console.log("[Electron] RENDERER_DIST:", RENDERER_DIST);
  win.once("ready-to-show", () => {
    win == null ? void 0 : win.show();
    if (!VITE_DEV_SERVER_URL) {
      initAutoUpdater(win);
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
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
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
ipcMain.handle("get-platform", () => {
  return process.platform;
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  VITE_DEV_SERVER_URL
};
