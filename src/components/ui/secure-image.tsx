import { useState, useEffect } from "react";
import { getSignedUrl } from "@/utils/signedUrlUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SecureImageProps {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Component for displaying images from private storage buckets
 * Automatically fetches signed URLs for secure access
 */
export function SecureImage({ 
  bucket, 
  path, 
  alt, 
  className, 
  fallback,
  onLoad,
  onError 
}: SecureImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setUrl(null);
      return;
    }
    
    let cancelled = false;
    setLoading(true);
    setImageError(false);
    
    getSignedUrl(bucket, path)
      .then((signedUrl) => {
        if (!cancelled) {
          setUrl(signedUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageError(true);
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
  }, [bucket, path]);

  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  if (loading) {
    return <Skeleton className={cn("rounded", className)} />;
  }

  if (!url || imageError) {
    return <>{fallback}</> || null;
  }
  
  return (
    <img 
      src={url} 
      alt={alt} 
      className={className}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
