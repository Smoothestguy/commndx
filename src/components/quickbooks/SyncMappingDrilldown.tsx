import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface SyncMappingDrilldownProps {
  entityType: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EntityRecord = {
  id: string;
  label: string;
  detail?: string;
  detail2?: string;
  synced: boolean;
  qbId?: string | null;
  syncStatus?: string | null;
  lastSyncedAt?: string | null;
};

async function fetchEntityRecords(entityType: string): Promise<EntityRecord[]> {
  switch (entityType) {
    case "Vendors": {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company, quickbooks_vendor_mappings(quickbooks_vendor_id, sync_status, last_synced_at)")
        .is("merged_into_id", null)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((v: any) => {
        const m = v.quickbooks_vendor_mappings?.[0];
        return {
          id: v.id,
          label: v.name,
          detail: v.company,
          synced: !!m,
          qbId: m?.quickbooks_vendor_id,
          syncStatus: m?.sync_status,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Customers": {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company, email, quickbooks_customer_mappings(quickbooks_customer_id, sync_status, last_synced_at)")
        .is("merged_into_id", null)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((c: any) => {
        const m = c.quickbooks_customer_mappings?.[0];
        return {
          id: c.id,
          label: c.name,
          detail: c.company,
          detail2: c.email,
          synced: !!m,
          qbId: m?.quickbooks_customer_id,
          syncStatus: m?.sync_status,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Invoices": {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, customer_name, total, status, quickbooks_invoice_mappings(quickbooks_invoice_id, sync_status, last_synced_at)")
        .order("number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((i: any) => {
        const m = i.quickbooks_invoice_mappings?.[0];
        return {
          id: i.id,
          label: i.number || "No #",
          detail: i.customer_name,
          detail2: formatCurrency(i.total),
          synced: !!m,
          qbId: m?.quickbooks_invoice_id,
          syncStatus: m?.sync_status ?? i.status,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Estimates": {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, number, customer_name, total, quickbooks_estimate_mappings(quickbooks_estimate_id, sync_status, last_synced_at)")
        .order("number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((e: any) => {
        const m = e.quickbooks_estimate_mappings?.[0];
        return {
          id: e.id,
          label: e.number || "No #",
          detail: e.customer_name,
          detail2: formatCurrency(e.total),
          synced: !!m,
          qbId: m?.quickbooks_estimate_id,
          syncStatus: m?.sync_status,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Vendor Bills": {
      const { data, error } = await supabase
        .from("vendor_bills")
        .select("id, number, vendor_name, total, status, quickbooks_bill_mappings(quickbooks_bill_id, sync_status, last_synced_at)")
        .order("number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((b: any) => {
        const m = b.quickbooks_bill_mappings?.[0];
        return {
          id: b.id,
          label: b.number || "No #",
          detail: b.vendor_name,
          detail2: formatCurrency(b.total),
          synced: !!m,
          qbId: m?.quickbooks_bill_id,
          syncStatus: m?.sync_status ?? b.status,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Expense Categories": {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, type, quickbooks_account_mappings(quickbooks_account_id, quickbooks_account_name, last_synced_at)")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((ec: any) => {
        const m = ec.quickbooks_account_mappings?.[0];
        return {
          id: ec.id,
          label: ec.name,
          detail: ec.type,
          detail2: m?.quickbooks_account_name,
          synced: !!m,
          qbId: m?.quickbooks_account_id,
          lastSyncedAt: m?.last_synced_at,
        };
      });
    }
    case "Products (Umbrellas)": {
      const { data, error } = await supabase
        .from("qb_product_service_mappings")
        .select("id, name, quickbooks_item_id, quickbooks_item_type")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        label: p.name,
        detail: p.quickbooks_item_type,
        synced: !!p.quickbooks_item_id,
        qbId: p.quickbooks_item_id,
      }));
    }
    default:
      return [];
  }
}

function getColumns(entityType: string) {
  switch (entityType) {
    case "Vendors":
      return { col1: "Name", col2: "Company" };
    case "Customers":
      return { col1: "Name", col2: "Company", col3: "Email" };
    case "Invoices":
      return { col1: "Number", col2: "Customer", col3: "Total" };
    case "Estimates":
      return { col1: "Number", col2: "Customer", col3: "Total" };
    case "Vendor Bills":
      return { col1: "Number", col2: "Vendor", col3: "Total" };
    case "Expense Categories":
      return { col1: "Name", col2: "Type", col3: "QB Account" };
    case "Products (Umbrellas)":
      return { col1: "Name", col2: "Item Type" };
    default:
      return { col1: "Name", col2: "Detail" };
  }
}

export function SyncMappingDrilldown({ entityType, open, onOpenChange }: SyncMappingDrilldownProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"synced" | "not_synced">("not_synced");

  const { data: records, isLoading } = useQuery({
    queryKey: ["sync-drilldown", entityType],
    queryFn: () => fetchEntityRecords(entityType!),
    enabled: !!entityType && open,
  });

  const filtered = useMemo(() => {
    if (!records) return [];
    const q = search.toLowerCase();
    const byTab = records.filter((r) => (tab === "synced" ? r.synced : !r.synced));
    if (!q) return byTab;
    return byTab.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.detail?.toLowerCase().includes(q) ||
        r.detail2?.toLowerCase().includes(q) ||
        r.qbId?.toLowerCase().includes(q)
    );
  }, [records, search, tab]);

  const syncedCount = records?.filter((r) => r.synced).length ?? 0;
  const notSyncedCount = records?.filter((r) => !r.synced).length ?? 0;
  const cols = entityType ? getColumns(entityType) : { col1: "Name", col2: "Detail" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>{entityType} — Sync Details</SheetTitle>
          <SheetDescription>
            Inspect which {entityType?.toLowerCase()} records are synced or missing from QuickBooks
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0 mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="not_synced" className="flex-1">
              Not Synced ({notSyncedCount})
            </TabsTrigger>
            <TabsTrigger value="synced" className="flex-1">
              Synced ({syncedCount})
            </TabsTrigger>
          </TabsList>

          <div className="mt-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={`Search ${entityType?.toLowerCase()}...`}
            />
          </div>

          <TabsContent value={tab} className="flex-1 min-h-0 mt-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading records...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {search ? "No matching records found" : `No ${tab === "synced" ? "synced" : "unsynced"} records`}
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{cols.col1}</TableHead>
                      <TableHead>{cols.col2}</TableHead>
                      {"col3" in cols && <TableHead>{(cols as any).col3}</TableHead>}
                      {tab === "synced" && <TableHead>QB ID</TableHead>}
                      {tab === "synced" && <TableHead>Status</TableHead>}
                      {tab === "synced" && <TableHead>Last Synced</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium max-w-[160px] truncate">{r.label}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{r.detail ?? "—"}</TableCell>
                        {"col3" in cols && (
                          <TableCell className="max-w-[120px] truncate">{r.detail2 ?? "—"}</TableCell>
                        )}
                        {tab === "synced" && (
                          <>
                            <TableCell className="font-mono text-[10px]">{r.qbId ?? "—"}</TableCell>
                            <TableCell>
                              {r.syncStatus && (
                                <Badge variant="outline" className="text-[10px]">
                                  {r.syncStatus}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.lastSyncedAt
                                ? format(new Date(r.lastSyncedAt), "MMM d, h:mm a")
                                : "—"}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
