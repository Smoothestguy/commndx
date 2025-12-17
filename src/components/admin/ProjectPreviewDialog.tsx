import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { Calendar, MapPin, User, Clock, Building, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
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

  // Group time entries by week
  const weeklyData = useMemo(() => {
    if (!timeEntries || timeEntries.length === 0) return [];

    const weekMap = new Map<string, { entries: TimeEntry[]; dates: Set<string> }>();

    timeEntries.forEach((entry) => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { entries: [], dates: new Set() });
      }

      const data = weekMap.get(weekKey)!;
      data.entries.push(entry);
      data.dates.add(entry.entry_date);
    });

    const weeks: WeekData[] = [];
    const rate = hourlyRate || 0;

    weekMap.forEach((data, weekKey) => {
      const weekStart = parseISO(weekKey);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const regularHours = data.entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
      const overtimeHours = data.entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
      const totalHours = regularHours + overtimeHours;

      const regularPay = regularHours * rate;
      const overtimePay = overtimeHours * rate * overtimeMultiplier;
      const totalPay = regularPay + overtimePay;

      weeks.push({
        weekStart,
        weekEnd,
        daysWorked: data.dates.size,
        regularHours,
        overtimeHours,
        totalHours,
        regularPay,
        overtimePay,
        totalPay,
      });
    });

    return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [timeEntries, hourlyRate]);

  // Calculate totals
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

            {/* Project Totals Summary */}
            {timeEntries.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Project Totals
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
                {hourlyRate && hourlyRate > 0 && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 justify-center text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCurrency(totals.regularPay)}</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-amber-600">{formatCurrency(totals.overtimePay)}</span>
                    <span className="text-xs text-muted-foreground">(1.5x)</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="font-semibold text-primary">{formatCurrency(totals.totalPay)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Pay History */}
            {weeklyData.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Weekly Pay Periods
                </h4>
                <div className="space-y-2">
                  {weeklyData.map((week) => (
                    <div 
                      key={format(week.weekStart, "yyyy-MM-dd")} 
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {format(week.weekStart, "MMM d")} - {format(week.weekEnd, "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {week.daysWorked} day{week.daysWorked !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{week.regularHours.toFixed(1)}h</span>
                        <span className="text-muted-foreground">+</span>
                        <span className="text-amber-600">{week.overtimeHours.toFixed(1)}h OT</span>
                        <span className="text-muted-foreground">=</span>
                        <span className="font-semibold">{week.totalHours.toFixed(1)}h</span>
                      </div>
                      {hourlyRate && hourlyRate > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>{formatCurrency(week.regularPay)}</span>
                          <span className="text-muted-foreground">+</span>
                          <span className="text-amber-600">{formatCurrency(week.overtimePay)}</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="font-semibold text-primary">{formatCurrency(week.totalPay)}</span>
                        </div>
                      )}
                    </div>
                  ))}
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
