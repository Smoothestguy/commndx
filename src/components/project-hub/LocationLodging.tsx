import { useMemo, useState } from "react";
import { format } from "date-fns";
import { BedDouble, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLodgingByLocation, useSendLodgingDetails } from "@/integrations/supabase/hooks/useHotelAssignments";
import { AssignHotelDialog, LODGING_TYPES } from "./AssignHotelDialog";

const typeLabel = (t?: string | null) =>
  (LODGING_TYPES as readonly { value: string; label: string }[]).find((x) => x.value === t)?.label ?? "Hotel";

/** Location-scoped view of personnel_hotel_assignments; same rows as the project Lodging section. */
export function LocationLodging({ projectId, locationId, housingBy, canWrite }: {
  projectId: string; locationId: string; housingBy: string | null; canWrite: boolean;
}) {
  const { data: rows = [] } = useLodgingByLocation(locationId);
  const send = useSendLodgingDetails();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]);

  // Group occupants sharing the same lodging details
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = [r.hotel_name, r.hotel_address, r.room_number, r.check_in, r.lodging_type].join("|");
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.values()];
  }, [rows]);

  const customer = housingBy === "customer";

  return (
    <div className="pt-2 border-t space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-1"><BedDouble className="h-4 w-4" />Lodging</span>
        {canWrite && (
          <Button size="sm" variant="ghost" className={customer ? "h-8 px-2 text-muted-foreground" : "h-8 px-2"} onClick={() => setOpen(true)}>
            Assign lodging
          </Button>
        )}
      </div>
      {customer && <p className="text-xs text-muted-foreground">Housing arranged by customer</p>}
      {groups.map((g) => {
        const a = g[0];
        const ids = g.map((x) => x.id);
        const sent = g.every((x) => x.notified_at);
        return (
          <div key={a.id} className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.hotel_name} <span className="text-muted-foreground font-normal">· {typeLabel(a.lodging_type)}</span></p>
              <p className="text-muted-foreground truncate">
                {g.map((x) => [x.personnel?.first_name, x.personnel?.last_name].filter(Boolean).join(" ")).join(", ")}
              </p>
              {sent && a.notified_at && <p className="text-muted-foreground">Sent {format(new Date(a.notified_at), "MMM d")}</p>}
            </div>
            {canWrite && (
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Send details"
                disabled={send.isPending} onClick={() => send.mutate(ids)}><Send className="h-4 w-4" /></Button>
            )}
          </div>
        );
      })}
      {canWrite && (
        <AssignHotelDialog open={open} onOpenChange={setOpen} projectId={projectId} locationId={locationId}
          onCreated={(ids) => setPending(ids)} />
      )}
      <AlertDialog open={pending.length > 0} onOpenChange={(o) => !o && setPending([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send lodging details?</AlertDialogTitle>
            <AlertDialogDescription>Send lodging details to {pending.length} personnel by text/email?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={() => { send.mutate(pending); setPending([]); }}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
