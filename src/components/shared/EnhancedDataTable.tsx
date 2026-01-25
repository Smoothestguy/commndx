import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown, GripVertical } from "lucide-react";
import { ColumnHeaderMenu, ColumnConfig } from "./ColumnHeaderMenu";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useUIDensity } from "@/contexts/UIDensityContext";

export interface EnhancedColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  getValue?: (item: T) => string | number | null;
  /** Hide column at specific breakpoints: 'sm' | 'md' | 'lg' | 'xl' */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

interface EnhancedDataTableProps<T> {
  tableId: string;
  data: T[];
  columns: EnhancedColumn<T>[];
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  compact?: boolean;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

interface SortableHeaderProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ id, children, className }: SortableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        isDragging && "opacity-50 bg-muted",
        "group relative"
      )}
      {...attributes}
    >
      <div className="flex items-center gap-1">
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {children}
      </div>
    </TableHead>
  );
}

export function EnhancedDataTable<T extends { id: string | number }>({
  tableId,
  data,
  columns,
  onRowClick,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  compact = true,
  defaultSortKey,
  defaultSortDirection = 'desc',
}: EnhancedDataTableProps<T>) {
  const { isSpreadsheetMode, is2K1Mode, isCompactMode } = useUIDensity();
  const defaultColumnKeys = columns.map(col => String(col.key));
  
  const {
    preferences,
    setSort,
    toggleColumnVisibility,
    setColumnOrder,
    setColumnFilter,
  } = useTablePreferences({
    tableId,
    defaultColumns: defaultColumnKeys,
    defaultSortKey,
    defaultSortDirection,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = preferences.columnOrder.indexOf(String(active.id));
      const newIndex = preferences.columnOrder.indexOf(String(over.id));
      setColumnOrder(arrayMove(preferences.columnOrder, oldIndex, newIndex));
    }
  };

  // Filter and sort columns based on preferences
  const visibleColumns = useMemo(() => {
    return preferences.columnOrder
      .filter(key => preferences.visibleColumns.includes(key))
      .map(key => columns.find(col => String(col.key) === key))
      .filter((col): col is EnhancedColumn<T> => col !== undefined);
  }, [columns, preferences.columnOrder, preferences.visibleColumns]);

  // Column configs for the menu
  const columnConfigs: ColumnConfig[] = useMemo(() => {
    return columns.map(col => ({
      key: String(col.key),
      header: col.header,
      sortable: col.sortable,
      filterable: col.filterable,
    }));
  }, [columns]);

  // Apply column filters and sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply column filters
    Object.entries(preferences.columnFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const column = columns.find(col => String(col.key) === key);
        result = result.filter(item => {
          const value = column?.getValue 
            ? column.getValue(item) 
            : item[key as keyof T];
          return String(value ?? '').toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (preferences.sortKey) {
      const column = columns.find(col => String(col.key) === preferences.sortKey);
      result.sort((a, b) => {
        const aValue = column?.getValue ? column.getValue(a) : a[preferences.sortKey as keyof T];
        const bValue = column?.getValue ? column.getValue(b) : b[preferences.sortKey as keyof T];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
        return preferences.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, preferences.columnFilters, preferences.sortKey, preferences.sortDirection, columns]);

  const allSelected = processedData.length > 0 && processedData.every(item => selectedIds.has(String(item.id)));
  const someSelected = processedData.some(item => selectedIds.has(String(item.id))) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const newSet = new Set(selectedIds);
      processedData.forEach(item => newSet.add(String(item.id)));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      processedData.forEach(item => newSet.delete(String(item.id)));
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

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSort(key);
    // Force the direction if explicitly requested
    if (preferences.sortKey === key && preferences.sortDirection !== direction) {
      setSort(key); // Toggle again to get correct direction
    }
  };

  // Helper to get responsive visibility classes
  const getResponsiveClass = (hideBelow?: 'sm' | 'md' | 'lg' | 'xl') => {
    if (!hideBelow) return '';
    const breakpointMap = {
      'sm': 'hidden sm:table-cell',
      'md': 'hidden md:table-cell',
      'lg': 'hidden lg:table-cell',
      'xl': 'hidden xl:table-cell',
    };
    return breakpointMap[hideBelow];
  };

  // Density mode styling
  // Spreadsheet: Ultra compact (24px rows, 11px text)
  // 2K1: Condensed (~30% tighter than normal, 28px rows, 12px text)
  // Normal: Standard padding
  const isUltraCompact = isSpreadsheetMode;
  const isCondensed = is2K1Mode;
  
  // Get text size class based on density
  const getTextClass = () => {
    if (isUltraCompact) return "text-[11px]";
    if (isCondensed) return "text-xs";
    return compact ? "text-xs" : "text-sm";
  };
  
  return (
    <div className={cn(
      "overflow-hidden",
      isUltraCompact 
        ? "border border-border" 
        : isCondensed
        ? "bg-card rounded border border-border shadow-sm"
        : "bg-card rounded-lg border border-border shadow-sm"
    )}>
      <div className="overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Table className={getTextClass()}>
          <TableHeader>
            <TableRow className={cn(
              "border-b border-table-border",
              isUltraCompact 
                ? "bg-muted/50 hover:bg-muted/50" 
                : "bg-table-header hover:bg-table-header"
            )}>
              {selectable && (
                <TableHead className={cn(
                  "w-8 text-table-header-foreground font-semibold",
                  isUltraCompact ? "py-0.5 px-1.5 h-6" : 
                  isCondensed ? "py-1 px-2 h-7" :
                  compact ? "py-2 px-3 h-9" : "py-3 px-4"
                )}>
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className={cn(
                      "border-table-header-foreground/50", 
                      isUltraCompact && "h-3.5 w-3.5",
                      isCondensed && "h-3.5 w-3.5"
                    )}
                  />
                </TableHead>
              )}
              <SortableContext
                items={visibleColumns.map(col => String(col.key))}
                strategy={horizontalListSortingStrategy}
              >
                {visibleColumns.map((column) => {
                  const key = String(column.key);
                  const isSorted = preferences.sortKey === key;
                  const SortIcon = isSorted
                    ? preferences.sortDirection === 'asc' ? ArrowUp : ArrowDown
                    : ArrowUpDown;

                  return (
                    <SortableHeader
                      key={key}
                      id={key}
                      className={cn(
                        "text-table-header-foreground font-semibold whitespace-nowrap",
                        isUltraCompact ? "py-0.5 px-1.5 h-6" : 
                        isCondensed ? "py-1 px-1.5 md:px-2 h-7" :
                        compact ? "py-2 px-2 md:px-3 h-9" : "py-3 px-4",
                        column.className,
                        getResponsiveClass(column.hideBelow)
                      )}
                    >
                      <div 
                        className={cn(
                          "flex items-center gap-0.5 flex-1",
                          column.sortable !== false && "cursor-pointer select-none"
                        )}
                        onClick={() => column.sortable !== false && setSort(key)}
                      >
                        <span>{column.header}</span>
                        {column.sortable !== false && (
                          <SortIcon className={cn(
                            isUltraCompact || isCondensed ? "h-3 w-3" : "h-3.5 w-3.5",
                            isSorted ? "text-primary" : "text-table-header-foreground/50"
                          )} />
                        )}
                      </div>
                      <ColumnHeaderMenu
                        column={columnConfigs.find(c => c.key === key)!}
                        allColumns={columnConfigs}
                        visibleColumns={preferences.visibleColumns}
                        sortKey={preferences.sortKey}
                        sortDirection={preferences.sortDirection}
                        columnFilter={preferences.columnFilters[key] || ''}
                        onSort={handleSort}
                        onToggleColumn={toggleColumnVisibility}
                        onFilterChange={setColumnFilter}
                      />
                    </SortableHeader>
                  );
                })}
              </SortableContext>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.map((item, index) => {
              const isSelected = selectedIds.has(String(item.id));
              return (
                <TableRow
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "border-b border-table-border transition-colors duration-75",
                    index % 2 === 1 && "bg-table-stripe",
                    onRowClick && "cursor-pointer hover:bg-muted/50",
                    isSelected && "bg-primary/5",
                    isUltraCompact && "h-6",
                    isCondensed && "h-7"
                  )}
                >
                  {selectable && (
                    <TableCell className={cn(
                      "w-8",
                      isUltraCompact ? "py-0.5 px-1.5" : 
                      isCondensed ? "py-0.5 px-2" :
                      compact ? "py-1.5 px-3" : "py-2 px-4"
                    )}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(String(item.id), !!checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select row"
                        className={isUltraCompact || isCondensed ? "h-3.5 w-3.5" : undefined}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={cn(
                        "text-foreground min-w-0",
                        isUltraCompact ? "py-0.5 px-1.5" : 
                        isCondensed ? "py-1 px-1.5 md:px-2" :
                        compact ? "py-1.5 px-2 md:px-3" : "py-2 px-4",
                        column.className,
                        getResponsiveClass(column.hideBelow)
                      )}
                    >
                      <div className="truncate">
                        {column.render
                          ? column.render(item)
                          : String(item[column.key as keyof T] ?? "")}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {processedData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>
      </div>
    </div>
  );
}
