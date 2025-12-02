import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface BadgePreviewProps {
  personnel: Personnel;
  template: {
    orientation: string;
    background_color?: string | null;
    fields: Array<{
      field_name: string;
      is_enabled: boolean;
    }>;
  };
}

export const BadgePreview = ({ personnel, template }: BadgePreviewProps) => {
  const isEnabled = (fieldName: string) =>
    template.fields.some((f) => f.field_name === fieldName && f.is_enabled);

  const isLandscape = template.orientation === "landscape";

  return (
    <Card
      className={`p-6 ${isLandscape ? "w-[400px] h-[250px]" : "w-[250px] h-[400px]"}`}
      style={{
        backgroundColor: template.background_color || "#ffffff",
      }}
    >
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        {isEnabled("photo") && (
          <Avatar className="h-24 w-24">
            <AvatarImage src={personnel.photo_url || ""} />
            <AvatarFallback className="text-2xl">
              {personnel.first_name[0]}
              {personnel.last_name[0]}
            </AvatarFallback>
          </Avatar>
        )}

        {isEnabled("personnel_number") && (
          <div className="text-sm text-muted-foreground font-mono">
            {personnel.personnel_number}
          </div>
        )}

        {(isEnabled("first_name") || isEnabled("last_name")) && (
          <h3 className="text-xl font-bold text-center">
            {personnel.first_name} {personnel.last_name}
          </h3>
        )}

        {isEnabled("phone") && personnel.phone && (
          <div className="text-sm">{personnel.phone}</div>
        )}

        {isEnabled("email") && personnel.email && (
          <div className="text-xs text-muted-foreground">{personnel.email}</div>
        )}

        {isEnabled("everify_status") && personnel.everify_status === "verified" && (
          <Badge className="bg-green-600">E-Verified</Badge>
        )}

        {isEnabled("qr_code") && (
          <div className="mt-auto pt-2">
            <div className="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
              <span className="text-xs text-muted-foreground">QR</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
