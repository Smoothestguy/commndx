import { LateCheckIn } from '@/components/signin/LateCheckIn';
import { EarlyCheckIn } from '@/components/signin/EarlyCheckIn';
import { FieldBadgeCheckIn } from '@/components/signin/FieldBadgeCheckIn';
import { useUserRole } from '@/hooks/useUserRole';
import { Textarea } from '@/components/ui/textarea';
import { type EarlyRejection } from '@/lib/shiftDiscipline';
import { SignaturePad } from "@/components/documents/SignaturePad";
import { SaveCrewPrompt } from '@/components/personnel/lifecycle/SaveCrewPrompt';
import { needsCrew } from '@/lib/deploymentFlow';
import { scheduledCheckout } from '@/lib/manualTime';
import { AddExpenseDialog } from "@/components/personnel/lifecycle/AddExpenseDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, Camera, Check, CheckCircle2, Loader2, MapPin, Receipt, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProject } from "@/integrations/supabase/hooks/useProjects";
import { useProjectLocations, ProjectLocation } from "@/integrations/supabase/hooks/useProjectLocations";
import { useCrews, usePersonnelDirectory, fullName, Crew } from "@/integrations/supabase/hooks/useCrews";
import {
  getCoords, todayYmd, useAddPurchase, useAddVisitPhoto, useCheckIn, useCheckOut,
  useSaveSignature, useTodayVisits, VisitRow, VisitPerson, useCheckOutPerson, useAddPersonToVisit,
  fetchTodaySignatures,
} from "@/integrations/supabase/hooks/useFieldMode";

const CREW_KEY = (pid: string) => `fieldModeCrew:${pid}`;

function fmtTime(iso: string) {
  return format(new Date(iso), "HH:mm");
}
function fmtDuration(inIso: string, outIso: string | null) {
  const end = outIso ? new Date(outIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(inIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------- Signature pad (plain canvas, pointer events, no deps) ----------

// ---------- Check-in sheet ----------

function CheckInSheet({ location, crew, projectId, locationIds, onClose }: {
  location: ProjectLocation; crew: Crew | null; projectId: string;
  locationIds: string[]; onClose: () => void;
}) {
  const crewMembers = useMemo(() => (crew?.members ?? []).map((m) => ({
    id: m.personnel_id, name: fullName(m.personnel),
  })), [crew]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(crewMembers.map((m) => m.id)));
  const [extraNames, setExtraNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sigQueue, setSigQueue] = useState<string[]>([]);
  const { data: directory = [] } = usePersonnelDirectory(showSearch);
  const checkIn = useCheckIn(projectId, locationIds);
  const {data:allCrews=[]}=useCrews(projectId);
  const [drawn,setDrawn]=useState<Record<string,Blob>>({});
  const [preparing,setPreparing]=useState(false);
  const [rejection,setRejection]=useState<EarlyRejection|null>(null);
  const [overrideReason,setOverrideReason]=useState('');
  const [crewPrompt,setCrewPrompt]=useState<string|null>(null);
  const reasonRef=useRef<{early?:string;late?:string;override?:string}>({});
  const finishCheckIn=async(signatures:Record<string,Blob>,earlyReason=reasonRef.current.early,override=reasonRef.current.override,lateReason=reasonRef.current.late)=>{reasonRef.current={early:earlyReason,late:lateReason,override};setDrawn(signatures);const {lat,lng}=await getCoords();checkIn.mutate({location_id:location.id,crew_id:crew?.id??null,memberIds:[...selected],lat,lng,signatures,earlyReason,lateReason,overrideReason:override},{onError:(e)=>{const r=(e as Error & {rejection?:EarlyRejection}).rejection;if(r){setSigQueue([]);setRejection(r);}},onSuccess:({visitId})=>{setRejection(null);setSigQueue([]);if(earlyReason)toast.success('Early check-in — pending supervisor approval');if(needsCrew([...selected],allCrews))setCrewPrompt(visitId);else onClose();}});};


  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const nameOf = (id: string) =>
    extraNames[id] ?? crewMembers.find((m) => m.id === id)?.name ??
    fullName(directory.find((p) => p.id === id) ?? null);

  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return directory
      .filter((p) => !selected.has(p.id))
      .filter((p) => !needle || fullName(p).toLowerCase().includes(needle))
      .slice(0, 30);
  }, [directory, search, selected]);

  const doCheckIn = async () => {
    if (!navigator.onLine) { toast.error("No signal — try again in coverage"); return; }
    setPreparing(true);try{const signed=await fetchTodaySignatures(locationIds,[...selected],location.id);const missing=[...selected].filter(id=>!signed[id]);if(missing.length)setSigQueue(missing);else await finishCheckIn({});}catch(e){toast.error(e instanceof Error?e.message:'Check-in unavailable');}finally{setPreparing(false);}
  };


  if(rejection?.reason==='late')return <LateCheckIn rejection={rejection} timezone={location.timezone||undefined} busy={checkIn.isPending} onSubmit={r=>finishCheckIn(drawn,undefined,undefined,r)}/>;
  if(rejection?.reason==='before_shift')return <EarlyCheckIn rejection={rejection} timezone={location.timezone||undefined} busy={checkIn.isPending} onSubmit={r=>finishCheckIn(drawn,r,overrideReason||undefined)}/>;
  if(rejection)return <section className="p-4 space-y-4"><p className="text-warning">{rejection.reason==='no_gps'?"Couldn't get your location":rejection.reason==='out_of_range'?"You're outside the site geofence":'Check-in unavailable — ask your supervisor'}</p>{['no_gps','out_of_range'].includes(rejection.reason)&&<><Textarea aria-label="Off-site reason" placeholder="Reason (required)" value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} maxLength={1000}/><Button disabled={checkIn.isPending||!overrideReason.trim()} onClick={()=>finishCheckIn(drawn,undefined,overrideReason.trim())}>I'M ON SITE ANYWAY</Button></>}</section>;
  if(crewPrompt)return <SaveCrewPrompt projectId={projectId} ids={[...selected]} visitId={crewPrompt} onDone={onClose}/>;
  if (sigQueue.length) {
    const pid = sigQueue[0];
    return (
      <SignaturePad
        key={pid} name={nameOf(pid)}
        required
        saving={checkIn.isPending}
        onSkip={()=>{}}
        onSave={blob=>{const next={...drawn,[pid]:blob};setDrawn(next);if(sigQueue.length>1)setSigQueue(q=>q.slice(1));else void finishCheckIn(next);}}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <p className="text-xs uppercase text-muted-foreground">Checking in to</p>
        <p className="text-xl font-bold leading-tight">{location.name}</p>
        {location.address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {[location.address, location.city, location.state].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />Who's on site? ({selected.size})
        </p>
        <div className="flex flex-wrap gap-2">
          {[...selected].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="h-12 px-4 rounded-full bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2"
            >
              {nameOf(id)}<X className="h-4 w-4" />
            </button>
          ))}
          {crewMembers.filter((m) => !selected.has(m.id)).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className="h-12 px-4 rounded-full border-2 border-dashed text-muted-foreground font-medium text-sm"
            >
              {m.name}
            </button>
          ))}
        </div>
        {crewMembers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {crew ? `No members on ${crew.name} — add people below.` : "No crew selected — add people below."}
          </p>
        )}

        {showSearch ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel…"
              className="h-12 text-base"
            />
            <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted"
                  onClick={() => {
                    setExtraNames((m) => ({ ...m, [p.id]: fullName(p) }));
                    toggle(p.id);
                    setSearch("");
                  }}
                >
                  {fullName(p)}
                </button>
              ))}
              {searchResults.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matches.</p>}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="h-12 w-full" onClick={() => setShowSearch(true)}>
            + Add person
          </Button>
        )}
      </div>

      <div className="p-4 border-t">
        <Button
          size="lg"
          className="w-full h-16 text-xl font-bold bg-success hover:bg-success/90 text-success-foreground"
          disabled={selected.size === 0 || checkIn.isPending || preparing}
          onClick={doCheckIn}
        >
          {checkIn.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : `CHECK IN (${selected.size})`}
        </Button>
      </div>
    </div>
  );
}

// ---------- Active visit sheet ----------

function ActiveVisitSheet({ visit, location, projectId, defaultShiftHours, people, locationIds, onClose }: {
  visit: VisitRow; location: ProjectLocation; projectId: string; defaultShiftHours: number;
  people: VisitPerson[]; locationIds: string[]; onClose: () => void;
}) {
  const {data:shiftProject}=useProject(projectId);
  const [mode, setMode] = useState<"menu" | "receipt" | "photo" | "add">("menu");
  const [personSheet, setPersonSheet] = useState<VisitPerson | null>(null);
  const [sigFor, setSigFor] = useState<string | null>(null);
  const [expOpen, setExpOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const { data: directory = [] } = usePersonnelDirectory(mode === "add");
  const checkOutPerson = useCheckOutPerson(projectId);
  const addPerson = useAddPersonToVisit(projectId, locationIds);
  const saveSig = useSaveSignature(projectId);
  const {data:allCrews=[]}=useCrews(projectId);
  const [crewDismissed,setCrewDismissed]=useState(false);
  const onSite = people.filter((p) => !p.checked_out_at);
  const leftEarly = people.filter((p) => p.checked_out_at);
  const sinceOf = (p: VisitPerson) => p.checked_in_at ?? visit.check_in_at;
  const presentIds = useMemo(() => new Set(people.map((p) => p.personnel_id)), [people]);
  const addResults = useMemo(() => {
    const n = addSearch.trim().toLowerCase();
    return directory.filter((d) => !presentIds.has(d.id))
      .filter((d) => !n || fullName(d).toLowerCase().includes(n)).slice(0, 30);
  }, [directory, addSearch, presentIds]);
  const [addRejection,setAddRejection]=useState<EarlyRejection|null>(null);
  const [addReason,setAddReason]=useState('');
  const retryAdd=(earlyReason?:string,overrideReason?:string,lateReason?:string)=>{const vars=addPerson.variables;if(!vars)return;addPerson.mutate({...vars,earlyReason:earlyReason??vars.earlyReason,overrideReason:overrideReason??vars.overrideReason,lateReason:lateReason??vars.lateReason},{onSuccess:()=>{setAddRejection(null);setSigFor(null);setMode('menu');},onError:e=>setAddRejection((e as Error & {rejection?:EarlyRejection}).rejection||null)});};
  const [addedName, setAddedName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [caption, setCaption] = useState("");
  const receiptInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const addPurchase = useAddPurchase(projectId);
  const addPhoto = useAddVisitPhoto(projectId);
  const checkOut = useCheckOut(projectId);

  const openHours = (Date.now() - new Date(visit.check_in_at).getTime()) / 3_600_000;
  const autoCloseHours=shiftProject?.auto_close_after_hours??14;
  const stale = openHours > autoCloseHours;
  const scheduled=scheduledCheckout(visit.check_in_at,location.timezone||'America/Chicago',location,shiftProject);
  const defaultEnd = new Date(scheduled || new Date(visit.check_in_at).getTime() + defaultShiftHours * 3_600_000);

  const doCheckOut = async (endedAt?: string) => {
    if (!navigator.onLine) { toast.error("No signal — try again in coverage"); return; }
    const { lat, lng } = await getCoords();
    checkOut.mutate({ visit, lat, lng, endedAt }, { onSuccess: onClose });
  };

  const saveReceipt = () => {
    if (!file) return;
    addPurchase.mutate(
      { visit_id: visit.id, file, amount: amount.trim() ? Number(amount) : null, vendor: vendor.trim() || null },
      { onSuccess: () => { setMode("menu"); setFile(null); setAmount(""); setVendor(""); } },
    );
  };
  const savePhoto = async () => {
    if (!file) return;
    const { lat, lng } = await getCoords();
    addPhoto.mutate(
      { visit_id: visit.id, file, caption: caption.trim() || null, lat, lng },
      { onSuccess: () => { setMode("menu"); setFile(null); setCaption(""); } },
    );
  };

  const failedAdd=(addPerson.error as (Error & {rejection?:EarlyRejection})|null)?.rejection;
  const currentRejection=addRejection||failedAdd;
  if(currentRejection?.reason==='late')return <LateCheckIn rejection={currentRejection} timezone={location.timezone||undefined} busy={addPerson.isPending} onSubmit={r=>retryAdd(undefined,undefined,r)}/>;
  if(currentRejection?.reason==='before_shift')return <EarlyCheckIn rejection={currentRejection} timezone={location.timezone||undefined} busy={addPerson.isPending} onSubmit={r=>retryAdd(r,addReason||undefined)}/>;
  if(currentRejection&&['no_gps','out_of_range'].includes(currentRejection.reason))return <section className="p-4 space-y-4"><p className="text-warning">Location unavailable or outside the geofence</p><Textarea aria-label="Off-site reason" placeholder="Reason (required)" value={addReason} onChange={e=>setAddReason(e.target.value)} maxLength={1000}/><Button disabled={!addReason.trim()||addPerson.isPending} onClick={()=>retryAdd(undefined,addReason.trim())}>I'M ON SITE ANYWAY</Button></section>;
  if (sigFor) {
    return (
      <SignaturePad
        name={addedName}
        required
        saving={saveSig.isPending || addPerson.isPending}
        onSkip={() => setSigFor(null)}
        onSave={(blob) => addPerson.mutate({visit,personnel_id:sigFor,blob},{onSuccess:()=>{setSigFor(null);setMode('menu');}})}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <p className="text-xs uppercase text-muted-foreground">On site</p>
        <p className="text-xl font-bold leading-tight">{location.name}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Since {fmtTime(visit.check_in_at)} · {fmtDuration(visit.check_in_at, null)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!crewDismissed && needsCrew(onSite.map(p=>p.personnel_id),allCrews) && <SaveCrewPrompt projectId={projectId} ids={onSite.map(p=>p.personnel_id)} visitId={visit.id} onDone={()=>setCrewDismissed(true)}/>}
        {stale && mode === "menu" && (
          <div className="rounded-xl border-2 border-warning bg-warning/10 p-4 space-y-2">
            <p className="font-semibold">Forgot to check out?</p>
            <p className="text-sm text-muted-foreground">This visit has been open over {autoCloseHours} hours.</p>
            <Button
              variant="outline"
              className="w-full h-12"
              disabled={checkOut.isPending}
              onClick={() => doCheckOut(defaultEnd.toISOString())}
            >
              End at {fmtTime(defaultEnd.toISOString())}
            </Button>
          </div>
        )}

        {mode === "menu" && (
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">On site ({onSite.length})</p>
            <div className="flex flex-wrap gap-2">
              {onSite.map((p) => (
                <button key={p.personnel_id} type="button" onClick={() => setPersonSheet(p)}
                  className="min-h-12 rounded-full border-2 px-4 text-base font-medium hover:bg-muted">
                  {p.personnel?.first_name ?? fullName(p.personnel)} · since {fmtTime(sinceOf(p))}
                </button>
              ))}
              <button type="button" onClick={() => { setAddSearch(""); setMode("add"); }}
                className="min-h-12 rounded-full border-2 border-dashed px-4 text-base font-medium hover:bg-muted">
                + Add person
              </button>
            </div>
            {leftEarly.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Left: {leftEarly.map((p) => `${p.personnel?.first_name ?? fullName(p.personnel)} ${p.checked_out_at ? fmtTime(p.checked_out_at) : ''}`).join(" · ")}
              </p>
            )}
          </div>
        )}

        {mode === "add" && (
          <div className="space-y-3">
            <Input autoFocus value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search name…" className="h-12 text-base" />
            <div className="divide-y border rounded-xl max-h-[50vh] overflow-y-auto">
              {addResults.map((d) => (
                <button key={d.id} type="button" disabled={addPerson.isPending}
                  className="w-full text-left px-4 py-3 text-base hover:bg-muted"
                  onClick={async()=>{try{const signed=await fetchTodaySignatures(locationIds,[d.id],location.id);if(!signed[d.id]){setAddedName(fullName(d));setSigFor(d.id);}else addPerson.mutate({visit,personnel_id:d.id},{onSuccess:()=>setMode('menu')});}catch(e){toast.error(e instanceof Error?e.message:'Signature lookup failed');}}}>
                  {fullName(d)}
                </button>
              ))}
              {!addResults.length && <p className="p-4 text-sm text-muted-foreground">No matches.</p>}
            </div>
            <Button variant="outline" className="w-full h-12" onClick={() => setMode("menu")}>Back</Button>
          </div>
        )}

        {mode === "menu" && (
          <>
            <button
              type="button"
              onClick={() => setExpOpen(true)}
              className="w-full h-20 rounded-xl border-2 border-success/50 bg-success/10 flex items-center gap-4 px-5 text-left hover:bg-success/20"
            >
              <span className="text-3xl shrink-0" aria-hidden>💵</span>
              <span><span className="block text-lg font-semibold">Expense</span>
                <span className="block text-sm text-muted-foreground">Per diem, fuel, travel — for someone on site</span></span>
            </button>
            <button
              type="button"
              onClick={() => { setMode("receipt"); setTimeout(() => receiptInput.current?.click(), 50); }}
              className="w-full h-20 rounded-xl border-2 flex items-center gap-4 px-5 text-left hover:bg-muted"
            >
              <Receipt className="h-8 w-8 shrink-0" />
              <span><span className="block text-lg font-semibold">Receipt</span>
                <span className="block text-sm text-muted-foreground">Snap a purchase receipt</span></span>
            </button>
            <button
              type="button"
              onClick={() => { setMode("photo"); setTimeout(() => photoInput.current?.click(), 50); }}
              className="w-full h-20 rounded-xl border-2 flex items-center gap-4 px-5 text-left hover:bg-muted"
            >
              <Camera className="h-8 w-8 shrink-0" />
              <span><span className="block text-lg font-semibold">Site photo</span>
                <span className="block text-sm text-muted-foreground">Document conditions or progress</span></span>
            </button>
          </>
        )}

        {mode === "receipt" && (
          <div className="space-y-3">
            {file ? (
              <img src={URL.createObjectURL(file)} alt="Receipt" className="w-full max-h-64 object-contain rounded-xl border" />
            ) : (
              <Button variant="outline" className="w-full h-14" onClick={() => receiptInput.current?.click()}>
                <Camera className="h-5 w-5 mr-2" />Take receipt photo
              </Button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">$</span>
              <Input
                type="number" inputMode="decimal" min={0} step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="Amount (optional)"
                className="h-14 text-lg"
              />
            </div>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor (optional)" className="h-12" />
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 flex-1" onClick={() => { setMode("menu"); setFile(null); }}>Back</Button>
              <Button className="h-12 flex-1" disabled={!file || addPurchase.isPending} onClick={saveReceipt}>
                {addPurchase.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save receipt
              </Button>
            </div>
          </div>
        )}

        {mode === "photo" && (
          <div className="space-y-3">
            {file ? (
              <img src={URL.createObjectURL(file)} alt="Site" className="w-full max-h-64 object-contain rounded-xl border" />
            ) : (
              <Button variant="outline" className="w-full h-14" onClick={() => photoInput.current?.click()}>
                <Camera className="h-5 w-5 mr-2" />Take site photo
              </Button>
            )}
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="h-12" />
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 flex-1" onClick={() => { setMode("menu"); setFile(null); }}>Back</Button>
              <Button className="h-12 flex-1" disabled={!file || addPhoto.isPending} onClick={savePhoto}>
                {addPhoto.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save photo
              </Button>
            </div>
          </div>
        )}
      </div>

      {mode === "menu" && (
        <div className="p-4 border-t">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-16 text-xl font-bold"
            disabled={checkOut.isPending}
            onClick={() => doCheckOut()}
          >
            {checkOut.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "CHECK OUT"}
          </Button>
        </div>
      )}

      <AddExpenseDialog open={expOpen} onOpenChange={setExpOpen} projectId={projectId} lockProject
        people={onSite.map((p) => ({ id: p.personnel_id, name: [p.personnel?.first_name, p.personnel?.last_name].filter(Boolean).join(" ") || "Unknown" }))} />
      <Dialog open={!!personSheet} onOpenChange={(o) => !o && setPersonSheet(null)}>
        <DialogContent className="max-w-sm">
          {personSheet && (
            <div className="space-y-3 pt-2">
              <p className="text-lg font-semibold">{fullName(personSheet.personnel)}</p>
              <p className="text-sm text-muted-foreground">On site since {fmtTime(sinceOf(personSheet))} · {fmtDuration(sinceOf(personSheet), null)}</p>
              <Button variant="destructive" className="w-full h-14 text-lg" disabled={checkOutPerson.isPending}
                onClick={() => checkOutPerson.mutate({ visit, personnel_id: personSheet.personnel_id }, { onSuccess: () => setPersonSheet(null) })}>
                {checkOutPerson.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : `Check out ${personSheet.personnel?.first_name ?? "person"}`}
              </Button>
              <Button variant="outline" className="w-full h-12" onClick={() => setPersonSheet(null)}>Cancel</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={receiptInput} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ---------- Page ----------

export default function FieldMode() {
  const {isAdmin,isManager}=useUserRole();
  const [scanLocation,setScanLocation]=useState<ProjectLocation|null>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: locations = [], isLoading } = useProjectLocations(projectId);
  const { data: crews = [] } = useCrews(projectId);
  const locationIds = useMemo(() => locations.map((l) => l.id), [locations]);
  const { data: bundle } = useTodayVisits(projectId, locationIds);

  const activeCrews = crews.filter((c) => c.status === "active");
  const [crewId, setCrewId] = useState<string>(() => (projectId ? localStorage.getItem(CREW_KEY(projectId)) : null) ?? "");
  useEffect(() => {
    if (!crewId && activeCrews.length) setCrewId(activeCrews[0].id);
  }, [activeCrews, crewId]);
  const pickCrew = (id: string) => {
    setCrewId(id);
    if (projectId) localStorage.setItem(CREW_KEY(projectId), id);
  };
  const crew = activeCrews.find((c) => c.id === crewId) ?? null;

  const [sheet, setSheet] = useState<{ location: ProjectLocation; visit: VisitRow | null } | null>(null);

  const today = todayYmd();
  const visitsByLocation = useMemo(() => {
    const m: Record<string, VisitRow[]> = {};
    for (const v of bundle?.visits ?? []) (m[v.location_id] ??= []).push(v);
    return m;
  }, [bundle]);

  const isActiveToday = (l: ProjectLocation) =>
    !(l.demobe_date && l.demobe_date < today) && !(l.mobe_date && l.mobe_date > today);

  const sortedLocations = useMemo(() => {
    const status = (l: ProjectLocation) => {
      const vs = visitsByLocation[l.id] ?? [];
      if (vs.some((v) => !v.check_out_at)) return 0;
      if (vs.length) return 1;
      return isActiveToday(l) ? 2 : 3;
    };
    return [...locations].sort((a, b) => status(a) - status(b) || a.name.localeCompare(b.name));
  }, [locations, visitsByLocation, today]);

  const defaultShiftHours = Number((project as any)?.default_shift_hours ?? 12) || 12;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Back to project"
            onClick={() => navigate(`/projects/${projectId}?tab=deployment`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="font-bold truncate leading-tight">{(project as any)?.name ?? "Field Mode"}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
          </div>
        </div>
        {activeCrews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {activeCrews.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCrew(c.id)}
                className={cn(
                  "h-11 px-5 rounded-full font-semibold text-sm whitespace-nowrap border-2 shrink-0",
                  crewId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Site list */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : sortedLocations.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No locations on this project yet.</p>
        ) : (
          sortedLocations.map((l) => {
            const vs = visitsByLocation[l.id] ?? [];
            const open = vs.find((v) => !v.check_out_at);
            const lastDone = vs.find((v) => v.check_out_at);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSheet({ location: l, visit: open ?? null })}
                className={cn(
                  "w-full rounded-2xl border-2 p-5 text-left flex items-center gap-4 min-h-[5.5rem]",
                  open ? "border-success bg-success/10" : lastDone ? "border-muted bg-muted/40" : "bg-card",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold truncate">{l.name}</p>
                  {l.project_number && <p className="text-xs text-muted-foreground">#{l.project_number}</p>}
                  {open ? (
                    <p className="text-sm font-semibold text-success flex items-center gap-2 mt-1">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                      </span>
                      ON SITE since {fmtTime(open.check_in_at)}
                    </p>
                  ) : lastDone ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Done · {fmtDuration(lastDone.check_in_at, lastDone.check_out_at)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Not visited today</p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </main>

      {/* Full-screen sheet */}
      <Dialog open={!!scanLocation} onOpenChange={open=>{if(!open)setScanLocation(null);}}><DialogContent className="w-full max-w-3xl h-[100dvh] sm:h-auto max-h-[100dvh] overflow-y-auto p-0">{scanLocation&&<FieldBadgeCheckIn location={scanLocation} projectId={projectId||''} locationIds={locationIds} onDone={()=>{toast.success('Badge check-in recorded');setScanLocation(null);}}/>}</DialogContent></Dialog>
      <Dialog open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="max-w-none w-full h-[100dvh] p-0 gap-0 rounded-none border-0 [&>button]:hidden">
          {sheet && (
            scanLocation ? null :
            sheet.visit ? (
              <ActiveVisitSheet
                visit={sheet.visit}
                location={sheet.location}
                projectId={projectId || ''}
                defaultShiftHours={defaultShiftHours}
                people={(bundle?.people ?? []).filter((p) => p.visit_id === sheet.visit?.id)}
                locationIds={locationIds}
                onClose={() => setSheet(null)}
              />
            ) : (
              <CheckInSheet
                location={sheet.location}
                crew={crew}
                projectId={projectId || ''}
                locationIds={locationIds}
                onClose={() => setSheet(null)}
              />
            )
          )}
          <Button
            size="icon" variant="ghost" aria-label="Close"
            className="absolute top-3 right-3 h-10 w-10 z-10"
            onClick={() => setSheet(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {sheet&&(isAdmin||isManager)&&<div className="absolute top-3 right-16 z-10"><Button variant="outline" className="h-10" onClick={()=>{setScanLocation(sheet.location);setSheet(null);}}>Scan badge</Button></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
