/** Remove only obsolete row-selection storage; never touch list preferences. */
export function clearLegacySelection(storage: Pick<Storage, 'removeItem'>, key: string) {
  try {
    storage.removeItem(`ss:${key}`);
    storage.removeItem(key);
  } catch { /* Storage may be unavailable. */ }
}