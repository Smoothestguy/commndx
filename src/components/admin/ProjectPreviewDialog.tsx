import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Calendar, MapPin, Clock, Building, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  getAllPayPeriodsFromEntries, 
  calculatePayPeriodTotals, 
  PayPeriod 
} from "@/lib/payPeriodUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Project {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  customer_name?: string;
  customer?: {
    name: string;
    company?: string;
  };
}

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
}

interface ProjectPreviewDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  assignedAt?: string;
  timeEntries?: TimeEntry[];
  hourlyRate?: number | null;
}

export function ProjectPreviewDialog({ 
  project, 
  open, 
  onClose, 
  assignedAt,
  timeEntries = [],
  hourlyRate = null
}: ProjectPreviewDialogProps) {
  const overtimeMultiplier = 1.5;
  
  // Get all pay periods from time entries
  const payPeriods = useMemo(() => {
    return getAllPayPeriodsFromEntries(timeEntries);
  }, [timeEntries]);
  
  // Default to the most recent pay period
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(true);
  
  // Get the selected pay period (default to first/most recent)
  const selectedPeriod = useMemo(() => {
    if (!payPeriods.length) return null;
    if (!selectedPeriodKey) return payPeriods[0];
    return payPeriods.find(p => format(p.weekStart, "yyyy-MM-dd") === selectedPeriodKey) || payPeriods[0];
  }, [payPeriods, selectedPeriodKey]);
  
  // Calculate totals for selected period
  const periodTotals = useMemo(() => {
    if (!selectedPeriod) return null;
    return calculatePayPeriodTotals(timeEntries, selectedPeriod, hourlyRate || 0, overtimeMultiplier);
  }, [timeEntries, selectedPeriod, hourlyRate]);

  // Calculate overall totals
  const totals = useMemo(() => {
    const regularHours = timeEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
    const overtimeHours = timeEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const rate = hourlyRate || 0;
    return {
      regularHours,
      overtimeHours,
      totalHours: regularHours + overtimeHours,
      regularPay: regularHours * rate,
      overtimePay: overtimeHours * rate * overtimeMultiplier,
      totalPay: (regularHours * rate) + (overtimeHours * rate * overtimeMultiplier),
    };
  }, [timeEntries, hourlyRate]);

  if (!project) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "in_progress":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "completed":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "on_hold":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  // Format full address
  const fullAddress = [
    project.address,
    project.city && project.state ? `${project.city}, ${project.state}` : project.city || project.state,
    project.zip
  ].filter(Boolean).join(' ') || project.location;

  const customerName = project.customer?.company || project.customer?.name || project.customer_name;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {project.name}
          </DialogTitle>
          <DialogDescription>
            Project assignment details and pay history
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Status & Basic Info */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(project.status)}>
                {project.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assignedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Assigned:</span>{" "}
                    <span className="font-medium">{format(parseISO(assignedAt), "MMM d, yyyy")}</span>
                  </div>
                </div>
              )}

              {customerName && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <span className="font-medium">{customerName}</span>
                  </div>
                </div>
              )}

              {fullAddress && (
                <div className="flex items-center gap-3 text-sm col-span-full">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Address:</span>{" "}
                    <span className="font-medium">{fullAddress}</span>
                  </div>
                </div>
              )}

              {(project.start_date || project.end_date) && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    <span className="font-medium">
                      {project.start_date && format(parseISO(project.start_date), "MMM d, yyyy")}
                      {project.start_date && project.end_date && " - "}
                      {project.end_date && format(parseISO(project.end_date), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pay Period Selector */}
            {payPeriods.length > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Pay Period History
                  </h4>
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

                {selectedPeriod && periodTotals && (
                  <>
                    {/* Payment Date */}
                    <div className="flex items-center justify-between mb-3 text-sm">
                      <span className="text-muted-foreground">Payment Date:</span>
                      <span className="font-medium text-primary">
                        {format(selectedPeriod.paymentDate, "EEEE, MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Weekly Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
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
                      <div className="p-2 bg-background rounded-lg">
                        <div className="text-lg font-bold">{periodTotals.totalHours.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Total Hours</div>
                      </div>
                    </div>

                    {/* Pay Breakdown */}
                    {hourlyRate && hourlyRate > 0 && (
                      <div className="flex items-center gap-2 justify-center text-sm bg-background p-3 rounded-lg mb-4">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{formatCurrency(periodTotals.regularPay)}</span>
                        <span className="text-muted-foreground">+</span>
                        <span className="text-amber-600">{formatCurrency(periodTotals.overtimePay)}</span>
                        <span className="text-xs text-muted-foreground">(1.5x)</span>
                        <span className="text-muted-foreground">=</span>
                        <span className="font-bold text-primary text-lg">{formatCurrency(periodTotals.totalPay)}</span>
                      </div>
                    )}

                    {/* Daily Breakdown Collapsible */}
                    <Collapsible open={showDailyBreakdown} onOpenChange={setShowDailyBreakdown}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-background/50 rounded-lg transition-colors">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Daily Breakdown
                        </span>
                        {showDailyBreakdown ? (
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
                                <TableHead className="text-right">Total</TableHead>
                                {hourlyRate && hourlyRate > 0 && (
                                  <TableHead className="text-right">Pay</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {periodTotals.dailyBreakdown.map((day) => {
                                const dayPay = hourlyRate 
                                  ? (day.regularHours * hourlyRate) + (day.overtimeHours * hourlyRate * overtimeMultiplier)
                                  : 0;
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
                                    <TableCell className="text-right font-medium">
                                      {hasHours ? `${day.totalHours.toFixed(1)}h` : "-"}
                                    </TableCell>
                                    {hourlyRate && hourlyRate > 0 && (
                                      <TableCell className="text-right font-medium text-primary">
                                        {hasHours ? formatCurrency(dayPay) : "-"}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </div>
            )}

            {/* Project Totals Summary */}
            {timeEntries.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  All-Time Project Totals
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold">{totals.totalHours.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Total Hours</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{totals.regularHours.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Regular</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600">{totals.overtimeHours.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Overtime</div>
                  </div>
                  {hourlyRate && hourlyRate > 0 && (
                    <div>
                      <div className="text-lg font-bold text-primary">{formatCurrency(totals.totalPay)}</div>
                      <div className="text-xs text-muted-foreground">Total Pay</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {timeEntries.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No time entries logged for this project yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
