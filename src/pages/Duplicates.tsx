import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Users, Phone } from "lucide-react";
import { format } from "date-fns";

interface DupGroup {
  group_key: string;
  match_type: "phone" | "name";
  applicant_ids: string[];
  names: string[];
  emails: (string | null)[];
  phones: (string | null)[];
  created_dates: (string | null)[];
}

export default function Duplicates() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({}); // group_key -> keeper id
  const [confirm, setConfirm] = useState<DupGroup | null>(null);
  const [merging, setMerging] = useState(false);

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ["duplicate-applicant-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_duplicate_applicant_groups" as any);
      if (error) throw error;
      return (data ?? []) as DupGroup[];
    },
  });

  // Default keeper = oldest (earliest created)
  const getDefaultKeeper = (g: DupGroup) => {
    let idx = 0;
    let oldest = g.created_dates[0] || "9999-12-31";
    for (let i = 1; i < g.applicant_ids.length; i++) {
      const d = g.created_dates[i] || "9999-12-31";
      if (d < oldest) { oldest = d; idx = i; }
    }
    return g.applicant_ids[idx];
  };

  const keeperFor = (g: DupGroup) => selected[g.group_key] ?? getDefaultKeeper(g);

  const runMerge = async (g: DupGroup) => {
    const keeper = keeperFor(g);
    const others = g.applicant_ids.filter(id => id !== keeper);
    setMerging(true);
    let ok = 0, fail = 0;
    for (const id of others) {
      const { data, error } = await supabase.rpc("merge_applicants" as any, {
        _keep_id: keeper, _merge_id: id,
      });
      const res = data as any;
      if (error || res?.success === false) {
        fail++;
        toast.error(`Merge failed: ${error?.message || res?.error || "unknown"}`);
      } else {
        ok++;
        toast.success(`Merged 1 duplicate into keeper.`);
      }
    }
    setMerging(false);
    setConfirm(null);
    toast.message(`Done: ${ok} merged, ${fail} failed.`);
    qc.invalidateQueries({ queryKey: ["duplicate-applicant-groups"] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    refetch();
  };

  const sorted = useMemo(() => {
    if (!groups) return [];
    return [...groups].sort((a, b) => {
      if (a.match_type !== b.match_type) return a.match_type === "phone" ? -1 : 1;
      return b.applicant_ids.length - a.applicant_ids.length;
    });
  }, [groups]);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Duplicates</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Applicants that appear to be duplicates. Pick a keeper and merge — applications and personnel
          links move to the keeper, the duplicate record is deleted, and profile gaps on the keeper are
          filled from the duplicate.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning applicants…
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No duplicate groups found.
        </CardContent></Card>
      )}

      <div className="space-y-4">
        {sorted.map((g) => {
          const keeper = keeperFor(g);
          return (
            <Card key={g.group_key}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={g.match_type === "phone" ? "default" : "secondary"} className="gap-1">
                      {g.match_type === "phone" ? <Phone className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {g.match_type === "phone" ? "Same phone" : "Same name"}
                    </Badge>
                    <CardTitle className="text-base">{g.applicant_ids.length} records</CardTitle>
                  </div>
                  <Button
                    size="sm"
                    disabled={merging}
                    onClick={() => setConfirm(g)}
                  >
                    Merge into selected
                  </Button>
                </div>
                <CardDescription>Key: {g.group_key}</CardDescription>
                {g.match_type === "name" && (
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Same name may be different people (father/son) — verify before merging.
                    </AlertDescription>
                  </Alert>
                )}
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={keeper}
                  onValueChange={(v) => setSelected(prev => ({ ...prev, [g.group_key]: v }))}
                  className="space-y-2"
                >
                  {g.applicant_ids.map((id, i) => (
                    <label
                      key={id}
                      className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <RadioGroupItem value={id} className="mt-1" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                        <div className="font-medium">{g.names[i] || "—"}</div>
                        <div className="text-muted-foreground">{g.emails[i] || "—"}</div>
                        <div className="text-muted-foreground">{g.phones[i] || "—"}</div>
                        <div className="text-muted-foreground">
                          {g.created_dates[i]
                            ? format(new Date(g.created_dates[i] as string), "MMM d, yyyy")
                            : "—"}
                          {id === keeper && <Badge className="ml-2" variant="outline">Keeper</Badge>}
                        </div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge {confirm ? confirm.applicant_ids.length - 1 : 0} duplicate(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Applications and personnel links move to the keeper; the other record(s) are deleted;
              profile gaps on the keeper are filled from the duplicates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={merging}
              onClick={(e) => { e.preventDefault(); if (confirm) runMerge(confirm); }}
            >
              {merging ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Merging…</> : "Confirm merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
