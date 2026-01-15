import { useState, useEffect } from "react";
import { getSignedUrl } from "@/utils/signedUrlUtils";

/**
 * Hook to fetch and manage signed URLs for private bucket access
 * Handles both legacy full URLs and new path-only format
 */
export function useSecureUrl(bucket: string, urlOrPath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!urlOrPath) {
      setUrl(null);
      setLoading(false);
      return;
    }
    
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    getSignedUrl(bucket, urlOrPath)
      .then((signedUrl) => {
        if (!cancelled) {
          setUrl(signedUrl);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, urlOrPath]);

  return { url, loading, error };
}
