export interface ElectronUpdateInfo {
  status:
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
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

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      onMainProcessMessage: (callback: (message: string) => void) => void;
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<boolean>;
      installUpdate: () => void;
      onUpdateStatus: (callback: (info: ElectronUpdateInfo) => void) => void;
      // Deep link / OAuth support
      onDeepLink: (callback: (url: string) => void) => void;
      openExternal: (url: string) => Promise<void>;
      isElectron: boolean;
    };
  }
}

export {};
