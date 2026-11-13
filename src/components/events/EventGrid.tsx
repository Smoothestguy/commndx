import { useMemo, isValidElement, type ReactNode } from 'react';
import { useSessionState } from '@/hooks/useSessionState';
import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';

const plainText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return '';
};

type Row = { id: string; cells: ReactNode[]; sort?: string[] };

/** Event Manager grid: shared data grid (search, column menus, footer, export) with phone cards. */
export function EventGrid({ headers, rows, mobile = false, empty = 'No records yet.', gridId, selectable = true, bulkActions, exportName }: {
  headers: string[]; rows: Row[]; empty?: string; mobile?: boolean; gridId?: string; selectable?: boolean;
  bulkActions?: (selected: Row[], clear: () => void) => ReactNode; exportName?: string;
}) {
  const tableId = `event:${gridId ?? headers.join('|')}:${window.location.pathname}`;
  const [ids, setIds] = useSessionState<string[]>(`${tableId}:selected`, []);
  const selected = new Set(ids);
  const setSelected = (next: Set<string>) => setIds([...next]);
  const columns = useMemo<EnhancedColumn<Row>[]>(() => headers.map((h, i) => ({
    key: `c${i}`,
    header: h,
    render: (r) => r.cells[i],
    noExport: /^actions?$/i.test(h),
    sortable: !/^actions?$/i.test(h),
    filterable: !/^actions?$/i.test(h),
    getValue: (r) => r.sort?.[i] ?? plainText(r.cells[i]),
  })), [headers]);

  return <>
    <div className={mobile ? 'hidden md:block' : ''}>
      <EnhancedDataTable
        fillViewport
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
    {mobile && <div className="md:hidden divide-y divide-border border-y border-border">{rows.map(r => <div key={r.id} className="py-3 space-y-2 text-sm"><div className="flex flex-col items-start gap-3"><div className="min-w-0"><p className="font-semibold break-words">{r.cells[0]}</p><p className="text-muted-foreground break-words">{r.cells[1]}</p></div><div className="min-w-0 max-w-full flex flex-wrap gap-2">{r.cells[r.cells.length - 1]}</div></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{r.cells.slice(2, -1).map((c, i) => <span key={i} className="flex flex-wrap gap-1 items-center min-w-0 break-words"><span className="text-muted-foreground">{headers[i + 2]}:</span>{c}</span>)}</div></div>)}{!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}</div>}
  </>;
}
