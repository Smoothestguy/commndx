import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  compact?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  onRowClick,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  sortKey,
  sortDirection,
  onSort,
  compact = true,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && data.every(item => selectedIds.has(String(item.id)));
  const someSelected = data.some(item => selectedIds.has(String(item.id))) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const newSet = new Set(selectedIds);
      data.forEach(item => newSet.add(String(item.id)));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      data.forEach(item => newSet.delete(String(item.id)));
      onSelectionChange(newSet);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    onSelectionChange(newSet);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-x-auto">
      <Table className={cn(compact && "text-xs")}>
        <TableHeader>
          <TableRow className="bg-table-header hover:bg-table-header border-b border-table-border">
            {selectable && (
              <TableHead className={cn(
                "w-10 text-table-header-foreground font-semibold",
                compact ? "py-2 px-3 h-9" : "py-3 px-4"
              )}>
                <IndeterminateCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className="border-table-header-foreground/50"
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const isSorted = sortKey === String(column.key);
              const SortIcon = isSorted
                ? sortDirection === 'asc' ? ArrowUp : ArrowDown
                : ArrowUpDown;
              
              return (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    "text-table-header-foreground font-semibold whitespace-nowrap",
                    compact ? "py-2 px-3 h-9" : "py-3 px-4",
                    column.sortable && onSort && "cursor-pointer select-none hover:bg-white/5 transition-colors",
                    column.className
                  )}
                  onClick={() => column.sortable && onSort?.(String(column.key))}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && onSort && (
                      <SortIcon className={cn(
                        "h-3.5 w-3.5",
                        isSorted ? "text-primary" : "text-table-header-foreground/50"
                      )} />
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => {
            const isSelected = selectedIds.has(String(item.id));
            return (
              <TableRow
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "border-b border-table-border transition-colors duration-100",
                  index % 2 === 1 && "bg-table-stripe",
                  onRowClick && "cursor-pointer hover:bg-muted/50",
                  isSelected && "bg-primary/5"
                )}
              >
                {selectable && (
                  <TableCell className={cn(
                    "w-10",
                    compact ? "py-1.5 px-3" : "py-2 px-4"
                  )}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(String(item.id), !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Select row"
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key)}
                    className={cn(
                      "text-foreground",
                      compact ? "py-1.5 px-3" : "py-2 px-4",
                      column.className
                    )}
                  >
                    {column.render
                      ? column.render(item)
                      : String(item[column.key as keyof T] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
