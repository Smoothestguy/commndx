import { StatusPill, EnhancedDataTable, type EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { ApplicantMergeDialog, ApplicantDuplicateActions, type MergeCandidate } from '@/components/staffing/ApplicantMergeDialog';
import { SubmittedTime, RecruitingStateFilter } from '@/components/staffing/RecruitingControls';
import { useApplicantDuplicates } from '@/hooks/useApplicantDuplicates';
import { recruitingState, submissionTime, canMergeApplicants } from '@/lib/recruiting';
import { useIsMobile } from "@/hooks/use-mobile";
import { useSessionState } from "@/hooks/useSessionState";
import { ApplicantTagBadges, ApplicantNoteLine } from "@/components/staffing/ApplicantMetaInline";
import { useApplicantCertSummary } from "@/hooks/useApplicantCertSummary";
import { formatApplicantLocation } from "@/lib/applicantLocation";
import { useApplicantLocations } from "@/hooks/useZipLookup";
import { useMemo, useState } from "react";
import { ApplicantStarButton } from "@/components/staffing/ApplicantStarButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {useUserRole} from '@/hooks/useUserRole';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from '@/components/ui/dialog';
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
  gender?: string | null;
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
      const applicants: any[] = [];
      const apps: any[] = [];
      for (let offset=0; ;offset+=500) {
        const {data,error}=await supabase.from('applicants').select('id, vendor_id, first_name, last_name, email, phone, photo_url, gender, city, state, home_zip, starred_at, role_tags, staff_notes, status, created_at').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
        if(error)throw error; applicants.push(...(data??[])); if((data??[]).length<500)break;
      }
      for (let offset=0; ;offset+=500) {
        const {data,error}=await supabase.from('applications').select(`
          applicant_id, created_at, submitted_at, answers, job_posting_id,
          job_postings (
            id,
            project_task_orders ( title, projects:project_id (name) )
          )
        `)
        .order('created_at',{ascending:false}).order('id').range(offset,offset+499);
        if(error)throw error; apps.push(...(data??[])); if((data??[]).length<500)break;
      }

      const byApplicant = new Map<string, { count: number; last?: any }>();
      for (const a of ((apps ?? []) as any[]).sort((a,b) => submissionTime(b).localeCompare(submissionTime(a)))) {
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
          state: recruitingState(a.state, last?.answers) || a.state,
          application_count: info?.count ?? 0,
          last_applied_at: last ? submissionTime(last) : a.created_at,
          last_posting_id: last?.job_posting_id ?? null,
          last_posting_title: title,
        };
      });
    },
  });

type SortKey = "name" | "last_applied_at" | "application_count" | "city";

export default function MasterApplicants() {
  const mobile = useIsMobile();
  const { groupsFor } = useApplicantDuplicates();
  const [stateFilter, setStateFilter] = useState('all');
  const [mergePair, setMergePair] = useState<MergeCandidate[] | null>(null);
  const qc=useQueryClient(),{isAdmin,isManager}=useUserRole();
  const [editor,setEditor]=useState<{id?:string;first_name:string;last_name:string;email:string;phone:string}|null>(null);
  const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false);
  const openApplicant=(r:Row,edit:boolean)=>{setEditing(edit);setEditor({id:r.id,first_name:r.first_name,last_name:r.last_name,email:r.email,phone:r.phone??''});};
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
      if (status === "all" ? r.status === "archived" : r.status !== status) return false;
      if (hasPhone === "yes" && !r.phone) return false;
      if (hasPhone === "no" && r.phone) return false;
      if (stateFilter !== 'all' && (recruitingState(r.state) || 'unknown') !== stateFilter) return false;
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
  }, [data, search, status, hasPhone, sortKey, sortDir, stateFilter]);

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
    { key: 'name', header: 'Name', width: 280, getValue: r => `${r.first_name} ${r.last_name}`, render: r => <span className="flex items-center gap-2">{mobile && <ApplicantStarButton applicantId={r.id} starredAt={r.starred_at} />}<span className="min-w-0 truncate font-medium" title={`${r.first_name} ${r.last_name}`}>{r.first_name} {r.last_name}{mobile && <><ApplicantTagBadges applicant={r} certs={certSummary[r.id]} /><ApplicantNoteLine applicant={r} /></>}</span></span> },
    ...(!mobile ? [{ key: 'flags', header: 'Flags', width: 240, sortable: false, getValue: (r: Row) => [r.starred_at ? 'Starred' : '', ...(r.role_tags ?? []), ...(certSummary[r.id]?.types ?? [])].filter(Boolean).join(', '), render: (r: Row) => <div className="flex items-center gap-2 flex-nowrap [&>span]:flex-nowrap"><ApplicantStarButton applicantId={r.id} starredAt={r.starred_at}/><ApplicantTagBadges applicant={r} certs={certSummary[r.id]} className="flex-nowrap" /></div> }, {key:'notes',header:'Notes',width:220,getValue:(r:Row)=>r.staff_notes ?? '',render:(r:Row)=><span className="block truncate text-muted-foreground" title={r.staff_notes ?? undefined}>{r.staff_notes || '—'}</span>}] : []),
    { key: 'gender', header: 'Gender', width: 120, sortable: true, filterable: true, getValue: (r: any) => r.gender === 'male' ? 'Male' : r.gender === 'female' ? 'Female' : '' },
    { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email', width: 240 },
    { key: 'location', header: 'Location', getValue: formatApplicantLocation },
    { key: 'state', header: 'State', width: 100, sortable: true, filterable: true, getValue: r => recruitingState(r.state) },
    { key: 'duplicate', header: 'Duplicate', width: 180, getValue: r => groupsFor(r.id).length ? 'Possible duplicate' : '', render: r => groupsFor(r.id).length ? <Badge variant="outline">Possible duplicate</Badge> : null },
    { key: 'last_applied_at', header: 'Submitted', width: 310, getValue: submissionTime, render: r => <SubmittedTime value={submissionTime(r)} /> },
    { key: 'last_posting_title', header: 'Last position' }, { key: 'application_count', header: '# apps' },
    { key: 'status', header: 'Status', render: r => <StatusPill value={r.status} /> },
  ];

  return (
    <div data-viewport-list className="desktop-list-page p-4 sm:p-6 space-y-4 min-[1180px]:space-y-2">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applicant Pool</h1>
          <p className="text-sm text-muted-foreground">Everyone who's ever applied. Bulk-invite them to new job postings in one tap.</p>
        </div>
      </div>

      <Card className="min-[1180px]:border-0 min-[1180px]:shadow-none min-[1180px]:bg-transparent">
        <CardHeader className="pb-3 md:hidden">
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
                <SelectItem value="all">All (excl. archived)</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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
            <RecruitingStateFilter value={stateFilter} onChange={setStateFilter}/>
          </div>
        </CardHeader>
        <CardContent className="min-[1180px]:p-0">
          <EnhancedDataTable fillViewport tableId="master-applicants" data={filtered} columns={columns} selectedIds={selected} onSelectionChange={setSelected}
            searchValue={search} onSearchChange={setSearch} latestSortKey="last_applied_at"
            toolbar={mobile ? undefined : <RecruitingStateFilter value={stateFilter} onChange={setStateFilter}/>}
            filterContent={<><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent>{['all','new','approved','inactive','rejected','archived'].map(v=><SelectItem key={v} value={v}>{v==='all'?'All (excl. archived)':v}</SelectItem>)}</SelectContent></Select><Select value={hasPhone} onValueChange={setHasPhone}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Any phone</SelectItem><SelectItem value="yes">Has phone</SelectItem><SelectItem value="no">No phone</SelectItem></SelectContent></Select></>}
            selectable={isAdmin||isManager} entityName="applicant"
            onRowClick={r=>openApplicant(r,false)} onEdit={r=>openApplicant(r,true)}
            onAdd={()=>{setEditing(true);setEditor({first_name:'',last_name:'',email:'',phone:''});}}
            canSetActive={r=>r.status==='new'||r.status==='inactive'}
            onSetActive={async(rows,active)=>{const {error}=await supabase.from('applicants').update({status:active?'new':'inactive'}).in('id',rows.map(r=>r.id));if(error){toast.error(error.message);throw error;}await qc.invalidateQueries({queryKey:['master-applicants']});}}
            defaultSortKey="last_applied_at" defaultSortDirection="desc" exportName="applicant-pool" attention={r => !r.phone ? 'Missing phone' : null}
            emptyText={isLoading ? 'Loading…' : 'No applicants match your filters.'}
            bulkActions={rows => <><Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><Send className="h-3.5 w-3.5 mr-1" />Invite to Job</Button>{canMergeApplicants(isAdmin||isManager,rows.map(r=>r.id)) && <Button size="sm" variant="outline" onClick={()=>setMergePair(rows)}>Merge applicants</Button>}</>} />

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
      <ApplicantMergeDialog candidates={mergePair} onClose={()=>setMergePair(null)} onMerged={()=>setSelection([])}/>
      <Dialog open={!!editor} onOpenChange={o=>{if(!o&&!saving)setEditor(null);}}><DialogContent><DialogHeader><DialogTitle>{editing?(editor?.id?'Edit applicant':'Add applicant'):'Applicant'}</DialogTitle></DialogHeader>{editor?.id && <ApplicantDuplicateActions applicant={{...editor,id:editor.id}}/>}{editor&&<form onSubmit={async e=>{e.preventDefault();if(!editing||!(isAdmin||isManager))return;setSaving(true);try{const {id,...fields}=editor;const payload={...fields,phone:fields.phone||null};const result=id?await supabase.from('applicants').update(payload).eq('id',id):await supabase.from('applicants').insert({...payload,status:'new'});if(result.error)throw result.error;await qc.invalidateQueries({queryKey:['master-applicants']});setEditor(null);}catch(e){toast.error(e instanceof Error?e.message:'Could not save applicant');}finally{setSaving(false);}}} className="space-y-3">{(['first_name','last_name','email','phone'] as const).map(key=><label key={key} className="block space-y-1 text-sm"><span>{key.replace(/_/g,' ')}</span><Input readOnly={!editing} required={key!=='phone'} type={key==='email'?'email':key==='phone'?'tel':'text'} value={editor[key]} onChange={e=>setEditor({...editor,[key]:e.target.value})}/></label>)}<DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={()=>setEditor(null)}>Close</Button>{editing&&<Button type="submit" disabled={saving}>Save</Button>}</DialogFooter></form>}</DialogContent></Dialog>
    </div>
  );
}
