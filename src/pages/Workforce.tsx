import { ApplicantTagBadges, ApplicantNoteLine } from "@/components/staffing/ApplicantMetaInline";
import { useApplicantCertSummary } from "@/hooks/useApplicantCertSummary";
import { formatApplicantLocation } from "@/lib/applicantLocation";
import { useApplicantLocations } from "@/hooks/useZipLookup";
import { useEffect, useMemo, useState } from "react";
import { ApplicantStarButton, StarredCountChip } from "@/components/staffing/ApplicantStarButton";
import { sortStarredBlocks, countStarred } from "@/lib/applicantStar";
import { useSearchParams } from "react-router-dom";
import { NetSuitePageLayout } from "@/components/layout/netsuite";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Sparkles, Download, Loader2, Users, Send, MessageSquare, Tag, X, BadgeCheck,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  useCapabilityCategories,
  useWorkforcePool,
  useClassifyApplicants,
  useWorkforceHistory,
  useAddCapabilityTag,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";
import { useJobPostings } from "@/integrations/supabase/hooks/useStaffingApplications";
import { WorkforceApplicantDrawer } from "@/components/workforce/WorkforceApplicantDrawer";
import { WorkforceInviteDialog } from "@/components/workforce/WorkforceInviteDialog";
import { TextSelectedDialog } from "@/components/workforce/TextSelectedDialog";
import { RatingStars } from "@/components/workforce/RatingDialog";
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/PhotoLightbox";
import { calculateDistanceMiles } from "@/utils/geoDistance";

const PAGE_SIZE = 50;
const UNCLASSIFIED = "__unclassified__";

type SortKey = "name" | "recent" | "confidence" | "distance";

export default function Workforce() {
  const [searchParams, setSearchParams] = useSearchParams();
  const postingParam = searchParams.get("posting");

  const { data: categories = [], isLoading: catLoading } = useCapabilityCategories();
  const { data: rawPool = [], isLoading: poolLoading, refetch } = useWorkforcePool();
  const resolveLocation = useApplicantLocations(rawPool);
  const pool = useMemo(() => rawPool.map(resolveLocation), [rawPool, resolveLocation]);
  const { data: history } = useWorkforceHistory();
  const { data: postings = [] } = useJobPostings();
  const classify = useClassifyApplicants();
  const addTag = useAddCapabilityTag();

  const [selected, setSelected] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [drawerApplicant, setDrawerApplicant] = useState<WorkforceApplicant | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [startingRemaining, setStartingRemaining] = useState(0);

  // Phase 2 filters
  const [workedWithFrg, setWorkedWithFrg] = useState(false);
  const [ratedHigh, setRatedHigh] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [consentOnly, setConsentOnly] = useState(false);
  const [showDnr, setShowDnr] = useState(false);
  const [radius, setRadius] = useState<number>(150);
  const [useRadius, setUseRadius] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("all");

  // Bulk selection
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);

  const posting: any = useMemo(
    () => (postings ?? []).find((p: any) => p.id === postingParam),
    [postings, postingParam]
  );
  const postingCoords = useMemo(() => {
    const to = posting?.project_task_orders;
    const lat = to?.location_lat ?? to?.projects?.site_lat ?? null;
    const lng = to?.location_lng ?? to?.projects?.site_lng ?? null;
    return lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
  }, [posting]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of pool) {
      const seen = new Set<string>();
      for (const t of a.tags) {
        if (seen.has(t.category_id)) continue;
        seen.add(t.category_id);
        map.set(t.category_id, (map.get(t.category_id) ?? 0) + 1);
      }
    }
    return map;
  }, [pool]);

  const unclassifiedCount = useMemo(
    () => pool.filter((a) => !a.capabilities_classified_at).length,
    [pool]
  );

  useEffect(() => {
    if (!classifying) return;
    const t = setInterval(() => refetch(), 5000);
    return () => clearInterval(t);
  }, [classifying, refetch]);

  useEffect(() => {
    if (classifying && unclassifiedCount === 0) {
      setClassifying(false);
      toast.success("Classification complete");
    }
  }, [classifying, unclassifiedCount]);

  // Derive category preselection from a posting's positions
  const [postingApplied, setPostingApplied] = useState(false);
  useEffect(() => {
    if (postingApplied || !postingParam || !posting || !categories.length) return;
    const labels: string[] = (posting.project_task_orders?.task_order_positions ?? [])
      .map((p: any) => String(p.position_label ?? "").trim().toLowerCase())
      .filter(Boolean);
    const matched = categories
      .filter((c) => {
        const names = [c.name, ...(c.aliases ?? [])].map((n) => n.trim().toLowerCase());
        return labels.some((l) => names.some((n) => n === l || l.includes(n) || n.includes(l)));
      })
      .map((c) => c.id);
    if (matched.length) setSelected(matched);
    if (postingCoords) setUseRadius(true);
    setPostingApplied(true);
  }, [postingParam, posting, categories, postingCoords, postingApplied]);

  const distanceOf = (a: WorkforceApplicant) =>
    postingCoords && a.home_lat != null && a.home_lng != null
      ? calculateDistanceMiles(postingCoords.lat, postingCoords.lng, a.home_lat, a.home_lng)
      : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = pool;

    if (!showDnr) rows = rows.filter((a) => !a.do_not_rehire);
    if (workedWithFrg) rows = rows.filter((a) => (history?.links.get(a.id)?.projects_worked ?? 0) > 0);
    if (ratedHigh) rows = rows.filter((a) => (history?.links.get(a.id)?.rating ?? 0) >= 4);
    if (availableOnly) rows = rows.filter((a) => a.availability_status === "available");
    if (consentOnly) rows = rows.filter((a) => a.has_sms_consent);
    if (stateFilter !== "all") rows = rows.filter((a) => (a.state ?? "") === stateFilter);

    if (postingParam) rows = rows.filter((a) => !a.applied_posting_ids.includes(postingParam));

    if (useRadius && postingCoords) {
      rows = rows.filter((a) => {
        const d = distanceOf(a);
        return d != null && d <= radius;
      });
    }

    if (selected.length) {
      const wantsUnclassified = selected.includes(UNCLASSIFIED);
      const catIds = selected.filter((s) => s !== UNCLASSIFIED);
      rows = rows.filter((a) => {
        if (wantsUnclassified && !a.capabilities_classified_at) return true;
        if (!catIds.length) return false;
        const ids = new Set(a.tags.map((t) => t.category_id));
        return matchAll ? catIds.every((c) => ids.has(c)) : catIds.some((c) => ids.has(c));
      });
    }

    if (q) {
      rows = rows.filter((a) =>
        [a.first_name, a.last_name, a.email, a.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    const sorted = [...rows];
    if (sort === "name") {
      sorted.sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
    } else if (sort === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.last_application_at ?? b.created_at).getTime() -
          new Date(a.last_application_at ?? a.created_at).getTime()
      );
    } else if (sort === "distance") {
      sorted.sort((a, b) => (distanceOf(a) ?? 1e9) - (distanceOf(b) ?? 1e9));
    } else {
      const best = (a: WorkforceApplicant) => Math.max(0, ...a.tags.map((t) => t.confidence ?? 1));
      sorted.sort((a, b) => best(b) - best(a));
    }
    // Starred first; chosen sort stays secondary within each block (stable).
    return sortStarredBlocks(sorted, (a) => a, () => 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pool, selected, matchAll, search, sort, showDnr, workedWithFrg, ratedHigh, availableOnly,
    consentOnly, stateFilter, postingParam, useRadius, radius, postingCoords, history,
  ]);

  const alreadyAppliedCount = useMemo(
    () => (postingParam ? pool.filter((a) => a.applied_posting_ids.includes(postingParam)).length : 0),
    [pool, postingParam]
  );

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const certSummary = useApplicantCertSummary(pageRows.map((a) => a.id));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const states = useMemo(
    () => [...new Set(pool.map((a) => a.state).filter(Boolean) as string[])].sort(),
    [pool]
  );

  const checkedApplicants = useMemo(
    () => pool.filter((a) => checked.has(a.id)),
    [pool, checked]
  );

  const toggleCategory = (id: string) => {
    setPage(1);
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleRow = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pageAllChecked = pageRows.length > 0 && pageRows.every((r) => checked.has(r.id));

  const toRows = (rows: WorkforceApplicant[]) => [
    ["Name", "Phone", "Email", "City", "State", "Status", "Rating", "Projects", "Categories", "Last Application"],
    ...rows.map((a) => [
      `${a.first_name} ${a.last_name}`,
      a.phone ?? "",
      a.email ?? "",
      a.city ?? "",
      a.state ?? "",
      a.status,
      history?.links.get(a.id)?.rating?.toFixed(1) ?? "",
      String(history?.links.get(a.id)?.projects_worked ?? 0),
      a.tags.map((t) => catById.get(t.category_id)?.name ?? "").filter(Boolean).join(" | "),
      a.last_application_at ? format(new Date(a.last_application_at), "yyyy-MM-dd") : "",
    ]),
  ];

  const downloadCsv = (rows: WorkforceApplicant[], name: string) => {
    const csv = toRows(rows)
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startClassification = async () => {
    setStartingRemaining(unclassifiedCount);
    setClassifying(true);
    const res = await classify.mutateAsync({ batch_size: 15, chain: true });
    if (res?.paused) {
      setClassifying(false);
      toast.warning(res.reason ?? "Classification paused");
    }
  };

  const progress =
    startingRemaining > 0
      ? Math.min(100, Math.round(((startingRemaining - unclassifiedCount) / startingRemaining) * 100))
      : 0;

  return (
    <NetSuitePageLayout
      title="Workforce"
      description="Browse the applicant pool by capability, history and rating"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={startClassification}
            disabled={classify.isPending || classifying || unclassifiedCount === 0}
          >
            {classifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">Classify unclassified ({unclassifiedCount})</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(filtered, "workforce")}>
            <Download className="h-4 w-4" />
            <span className="ml-2">Export CSV</span>
          </Button>
        </>
      }
    >
      {postingParam && posting && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              Showing candidates for{" "}
              <strong>{posting.project_task_orders?.title ?? "posting"}</strong> — {filtered.length}{" "}
              match · {alreadyAppliedCount} already applied
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                searchParams.delete("posting");
                setSearchParams(searchParams);
                setSelected([]);
                setUseRadius(false);
                setPostingApplied(false);
              }}
            >
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {classifying && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Classifying applicants…</span>
              <span className="text-muted-foreground">{unclassifiedCount} remaining</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Left rail */}
        <Card>
          <CardContent className="p-3">
            <div className="mb-3 space-y-2 border-b pb-3">
              <div className="text-sm font-medium">Filters</div>
              {[
                ["Worked with FRG", workedWithFrg, setWorkedWithFrg],
                ["Rated 4+", ratedHigh, setRatedHigh],
                ["Available", availableOnly, setAvailableOnly],
                ["Has SMS consent", consentOnly, setConsentOnly],
                ["Show do-not-rehire", showDnr, setShowDnr],
              ].map(([label, value, setter]: any) => (
                <div key={label} className="flex items-center justify-between">
                  <Label className="text-xs font-normal">{label}</Label>
                  <Switch checked={value} onCheckedChange={(v) => { setter(v); setPage(1); }} />
                </div>
              ))}

              {postingCoords ? (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-normal">Within {radius} miles</Label>
                    <Switch checked={useRadius} onCheckedChange={setUseRadius} />
                  </div>
                  {useRadius && (
                    <Input
                      type="number"
                      className="h-8"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value) || 0)}
                    />
                  )}
                </>
              ) : (
                <div>
                  <Label className="text-xs font-normal">State</Label>
                  <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Categories</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setMatchAll(!matchAll)}
              >
                {matchAll ? "Match all" : "Match any"}
              </Button>
            </div>
            <ScrollArea className="h-[45vh] pr-2">
              <button
                onClick={() => toggleCategory(UNCLASSIFIED)}
                className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selected.includes(UNCLASSIFIED) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <span>Unclassified</span>
                <span className="text-xs text-muted-foreground">{unclassifiedCount}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                    selected.includes(c.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="truncate pr-2">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{counts.get(c.id) ?? 0}</span>
                </button>
              ))}
            </ScrollArea>
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Main */}
        <Card>
          <CardContent className="p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, phone, email"
                  className="pl-8"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  {postingCoords && <SelectItem value="distance">Distance</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {poolLoading || catLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No applicants match this selection.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            checked={pageAllChecked}
                            onCheckedChange={(v) =>
                              setChecked((prev) => {
                                const next = new Set(prev);
                                pageRows.forEach((r) => (v ? next.add(r.id) : next.delete(r.id)));
                                return next;
                              })
                            }
                          />
                        </TableHead>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>FRG history</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Categories</TableHead>
                        <TableHead>Last application</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((a) => {
                        const link = history?.links.get(a.id);
                        const dist = distanceOf(a);
                        return (
                          <TableRow
                            key={a.id}
                            className="cursor-pointer"
                            onClick={() => setDrawerApplicant(a)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={checked.has(a.id)}
                                onCheckedChange={() => toggleRow(a.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ApplicantStarButton applicantId={a.id} starredAt={a.starred_at} />
                                <Avatar
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    if (!a.photo_url) return;
                                    e.stopPropagation();
                                    setLightbox({
                                      url: a.photo_url,
                                      caption: `${a.first_name} ${a.last_name}`,
                                    });
                                  }}
                                >
                                  <AvatarImage
                                    src={a.photo_url ?? undefined}
                                    className="object-cover"
                                  />
                                  <AvatarFallback>
                                    {a.first_name?.[0]}
                                    {a.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium">
                                      {a.first_name} {a.last_name}
                                    </span>
                                    <ApplicantTagBadges applicant={a} certs={certSummary[a.id]} />
                                  </div>
                                  <ApplicantNoteLine applicant={a} className="max-w-[260px]" />
                                </div>
                                {a.do_not_rehire && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Do not rehire
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div>{a.phone ?? "—"}</div>
                              <div className="truncate max-w-[180px]">{a.email}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatApplicantLocation(a)}
                              {dist != null && (
                                <div className="text-xs">{Math.round(dist)} mi</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {link && link.projects_worked > 0 ? (
                                <>
                                  <div>
                                    {link.projects_worked} project
                                    {link.projects_worked === 1 ? "" : "s"}
                                  </div>
                                  <div className="truncate max-w-[160px] text-xs">
                                    {link.last_project_name ?? "—"}
                                    {link.last_project_at
                                      ? ` · ${format(new Date(link.last_project_at), "yyyy")}`
                                      : ""}
                                  </div>
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <RatingStars value={link?.rating ?? null} />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {a.tags.length === 0 && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                                {a.tags.map((t) => {
                                  const label = catById.get(t.category_id)?.name ?? "Unknown";
                                  const chip = (
                                    <Badge
                                      variant={
                                        t.source === "verified"
                                          ? "default"
                                          : t.source === "ai"
                                          ? "outline"
                                          : "secondary"
                                      }
                                      className="text-[11px]"
                                    >
                                      {t.source === "verified" && (
                                        <BadgeCheck className="mr-1 h-3 w-3" />
                                      )}
                                      {label}
                                      {t.years_experience != null && ` · ${t.years_experience}y`}
                                    </Badge>
                                  );
                                  return t.source === "ai" ? (
                                    <Tooltip key={t.id}>
                                      <TooltipTrigger asChild>
                                        <span>{chip}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t.confidence != null
                                          ? `${Math.round(t.confidence * 100)}% confidence`
                                          : "AI suggested"}
                                        {t.evidence ? ` — ${t.evidence}` : ""}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span key={t.id}>{chip}</span>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {a.last_application_at ? (
                                <>
                                  <div className="truncate max-w-[180px]">
                                    {a.last_application_title ?? "—"}
                                  </div>
                                  <div>{format(new Date(a.last_application_at), "MMM d, yyyy")}</div>
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{a.status}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {filtered.length} applicant{filtered.length === 1 ? "" : "s"}{" "}
                    <StarredCountChip count={countStarred(filtered, (a) => a)} />
                    {checked.size > 0 && ` · ${checked.size} selected`}
                    {checked.size > 0 && checked.size < filtered.length && (
                      <button
                        className="ml-2 text-primary underline"
                        onClick={() => setChecked(new Set(filtered.map((f) => f.id)))}
                      >
                        Select all {filtered.length} matching
                      </button>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky bulk bar */}
      {checked.size > 0 && (
        <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-lg">
          <span className="text-sm font-medium">{checked.size} selected</span>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Send className="mr-2 h-4 w-4" /> Invite to posting
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTextOpen(true)}>
            <MessageSquare className="mr-2 h-4 w-4" /> Text selected
          </Button>
          <div className="flex items-center gap-1">
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Add category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!bulkCategory}
              onClick={async () => {
                for (const id of checked) {
                  await addTag.mutateAsync({ applicant_id: id, category_id: bulkCategory });
                }
                setBulkCategory("");
              }}
            >
              <Tag className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsv(checkedApplicants, "workforce-selected")}
          >
            <Download className="mr-2 h-4 w-4" /> Export selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <WorkforceApplicantDrawer
        applicant={
          drawerApplicant ? pool.find((p) => p.id === drawerApplicant.id) ?? drawerApplicant : null
        }
        categories={categories}
        open={!!drawerApplicant}
        onOpenChange={(o) => !o && setDrawerApplicant(null)}
      />

      <WorkforceInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        applicants={checkedApplicants}
        defaultPostingId={postingParam}
      />
      <TextSelectedDialog
        open={textOpen}
        onOpenChange={setTextOpen}
        applicants={checkedApplicants}
      />

      <PhotoLightbox
        photos={lightbox ? [lightbox] : []}
        open={!!lightbox}
        onOpenChange={(o) => !o && setLightbox(null)}
      />
    </NetSuitePageLayout>
  );
}
