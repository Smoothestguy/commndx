import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface JournalEntryLine {
  lineId: string;
  description: string | null;
  accountId: string;
  accountName: string;
  amount: number;
  postingType: 'Debit' | 'Credit';
  entityType?: string;
  entityName?: string;
}

interface JournalEntry {
  id: string;
  quickbooks_id: string;
  doc_number: string | null;
  txn_date: string;
  private_note: string | null;
  total_amount: number;
  is_adjustment: boolean;
  currency_code: string;
  line_items: JournalEntryLine[];
  fetched_at: string;
  created_at: string;
}

// Hook to fetch journal entries from database
const useQuickBooksJournalEntries = (dateRange?: DateRange, adjustmentsOnly?: boolean) => {
  return useQuery({
    queryKey: ["quickbooks-journal-entries", dateRange, adjustmentsOnly],
    queryFn: async () => {
      let query = supabase
        .from("quickbooks_journal_entries")
        .select("*")
        .order("txn_date", { ascending: false });

      if (dateRange?.from) {
        query = query.gte("txn_date", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        query = query.lte("txn_date", format(dateRange.to, "yyyy-MM-dd"));
      }
      if (adjustmentsOnly) {
        query = query.eq("is_adjustment", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((entry) => ({
        ...entry,
        line_items: (entry.line_items || []) as unknown as JournalEntryLine[],
      })) as JournalEntry[];
    },
  });
};

// Hook to fetch journal entries from QuickBooks
const useFetchJournalEntriesFromQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate?: string; endDate?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "quickbooks-fetch-journal-entries",
        {
          body: { startDate, endDate },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-journal-entries"] });
      toast.success(
        `Fetched ${data.fetched} new entries, updated ${data.updated}`
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to fetch journal entries: ${error.message}`);
    },
  });
};

// Export to CSV
const exportToCSV = (entries: JournalEntry[]) => {
  if (entries.length === 0) {
    toast.error("No entries to export");
    return;
  }

  const headers = [
    "Date",
    "Number",
    "Memo",
    "Total",
    "Is Adjustment",
    "Account",
    "Debit",
    "Credit",
    "Description",
  ];

  const rows: string[][] = [];

  entries.forEach((entry) => {
    const lineItems = entry.line_items as JournalEntryLine[];
    lineItems.forEach((line, index) => {
      rows.push([
        index === 0 ? entry.txn_date : "",
        index === 0 ? entry.doc_number || "" : "",
        index === 0 ? entry.private_note || "" : "",
        index === 0 ? entry.total_amount.toFixed(2) : "",
        index === 0 ? (entry.is_adjustment ? "Yes" : "No") : "",
        line.accountName,
        line.postingType === "Debit" ? line.amount.toFixed(2) : "",
        line.postingType === "Credit" ? line.amount.toFixed(2) : "",
        line.description || "",
      ]);
    });
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `journal-entries-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
  toast.success("Exported to CSV");
};

// Single entry row component
const JournalEntryRow = ({ entry }: { entry: JournalEntry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const lineItems = entry.line_items as JournalEntryLine[];

  const totalDebits = lineItems
    .filter((l) => l.postingType === "Debit")
    .reduce((sum, l) => sum + l.amount, 0);
  const totalCredits = lineItems
    .filter((l) => l.postingType === "Credit")
    .reduce((sum, l) => sum + l.amount, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="cursor-pointer hover:bg-muted/50">
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-medium">
          {format(new Date(entry.txn_date), "MMM d, yyyy")}
        </TableCell>
        <TableCell>{entry.doc_number || "-"}</TableCell>
        <TableCell className="max-w-[200px] truncate">
          {entry.private_note || "-"}
        </TableCell>
        <TableCell className="text-right font-mono">
          ${entry.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3 w-3" />
              <span className="font-mono text-xs">
                ${totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-1 text-destructive">
              <ArrowDownRight className="h-3 w-3" />
              <span className="font-mono text-xs">
                ${totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {entry.is_adjustment && (
            <Badge variant="secondary" className="text-xs">
              Adjustment
            </Badge>
          )}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={7} className="p-0">
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((line) => (
                    <TableRow key={line.lineId}>
                      <TableCell className="font-medium">
                        {line.accountName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.entityName
                          ? `${line.entityType}: ${line.entityName}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {line.postingType === "Debit"
                          ? `$${line.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {line.postingType === "Credit"
                          ? `$${line.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const JournalEntriesViewer = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 90),
    to: new Date(),
  });
  const [adjustmentsOnly, setAdjustmentsOnly] = useState(false);

  const { data: entries, isLoading } = useQuickBooksJournalEntries(
    dateRange,
    adjustmentsOnly
  );
  const fetchMutation = useFetchJournalEntriesFromQB();

  const handleFetch = () => {
    fetchMutation.mutate({
      startDate: dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : undefined,
      endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Journal Entries
              <Badge variant="outline" className="ml-2">
                Read-Only
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              View journal entries from QuickBooks for reconciliation and audit
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(entries || [])}
              disabled={!entries?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handleFetch}
              disabled={fetchMutation.isPending}
            >
              {fetchMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Fetch from QB
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <div className="flex items-center space-x-2">
            <Checkbox
              id="adjustments-only"
              checked={adjustmentsOnly}
              onCheckedChange={(checked) =>
                setAdjustmentsOnly(checked === true)
              }
            />
            <Label htmlFor="adjustments-only" className="text-sm">
              Adjusting entries only
            </Label>
          </div>
        </div>

        {/* Summary Stats */}
        {entries && entries.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{entries.length} entries</span>
            <span>•</span>
            <span>
              Total: $
              {entries
                .reduce((sum, e) => sum + e.total_amount, 0)
                .toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <span>•</span>
            <span>
              {entries.filter((e) => e.is_adjustment).length} adjustments
            </span>
          </div>
        )}

        {/* Table */}
        <ScrollArea className="h-[500px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Debits/Credits</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : entries && entries.length > 0 ? (
                entries.map((entry) => (
                  <JournalEntryRow key={entry.id} entry={entry} />
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No journal entries found. Click "Fetch from QB" to import.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default JournalEntriesViewer;
