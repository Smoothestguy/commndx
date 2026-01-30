import { app, BrowserWindow, shell, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initAutoUpdater } from "./updater";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom protocol for deep links (OAuth callbacks)
const PROTOCOL = "commandx";

// Determine if we're running in a packaged app or development
const isPackaged = app.isPackaged;

// Store the deep link URL if app was opened via protocol before window is ready
let pendingDeepLink: string | null = null;

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

// Register custom protocol for deep links
// This must be done before app.whenReady()
if (process.defaultApp) {
  // Development: need to pass the script path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  // Production: just register the protocol
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Handle deep link URL
function handleDeepLink(url: string) {
  console.log("[Electron] Deep link received:", url);
  if (win && win.webContents) {
    // Send the deep link to the renderer process
    win.webContents.send("deep-link", url);
    // Focus the window
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    // Window not ready yet, store for later
    pendingDeepLink = url;
  }
}

// Single instance lock for Windows/Linux
// This ensures only one instance runs and deep links are forwarded
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    // On Windows/Linux, the deep link URL is passed via command line
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleDeepLink(url);
    }
    // Focus existing window
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// macOS: Handle deep links via open-url event
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

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

    // Send any pending deep link that was received before window was ready
    if (pendingDeepLink && win) {
      console.log("[Electron] Sending pending deep link:", pendingDeepLink);
      win.webContents.send("deep-link", pendingDeepLink);
      pendingDeepLink = null;
    }
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

// Open URL in external browser (for OAuth)
ipcMain.handle("open-external", (_event, url: string) => {
  console.log("[Electron] Opening external URL:", url);
  return shell.openExternal(url);
});

app.whenReady().then(createWindow);
