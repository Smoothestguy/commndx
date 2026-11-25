export type SigSaveOutcome = "signed" | "uploading" | "offline";
type Deps = {
  online: () => boolean;
  /** Resolves true when the server says this stay already has a signature. Throws on network failure. */
  isSigned: () => Promise<boolean>;
  /** Resolves true when save returned ok. Throws on network failure. */
  save: () => Promise<boolean>;
  timeoutMs?: number;
};
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

/** After a committed check-in: never block the worker on the signature. */
export async function saveCommittedSignature({ online, isSigned, save, timeoutMs = 10_000 }: Deps): Promise<SigSaveOutcome> {
  if (!online()) return "offline";
  const check = async () => { try { return (await withTimeout(isSigned(), timeoutMs)) === true; } catch { return false; } };
  if (await check()) return "signed";
  let saved: boolean | "timeout" = false, failed = false;
  try { saved = await withTimeout(save(), timeoutMs); } catch { failed = true; }
  if (saved === true) return "signed";
  if (failed && !online()) return "offline";
  if (await check()) return "signed";
  return "uploading";
}
