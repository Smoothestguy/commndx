import { EnhancedDataTable, type EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useSessionState } from "@/hooks/useSessionState";
import { ApplicantTagBadges, ApplicantNoteLine } from "@/components/staffing/ApplicantMetaInline";
import { useApplicantCertSummary } from "@/hooks/useApplicantCertSummary";
import { formatApplicantLocation } from "@/lib/applicantLocation";
import { useApplicantLocations } from "@/hooks/useZipLookup";
import { useMemo, useState } from "react";
import { ApplicantStarButton } from "@/components/staffing/ApplicantStarButton";
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
  vendor_id: string | null;
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  starred_at?: string | null;
  role_tags?: string[] | null;
  staff_notes?: string | null;
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
        .select("id, vendor_id, first_name, last_name, email, phone, photo_url, city, state, home_zip, starred_at, role_tags, staff_notes, status, created_at")
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
  const { data: rawData, isLoading } = useMasterApplicants();
  const resolveLocation = useApplicantLocations(rawData ?? []);
  const data = useMemo(() => rawData?.map(resolveLocation), [rawData, resolveLocation]);
  const [search, setSearch] = useSessionState("master-applicants:search", "");
  const [status, setStatus] = useSessionState("master-applicants:status", "all");
  const [hasPhone, setHasPhone] = useSessionState("master-applicants:phone", "all");
  const [sortKey, setSortKey] = useState<SortKey>("last_applied_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selection, setSelection] = useSessionState<string[]>("master-applicants:selection", []);
  const selected = new Set(selection);
  const setSelected = (next: Set<string> | ((prev: Set<string>) => Set<string>)) => setSelection(prev => [...(typeof next === "function" ? next(new Set(prev)) : next)]);
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
      if (!!a.starred_at !== !!b.starred_at) return a.starred_at ? -1 : 1;
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

  const certSummary = useApplicantCertSummary(filtered.map((r) => r.id));
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

  const columns: EnhancedColumn<Row>[] = [
    { key: 'name', header: 'Name', width: 280, getValue: r => `${r.first_name} ${r.last_name}`, render: r => <span className="flex items-center gap-2"><ApplicantStarButton applicantId={r.id} starredAt={r.starred_at} /><span><span className="font-medium">{r.first_name} {r.last_name}</span><ApplicantTagBadges applicant={r} certs={certSummary[r.id]} /><ApplicantNoteLine applicant={r} /></span></span> },
    { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email', width: 240 },
    { key: 'location', header: 'Location', getValue: formatApplicantLocation },
    { key: 'last_applied_at', header: 'Last applied', render: r => r.last_applied_at ? formatDistanceToNow(new Date(r.last_applied_at), { addSuffix: true }) : 'never' },
    { key: 'last_posting_title', header: 'Last position' }, { key: 'application_count', header: '# apps' },
    { key: 'status', header: 'Status', render: r => <Badge variant="outline">{r.status}</Badge> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applicant Pool</h1>
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
          <EnhancedDataTable tableId="master-applicants" data={filtered} columns={columns} selectedIds={selected} onSelectionChange={setSelected}
            defaultSortKey="last_applied_at" defaultSortDirection="desc" exportName="applicant-pool" attention={r => !r.phone ? 'Missing phone' : null}
            pinFirst={r => !!r.starred_at} emptyText={isLoading ? 'Loading…' : 'No applicants match your filters.'}
            bulkActions={() => <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><Send className="h-3.5 w-3.5 mr-1" />Invite to Job</Button>} />

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
