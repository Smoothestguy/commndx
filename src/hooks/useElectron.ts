import { useState, useEffect, useCallback } from "react";

interface UpdateInfo {
  status: string;
  data?: {
    version?: string;
    percent?: number;
    message?: string;
  };
}

/**
 * Hook to detect if running in Electron and access Electron APIs
 */
export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Check if electronAPI is available (exposed via preload)
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      setIsElectron(true);

      // Get platform info
      window.electronAPI.getPlatform().then(setPlatform).catch(console.error);

      // Get app version
      window.electronAPI
        .getAppVersion()
        .then(setAppVersion)
        .catch(console.error);

      // Listen for main process messages
      window.electronAPI.onMainProcessMessage((message) => {
        console.log("Message from main process:", message);
      });

      // Listen for update status
      window.electronAPI.onUpdateStatus?.((info) => {
        setUpdateInfo(info);
      });
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (window.electronAPI?.checkForUpdates) {
      return await window.electronAPI.checkForUpdates();
    }
    return null;
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (window.electronAPI?.downloadUpdate) {
      return await window.electronAPI.downloadUpdate();
    }
    return false;
  }, []);

  const installUpdate = useCallback(() => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  }, []);

  return {
    isElectron,
    platform,
    appVersion,
    isMac: platform === "darwin",
    isWindows: platform === "win32",
    isLinux: platform === "linux",
    // Update functionality
    updateInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}

/**
 * Simple check if running in Electron (can be used outside of React)
 */
export function isRunningInElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectron;
}
