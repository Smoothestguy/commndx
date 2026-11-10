import { useMemo, useState, type ReactNode } from 'react';
import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';

type Row = { id: string; cells: ReactNode[]; sort?: string[] };

/** Event Manager grid: shared data grid (search, column menus, footer, export) with phone cards. */
export function EventGrid({ headers, rows, mobile = false, empty = 'No records yet.', gridId, selectable = true, bulkActions, exportName }: {
  headers: string[]; rows: Row[]; empty?: string; mobile?: boolean; gridId?: string; selectable?: boolean;
  bulkActions?: (selected: Row[], clear: () => void) => ReactNode; exportName?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columns = useMemo<EnhancedColumn<Row>[]>(() => headers.map((h, i) => ({
    key: `c${i}`,
    header: h,
    render: (r) => r.cells[i],
    getValue: (r) => r.sort?.[i] ?? (typeof r.cells[i] === 'string' || typeof r.cells[i] === 'number' ? String(r.cells[i]) : null),
  })), [headers]);
  const tableId = `event:${gridId ?? headers.join('|')}`;
  return <>
    <div className={mobile ? 'hidden md:block' : ''}>
      <EnhancedDataTable
        tableId={tableId}
        data={rows}
        columns={columns}
        emptyText={empty}
        selectable={selectable}
        selectedIds={selected}
        onSelectionChange={setSelected}
        bulkActions={bulkActions}
        exportName={exportName ?? 'event-manager'}
        defaultSortKey=""
      />
    </div>
    {mobile && <div className="md:hidden divide-y divide-border border-y border-border">{rows.map(r => <div key={r.id} className="py-3 space-y-2 text-sm"><div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="font-semibold break-words">{r.cells[0]}</p><p className="text-muted-foreground break-words">{r.cells[1]}</p></div><div className="shrink-0">{r.cells[r.cells.length - 1]}</div></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{r.cells.slice(2, -1).map((c, i) => <span key={i} className="flex gap-1 items-center"><span className="text-muted-foreground">{headers[i + 2]}:</span>{c}</span>)}</div></div>)}{!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}</div>}
  </>;
}
