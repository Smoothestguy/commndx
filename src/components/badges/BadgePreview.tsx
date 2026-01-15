import { Card } from "@/components/ui/card";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Separator } from "@/components/ui/separator";
interface PersonnelCertification {
  id: string;
  certification_name: string;
}
interface PersonnelCapability {
  id: string;
  capability: string;
}
interface PersonnelLanguage {
  id: string;
  language: string;
}
interface Personnel {
  id: string;
  first_name: string;
  last_name: string;
  personnel_number: string;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  work_authorization_type?: string | null;
  everify_status?: string | null;
  personnel_certifications?: PersonnelCertification[];
  personnel_capabilities?: PersonnelCapability[];
  personnel_languages?: PersonnelLanguage[];
}
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
    fields?: Array<{
      field_name: string;
      is_enabled: boolean;
    }>;
  };
}
export const BadgePreview = ({
  personnel,
  template
}: BadgePreviewProps) => {
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
      languages: template.show_languages
    };

    // Check new show_* boolean first
    if (showFieldMap[fieldName] !== undefined && showFieldMap[fieldName] !== null) {
      return showFieldMap[fieldName] as boolean;
    }

    // Fallback to legacy fields array
    if (template.fields && template.fields.length > 0) {
      return template.fields.some(f => f.field_name === fieldName && f.is_enabled);
    }

    // Default to true if not specified
    return true;
  };
  const isLandscape = template.orientation === "landscape";
  const certifications = personnel.personnel_certifications || [];
  const capabilities = personnel.personnel_capabilities || [];
  const languages = personnel.personnel_languages || [];
  return <Card className={`overflow-hidden flex flex-col ${isLandscape ? "w-[400px] h-[250px]" : "w-[250px] h-[400px]"}`} style={{
    backgroundColor: template.background_color || "#ffffff"
  }}>
      {/* Header Section */}
      <div style={{
      backgroundColor: template.header_color || "#1e40af"
    }} className="p-4 text-white flex items-center gap-3 bg-blue-700 px-[40px]">
        {template.company_logo_url && <img src={template.company_logo_url} alt="Logo" className="h-12 w-12 object-contain brightness-0 invert" />}
        <div>
          <h2 className="text-base font-bold">{template.company_name || "Company"}</h2>
          <p className="text-[10px] opacity-90">Personnel ID Badge</p>
        </div>
      </div>

      {/* Body Section */}
      <div className="flex-1 p-3 flex flex-col items-center gap-2 overflow-hidden">
        {isEnabled("photo") && <SecureAvatar
            bucket="personnel-photos"
            photoUrl={personnel.photo_url}
            className="h-14 w-14 border-2 border-muted"
            fallback={
              <span className="text-base bg-muted">
                {personnel.first_name[0]}
                {personnel.last_name[0]}
              </span>
            }
            alt={`${personnel.first_name} ${personnel.last_name}`}
          />}

        {/* Name */}
        <h3 className="text-sm font-bold text-center leading-tight" style={{
        color: template.name_color || "#1f2937"
      }}>
          {personnel.first_name} {personnel.last_name}
        </h3>

        {isEnabled("personnel_number") && <div className="text-[10px] font-mono" style={{
        color: template.personnel_number_color || "#6b7280"
      }}>
            {personnel.personnel_number}
          </div>}

        {/* Contact & Status Info */}
        <div className="w-full space-y-0.5 text-[9px]">
          {isEnabled("phone") && personnel.phone && <>
              <div className="flex justify-between px-1">
                <span style={{
              color: template.label_color || "#6b7280"
            }}>Phone:</span>
                <span style={{
              color: template.value_color || "#374151"
            }}>{personnel.phone}</span>
              </div>
              <Separator className="my-0.5" />
            </>}

          {isEnabled("email") && personnel.email && <>
              <div className="flex justify-between px-1">
                <span style={{
              color: template.label_color || "#6b7280"
            }}>Email:</span>
                <span className="truncate max-w-[100px]" style={{
              color: template.value_color || "#374151"
            }}>
                  {personnel.email}
                </span>
              </div>
              <Separator className="my-0.5" />
            </>}

          {isEnabled("work_authorization") && personnel.work_authorization_type && <>
              <div className="flex justify-between px-1">
                <span style={{
              color: template.label_color || "#6b7280"
            }}>Auth:</span>
                <span style={{
              color: template.value_color || "#374151"
            }}>
                  {personnel.work_authorization_type}
                </span>
              </div>
              <Separator className="my-0.5" />
            </>}

          {isEnabled("everify_status") && personnel.everify_status && <>
              <div className="flex justify-between px-1">
                <span style={{
              color: template.label_color || "#6b7280"
            }}>E-Verify:</span>
                <span className="capitalize" style={{
              color: personnel.everify_status === "verified" ? "#16a34a" : template.value_color || "#374151"
            }}>
                  {personnel.everify_status}
                </span>
              </div>
              <Separator className="my-0.5" />
            </>}
        </div>

        {/* Certifications Section */}
        {isEnabled("certifications") && certifications.length > 0 && <div className="w-full bg-muted/50 rounded p-1.5">
            <div className="text-[8px] font-semibold mb-0.5" style={{
          color: template.label_color || "#6b7280"
        }}>
              Certifications
            </div>
            <div className="text-[8px] space-y-0.5" style={{
          color: template.value_color || "#374151"
        }}>
              {certifications.slice(0, 3).map(cert => <div key={cert.id} className="flex items-center gap-1">
                  <span className="text-[6px]">•</span>
                  <span className="truncate">{cert.certification_name}</span>
                </div>)}
              {certifications.length > 3 && <div className="text-[7px] opacity-70">+{certifications.length - 3} more</div>}
            </div>
          </div>}

        {/* Capabilities Section */}
        {isEnabled("capabilities") && capabilities.length > 0 && <div className="w-full bg-muted/50 rounded p-1.5">
            <div className="text-[8px] font-semibold mb-0.5" style={{
          color: template.label_color || "#6b7280"
        }}>
              Capabilities
            </div>
            <div className="text-[8px] space-y-0.5" style={{
          color: template.value_color || "#374151"
        }}>
              {capabilities.slice(0, 3).map(cap => <div key={cap.id} className="flex items-center gap-1">
                  <span className="text-[6px]">•</span>
                  <span className="truncate">{cap.capability}</span>
                </div>)}
              {capabilities.length > 3 && <div className="text-[7px] opacity-70">+{capabilities.length - 3} more</div>}
            </div>
          </div>}

        {/* Languages Section */}
        {isEnabled("languages") && languages.length > 0 && <div className="w-full bg-muted/50 rounded p-1.5">
            <div className="text-[8px] font-semibold mb-0.5" style={{
          color: template.label_color || "#6b7280"
        }}>
              Languages
            </div>
            <div className="text-[8px] flex flex-wrap gap-1" style={{
          color: template.value_color || "#374151"
        }}>
              {languages.map(lang => <span key={lang.id}>{lang.language}</span>)}
            </div>
          </div>}
      </div>

      {/* Footer Section */}
      <div className="px-2 py-1.5 text-center text-[8px] bg-muted/50" style={{
      color: template.footer_color || "#6b7280"
    }}>
        Must be worn visibly at all times
      </div>
    </Card>;
};