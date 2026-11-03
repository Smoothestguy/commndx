import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_TAGS } from "@/lib/roleTags";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** Inline role editor: managers get a compact select; everyone else sees plain text. */
export function RoleSelect({ value, onChange, canEdit, priorityRoles = [], className, placeholder = "No role" }: {
  value: string | null | undefined;
  onChange: (role: string | null) => void;
  canEdit: boolean;
  priorityRoles?: string[];
  className?: string;
  placeholder?: string;
}) {
  if (!canEdit) return <span className={cn("truncate", className)}>{value ?? ""}</span>;
  const prio = [...new Set(priorityRoles.filter(Boolean))];
  const rest = (ROLE_TAGS as readonly string[]).filter((r) => !prio.includes(r));
  const custom = value && !prio.includes(value) && !rest.includes(value) ? value : null;
  return (
    <Select value={value ?? NONE} onValueChange={(v) => { const next = v === NONE ? null : v; if (next !== (value ?? null)) onChange(next); }}>
      <SelectTrigger
        className={cn("h-6 w-auto max-w-full gap-1 border-dashed border-transparent bg-transparent px-1 py-0 text-xs hover:border-border focus:ring-1 [&>span]:truncate", !value && "text-muted-foreground", className)}
        aria-label="Change role"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className="text-muted-foreground">No role</SelectItem>
        {custom && <SelectItem value={custom}>{custom}</SelectItem>}
        {prio.length > 0 && (
          <SelectGroup>
            <SelectSeparator />
            <SelectLabel className="text-[10px] uppercase text-muted-foreground">This location</SelectLabel>
            {prio.map((r) => <SelectItem key={`p-${r}`} value={r}>{r}</SelectItem>)}
          </SelectGroup>
        )}
        <SelectGroup>
          <SelectSeparator />
          {prio.length > 0 && <SelectLabel className="text-[10px] uppercase text-muted-foreground">All roles</SelectLabel>}
          {rest.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
