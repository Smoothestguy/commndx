// Global ambient types used across the app.
// Provides NodeJS.Timeout / Timer aliases for browser timer refs and
// declares optional Electron-only window.process.

declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
  type Timer = ReturnType<typeof setTimeout>;
  type Immediate = ReturnType<typeof setTimeout>;
}

interface Window {
  process?: {
    type?: string;
    [key: string]: unknown;
  };
}

export {};
