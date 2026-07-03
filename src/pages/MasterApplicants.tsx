import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InviteToJobDialog } from "@/components/staffing/InviteToJobDialog";

import { Search, Send, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  status: string;
  created_at: string;
  application_count: number;
  last_applied_at: string | null;
  last_posting_id: string | null;
  last_posting_title: string | null;
};

const useMasterApplicants = () =>
  useQuery({
    queryKey: ["master-applicants"],
    queryFn: async (): Promise<Row[]> => {
      const { data: applicants, error } = await supabase
        .from("applicants")
        .select("id, first_name, last_name, email, phone, photo_url, city, state, home_zip, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: apps, error: e2 } = await supabase
        .from("applications")
        .select(`
          applicant_id, created_at, job_posting_id,
          job_postings (
            id,
            project_task_orders ( title, projects:project_id (name) )
          )
        `)
        .order("created_at", { ascending: false });
      if (e2) throw e2;

      const byApplicant = new Map<string, { count: number; last?: any }>();
      for (const a of (apps ?? []) as any[]) {
        const cur = byApplicant.get(a.applicant_id) ?? { count: 0 };
        cur.count += 1;
        if (!cur.last) cur.last = a;
        byApplicant.set(a.applicant_id, cur);
      }

      return (applicants ?? []).map((a: any) => {
        const info = byApplicant.get(a.id);
        const last = info?.last;
        const title =
          last?.job_postings?.project_task_orders?.title ??
          last?.job_postings?.project_task_orders?.projects?.name ??
          null;
        return {
          ...a,
          application_count: info?.count ?? 0,
          last_applied_at: last?.created_at ?? null,
          last_posting_id: last?.job_posting_id ?? null,
          last_posting_title: title,
        };
      });
    },
  });

type SortKey = "name" | "last_applied_at" | "application_count" | "city";

export default function MasterApplicants() {
  const { data, isLoading } = useMasterApplicants();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [hasPhone, setHasPhone] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_applied_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    const filtered = data.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (hasPhone === "yes" && !r.phone) return false;
      if (hasPhone === "no" && r.phone) return false;
      if (!s) return true;
      const hay = [
        r.first_name, r.last_name, r.email, r.phone,
        r.city, r.state, r.home_zip, r.last_posting_title,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const av: any = sortKey === "name" ? `${a.last_name} ${a.first_name}`.toLowerCase()
        : sortKey === "city" ? (a.city ?? "").toLowerCase()
        : sortKey === "application_count" ? a.application_count
        : (a.last_applied_at ?? "");
      const bv: any = sortKey === "name" ? `${b.last_name} ${b.first_name}`.toLowerCase()
        : sortKey === "city" ? (b.city ?? "").toLowerCase()
        : sortKey === "application_count" ? b.application_count
        : (b.last_applied_at ?? "");
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return filtered;
  }, [data, search, status, hasPhone, sortKey, sortDir]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const clickSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "city" ? "asc" : "desc"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Master Applicants</h1>
          <p className="text-sm text-muted-foreground">Everyone who's ever applied. Bulk-invite them to new job postings in one tap.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone, city, ZIP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hasPhone} onValueChange={setHasPhone}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Phone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any phone</SelectItem>
                <SelectItem value="yes">Has phone</SelectItem>
                <SelectItem value="no">No phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selected.size > 0 && (
            <div className="flex items-center justify-between mb-3 rounded-md border bg-muted/40 px-3 py-2">
              <div className="text-sm font-medium">{selected.size} selected</div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <Send className="h-4 w-4 mr-1" /> Invite to Job
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => clickSort("name")}>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => clickSort("city")}>Location</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => clickSort("last_applied_at")}>Last applied</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => clickSort("application_count")}># apps</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No applicants match your filters.</TableCell></TableRow>
                ) : filtered.map((r) => {
                  const initials = `${r.first_name?.[0] ?? ""}${r.last_name?.[0] ?? ""}`.toUpperCase();
                  const loc = [r.city, r.state, r.home_zip].filter(Boolean).join(", ");
                  return (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {r.photo_url ? <AvatarImage src={r.photo_url} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="font-medium">{r.first_name} {r.last_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{r.phone || <span className="text-muted-foreground">no phone</span>}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{loc || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">
                        {r.last_applied_at ? (
                          <div>
                            <div>{formatDistanceToNow(new Date(r.last_applied_at), { addSuffix: true })}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.last_posting_title || "—"}</div>
                          </div>
                        ) : <span className="text-muted-foreground">never</span>}
                      </TableCell>
                      <TableCell className="text-right">{r.application_count}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground mt-2">
            Showing {filtered.length} of {data?.length ?? 0} applicants
          </div>
        </CardContent>
      </Card>

      <InviteToJobDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        applicantIds={Array.from(selected)}
      />
    </div>
  );
}
