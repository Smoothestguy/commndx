import { ApplicationsTable } from './ApplicationsTable';
import { SecureImage } from '@/components/ui/secure-image';
import { format } from 'date-fns';
import type { Application } from '@/integrations/supabase/hooks/useStaffingApplications';
import type { FormField } from '@/integrations/supabase/hooks/useApplicationFormTemplates';

interface PostingEntriesTableProps {
  applications: Application[];
  formFields: FormField[];
  isLoading: boolean;
  onViewApplication: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

// Format field value based on type
function formatFieldValue(value: unknown, field: FormField): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  switch (field.type) {
    case "file":
      if (typeof value === "string" && (value.startsWith("http") || value.startsWith("data:image"))) {
        return (
          <SecureImage bucket="application-files" path={value} alt={field.label} className="h-10 w-10 object-cover rounded" fallback={<span className="text-xs text-muted-foreground">File</span>}/>
        );
      }
      return <span className="text-xs text-muted-foreground">File</span>;

    case "signature":
      if (typeof value === "string" && value.startsWith("data:image")) {
        return (
          <span className="text-xs text-green-600 font-medium">✓ Signed</span>
        );
      }
      return <span className="text-xs text-muted-foreground">—</span>;

    case "date":
      try {
        return (
          <span className="text-sm">
            {format(new Date(value as string), "MMM d, yyyy")}
          </span>
        );
      } catch {
        return <span className="text-sm">{String(value)}</span>;
      }

    case "checkbox":
      return value ? (
        <span className="text-green-600">✓</span>
      ) : (
        <span className="text-muted-foreground">✗</span>
      );

    case "multiselect":
      if (Array.isArray(value)) {
        return <span className="block truncate" title={value.map(String).join(', ')}>{value.map(String).join(', ')}</span>;
      }
      return <span className="text-sm">{String(value)}</span>;

    case "address":
      if (typeof value === "object" && value !== null) {
        const addr = value as Record<string, string>;
        const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
        return (
          <span className="text-sm whitespace-nowrap">
            {parts.join(", ").slice(0, 30)}
            {parts.join(", ").length > 30 ? "..." : ""}
          </span>
        );
      }
      return <span className="text-sm">{String(value)}</span>;

    default:
      const stringValue = String(value);
      return (
        <span className="text-sm whitespace-nowrap">
          {stringValue.length > 25 ? stringValue.slice(0, 25) + "..." : stringValue}
        </span>
      );
  }
}

export function PostingEntriesTable({ applications, formFields, isLoading, onViewApplication, onApprove, onReject, selectable, selectedIds, onSelectionChange }: PostingEntriesTableProps) {
  const fields = formFields.filter(f => f.type !== 'section').slice(0,4);
  return <ApplicationsTable applications={applications} isLoading={isLoading} onViewApplication={onViewApplication} onApprove={onApprove} onReject={onReject} selectable={selectable} selectedIds={selectedIds} onSelectionChange={onSelectionChange}
    extraColumns={fields.map(field => ({key:`answer-${field.id}`,header:field.label,width:180,getValue:app=>{const value=app.answers?.[field.id];return value==null?'':typeof value==='object'?JSON.stringify(value):String(value);},render:app=>formatFieldValue(app.answers?.[field.id],field)}))} />;
}
