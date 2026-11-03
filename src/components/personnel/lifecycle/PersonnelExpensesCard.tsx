import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, Pencil, Receipt, Trash2, X } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { useUserRole } from "@/hooks/useUserRole";
import { EXPENSE_CATEGORIES, PersonnelExpense, useDeletePersonnelExpense, useProjectPersonnelExpenses, useUpdatePersonnelExpense } from "@/integrations/supabase/hooks/usePersonnelStatus";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const catLabel = (c: string) => EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export function PersonnelExpensesCard({ projectId }: { projectId: string }) {
  const { data = [] } = useProjectPersonnelExpenses(projectId);
  const { isAdmin, isManager } = useUserRole();
  const canEdit = isAdmin || isManager;
  const upd = useUpdatePersonnelExpense();
  const del = useDeletePersonnelExpense();
  const [edit, setEdit] = useState<{ id: string; amount: string; category: string } | null>(null);
  const [delRow, setDelRow] = useState<PersonnelExpense | null>(null);
  const [showAll, setShowAll] = useState(false);

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of data) m[e.category] = (m[e.category] ?? 0) + e.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [data]);
  const total = data.reduce((a, e) => a + e.amount, 0);
  if (data.length === 0) return null;
  const list = showAll ? data : data.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">Personnel expenses <span>{money(total)}</span></CardTitle>
        <div className="flex flex-wrap gap-1">{byCat.map(([c, v]) => <Badge key={c} variant="outline">{catLabel(c)} {money(v)}</Badge>)}</div>
      </CardHeader>
      <CardContent className="space-y-1">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{e.person_name}</div>
              <div className="text-xs text-muted-foreground truncate">{formatLocalDate(e.incurred_on)} · {catLabel(e.category)}{e.note ? ` · ${e.note}` : ""}</div>
            </div>
            {edit?.id === e.id ? (
              <>
                <Select value={edit.category} onValueChange={(v) => setEdit({ ...edit, category: v })}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-8 w-24" type="number" inputMode="decimal" value={edit.amount} onChange={(ev) => setEdit({ ...edit, amount: ev.target.value })} />
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!(Number(edit.amount) > 0)}
                  onClick={() => upd.mutate({ id: e.id, amount: Number(edit.amount), category: edit.category }, { onSuccess: () => setEdit(null) })}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(null)}><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary" aria-label="Receipt"><Receipt className="h-4 w-4" /></a>}
                <span className="font-semibold tabular-nums">{money(e.amount)}</span>
                {canEdit && <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit({ id: e.id, amount: String(e.amount), category: e.category })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDelRow(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>}
              </>
            )}
          </div>
        ))}
        {data.length > 10 && <Button variant="link" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : `Show all ${data.length}`}</Button>}
      </CardContent>
      <AlertDialog open={!!delRow} onOpenChange={(o) => !o && setDelRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>{delRow && `${delRow.person_name} · ${money(delRow.amount)}`}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delRow && del.mutate(delRow.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
