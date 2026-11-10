import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Preview = { archive_applicants: number; deactivate_personnel: number; archived_applicants: number; inactive_personnel: number };

/** Manager/admin data hygiene: reversible archive of idle applicants (90d) and deactivation of idle personnel (120d). */
export function DataHygieneCard() {
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ["data-hygiene-preview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("data_hygiene_preview" as never);
      if (error) throw error;
      return data as unknown as Preview;
    },
  });
  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("data_hygiene_run" as never);
      if (error) throw error;
      return data as unknown as { archived_applicants: number; deactivated_personnel: number };
    },
    onSuccess: (r) => {
      toast.success(`Archived ${r.archived_applicants} applicants, deactivated ${r.deactivated_personnel} personnel`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const p = preview.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data hygiene</CardTitle>
        <CardDescription>
          Applicants idle 90+ days who never became personnel are archived; personnel with no assignments, punches or time in 120+ days are set Inactive. Nothing is deleted and both are reversible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview.isLoading ? (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        ) : preview.error ? (
          <p className="text-sm text-destructive">{(preview.error as Error).message}</p>
        ) : p ? (
          <div className="text-sm space-y-1" data-testid="hygiene-preview">
            <p>Would archive <strong>{p.archive_applicants}</strong> applicants and deactivate <strong>{p.deactivate_personnel}</strong> personnel.</p>
            <p className="text-muted-foreground">Currently {p.archived_applicants} archived applicants, {p.inactive_personnel} inactive personnel.</p>
          </div>
        ) : null}
        <Button
          size="sm"
          disabled={run.isPending || !p || (p.archive_applicants === 0 && p.deactivate_personnel === 0)}
          onClick={() => { if (confirm("Archive/deactivate the listed records now? This is reversible.")) run.mutate(); }}
        >
          {run.isPending ? "Running…" : "Run now"}
        </Button>
      </CardContent>
    </Card>
  );
}
