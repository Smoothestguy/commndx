import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  // Listen for messages from main process
  onMainProcessMessage: (callback) => {
    ipcRenderer.on(
      "main-process-message",
      (_event, message) => callback(message)
    );
  },
  // Auto-update functions
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, info) => callback(info));
  },
  // Check if running in Electron
  isElectron: true
});
