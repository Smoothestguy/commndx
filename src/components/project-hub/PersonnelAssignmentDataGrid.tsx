import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
  Columns,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import type {
  PersonnelProjectAssignment,
  PersonnelWithAssignment,
  RateBracketInfo,
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";

export type AssignmentWithDetails = PersonnelProjectAssignment & {
  personnel: PersonnelWithAssignment | null;
  project_rate_brackets: RateBracketInfo | null;
};

type SortKey = "personnelName" | "rateBracket" | "billRate" | "payRate" | "assignedAt";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface ColumnVisibility {
  personnel: boolean;
  email: boolean;
  rateBracket: boolean;
  billRate: boolean;
  payRate: boolean;
  assignedAt: boolean;
  status: boolean;
}

interface Filters {
  search: string;
  rateBracket: string;
  billRateMin: number | null;
  billRateMax: number | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  status: string;
}

interface PersonnelAssignmentDataGridProps {
  data: AssignmentWithDetails[];
  rateBrackets: RateBracketInfo[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRemove: (id: string, firstName: string, lastName: string) => void;
  showPayRate?: boolean;
}

export function PersonnelAssignmentDataGrid({
  data,
  rateBrackets,
  selectedIds,
  onSelectionChange,
  onRemove,
  showPayRate = false,
}: PersonnelAssignmentDataGridProps) {
  const navigate = useNavigate();
  
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    rateBracket: "all",
    billRateMin: null,
    billRateMax: null,
    dateFrom: null,
    dateTo: null,
    status: "all",
  });
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    personnel: true,
    email: true,
    rateBracket: true,
    billRate: true,
    payRate: showPayRate,
    assignedAt: true,
    status: true,
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((assignment) => {
      const personnel = assignment.personnel;
      const rateBracket = assignment.project_rate_brackets;
      const billRate = assignment.bill_rate ?? rateBracket?.bill_rate;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = `${personnel?.first_name} ${personnel?.last_name}`
          .toLowerCase()
          .includes(searchLower);
        const emailMatch = personnel?.email?.toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch) return false;
      }

      // Rate bracket filter
      if (filters.rateBracket !== "all") {
        if (rateBracket?.id !== filters.rateBracket) return false;
      }

      // Bill rate range filter
      if (filters.billRateMin != null) {
        if (billRate == null || billRate < filters.billRateMin) return false;
      }
      if (filters.billRateMax != null) {
        if (billRate == null || billRate > filters.billRateMax) return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const assignedDate = assignment.assigned_at
          ? new Date(assignment.assigned_at)
          : null;
        if (!assignedDate || assignedDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const assignedDate = assignment.assigned_at
          ? new Date(assignment.assigned_at)
          : null;
        if (!assignedDate || assignedDate > filters.dateTo) return false;
      }

      // Status filter
      if (filters.status !== "all") {
        if (assignment.status !== filters.status) return false;
      }

      return true;
    });
  }, [data, filters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const { key, direction } = sortConfig;
      let comparison = 0;

      switch (key) {
        case "personnelName":
          const nameA = `${a.personnel?.first_name} ${a.personnel?.last_name}`;
          const nameB = `${b.personnel?.first_name} ${b.personnel?.last_name}`;
          comparison = nameA.localeCompare(nameB);
          break;
        case "rateBracket":
          const bracketA = a.project_rate_brackets?.name || "";
          const bracketB = b.project_rate_brackets?.name || "";
          comparison = bracketA.localeCompare(bracketB);
          break;
        case "billRate":
          const rateA = a.bill_rate ?? a.project_rate_brackets?.bill_rate ?? 0;
          const rateB = b.bill_rate ?? b.project_rate_brackets?.bill_rate ?? 0;
          comparison = rateA - rateB;
          break;
        case "payRate":
          const payA = a.personnel?.pay_rate ?? a.personnel?.hourly_rate ?? 0;
          const payB = b.personnel?.pay_rate ?? b.personnel?.hourly_rate ?? 0;
          comparison = payA - payB;
          break;
        case "assignedAt":
          const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
          const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === sortedData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedData.map((a) => a.id));
    }
  }, [selectedIds.length, sortedData, onSelectionChange]);

  const handleSelectAllFiltered = useCallback(() => {
    onSelectionChange(sortedData.map((a) => a.id));
  }, [sortedData, onSelectionChange]);

  const handleToggleSelection = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((x) => x !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const clearFilters = () => {
    setFilters({
      search: "",
      rateBracket: "all",
      billRateMin: null,
      billRateMax: null,
      dateFrom: null,
      dateTo: null,
      status: "all",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.rateBracket !== "all" ||
    filters.billRateMin != null ||
    filters.billRateMax != null ||
    filters.dateFrom != null ||
    filters.dateTo != null ||
    filters.status !== "all";

  const isAllSelected = sortedData.length > 0 && selectedIds.length === sortedData.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < sortedData.length;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Global Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="pl-9"
          />
        </div>

        {/* Rate Bracket Filter */}
        <Select
          value={filters.rateBracket}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, rateBracket: value }))
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Rate Bracket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brackets</SelectItem>
            {rateBrackets.map((bracket) => (
              <SelectItem key={bracket.id} value={bracket.id}>
                {bracket.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bill Rate Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Bill Rate
              {(filters.billRateMin != null || filters.billRateMax != null) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  ✓
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <p className="text-sm font-medium">Bill Rate Range</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Min</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.billRateMin ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        billRateMin: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Max</label>
                  <Input
                    type="number"
                    placeholder="999"
                    value={filters.billRateMax ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        billRateMax: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Assigned Date
              {(filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  ✓
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Calendar
                  mode="single"
                  selected={filters.dateFrom || undefined}
                  onSelect={(date) =>
                    setFilters((prev) => ({ ...prev, dateFrom: date || null }))
                  }
                  className="rounded-md border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Calendar
                  mode="single"
                  selected={filters.dateTo || undefined}
                  onSelect={(date) =>
                    setFilters((prev) => ({ ...prev, dateTo: date || null }))
                  }
                  className="rounded-md border"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, status: value }))
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        {/* Columns Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Columns className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={columnVisibility.personnel}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, personnel: checked }))
              }
            >
              Personnel
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.email}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, email: checked }))
              }
            >
              Email
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.rateBracket}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, rateBracket: checked }))
              }
            >
              Rate Bracket
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.billRate}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, billRate: checked }))
              }
            >
              Bill Rate
            </DropdownMenuCheckboxItem>
            {showPayRate && (
              <DropdownMenuCheckboxItem
                checked={columnVisibility.payRate}
                onCheckedChange={(checked) =>
                  setColumnVisibility((prev) => ({ ...prev, payRate: checked }))
                }
              >
                Pay Rate
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              checked={columnVisibility.assignedAt}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, assignedAt: checked }))
              }
            >
              Assigned Date
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.status}
              onCheckedChange={(checked) =>
                setColumnVisibility((prev) => ({ ...prev, status: checked }))
              }
            >
              Status
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selection Info */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-primary" />
          <span>
            {selectedIds.length} of {sortedData.length} selected
          </span>
          {selectedIds.length < sortedData.length && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={handleSelectAllFiltered}
            >
              Select all {sortedData.length} matching
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <IndeterminateCheckbox
                  checked={isAllSelected}
                  indeterminate={isSomeSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              {columnVisibility.personnel && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("personnelName")}
                >
                  <div className="flex items-center">
                    Personnel
                    {getSortIcon("personnelName")}
                  </div>
                </TableHead>
              )}
              {columnVisibility.rateBracket && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("rateBracket")}
                >
                  <div className="flex items-center">
                    Rate Bracket
                    {getSortIcon("rateBracket")}
                  </div>
                </TableHead>
              )}
              {columnVisibility.billRate && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("billRate")}
                >
                  <div className="flex items-center">
                    Bill Rate
                    {getSortIcon("billRate")}
                  </div>
                </TableHead>
              )}
              {columnVisibility.payRate && showPayRate && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("payRate")}
                >
                  <div className="flex items-center">
                    Pay Rate
                    {getSortIcon("payRate")}
                  </div>
                </TableHead>
              )}
              {columnVisibility.assignedAt && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("assignedAt")}
                >
                  <div className="flex items-center">
                    Assigned
                    {getSortIcon("assignedAt")}
                  </div>
                </TableHead>
              )}
              {columnVisibility.status && <TableHead>Status</TableHead>}
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Object.values(columnVisibility).filter(Boolean).length + 2}
                  className="text-center py-8 text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "No personnel match the current filters"
                    : "No personnel assigned"}
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((assignment) => {
                const personnel = assignment.personnel!;
                const rateBracket = assignment.project_rate_brackets;
                const billRate = assignment.bill_rate ?? rateBracket?.bill_rate;
                const isSelected = selectedIds.includes(assignment.id);

                return (
                  <TableRow
                    key={assignment.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => navigate(`/personnel/${assignment.personnel_id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelection(assignment.id)}
                        aria-label={`Select ${personnel.first_name} ${personnel.last_name}`}
                      />
                    </TableCell>
                    {columnVisibility.personnel && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SecureAvatar
                            bucket="personnel-photos"
                            photoUrl={null}
                            className="h-8 w-8"
                            fallback={
                              <span className="text-xs">
                                {personnel.first_name?.[0]}
                                {personnel.last_name?.[0]}
                              </span>
                            }
                            alt={`${personnel.first_name} ${personnel.last_name}`}
                          />
                          <div>
                            <p className="font-medium">
                              {personnel.first_name} {personnel.last_name}
                            </p>
                            {columnVisibility.email && (
                              <p className="text-sm text-muted-foreground">
                                {personnel.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {columnVisibility.rateBracket && (
                      <TableCell>
                        {rateBracket?.name ? (
                          <Badge variant="secondary">{rateBracket.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.billRate && (
                      <TableCell>
                        {billRate != null
                          ? `${formatCurrency(billRate)}/hr`
                          : "—"}
                      </TableCell>
                    )}
                    {columnVisibility.payRate && showPayRate && (
                      <TableCell>
                        {personnel.pay_rate ?? personnel.hourly_rate != null
                          ? `${formatCurrency(personnel.pay_rate ?? personnel.hourly_rate)}/hr`
                          : "—"}
                      </TableCell>
                    )}
                    {columnVisibility.assignedAt && (
                      <TableCell>
                        {assignment.assigned_at
                          ? format(new Date(assignment.assigned_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    )}
                    {columnVisibility.status && (
                      <TableCell>
                        <Badge
                          variant={
                            assignment.status === "active" ? "default" : "secondary"
                          }
                        >
                          {assignment.status}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            onRemove(
                              assignment.id,
                              personnel.first_name,
                              personnel.last_name
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedData.length} of {data.length} personnel
      </div>
    </div>
  );
}

export { type ColumnVisibility, type Filters };
