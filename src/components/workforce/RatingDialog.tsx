import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSaveRating } from "@/integrations/supabase/hooks/useWorkforce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  projectId?: string | null;
  assignmentId?: string | null;
  personName?: string;
  projectName?: string | null;
}

function Stars({
  value, onChange, label,
}: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${label} ${n}`}>
            <Star
              className={cn(
                "h-5 w-5",
                n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RatingDialog({
  open, onOpenChange, personnelId, projectId, assignmentId, personName, projectName,
}: Props) {
  const save = useSaveRating();
  const [overall, setOverall] = useState(0);
  const [reliability, setReliability] = useState(0);
  const [skill, setSkill] = useState(0);
  const [attitude, setAttitude] = useState(0);
  const [wouldRehire, setWouldRehire] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setOverall(0); setReliability(0); setSkill(0); setAttitude(0);
    setWouldRehire(true); setNotes("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {personName ?? "worker"}</DialogTitle>
          <DialogDescription>
            {projectName ? `Performance on ${projectName}.` : "Performance rating."} A rating of 3 or
            better marks the matching capabilities as verified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Stars label="Overall" value={overall} onChange={setOverall} />
          <Stars label="Reliability" value={reliability} onChange={setReliability} />
          <Stars label="Skill" value={skill} onChange={setSkill} />
          <Stars label="Attitude" value={attitude} onChange={setAttitude} />
          <div className="flex items-center justify-between pt-1">
            <Label className="text-sm">Would rehire</Label>
            <Switch checked={wouldRehire} onCheckedChange={setWouldRehire} />
          </div>
          {!wouldRehire && (
            <p className="text-xs text-destructive">
              This will flag the applicant as do-not-rehire.
            </p>
          )}
          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!overall || save.isPending}
            onClick={async () => {
              await save.mutateAsync({
                personnel_id: personnelId,
                project_id: projectId ?? null,
                assignment_id: assignmentId ?? null,
                overall,
                reliability: reliability || null,
                skill: skill || null,
                attitude: attitude || null,
                would_rehire: wouldRehire,
                notes: notes.trim() || null,
              });
              onOpenChange(false);
            }}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          )}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}
