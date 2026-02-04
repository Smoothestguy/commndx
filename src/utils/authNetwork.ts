/**
 * Auth Network Utilities
 * Provides timeout handling, health checks, and error classification for authentication flows
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUILD_VERSION = import.meta.env.VITE_BUILD_TIMESTAMP || new Date().toISOString().slice(0, 10);

// Log build info on module load (helps identify stale bundles)
console.info(`[Build] version: ${BUILD_VERSION}, origin: ${window.location.origin}`);

export interface NetworkError {
  isNetworkError: true;
  userMessage: string;
  technicalDetails: string;
  originalError: unknown;
}

export interface AuthHealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Wraps a promise with a timeout
 * Returns the result or throws a timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = "Operation"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Checks if an error is a network failure (vs. an API error like "invalid credentials")
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("aborted") ||
      msg.includes("timeout") ||
      msg.includes("net::") ||
      msg.includes("dns") ||
      msg.includes("connection")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Classifies an error and returns a user-safe message plus technical details for logging
 */
export function classifyNetworkError(error: unknown): NetworkError {
  const originalError = error;
  let userMessage = "Something went wrong. Please try again.";
  let technicalDetails = "";

  const errMsg = error instanceof Error ? error.message : String(error);
  technicalDetails = `Error: ${errMsg} | Origin: ${window.location.origin} | Backend defined: ${!!SUPABASE_URL}`;

  if (error instanceof TypeError && errMsg.includes("Failed to fetch")) {
    userMessage = "Can't reach the sign-in service. Please check your connection and try again.";
    technicalDetails += " | Type: Failed to fetch";
  } else if (errMsg.toLowerCase().includes("timeout")) {
    userMessage = "The request took too long. Please check your connection and try again.";
    technicalDetails += " | Type: Timeout";
  } else if (errMsg.toLowerCase().includes("network")) {
    userMessage = "Network error. Please check your internet connection.";
    technicalDetails += " | Type: Network";
  } else if (errMsg.toLowerCase().includes("aborted")) {
    userMessage = "The request was cancelled. Please try again.";
    technicalDetails += " | Type: Aborted";
  }

  console.error("[Auth Network]", technicalDetails);

  return {
    isNetworkError: true,
    userMessage,
    technicalDetails,
    originalError,
  };
}

/**
 * Pings the Supabase auth health endpoint to check if the service is reachable
 * Returns quickly to give fast feedback before attempting login
 */
export async function pingAuthHealth(timeoutMs = 5000): Promise<AuthHealthResult> {
  if (!SUPABASE_URL) {
    console.error("[Auth Health] SUPABASE_URL is not defined");
    return {
      healthy: false,
      latencyMs: 0,
      error: "Backend URL not configured",
    };
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use GET request instead of HEAD for better CORS compatibility
    // The /auth/v1/settings endpoint is publicly accessible and CORS-friendly
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    // Any HTTP response means the server is reachable (even 4xx/5xx)
    console.info(`[Auth Health] Ping successful: ${response.status} in ${latencyMs}ms`);
    return {
      healthy: true,
      latencyMs,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[Auth Health] Ping failed:", errMsg);

    return {
      healthy: false,
      latencyMs,
      error: errMsg.includes("aborted") ? "Connection timeout" : errMsg,
    };
  }
}

/**
 * Generates diagnostic info for troubleshooting (safe to show/copy)
 * Does NOT include any secrets or tokens
 */
export function getDiagnostics(): string {
  const now = new Date().toISOString();
  const diagnostics = {
    timestamp: now,
    buildVersion: BUILD_VERSION,
    origin: window.location.origin,
    pathname: window.location.pathname,
    backendConfigured: !!SUPABASE_URL,
    userAgent: navigator.userAgent.slice(0, 100),
    online: navigator.onLine,
    language: navigator.language,
  };

  return JSON.stringify(diagnostics, null, 2);
}

/**
 * Copies diagnostic info to clipboard
 */
export async function copyDiagnostics(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(getDiagnostics());
    return true;
  } catch {
    console.error("[Diagnostics] Failed to copy to clipboard");
    return false;
  }
}
