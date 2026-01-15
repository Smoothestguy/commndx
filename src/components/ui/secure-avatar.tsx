import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSecureUrl } from "@/hooks/useSecureUrl";
import { cn } from "@/lib/utils";

interface SecureAvatarProps {
  bucket: string;
  photoUrl?: string | null;
  fallback: React.ReactNode;
  alt?: string;
  className?: string;
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
}: SecureAvatarProps) {
  const { url: secureUrl, loading } = useSecureUrl(bucket, photoUrl);

  return (
    <Avatar className={cn(className)}>
      <AvatarImage 
        src={secureUrl || undefined} 
        alt={alt}
        className={loading ? "opacity-0" : "opacity-100 transition-opacity"}
      />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}
