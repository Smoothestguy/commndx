import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown, Clock, DollarSign, Lock, Plus, Folder } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";

interface TimeEntry {
  id: string;
  project_id: string;
  personnel_id?: string | null;
  entry_date: string;
  hours: number;
  billable: boolean;
  is_locked?: boolean;
}

interface RowData {
  rowKey: string;
  projectId: string;
  projectName: string;
  personnelId?: string;
  personnelName?: string;
  personnelPhotoUrl?: string | null;
  personnelRate?: number | null;
  isPersonnelEntry: boolean;
}

interface WeeklyProjectSectionProps {
  projectId: string;
  projectName: string;
  rows: RowData[];
  weekDays: Date[];
  entries: TimeEntry[];
  entryMap: Map<string, TimeEntry>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isWeekClosed: boolean;
  selectedRows: Set<string>;
  onToggleRowSelection: (rowKey: string) => void;
  onSelectProjectRows: (rowKeys: string[], selected: boolean) => void;
  onCellClick: (row: RowData, day: Date) => void;
  onEditRate: (row: RowData) => void;
  getRowTotal: (rowKey: string) => number;
  getRowRegularHours: (rowKey: string, personnelId: string | null) => number;
  getRowOvertimeHours: (rowKey: string, personnelId: string | null) => number;
  getRowRegularPay: (rowKey: string, personnelId: string | null, rate: number | null) => number | null;
  getRowOvertimePay: (rowKey: string, personnelId: string | null, rate: number | null) => number | null;
  getRowPay: (rowKey: string, personnelId: string | null, rate: number | null) => number | null;
  overtimeMultiplier: number;
  weeklyOvertimeThreshold: number;
  formatCurrency: (amount: number) => string;
  hasPersonnelRows: boolean;
}

export function WeeklyProjectSection({
  projectId,
  projectName,
  rows,
  weekDays,
  entries,
  entryMap,
  isExpanded,
  onToggleExpand,
  isWeekClosed,
  selectedRows,
  onToggleRowSelection,
  onSelectProjectRows,
  onCellClick,
  onEditRate,
  getRowTotal,
  getRowRegularHours,
  getRowOvertimeHours,
  getRowRegularPay,
  getRowOvertimePay,
  getRowPay,
  overtimeMultiplier,
  formatCurrency,
  hasPersonnelRows,
}: WeeklyProjectSectionProps) {
  // Calculate project totals
  const projectTotals = useMemo(() => {
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let totalPay = 0;
    let regularPay = 0;
    let overtimePay = 0;

    rows.forEach((row) => {
      const rowTotal = getRowTotal(row.rowKey);
      const rowRegular = getRowRegularHours(row.rowKey, row.personnelId ?? null);
      const rowOvertime = getRowOvertimeHours(row.rowKey, row.personnelId ?? null);
      const rowRegPay = getRowRegularPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
      const rowOtPay = getRowOvertimePay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
      const rowTotalPay = getRowPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);

      totalHours += rowTotal;
      regularHours += rowRegular;
      overtimeHours += rowOvertime;
      if (rowRegPay !== null) regularPay += rowRegPay;
      if (rowOtPay !== null) overtimePay += rowOtPay;
      if (rowTotalPay !== null) totalPay += rowTotalPay;
    });

    return { totalHours, regularHours, overtimeHours, totalPay, regularPay, overtimePay };
  }, [rows, getRowTotal, getRowRegularHours, getRowOvertimeHours, getRowRegularPay, getRowOvertimePay, getRowPay]);

  const allRowsSelected = rows.every((r) => selectedRows.has(r.rowKey));
  const someRowsSelected = rows.some((r) => selectedRows.has(r.rowKey));

  const handleSelectAllProject = (checked: boolean) => {
    const personnelRowKeys = rows
      .filter((r) => r.isPersonnelEntry && r.personnelId)
      .map((r) => r.rowKey);
    onSelectProjectRows(personnelRowKeys, checked);
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        {/* Project Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <Folder className="h-5 w-5 text-primary" />
              <span className="font-semibold">{projectName}</span>
              <Badge variant="secondary" className="ml-2">
                {rows.length} {rows.length === 1 ? "person" : "people"}
              </Badge>
              {isWeekClosed && (
                <Badge variant="outline" className="ml-1">
                  <Lock className="h-3 w-3 mr-1" />
                  Closed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-6">
              {/* Hours Summary */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{projectTotals.regularHours.toFixed(1)}h</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-amber-600 font-medium">{projectTotals.overtimeHours.toFixed(1)}h OT</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold text-primary">{projectTotals.totalHours.toFixed(1)}h</span>
              </div>
              {/* Pay Summary */}
              {projectTotals.totalPay > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">{formatCurrency(projectTotals.totalPay)}</span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  {hasPersonnelRows && (
                    <th className="p-3 text-center font-medium w-12">
                      <Checkbox
                        checked={allRowsSelected && rows.length > 0}
                        onCheckedChange={(checked) => handleSelectAllProject(!!checked)}
                        className={someRowsSelected && !allRowsSelected ? "opacity-50" : ""}
                      />
                    </th>
                  )}
                  <th className="p-3 text-left font-medium min-w-[200px]">Personnel</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="p-3 text-center font-medium min-w-[90px]">
                      <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                      <div className="text-sm">{format(day, "MMM d")}</div>
                    </th>
                  ))}
                  <th className="p-3 text-center font-medium min-w-[180px]">Hours (Reg + OT)</th>
                  <th className="p-3 text-center font-medium min-w-[200px]">Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const regularHrs = getRowRegularHours(row.rowKey, row.personnelId ?? null);
                  const overtimeHrs = getRowOvertimeHours(row.rowKey, row.personnelId ?? null);
                  const totalHrs = getRowTotal(row.rowKey);
                  const regularPay = getRowRegularPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
                  const overtimePay = getRowOvertimePay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
                  const totalPay = getRowPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
                  const isSelected = selectedRows.has(row.rowKey);
                  const canSelect = row.isPersonnelEntry && row.personnelId;

                  return (
                    <tr
                      key={row.rowKey}
                      className={`border-b hover:bg-muted/30 ${isSelected ? "bg-destructive/5" : ""}`}
                    >
                      {hasPersonnelRows && (
                        <td className="p-3 text-center">
                          {canSelect ? (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onToggleRowSelection(row.rowKey)}
                            />
                          ) : null}
                        </td>
                      )}
                      <td className="p-3">
                        {row.personnelName ? (
                          <div className="flex items-center gap-2">
                            <PersonnelAvatar
                              photoUrl={row.personnelPhotoUrl}
                              firstName={row.personnelName?.split(" ")[0] || ""}
                              lastName={row.personnelName?.split(" ")[1] || ""}
                              size="xs"
                            />
                            <span className="font-medium">{row.personnelName}</span>
                            {row.personnelId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs ml-1"
                                onClick={() => onEditRate(row)}
                              >
                                <DollarSign className="h-3 w-3" />
                                {row.personnelRate !== null ? `${row.personnelRate}/hr` : "Set rate"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="font-medium text-muted-foreground">My Hours</span>
                        )}
                      </td>
                      {weekDays.map((day) => {
                        const dateString = format(day, "yyyy-MM-dd");
                        const key = `${row.rowKey}-${dateString}`;
                        const entry = entryMap.get(key);

                        return (
                          <td key={dateString} className="p-2 text-center">
                            <Button
                              variant={entry ? "secondary" : "ghost"}
                              size="sm"
                              className={`w-full h-10 relative ${
                                entry?.is_locked || isWeekClosed
                                  ? "opacity-60 cursor-not-allowed bg-muted/50"
                                  : ""
                              }`}
                              onClick={() => onCellClick(row, day)}
                              disabled={entry?.is_locked || isWeekClosed}
                            >
                              {entry ? (
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-sm">
                                      {Number(entry.hours).toFixed(1)}h
                                    </span>
                                    {(entry.is_locked || isWeekClosed) && (
                                      <Lock className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              ) : isWeekClosed ? (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <span>{regularHrs.toFixed(1)}h</span>
                          <span className="text-muted-foreground">+</span>
                          <span className="text-amber-600">{overtimeHrs.toFixed(1)}h</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="font-semibold">{totalHrs.toFixed(1)}h</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {totalPay !== null ? (
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <span>{formatCurrency(regularPay!)}</span>
                            <span className="text-muted-foreground">+</span>
                            <span className="text-amber-600">{formatCurrency(overtimePay!)}</span>
                            <span className="text-muted-foreground">=</span>
                            <span className="font-semibold">{formatCurrency(totalPay)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
