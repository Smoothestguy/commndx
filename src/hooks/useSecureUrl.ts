import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPathFromUrl } from "@/utils/signedUrlUtils";

const EXPIRES_IN = 7200; // 2h signed URLs
const STALE_MS = 45 * 60 * 1000; // reuse for 45 min, well inside expiry

/**
 * Buckets that are PUBLIC in this project: their URLs are directly usable.
 * Anything matching /object/public/<publicBucket>/ must be used as-is —
 * routing it through createSignedUrls silently breaks rendering.
 */
const PUBLIC_BUCKETS = new Set(["application-files", "form-uploads", "logos", "dashboard-backgrounds"]);

/**
 * Batches signed-URL requests per bucket: every avatar that mounts in the same
 * tick is resolved with ONE createSignedUrls call instead of one request each.
 */
type Pending = { resolve: (u: string | null) => void; reject: (e: unknown) => void; fallback: string | null };
const queues = new Map<string, Map<string, Pending[]>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function flush(bucket: string) {
  const queue = queues.get(bucket);
  queues.delete(bucket);
  timers.delete(bucket);
  if (!queue || queue.size === 0) return;
  const paths = [...queue.keys()];
  // Chunk to keep request bodies reasonable.
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    supabase.storage
      .from(bucket)
      .createSignedUrls(chunk, EXPIRES_IN)
      .then(({ data, error }) => {
        if (error) throw error;
        const byPath = new Map((data ?? []).map((d: any) => [d.path, d.error ? null : d.signedUrl]));
        chunk.forEach((p) =>
          queue.get(p)?.forEach((w) => w.resolve(byPath.get(p) ?? w.fallback ?? null))
        );
      })
      .catch((err) =>
        chunk.forEach((p) =>
          queue.get(p)?.forEach((w) => (w.fallback ? w.resolve(w.fallback) : w.reject(err)))
        )
      );
  }
}

function requestSignedUrl(bucket: string, path: string, fallback: string | null = null): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let queue = queues.get(bucket);
    if (!queue) {
      queue = new Map();
      queues.set(bucket, queue);
    }
    const list = queue.get(path) ?? [];
    list.push({ resolve, reject, fallback });
    queue.set(path, list);
    if (!timers.has(bucket)) timers.set(bucket, setTimeout(() => flush(bucket), 10));
  });
}

/** Returns a directly-usable URL (no signing needed) or null if signing is required. */
function directUrl(bucket: string, urlOrPath: string): string | null {
  if (urlOrPath.startsWith("data:") || urlOrPath.startsWith("blob:")) return urlOrPath;
  if (urlOrPath.startsWith("http")) {
    // Storage URL? Public buckets are used as-is; private-bucket URLs need signing.
    const m = urlOrPath.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
    if (m) return PUBLIC_BUCKETS.has(m[1]) ? urlOrPath : null;
    // Anything else (OAuth photos, already-signed URLs) is used as-is.
    return urlOrPath;
  }
  return null;
}

/**
 * Signed URL for private bucket access, cached in react-query by bucket+path
 * and batched across simultaneous mounts.
 */
export function useSecureUrl(bucket: string, urlOrPath: string | null | undefined) {
  const direct = urlOrPath ? directUrl(bucket, urlOrPath) : null;
  const path = urlOrPath && !direct ? getPathFromUrl(urlOrPath, bucket) : "";
  // Safety net: if the original input was an absolute URL, fall back to it when
  // the signing call fails instead of showing nothing.
  const fallback = urlOrPath && urlOrPath.startsWith("http") ? urlOrPath : null;

  const q = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: () => requestSignedUrl(bucket, path, fallback),
  });

  if (direct) return { url: direct, loading: false, error: null as string | null };
  return {
    url: q.data ?? null,
    loading: !!path && q.isLoading,
    error: q.error ? (q.error as Error).message : null,
  };
}
