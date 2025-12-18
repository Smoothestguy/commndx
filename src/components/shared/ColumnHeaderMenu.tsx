import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  Columns3,
  Filter,
  MoreVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
}

interface ColumnHeaderMenuProps {
  column: ColumnConfig;
  allColumns: ColumnConfig[];
  visibleColumns: string[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  columnFilter: string;
  onSort: (key: string, direction: 'asc' | 'desc') => void;
  onToggleColumn: (key: string) => void;
  onFilterChange: (key: string, value: string) => void;
}

export function ColumnHeaderMenu({
  column,
  allColumns,
  visibleColumns,
  sortKey,
  sortDirection,
  columnFilter,
  onSort,
  onToggleColumn,
  onFilterChange,
}: ColumnHeaderMenuProps) {
  const isSorted = sortKey === column.key;
  const hasFilter = columnFilter.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
            (isSorted || hasFilter) && "opacity-100"
          )}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {column.sortable !== false && (
          <>
            <DropdownMenuItem
              onClick={() => onSort(column.key, 'asc')}
              className={cn(isSorted && sortDirection === 'asc' && "bg-accent")}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Sort Ascending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSort(column.key, 'desc')}
              className={cn(isSorted && sortDirection === 'desc' && "bg-accent")}
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Sort Descending
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Columns3 className="mr-2 h-4 w-4" />
            Columns
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {allColumns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleColumns.includes(col.key)}
                onCheckedChange={() => onToggleColumn(col.key)}
                disabled={visibleColumns.length === 1 && visibleColumns.includes(col.key)}
              >
                {col.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {column.filterable !== false && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Filter className="mr-2 h-4 w-4" />
              Filter
              {hasFilter && (
                <span className="ml-auto text-xs text-primary">Active</span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Filter ${column.header}...`}
                  value={columnFilter}
                  onChange={(e) => onFilterChange(column.key, e.target.value)}
                  className="h-8 text-sm"
                />
                {hasFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onFilterChange(column.key, '')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
