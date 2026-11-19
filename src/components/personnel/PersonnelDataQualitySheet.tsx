import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/hooks/useUserRole';
import { readPersonnelHistories } from '@/lib/personnelHistoryReader';
import { Link } from "react-router-dom";
import { MoveOnboardingPair } from './MoveOnboardingDialog';
import { useOpenContactReviews, useResolveContactReview, usePersonnelDuplicateGroups, useDismissDuplicateGroup, type DuplicateGroup } from "@/integrations/supabase/hooks/useContactReview";

const REASON: Record<string, string> = { same_email: "Same email", same_phone: "Same phone", similar_name: "Similar name", email_match_phone_differs: "Email matched, phone differs", phone_match_email_differs: "Phone matched, email differs" };

export function PersonnelDataQualitySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { isAdmin, isManager } = useUserRole();
  const allowed = isAdmin || isManager;
  const reviews = useOpenContactReviews(open && allowed);
  const resolve = useResolveContactReview();
  const groups = usePersonnelDuplicateGroups(open && allowed);
  const dismiss = useDismissDuplicateGroup();
  const ids = [...new Set(groups.data?.flatMap(g => g.personnel.map(p => p.id)) ?? [])].sort();
  const history = useQuery({ queryKey: ['personnel-duplicate-history', ids], queryFn: () => readPersonnelHistories(ids), enabled: open && allowed && ids.length > 0, retry: false });

  const groupRow = (g: DuplicateGroup) => {
    const [oldest, ...rest] = g.personnel;
    return (
      <li key={`${g.reason}:${g.match_key}`} className="rounded-md border border-border p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="whitespace-nowrap">{REASON[g.reason]}</Badge>
          <span className="text-sm text-muted-foreground truncate">{g.reason === "similar_name" ? g.match_key.replace("|", " ") : g.match_key}</span>
          <Button size="sm" variant="ghost" className="ml-auto" disabled={dismiss.isPending} onClick={() => dismiss.mutate({ ids: g.personnel.map((p) => p.id), reason: REASON[g.reason] })}>Not duplicates</Button>
        </div>
        <ul className="space-y-1">
          {g.personnel.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Link to={`/personnel/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <span className="text-muted-foreground">{p.personnel_number} · {p.status} · added {format(new Date(p.created_at), "MMM d, yyyy")}</span>
              {p.id !== oldest.id && rest.length > 0 && (
                <div className="ml-auto flex gap-2" aria-label="Open both profiles">
                  <Button size="sm" variant="outline" asChild><Link to={`/personnel/${oldest.id}`} target="_blank" rel="noopener noreferrer">Open {oldest.personnel_number ?? "first profile"}</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link to={`/personnel/${p.id}`} target="_blank" rel="noopener noreferrer">Open {p.personnel_number ?? "second profile"}</Link></Button>
                </div>
              )}
              <div className="w-full flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-2">
                {history.data?.[p.id] ? <>
                  <Badge variant="secondary">{history.data[p.id].onboarding}</Badge>
                  <span>{history.data[p.id].timeEntries} time entries · Last worked {history.data[p.id].lastWorked ?? '—'}</span>
                  <span>{history.data[p.id].activeProjects} active projects / {history.data[p.id].activeLocations} active sites</span>
                  <span>{history.data[p.id].documents} documents · W-9 {history.data[p.id].w9Forms > 0 ? 'Yes' : 'No'}</span>
                </> : <span>{history.isError ? 'History unavailable — no counts assumed.' : 'Loading history…'}</span>}
              </div>
              {isAdmin && <div className="w-full flex flex-wrap gap-2">{g.personnel.filter(other=>other.id!==p.id).map(other=><MoveOnboardingPair key={other.id} source={p.id} target={other.id}/>)}</div>}
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <Sheet open={open && allowed} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Contact review & duplicates</SheetTitle>
          <SheetDescription>Nothing is merged or changed automatically.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="review" className="mt-4">
          <TabsList>
            <TabsTrigger value="review">Needs review ({reviews.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="dupes">Possible duplicates ({groups.data?.length ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="review">
            {reviews.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !reviews.data?.length ? <p className="text-sm text-muted-foreground">Nothing to review.</p> : (
              <ul className="space-y-3">
                {reviews.data.map((i) => (
                  <li key={i.id} className="rounded-md border border-border p-3 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="whitespace-nowrap">{REASON[i.reason] ?? i.reason}</Badge>
                      <span className="text-muted-foreground">{i.source} · {format(new Date(i.created_at), "MMM d, h:mm a")}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><div className="text-xs text-muted-foreground">Submitted</div><div className="font-medium">{i.submitted_first_name} {i.submitted_last_name}</div><div>{i.submitted_email}</div><div>{i.submitted_phone}</div></div>
                      <div><div className="text-xs text-muted-foreground">Existing {i.matched_entity_type}</div><div className="font-medium">{i.matched?.name ?? "—"}</div><div>{i.matched?.email}</div><div>{i.matched?.phone}</div></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: i.id, decision: "update_contact" })}>Same person – update contact</Button>
                      <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: i.id, decision: "keep_existing" })}>Same person – keep existing</Button>
                      <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: i.id, decision: "different_person" })}>Different person</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="dupes">
            {groups.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !groups.data?.length ? <p className="text-sm text-muted-foreground">No possible duplicates.</p> : <ul className="space-y-3">{groups.data.map(groupRow)}</ul>}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
