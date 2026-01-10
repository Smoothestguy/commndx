import pkg from "electron-updater";
const { autoUpdater } = pkg;
import { BrowserWindow, ipcMain } from "electron";
import electronLog from "electron-log";
const log = electronLog.default || electronLog;

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;

// Disable auto download - we'll let the user decide
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;
let isInitialized = false;

export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;

  // Prevent duplicate handler registration
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  // Send update status to renderer
  const sendStatusToWindow = (status: string, data?: any) => {
    if (mainWindow) {
      mainWindow.webContents.send("update-status", { status, data });
    }
  };

  // Check for updates events
  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("checking");
    log.info("Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    sendStatusToWindow("available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
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
      bytesPerSecond: progressObj.bytesPerSecond,
    });
    log.info(`Download progress: ${progressObj.percent.toFixed(1)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatusToWindow("downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
    log.info("Update downloaded:", info.version);
  });

  // IPC handlers for renderer
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

  // Check for updates on startup (after a short delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("Initial update check failed:", err);
    });
  }, 3000);
}

export function checkForUpdates() {
  return autoUpdater.checkForUpdates();
}
