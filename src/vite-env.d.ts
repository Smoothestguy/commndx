/// <reference types="vite/client" />

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
