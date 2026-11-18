export const SUBMIT_BACKOFF_MS = [1000, 3000, 6000] as const;
export const CONNECTION_SAVED_MESSAGE = "Connection problem — your answers are saved. Tap Submit again when you have signal. / Problema de conexión — tus respuestas están guardadas. Toca Enviar de nuevo cuando tengas señal.";

export function isSubmitNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string; status?: number; context?: { status?: number } };
  if (e.status || e.context?.status) return false;
  return e.name === 'FunctionsFetchError' || /load failed|failed to fetch|networkerror|network request failed|fetch failed/i.test(e.message ?? '');
}

export async function retryApplicationSubmit<T>(submit: () => Promise<T>, pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await submit(); }
    catch (error) {
      const delay = SUBMIT_BACKOFF_MS[attempt];
      if (!isSubmitNetworkError(error) || delay === undefined) throw error;
      await pause(delay);
    }
  }
}

export function readApplicationDraft(key: string) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || 'null');
    return draft && Date.now() - draft.savedAt < 24 * 60 * 60 * 1000 ? draft : null;
  } catch { return null; }
}