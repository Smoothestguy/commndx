import { useState } from "react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { REASON_LABEL, matchesBlock, type ContactMatch } from "@/lib/contactMatches";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  matches: ContactMatch[] | null;
  onClose: () => void;
  /** Omit when the screen cannot reuse an existing record. */
  onUseExisting?: (m: ContactMatch) => void;
  onCreateAnyway: (reason: string | null) => void;
}

export function PossibleMatchDialog({ matches, onClose, onUseExisting, onCreateAnyway }: Props) {
  const { isAdmin } = useUserRole();
  const [reason, setReason] = useState("");
  const blocked = !!matches && matchesBlock(matches);
  return (
    <AlertDialog open={!!matches && matches.length > 0} onOpenChange={(o) => { if (!o) { setReason(""); onClose(); } }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{blocked ? "This email is already on file" : "Possible match"}</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked ? "Same email means it is very likely the same person. Use the existing record." : "Check before creating a new record. Families and crews sometimes share a phone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-2 max-h-72 overflow-y-auto" aria-label="Possible matches">
          {matches?.map((m) => (
            <li key={`${m.entity_type}:${m.entity_id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">Possible match: {m.full_name}</span>{" "}
                {m.ref_number && <span className="text-muted-foreground">{m.ref_number}</span>}
                <span className="text-muted-foreground"> · {m.reasons.map((r) => REASON_LABEL[r]).join(" · ")} · {m.entity_type === "applicant" ? "applicant" : "added"} {m.created_at ? format(new Date(m.created_at), "MMM d, yyyy") : ""}</span>
              </span>
              {onUseExisting && m.entity_type === "personnel" && (
                <Button size="sm" variant="secondary" onClick={() => { setReason(""); onUseExisting(m); }}>Use existing</Button>
              )}
            </li>
          ))}
        </ul>
        {blocked && isAdmin && (
          <div className="space-y-1">
            <Label htmlFor="create-anyway-reason">Reason to create anyway (admin)</Label>
            <Textarea id="create-anyway-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {(!blocked || isAdmin) && (
            <Button variant="outline" disabled={blocked && reason.trim().length < 3} onClick={() => { const r = blocked ? reason.trim() : null; setReason(""); onCreateAnyway(r); }}>
              Create anyway
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
