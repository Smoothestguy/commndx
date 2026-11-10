import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSecureUrl } from "@/hooks/useSecureUrl";
import { cn } from "@/lib/utils";
import { PhotoLightbox } from "@/components/shared/PhotoLightbox";
import { useOptimizedPhoto } from '@/hooks/useOptimizedPhoto';

interface SecureAvatarProps {
  bucket: string;
  photoUrl?: string | null;
  fallback: React.ReactNode;
  alt?: string;
  className?: string;
  /** When true, clicking the avatar opens the photo full size. */
  enableLightbox?: boolean;
}

/**
 * Avatar component that fetches signed URLs for private bucket images
 * Falls back gracefully while loading or if URL generation fails
 */
export function SecureAvatar({
  bucket,
  photoUrl,
  fallback,
  alt = "Avatar",
  className,
  enableLightbox = false,
}: SecureAvatarProps) {
  const optimized = useOptimizedPhoto(bucket, photoUrl);
  const { url: secureUrl, loading } = useSecureUrl(optimized.bucket ?? bucket, optimized.loading ? null : optimized.photo);
  const [open, setOpen] = useState(false);
  const { url: fullUrl } = useSecureUrl(bucket, open ? photoUrl : null);
  const clickable = enableLightbox && !!secureUrl;

  return (
    <>
      <Avatar
        className={cn(clickable && "cursor-pointer", className)}
        onClick={clickable ? () => setOpen(true) : undefined}
      >
        <AvatarImage
          src={secureUrl || undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn("object-cover", loading ? "opacity-0" : "opacity-100 transition-opacity")}
        />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {clickable && (
        <PhotoLightbox
          photos={[{ url: fullUrl ?? secureUrl ?? '', caption: alt }]}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
