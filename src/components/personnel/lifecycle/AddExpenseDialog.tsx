import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2 } from "lucide-react";
import { format } from "date-fns";
const today = () => format(new Date(), "yyyy-MM-dd");
import { EXPENSE_CATEGORIES, useAddPersonnelExpense, useCurrentStatus, useStatusProjects } from "@/integrations/supabase/hooks/usePersonnelStatus";

export function AddExpenseDialog({ open, onOpenChange, personnelId, people, projectId, lockProject }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  personnelId?: string; // fixed person
  people?: { id: string; name: string }[]; // or choose from list
  projectId?: string | null; lockProject?: boolean;
}) {
  const [pid, setPid] = useState(personnelId ?? "");
  const { row } = useCurrentStatus(pid || undefined);
  const { data: projects = [] } = useStatusProjects(open && !lockProject);
  const add = useAddPersonnelExpense();
  const [proj, setProj] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("per_diem");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setPid(personnelId ?? (people?.length === 1 ? people[0].id : ""));
      setProj(projectId ?? ""); setAmount(""); setCategory("per_diem"); setNote(""); setDate(today()); setFile(null);
    }
  }
  const effectiveProj = proj || (!lockProject ? row?.project_id ?? "" : "");
  const amt = Number(amount);
  const valid = !!pid && !!effectiveProj && amount.trim() !== "" && amt > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!personnelId && (
            <div><Label>Person</Label>
              <Select value={pid} onValueChange={setPid}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Who spent it?" /></SelectTrigger>
                <SelectContent>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {!lockProject && (
            <div><Label>Project</Label>
              <Select value={effectiveProj} onValueChange={setProj}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  {row?.project_id && !projects.some((p) => p.id === row.project_id) && <SelectItem value={row.project_id}>{row.project_name ?? "Current project"}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Amount ($)</Label>
            <Input className="h-12 text-lg" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input className="h-11" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <label className="flex items-center gap-2 h-11 px-3 rounded-md border cursor-pointer text-sm">
            <Camera className="h-4 w-4" />
            <span className="truncate">{file ? file.name : "Receipt photo (optional)"}</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || add.isPending}
            onClick={() => add.mutate({ personnel_id: pid, project_id: effectiveProj, amount: amt, category, note, incurred_on: date, receipt: file }, { onSuccess: () => onOpenChange(false) })}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
