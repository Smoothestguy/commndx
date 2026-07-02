// Global ambient types. `moduleDetection: "force"` in tsconfig treats every
// file as a module, so we must use `declare global {}` to expose these
// symbols globally.

export {};

declare global {
  namespace NodeJS {
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
}
