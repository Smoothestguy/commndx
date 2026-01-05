import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { 
  getAllPayPeriodsFromEntries, 
  calculatePayPeriodTotals,
  PayPeriod 
} from "@/lib/payPeriodUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  hourly_rate?: number | null;
  hours?: number | null;
  is_holiday?: boolean;
}

interface ProjectWeeklyPayHistoryProps {
  timeEntries: TimeEntry[];
  hourlyRate: number | null;
  overtimeMultiplier?: number;
  holidayMultiplier?: number;
}

export function ProjectWeeklyPayHistory({ 
  timeEntries, 
  hourlyRate, 
  overtimeMultiplier = 1.5,
  holidayMultiplier = 2.0
}: ProjectWeeklyPayHistoryProps) {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  // Get all pay periods from time entries
  const payPeriods = useMemo(() => {
    return getAllPayPeriodsFromEntries(timeEntries);
  }, [timeEntries]);

  // Default to most recent period expanded
  const selectedPeriod = useMemo(() => {
    if (!payPeriods.length) return null;
    if (!selectedPeriodKey) return payPeriods[0];
    return payPeriods.find(p => format(p.weekStart, "yyyy-MM-dd") === selectedPeriodKey) || payPeriods[0];
  }, [payPeriods, selectedPeriodKey]);

  // Calculate totals for selected period
  const periodTotals = useMemo(() => {
    if (!selectedPeriod) return null;
    return calculatePayPeriodTotals(timeEntries, selectedPeriod, hourlyRate || 0, overtimeMultiplier, 40, holidayMultiplier);
  }, [timeEntries, selectedPeriod, hourlyRate, overtimeMultiplier, holidayMultiplier]);

  const togglePeriodExpanded = (periodKey: string) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodKey)) {
      newExpanded.delete(periodKey);
    } else {
      newExpanded.add(periodKey);
    }
    setExpandedPeriods(newExpanded);
  };

  if (payPeriods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Pay Period History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No time entries logged for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Pay Period History
          </CardTitle>
          <Select 
            value={selectedPeriodKey || (payPeriods[0] ? format(payPeriods[0].weekStart, "yyyy-MM-dd") : "")}
            onValueChange={setSelectedPeriodKey}
          >
            <SelectTrigger className="w-full sm:w-[220px] h-9">
              <SelectValue placeholder="Select pay period" />
            </SelectTrigger>
            <SelectContent>
              {payPeriods.map((period) => (
                <SelectItem 
                  key={format(period.weekStart, "yyyy-MM-dd")} 
                  value={format(period.weekStart, "yyyy-MM-dd")}
                >
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedPeriod && periodTotals && (
          <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
            {/* Payment Date */}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">Payment Date:</span>
              <span className="font-medium text-primary">
                {format(selectedPeriod.paymentDate, "EEEE, MMM d, yyyy")}
              </span>
            </div>

            {/* Weekly Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center mb-4">
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.daysWorked}</div>
                <div className="text-xs text-muted-foreground">Days Worked</div>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.regularHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Regular Hours</div>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold text-amber-600">{periodTotals.overtimeHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">OT Hours</div>
              </div>
              {periodTotals.holidayHours > 0 && (
                <div className="p-2 bg-background rounded-lg">
                  <div className="text-lg font-bold text-purple-600">{periodTotals.holidayHours.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">HO Hours</div>
                </div>
              )}
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.totalHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Total Hours</div>
              </div>
            </div>

            {/* Pay Breakdown */}
            {hourlyRate !== null && hourlyRate > 0 && (
              <div className="flex flex-wrap items-center gap-2 justify-center text-sm bg-background p-3 rounded-lg mb-4">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(periodTotals.regularPay)}</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-amber-600">{formatCurrency(periodTotals.overtimePay)}</span>
                <span className="text-xs text-muted-foreground">(1.5x)</span>
                {periodTotals.holidayPay > 0 && (
                  <>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-purple-600">{formatCurrency(periodTotals.holidayPay)}</span>
                    <span className="text-xs text-muted-foreground">(2x)</span>
                  </>
                )}
                <span className="text-muted-foreground">=</span>
                <span className="font-bold text-primary text-lg">{formatCurrency(periodTotals.totalPay)}</span>
              </div>
            )}

            {/* Daily Breakdown */}
            <Collapsible 
              open={expandedPeriods.has(format(selectedPeriod.weekStart, "yyyy-MM-dd"))}
              onOpenChange={() => togglePeriodExpanded(format(selectedPeriod.weekStart, "yyyy-MM-dd"))}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-background/50 rounded-lg transition-colors">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Daily Breakdown
                </span>
                {expandedPeriods.has(format(selectedPeriod.weekStart, "yyyy-MM-dd")) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[80px]">Day</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead className="text-right">HO</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodTotals.dailyBreakdown.map((day) => {
                        // Note: daily pay is now calculated in the totals using snapshotted rates
                        // For display, we show the hours breakdown only (pay is in the period totals)
                        const hasHours = day.totalHours > 0;
                        return (
                          <TableRow 
                            key={format(day.date, "yyyy-MM-dd")}
                            className={hasHours ? "" : "opacity-50"}
                          >
                            <TableCell className="font-medium">{day.dayName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(day.date, "MMM d")}
                            </TableCell>
                            <TableCell className="text-right">
                              {hasHours ? `${day.regularHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-purple-600">
                              {day.holidayHours > 0 ? `${day.holidayHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {hasHours ? `${day.totalHours.toFixed(1)}h` : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Past Pay Periods Summary List */}
          {payPeriods.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Past Pay Periods</h4>
            {payPeriods.slice(1, 5).map((period) => {
              const totals = calculatePayPeriodTotals(timeEntries, period, hourlyRate || 0, overtimeMultiplier, 40, holidayMultiplier);
              return (
                <div 
                  key={format(period.weekStart, "yyyy-MM-dd")} 
                  className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setSelectedPeriodKey(format(period.weekStart, "yyyy-MM-dd"))}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{period.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {totals.daysWorked} day{totals.daysWorked !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{totals.totalHours.toFixed(1)}h total</span>
                    {hourlyRate !== null && hourlyRate > 0 && (
                      <span className="font-medium text-primary">{formatCurrency(totals.totalPay)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
