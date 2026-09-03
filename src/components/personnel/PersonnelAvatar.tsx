import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useSecureUrl } from "@/hooks/useSecureUrl";
import { useState } from "react";
import { PhotoLightbox } from "@/components/shared/PhotoLightbox";

interface PersonnelAvatarProps {
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** When true, clicking the avatar opens a full-size photo viewer. */
  enableLightbox?: boolean;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function PersonnelAvatar({
  photoUrl,
  firstName,
  lastName,
  size = "sm",
  className,
  enableLightbox = false,
}: PersonnelAvatarProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  
  // Use signed URL for personnel photos (private bucket)
  const { url: securePhotoUrl } = useSecureUrl('personnel-photos', photoUrl);

  const clickable = enableLightbox && !!securePhotoUrl;

  return (
    <>
      <Avatar
        className={cn(sizeClasses[size], clickable && "cursor-pointer", className)}
        onClick={clickable ? () => setLightboxOpen(true) : undefined}
      >
        <AvatarImage
          src={securePhotoUrl || undefined}
          alt={`${firstName} ${lastName}`}
          className="object-cover"
        />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>
      {clickable && (
        <PhotoLightbox
          photos={[{ url: securePhotoUrl as string, caption: `${firstName} ${lastName}` }]}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </>
  );
}
