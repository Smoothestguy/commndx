import { useEffect, useMemo, useState } from "react";
import { NetSuitePageLayout } from "@/components/layout/netsuite";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Sparkles, Download, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  useCapabilityCategories,
  useWorkforcePool,
  useClassifyApplicants,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";
import { WorkforceApplicantDrawer } from "@/components/workforce/WorkforceApplicantDrawer";

const PAGE_SIZE = 50;
const UNCLASSIFIED = "__unclassified__";

type SortKey = "name" | "recent" | "confidence";

export default function Workforce() {
  const { data: categories = [], isLoading: catLoading } = useCapabilityCategories();
  const { data: pool = [], isLoading: poolLoading, refetch } = useWorkforcePool();
  const classify = useClassifyApplicants();

  const [selected, setSelected] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [drawerApplicant, setDrawerApplicant] = useState<WorkforceApplicant | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [startingRemaining, setStartingRemaining] = useState(0);

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

  // Poll while a chained classification run is in flight
  useEffect(() => {
    if (!classifying) return;
    const t = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(t);
  }, [classifying, refetch]);

  useEffect(() => {
    if (classifying && unclassifiedCount === 0) {
      setClassifying(false);
      toast.success("Classification complete");
    }
  }, [classifying, unclassifiedCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = pool;

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
    } else {
      const best = (a: WorkforceApplicant) =>
        Math.max(0, ...a.tags.map((t) => t.confidence ?? 1));
      sorted.sort((a, b) => best(b) - best(a));
    }
    return sorted;
  }, [pool, selected, matchAll, search, sort]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const toggleCategory = (id: string) => {
    setPage(1);
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const exportCsv = () => {
    const header = ["Name", "Phone", "Email", "City", "State", "Status", "Categories", "Last Application"];
    const lines = filtered.map((a) => [
      `${a.first_name} ${a.last_name}`,
      a.phone ?? "",
      a.email ?? "",
      a.city ?? "",
      a.state ?? "",
      a.status,
      a.tags.map((t) => catById.get(t.category_id)?.name ?? "").filter(Boolean).join(" | "),
      a.last_application_at ? format(new Date(a.last_application_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [header, ...lines]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workforce-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      description="Browse the applicant pool by capability category"
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
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            <span className="ml-2">Export CSV</span>
          </Button>
        </>
      }
    >
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
            <ScrollArea className="h-[60vh] pr-2">
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
                  No applicants match this selection. Categories are AI-suggested from application
                  answers and can be corrected on any applicant.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Categories</TableHead>
                        <TableHead>Last application</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((a) => (
                        <TableRow
                          key={a.id}
                          className="cursor-pointer"
                          onClick={() => setDrawerApplicant(a)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={a.photo_url ?? undefined} />
                                <AvatarFallback>
                                  {a.first_name?.[0]}
                                  {a.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {a.first_name} {a.last_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div>{a.phone ?? "—"}</div>
                            <div className="truncate max-w-[180px]">{a.email}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[a.city, a.state].filter(Boolean).join(", ") || "—"}
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
                                    variant={t.source === "ai" ? "outline" : "default"}
                                    className="text-[11px]"
                                  >
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
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {filtered.length} applicant{filtered.length === 1 ? "" : "s"}
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

      <WorkforceApplicantDrawer
        applicant={
          drawerApplicant ? pool.find((p) => p.id === drawerApplicant.id) ?? drawerApplicant : null
        }
        categories={categories}
        open={!!drawerApplicant}
        onOpenChange={(o) => !o && setDrawerApplicant(null)}
      />
    </NetSuitePageLayout>
  );
}
