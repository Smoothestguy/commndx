import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useSecureUrl } from "@/hooks/useSecureUrl";

interface PersonnelAvatarProps {
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
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
}: PersonnelAvatarProps) {
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  
  // Use signed URL for personnel photos (private bucket)
  const { url: securePhotoUrl } = useSecureUrl('personnel-photos', photoUrl);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={securePhotoUrl || undefined} alt={`${firstName} ${lastName}`} />
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
