import { contextBridge, ipcRenderer } from "electron";

// Update status types
export type UpdateStatus =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateInfo {
  status: UpdateStatus;
  data?: {
    version?: string;
    releaseDate?: string;
    releaseNotes?: string;
    percent?: number;
    transferred?: number;
    total?: number;
    bytesPerSecond?: number;
    message?: string;
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // Listen for messages from main process
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on("main-process-message", (_event, message) =>
      callback(message)
    );
  },

  // Auto-update functions
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on("update-status", (_event, info) => callback(info));
  },

  // Deep link handling for OAuth
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on("deep-link", (_event, url) => callback(url));
  },

  // Open URL in external browser (for OAuth)
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  // Check if running in Electron
  isElectron: true,
});

// Type declarations for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      onMainProcessMessage: (callback: (message: string) => void) => void;
      // Auto-update
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<boolean>;
      installUpdate: () => void;
      onUpdateStatus: (callback: (info: UpdateInfo) => void) => void;
      // Deep link / OAuth
      onDeepLink: (callback: (url: string) => void) => void;
      openExternal: (url: string) => Promise<void>;
      isElectron: boolean;
    };
  }
}
