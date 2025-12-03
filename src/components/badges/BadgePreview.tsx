import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface BadgePreviewProps {
  personnel: Personnel;
  template: {
    orientation?: string | null;
    background_color?: string | null;
    header_color?: string | null;
    footer_color?: string | null;
    company_name?: string | null;
    company_logo_url?: string | null;
    name_color?: string | null;
    personnel_number_color?: string | null;
    label_color?: string | null;
    value_color?: string | null;
    // Field visibility - new show_* booleans
    show_photo?: boolean | null;
    show_personnel_number?: boolean | null;
    show_phone?: boolean | null;
    show_email?: boolean | null;
    show_work_authorization?: boolean | null;
    show_everify_status?: boolean | null;
    show_certifications?: boolean | null;
    show_capabilities?: boolean | null;
    show_languages?: boolean | null;
    // Legacy support
    fields?: Array<{ field_name: string; is_enabled: boolean }>;
  };
}

export const BadgePreview = ({ personnel, template }: BadgePreviewProps) => {
  // Helper to check field visibility - supports both new show_* booleans and legacy fields array
  const isEnabled = (fieldName: string): boolean => {
    const showFieldMap: Record<string, boolean | null | undefined> = {
      photo: template.show_photo,
      personnel_number: template.show_personnel_number,
      phone: template.show_phone,
      email: template.show_email,
      work_authorization: template.show_work_authorization,
      everify_status: template.show_everify_status,
      certifications: template.show_certifications,
      capabilities: template.show_capabilities,
      languages: template.show_languages,
    };

    // Check new show_* boolean first
    if (showFieldMap[fieldName] !== undefined && showFieldMap[fieldName] !== null) {
      return showFieldMap[fieldName] as boolean;
    }

    // Fallback to legacy fields array
    if (template.fields && template.fields.length > 0) {
      return template.fields.some((f) => f.field_name === fieldName && f.is_enabled);
    }

    // Default to true if not specified
    return true;
  };

  const isLandscape = template.orientation === "landscape";

  return (
    <Card
      className={`overflow-hidden flex flex-col ${isLandscape ? "w-[400px] h-[250px]" : "w-[250px] h-[400px]"}`}
      style={{ backgroundColor: template.background_color || "#ffffff" }}
    >
      {/* Header Section */}
      <div
        className="p-3 text-white flex items-center gap-2"
        style={{ backgroundColor: template.header_color || "#1e40af" }}
      >
        {template.company_logo_url && (
          <img
            src={template.company_logo_url}
            alt="Logo"
            className="h-8 w-8 object-contain brightness-0 invert"
          />
        )}
        <div>
          <h2 className="text-sm font-bold">{template.company_name || "Company"}</h2>
          <p className="text-[10px] opacity-90">Personnel ID Badge</p>
        </div>
      </div>

      {/* Body Section */}
      <div className="flex-1 p-3 flex flex-col items-center justify-center gap-2">
        {isEnabled("photo") && (
          <Avatar className="h-16 w-16 border-2 border-muted">
            <AvatarImage src={personnel.photo_url || ""} />
            <AvatarFallback className="text-lg bg-muted">
              {personnel.first_name[0]}
              {personnel.last_name[0]}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Name */}
        <h3
          className="text-base font-bold text-center"
          style={{ color: template.name_color || "#1f2937" }}
        >
          {personnel.first_name} {personnel.last_name}
        </h3>

        {isEnabled("personnel_number") && (
          <div
            className="text-xs font-mono"
            style={{ color: template.personnel_number_color || "#6b7280" }}
          >
            {personnel.personnel_number}
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-1 text-center w-full">
          {isEnabled("phone") && personnel.phone && (
            <div className="flex justify-between text-xs px-2">
              <span style={{ color: template.label_color || "#6b7280" }}>Phone:</span>
              <span style={{ color: template.value_color || "#374151" }}>{personnel.phone}</span>
            </div>
          )}

          {isEnabled("email") && personnel.email && (
            <div className="flex justify-between text-xs px-2">
              <span style={{ color: template.label_color || "#6b7280" }}>Email:</span>
              <span
                className="truncate max-w-[120px]"
                style={{ color: template.value_color || "#374151" }}
              >
                {personnel.email}
              </span>
            </div>
          )}

          {isEnabled("work_authorization") && personnel.work_authorization_type && (
            <div className="flex justify-between text-xs px-2">
              <span style={{ color: template.label_color || "#6b7280" }}>Work Auth:</span>
              <span style={{ color: template.value_color || "#374151" }}>
                {personnel.work_authorization_type}
              </span>
            </div>
          )}
        </div>

        {isEnabled("everify_status") && personnel.everify_status === "verified" && (
          <Badge className="bg-green-600 text-white text-[10px]">E-Verified</Badge>
        )}
      </div>

      {/* Footer Section */}
      <div
        className="px-2 py-1.5 text-center text-[9px] bg-muted/50"
        style={{ color: template.footer_color || "#6b7280" }}
      >
        Must be worn visibly at all times
      </div>
    </Card>
  );
};
