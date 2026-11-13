import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
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
import { Checkbox } from "@/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowUp, ArrowDown, ArrowUpDown, GripVertical, Search, Filter, Rows3, Rows4, Maximize2, Minimize2,
  Settings2, Download, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { ColumnHeaderMenu, ColumnConfig } from "./ColumnHeaderMenu";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useSessionState } from "@/hooks/useSessionState";
import { useViewportGrid } from "@/hooks/useViewportGrid";
import { gridColumnWidths } from "@/lib/gridSizing";
import { useIsMobile } from '@/hooks/use-mobile';

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
  /** Exclude from XLSX/CSV export (e.g. action columns). */
  noExport?: boolean;
  /** Freeze this column instead of the first visible column. */
  frozen?: boolean;
  /** Initial width in px; columns are resizable from the header edge. */
  width?: number;
}

interface EnhancedDataTableProps<T> {
  tableId: string;
  data: T[];
  columns: EnhancedColumn<T>[];
  onRowClick?: (item: T) => void;
  rowHref?: (item: T) => string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  compact?: boolean;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  /** Rows returning true stay above others regardless of column sort (stable). */
  pinFirst?: (item: T) => boolean;
  /** Instant search box top-left (default true). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Extra controls rendered next to the search box. */
  toolbar?: React.ReactNode;
  /** Bulk actions bar content shown while rows are selected. */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  /** Return a reason to show a warning dot (e.g. missing phone/signature). */
  attention?: (item: T) => string | null | undefined;
  /** File name stem for XLSX/CSV export (enables footer export). */
  exportName?: string;
  /** Rows per page (default 50). Use 0 to disable paging. */
  defaultPageSize?: number;
  /** Max height of the scroll area (sticky header). */
  maxHeight?: string;
  fillViewport?: boolean;
  emptyText?: string;
}

/** Colored status pill used across grids (ACTIVE green etc.). */
export function StatusPill({ value }: { value: string | null | undefined }) {
  const v = String(value ?? "").toLowerCase();
  const tone =
    /^(active|approved|open|in[_ ]camp|signed|ok|completed|paid|assigned|available)$/.test(v) ? "bg-success/15 text-success border-success/30"
    : /^(pending|draft|requested|in[_ ]progress|partial|on[_ ]hold|late)$/.test(v) ? "bg-warning/15 text-warning border-warning/30"
    : /^(inactive|closed|terminated|denied|rejected|void|demobilized|do[_ ]not[_ ]hire|checked[_ ]out|expired)$/.test(v) ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";
  if (!v) return null;
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap", tone)}>{String(value).replace(/_/g, " ")}</span>;
}

function SortableHeader({ id, children, className, width, onResize, left }: { left?: number; id: string; children: React.ReactNode; className?: string; width?: number; onResize: (w: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const ref = useRef<HTMLTableCellElement | null>(null);
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = ref.current?.offsetWidth ?? 120;
    const move = (ev: PointerEvent) => onResize(Math.max(48, startW + ev.clientX - startX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <th
      ref={(n) => { setNodeRef(n); ref.current = n; }}
      style={{ transform: CSS.Transform.toString(transform), transition, width, minWidth: width, maxWidth: width, left }}
      className={cn("group relative text-left align-middle", className, isDragging && "opacity-50")}
      {...attributes}
    >
      <div className="flex items-center gap-1 pr-1">
        <div {...listeners} className="cursor-grab active:cursor-grabbing -ml-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Drag column">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        {children}
      </div>
      <span onPointerDown={startResize} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" role="separator" aria-label={`Resize ${id}`} />
    </th>
  );
}

const cellText = <T,>(item: T, column: EnhancedColumn<T>) => {
  const v = column.getValue ? column.getValue(item) : (item as Record<string, unknown>)[String(column.key)];
  return v == null ? "" : typeof v === "object" ? "" : String(v);
};

export function EnhancedDataTable<T extends { id: string | number }>({
  tableId,
  data,
  columns,
  onRowClick,
  rowHref,
  selectable = true,
  selectedIds: controlledIds,
  onSelectionChange: controlledSelection,
  defaultSortKey,
  defaultSortDirection = 'desc',
  pinFirst,
  searchable = true,
  searchPlaceholder = "Search…",
  toolbar,
  bulkActions,
  attention,
  exportName,
  defaultPageSize = 50,
  maxHeight = "70vh",
  fillViewport = false,
  emptyText = "No results found",
}: EnhancedDataTableProps<T>) {
  const mobile = useIsMobile();
  const defaultColumnKeys = columns.map(col => String(col.key));
  const { preferences, setSort, toggleColumnVisibility, setColumnOrder, setColumnFilter } = useTablePreferences({
    tableId, defaultColumns: defaultColumnKeys, defaultSortKey, defaultSortDirection,
  });

  // Per-screen grid state preserved for the session (workspace tabs).
  const scope = `grid:${tableId}:${typeof window !== "undefined" ? window.location.pathname : ""}`;
  const [search, setSearch] = useSessionState(`${scope}:q`, "");
  const [page, setPage] = useSessionState(`${scope}:page`, 0);
  const [pageSize, setPageSize] = useSessionState(`${scope}:size`, defaultPageSize);
  const [dense, setDense] = useSessionState(`grid:${tableId}:dense`, true);
  const [widths, setWidths] = useSessionState<Record<string, number>>(`grid:${tableId}:widths`, {});
  const [selection, setSelection] = useSessionState<string[]>(`${scope}:selection`, []);
  const selectedIds = controlledIds ?? new Set(selection);
  const onSelectionChange = controlledSelection ?? ((ids: Set<string>) => setSelection([...ids]));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailableWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try { const pos = JSON.parse(sessionStorage.getItem(`${scope}:scroll`) ?? "[0,0]"); el.scrollTop = pos[0]; el.scrollLeft = pos[1]; } catch { /* unavailable storage */ }
  }, [scope, data.length]);
  const [fullscreen, setFullscreen] = useState(false);
  const viewportRef = useViewportGrid(fillViewport);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = preferences.columnOrder.indexOf(String(active.id));
      const newIndex = preferences.columnOrder.indexOf(String(over.id));
      setColumnOrder(arrayMove(preferences.columnOrder, oldIndex, newIndex));
    }
  };

  const visibleColumns = useMemo(() => {
    const ordered = preferences.columnOrder
      .filter(key => preferences.visibleColumns.includes(key))
      .map(key => columns.find(col => String(col.key) === key))
      .filter((col): col is EnhancedColumn<T> => col !== undefined);
    // Columns added after preferences were saved still show.
    const missing = columns.filter(c => !preferences.columnOrder.includes(String(c.key)));
    const all = [...ordered, ...missing];
    return [...all.filter(c => c.frozen), ...all.filter(c => !c.frozen)];
  }, [columns, preferences.columnOrder, preferences.visibleColumns]);

  const columnConfigs: ColumnConfig[] = useMemo(() => columns.map(col => ({
    key: String(col.key), header: col.header, sortable: col.sortable, filterable: col.filterable,
  })), [columns]);

  const processedData = useMemo(() => {
    let result = [...data];
    const q = search.trim().toLowerCase();
    if (q) {
      const terms = q.split(/\s+/);
      result = result.filter(item => {
        const hay = columns.map(c => cellText(item, c)).join(" ").toLowerCase();
        return terms.every(t => hay.includes(t));
      });
    }
    Object.entries(preferences.columnFilters).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      const column = columns.find(col => String(col.key) === key);
      if (!column) return;
      result = result.filter(item => cellText(item, column).toLowerCase().includes(filterValue.toLowerCase()));
    });
    if (preferences.sortKey) {
      const column = columns.find(col => String(col.key) === preferences.sortKey);
      result.sort((a, b) => {
        if (pinFirst) {
          const pa = pinFirst(a), pb = pinFirst(b);
          if (pa !== pb) return pa ? -1 : 1;
        }
        const aValue = column?.getValue ? column.getValue(a) : (a as Record<string, unknown>)[preferences.sortKey as string];
        const bValue = column?.getValue ? column.getValue(b) : (b as Record<string, unknown>)[preferences.sortKey as string];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        const comparison = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
        return preferences.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [data, search, preferences.columnFilters, preferences.sortKey, preferences.sortDirection, columns, pinFirst]);

  const total = processedData.length;
  const effectiveSize = pageSize > 0 ? pageSize : Math.max(total, 1);
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize));
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => { if (safePage !== page) setPage(safePage); }, [safePage, page, setPage]);
  const pageRows = pageSize > 0 ? processedData.slice(safePage * effectiveSize, (safePage + 1) * effectiveSize) : processedData;

  const selectedRows = useMemo(() => data.filter(i => selectedIds.has(String(i.id))), [data, selectedIds]);
  const allSelected = processedData.length > 0 && processedData.every(item => selectedIds.has(String(item.id)));
  const someSelected = processedData.some(item => selectedIds.has(String(item.id))) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    processedData.forEach(item => checked ? next.add(String(item.id)) : next.delete(String(item.id)));
    onSelectionChange(next);
  };
  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id); else next.delete(id);
    onSelectionChange(next);
  };
  const clearSelection = () => onSelectionChange?.(new Set());

  const handleSort = (key: string, direction: 'asc' | 'desc') => setSort(key, direction);

  const exportRows = (format: "xlsx" | "csv", selected = false) => {
    const rows = selected ? selectedRows : processedData;
    const cols = visibleColumns.filter(c => !c.noExport && c.header);
    const sheet = XLSX.utils.json_to_sheet(rows.map(r => Object.fromEntries(cols.map(c => [c.header, cellText(r, c)]))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Data");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${exportName ?? tableId}-${stamp}.${format}`, { bookType: format });
  };

  const getResponsiveClass = (hideBelow?: 'sm' | 'md' | 'lg' | 'xl') =>
    hideBelow ? { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }[hideBelow] : '';

  const cellPad = dense ? "py-1 px-2 h-7" : "py-2 px-3 h-10";
  const hasLead = selectable || !!attention;
  const leadWidth = (selectable ? 32 : 0) + (attention ? 16 : 0);
  const columnWidths = gridColumnWidths(visibleColumns.map(c => ({ ...c, key: String(c.key) })), widths, availableWidth, leadWidth);
  const activeFilters = Object.values(preferences.columnFilters).filter(Boolean).length;
  const from = total === 0 ? 0 : safePage * effectiveSize + 1;
  const to = Math.min(total, (safePage + 1) * effectiveSize);

  return (
    <div ref={viewportRef} data-viewport-grid={fillViewport} data-fullscreen={fullscreen} className={cn(
      "flex flex-col bg-card border border-border rounded-md shadow-sm overflow-hidden",
      mobile && "[&_button]:min-h-11 [&_input]:min-h-11",
      fillViewport && "viewport-grid",
      fullscreen && "fixed inset-0 z-50 rounded-none"
    )}>
      {/* Top bar: instant search + toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-border bg-card">
          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={searchPlaceholder} aria-label="Search grid" className="h-8 pl-7 pr-7 text-xs" />
              {search && <Button variant="ghost" size="icon" type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></Button>}
            </div>
          )}
          {toolbar}
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => Object.keys(preferences.columnFilters).forEach(k => setColumnFilter(k, ""))}>
              Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border bg-primary/5 text-xs" role="region" aria-label="Bulk actions">
          <span className="font-semibold">{selectedRows.length} selected</span>
          {bulkActions?.(selectedRows, clearSelection)}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportRows("xlsx", true)}><Download className="h-3 w-3 mr-1" />Export selected</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {mobile ? <div aria-label="Phone card list" className="divide-y min-w-0">
        {pageRows.map(item => <article key={String(item.id)} className="p-3 space-y-3 min-w-0">
          <div className="flex gap-3 items-start">{selectable && <Checkbox className="mt-1 h-5 w-5" aria-label="Select row" checked={selectedIds.has(String(item.id))} onCheckedChange={v=>handleSelectOne(String(item.id),!!v)}/>}<div className="min-w-0 flex-1">{visibleColumns.slice(0,1).map(c=><div key={String(c.key)} className="font-semibold break-words">{rowHref?<Link to={rowHref(item)}>{c.render?c.render(item):cellText(item,c)}</Link>:onRowClick?<Button variant="ghost" className="p-0 min-h-11 h-auto text-left whitespace-normal justify-start" onClick={()=>onRowClick(item)}>{c.render?c.render(item):cellText(item,c)}</Button>:c.render?c.render(item):cellText(item,c)}</div>)}{attention?.(item)&&<p className="text-xs text-warning">{attention(item)}</p>}</div></div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 min-w-0">{visibleColumns.slice(1,5).filter(c=>!c.noExport).map(c=><div key={String(c.key)} className="min-w-0"><dt className="text-xs text-muted-foreground">{c.header}</dt><dd className="text-sm break-words [&_*]:max-w-full">{c.render?c.render(item):cellText(item,c)||'—'}</dd></div>)}</dl>
          {visibleColumns.length>5&&<details><summary className="min-h-11 flex items-center text-sm text-primary cursor-pointer">More details</summary><dl className="space-y-2">{visibleColumns.slice(5).filter(c=>!c.noExport).map(c=><div key={String(c.key)} className="min-w-0"><dt className="text-xs text-muted-foreground">{c.header}</dt><dd className="text-sm break-words [&_*]:max-w-full">{c.render?c.render(item):cellText(item,c)||'—'}</dd></div>)}</dl></details>}
          <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:min-w-11">{visibleColumns.filter(c=>c.noExport).map(c=><div className="min-w-0 max-w-full" key={String(c.key)}>{c.render?.(item)}</div>)}</div>
        </article>)}
        {!pageRows.length&&<p className="p-6 text-sm text-muted-foreground">{emptyText}</p>}
      </div> : <div data-grid-scroll ref={scrollRef} onScroll={e => { try { sessionStorage.setItem(`${scope}:scroll`, JSON.stringify([e.currentTarget.scrollTop, e.currentTarget.scrollLeft])); } catch { /* unavailable storage */ } }} className={cn("overflow-auto min-h-0", fullscreen && "flex-1")} style={fullscreen ? undefined : { maxHeight }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table style={{ width: Math.max(availableWidth, leadWidth + columnWidths.reduce((n, w) => n + w, 0)) }} className={cn("table-fixed caption-bottom border-separate border-spacing-0", dense ? "text-xs" : "text-sm")}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-table-header">
                {hasLead && (
                  <th className={cn("sticky left-0 z-30 bg-table-header border-b border-table-border text-left", cellPad)} style={{ width: leadWidth, minWidth: leadWidth }}>
                    <div className="flex items-center gap-1">
                      {selectable && <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onCheckedChange={handleSelectAll} aria-label="Select all" className="h-3.5 w-3.5" />}
                    </div>
                  </th>
                )}
                <SortableContext items={visibleColumns.map(col => String(col.key))} strategy={horizontalListSortingStrategy}>
                  {visibleColumns.map((column, ci) => {
                    const key = String(column.key);
                    const isSorted = preferences.sortKey === key;
                    const SortIcon = isSorted ? (preferences.sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                    const filterVal = preferences.columnFilters[key] || "";
                    return (
                      <SortableHeader
                        key={key}
                        id={key}
                        width={columnWidths[ci]}
                        left={ci === 0 ? leadWidth : undefined}
                        onResize={(w) => setWidths(prev => ({ ...prev, [key]: w }))}
                        className={cn(
                          "bg-table-header text-table-header-foreground font-semibold whitespace-nowrap border-b border-table-border",
                          cellPad, column.className, getResponsiveClass(column.hideBelow),
                          ci === 0 && "sticky z-30 border-r border-table-border"
                        )}
                      >
                        <div className="flex flex-col flex-1 min-w-0" style={undefined}>
                          <div className={cn("flex items-center gap-0.5", column.sortable !== false && "cursor-pointer select-none")} onClick={() => column.sortable !== false && setSort(key)}>
                            <span className="truncate">{column.header}</span>
                            {column.sortable !== false && <SortIcon className={cn("h-3 w-3 shrink-0", isSorted ? "text-primary" : "text-table-header-foreground/40")} />}
                            {filterVal && <Filter className="h-3 w-3 text-primary shrink-0" />}
                          </div>
                          {showFilters && column.filterable !== false && (
                            <Input value={filterVal} onChange={e => { setColumnFilter(key, e.target.value); setPage(0); }} onClick={e => e.stopPropagation()} placeholder="Filter" aria-label={`Filter ${column.header}`} className="h-6 mt-1 px-1.5 text-[11px] font-normal" />
                          )}
                        </div>
                        <ColumnHeaderMenu
                          column={{ key, header: column.header, sortable: column.sortable, filterable: column.filterable }}
                          allColumns={columnConfigs}
                          visibleColumns={preferences.visibleColumns}
                          sortKey={preferences.sortKey}
                          sortDirection={preferences.sortDirection}
                          columnFilter={filterVal}
                          onSort={handleSort}
                          onToggleColumn={toggleColumnVisibility}
                          onFilterChange={setColumnFilter}
                        />
                      </SortableHeader>
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item, index) => {
                const id = String(item.id);
                const isSelected = selectedIds.has(id);
                const warn = attention?.(item);
                const rowBg = isSelected ? "bg-secondary" : index % 2 === 1 ? "bg-table-stripe" : "bg-card";
                return (
                  <tr
                    key={id}
                    onClick={rowHref ? undefined : e => { if (e.target instanceof Element && e.target.closest('a,button,input,[role="button"],[role="switch"],[role="checkbox"]')) return; if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) onRowClick?.(item); }}
                    className={cn("group/row", rowBg, (onRowClick || rowHref) && "cursor-pointer")}
                  >
                    {hasLead && (
                      <td className={cn("sticky left-0 z-10 border-b border-table-border group-hover/row:bg-muted", rowBg, cellPad)}>
                        <div className="flex items-center gap-1">
                          {selectable && <Checkbox checked={isSelected} onCheckedChange={(c) => handleSelectOne(id, !!c)} onClick={(e) => e.stopPropagation()} aria-label="Select row" className="h-3.5 w-3.5" />}
                          {attention && (warn ? <span className="h-2 w-2 rounded-full bg-warning shrink-0" title={warn} aria-label={warn} /> : <span className="h-2 w-2 shrink-0" />)}
                        </div>
                      </td>
                    )}
                    {visibleColumns.map((column, ci) => {
                      const w = columnWidths[ci];
                      return (
                        <td
                          key={String(column.key)}
                          style={{ width: w, minWidth: w, maxWidth: w, ...(ci === 0 ? { left: hasLead ? leadWidth : 0 } : {}) }}
                          className={cn(
                            "text-foreground border-b border-table-border group-hover/row:bg-muted align-middle",
                            cellPad, column.className, getResponsiveClass(column.hideBelow),
                            ci === 0 && cn("sticky z-10 font-medium border-r", rowBg)
                          )}
                        >
                          <div className="truncate" title={cellText(item, column) || undefined}>
                            {rowHref && ci === 0
                              ? <Link to={rowHref(item)} className="hover:text-primary hover:underline">{column.render ? column.render(item) : cellText(item, column)}</Link>
                              : column.render ? column.render(item) : cellText(item, column)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={visibleColumns.length + (hasLead ? 1 : 0)} className="h-24 text-center text-muted-foreground">{emptyText}</td></tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>}

      {/* Footer bar */}
      <div data-grid-footer className="shrink-0 flex flex-wrap items-center gap-1 px-2 py-1 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium text-foreground mr-2">{total.toLocaleString()} row{total === 1 ? "" : "s"}</span>
        {searchable && <Button variant="ghost" size="icon" className="h-7 w-7" title="Quick search" aria-label="Quick search" onClick={() => searchRef.current?.focus()}><Search className="h-3.5 w-3.5" /></Button>}
        <Button variant={showFilters ? "secondary" : "ghost"} size="icon" className="h-7 w-7" title="Column filters" aria-label="Column filters" onClick={() => setShowFilters(v => !v)}><Filter className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={dense ? "Comfortable rows" : "Dense rows"} aria-label="Toggle density" onClick={() => setDense(!dense)}>{dense ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}</Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={fullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label="Toggle fullscreen" onClick={() => setFullscreen(v => !v)}>{fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Columns" aria-label="Column settings"><Settings2 className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
            <DropdownMenuLabel className="text-xs">Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.filter(c => c.header).map(c => (
              <DropdownMenuCheckboxItem key={String(c.key)} checked={preferences.visibleColumns.includes(String(c.key))} disabled={visibleColumns.length === 1 && preferences.visibleColumns.includes(String(c.key))} onCheckedChange={() => toggleColumnVisibility(String(c.key))} onSelect={e => e.preventDefault()} className="text-xs">{c.header}</DropdownMenuCheckboxItem>
            ))}
            {Object.keys(widths).length > 0 && (<><DropdownMenuSeparator /><DropdownMenuItem className="text-xs" onSelect={() => setWidths({})}>Reset widths</DropdownMenuItem></>)}
          </DropdownMenuContent>
        </DropdownMenu>
        {(
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Export" aria-label="Export"><Download className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs">{`Export ${total} filtered rows`}</DropdownMenuLabel>
              <DropdownMenuItem className="text-xs" onSelect={() => exportRows("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onSelect={() => exportRows("csv")}>CSV (.csv)</DropdownMenuItem>
              {selectedRows.length > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => exportRows("xlsx", true)}>Selected Excel (.xlsx)</DropdownMenuItem><DropdownMenuItem onSelect={() => exportRows("csv", true)}>Selected CSV (.csv)</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="flex-1" />
        {defaultPageSize > 0 && (
          <>
            <span className="hidden sm:inline">Rows</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-[72px] text-xs" aria-label="Page size"><SelectValue /></SelectTrigger>
              <SelectContent>{[25, 50, 100, 250, 500].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}</SelectContent>
            </Select>
            <span className="tabular-nums px-1" aria-live="polite">{from}–{to} of {total.toLocaleString()}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
    </div>
  );
}
