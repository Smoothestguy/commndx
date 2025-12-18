import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, ChevronDown, ChevronRight } from "lucide-react";
import { useAllTimeEntries, TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { formatCurrency } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { calculateLaborCost } from "@/lib/overtimeUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";

interface ProjectTimeEntriesListProps {
  projectId: string;
}

interface DayEntry {
  date: string;
  totalHours: number;
  entries: TimeEntryWithDetails[];
}

interface PersonnelWeekData {
  personnelId: string;
  personnelName: string;
  hourlyRate: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  laborCost: number;
  dailyEntries: DayEntry[];
}

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  laborCost: number;
  personnel: PersonnelWeekData[];
}

export function ProjectTimeEntriesList({ projectId }: ProjectTimeEntriesListProps) {
  const { data: allTimeEntries, isLoading } = useAllTimeEntries(projectId);
  const { data: companySettings } = useCompanySettings();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const weeklyThreshold = companySettings?.weekly_overtime_threshold || 40;
  const overtimeMultiplier = companySettings?.overtime_multiplier || 1.5;

  const timeEntries = useMemo(() => {
    return (allTimeEntries || []);
  }, [allTimeEntries]);

  // Group entries by week, then by personnel, then by day
  const weeklyData = useMemo(() => {
    if (timeEntries.length === 0) return [];

    // Get all unique weeks
    const weekMap = new Map<string, TimeEntryWithDetails[]>();
    
    timeEntries.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }); // Monday
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(entry);
    });

    // Process each week
    const weeks: WeekData[] = [];
    
    weekMap.forEach((entries, weekKey) => {
      const weekStart = parseISO(weekKey);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Group by personnel
      const personnelMap = new Map<string, TimeEntryWithDetails[]>();
      entries.forEach(entry => {
        const key = entry.personnel_id || 'unknown';
        if (!personnelMap.has(key)) {
          personnelMap.set(key, []);
        }
        personnelMap.get(key)!.push(entry);
      });

      // Process each personnel
      const personnelData: PersonnelWeekData[] = [];
      
      personnelMap.forEach((personnelEntries, personnelId) => {
        const firstEntry = personnelEntries[0];
        const personnelName = firstEntry.personnel 
          ? `${firstEntry.personnel.first_name} ${firstEntry.personnel.last_name}`
          : 'Unknown';
        const hourlyRate = firstEntry.personnel?.hourly_rate || 0;
        
        // Calculate total hours for the week (sum of regular + overtime from stored values)
        const totalHours = personnelEntries.reduce((sum, e) => 
          sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
        );
        
        // Calculate overtime based on weekly threshold
        const regularHours = Math.min(totalHours, weeklyThreshold);
        const overtimeHours = Math.max(0, totalHours - weeklyThreshold);
        const laborCost = calculateLaborCost(regularHours, overtimeHours, hourlyRate, overtimeMultiplier);

        // Group by day
        const dayMap = new Map<string, TimeEntryWithDetails[]>();
        personnelEntries.forEach(entry => {
          if (!dayMap.has(entry.entry_date)) {
            dayMap.set(entry.entry_date, []);
          }
          dayMap.get(entry.entry_date)!.push(entry);
        });

        const dailyEntries: DayEntry[] = [];
        dayMap.forEach((dayEntries, date) => {
          const dayTotal = dayEntries.reduce((sum, e) => 
            sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
          );
          dailyEntries.push({
            date,
            totalHours: dayTotal,
            entries: dayEntries,
          });
        });

        // Sort days chronologically
        dailyEntries.sort((a, b) => a.date.localeCompare(b.date));

        personnelData.push({
          personnelId,
          personnelName,
          hourlyRate,
          totalHours,
          regularHours,
          overtimeHours,
          laborCost,
          dailyEntries,
        });
      });

      // Sort personnel by name
      personnelData.sort((a, b) => a.personnelName.localeCompare(b.personnelName));

      // Calculate week totals
      const weekTotalHours = personnelData.reduce((sum, p) => sum + p.totalHours, 0);
      const weekRegularHours = personnelData.reduce((sum, p) => sum + p.regularHours, 0);
      const weekOvertimeHours = personnelData.reduce((sum, p) => sum + p.overtimeHours, 0);
      const weekLaborCost = personnelData.reduce((sum, p) => sum + p.laborCost, 0);

      weeks.push({
        weekStart,
        weekEnd,
        weekLabel: `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
        totalHours: weekTotalHours,
        regularHours: weekRegularHours,
        overtimeHours: weekOvertimeHours,
        laborCost: weekLaborCost,
        personnel: personnelData,
      });
    });

    // Sort weeks by date (most recent first)
    weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

    // Auto-expand the most recent week
    if (weeks.length > 0 && expandedWeeks.size === 0) {
      setExpandedWeeks(new Set([format(weeks[0].weekStart, 'yyyy-MM-dd')]));
    }

    return weeks;
  }, [timeEntries, weeklyThreshold, overtimeMultiplier]);

  // Calculate grand totals
  const totals = useMemo(() => {
    return weeklyData.reduce((acc, week) => ({
      totalHours: acc.totalHours + week.totalHours,
      regularHours: acc.regularHours + week.regularHours,
      overtimeHours: acc.overtimeHours + week.overtimeHours,
      laborCost: acc.laborCost + week.laborCost,
    }), { totalHours: 0, regularHours: 0, overtimeHours: 0, laborCost: 0 });
  }, [weeklyData]);

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekKey)) {
        newSet.delete(weekKey);
      } else {
        newSet.add(weekKey);
      }
      return newSet;
    });
  };

  return (
    <Card className="glass border-border">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Time Tracking ({timeEntries.length})
          </CardTitle>
          {timeEntries.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Hours: </span>
                <span className="font-bold">{totals.totalHours.toFixed(1)}</span>
                <span className="text-muted-foreground ml-1">
                  ({totals.regularHours.toFixed(1)} reg + {totals.overtimeHours.toFixed(1)} OT)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Labor Cost: </span>
                <span className="font-bold text-primary">{formatCurrency(totals.laborCost)}</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading time entries...</div>
        ) : timeEntries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No time entries recorded for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {weeklyData.map((week) => {
              const weekKey = format(week.weekStart, 'yyyy-MM-dd');
              const isExpanded = expandedWeeks.has(weekKey);

              return (
                <Collapsible key={weekKey} open={isExpanded} onOpenChange={() => toggleWeek(weekKey)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{week.weekLabel}</span>
                        <Badge variant="secondary" className="ml-2">
                          {week.personnel.length} personnel
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <span className="text-muted-foreground">Hours: </span>
                          <span className="font-medium">{week.totalHours.toFixed(1)}</span>
                          {week.overtimeHours > 0 && (
                            <span className="text-orange-500 ml-1">
                              ({week.overtimeHours.toFixed(1)} OT)
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(week.laborCost)}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-6 pt-2">
                      <Accordion type="multiple" className="space-y-1">
                        {week.personnel.map((person) => (
                          <AccordionItem 
                            key={person.personnelId} 
                            value={person.personnelId}
                            className="border rounded-lg bg-background/50"
                          >
                            <AccordionTrigger className="px-3 py-2 hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <Link
                                    to={`/personnel/${person.personnelId}`}
                                    className="text-primary hover:underline font-medium"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {person.personnelName}
                                  </Link>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span>
                                    <span className="font-medium">{person.totalHours.toFixed(1)}h</span>
                                    {person.overtimeHours > 0 && (
                                      <Badge variant="outline" className="ml-2 text-orange-500 border-orange-500/30">
                                        +{person.overtimeHours.toFixed(1)} OT
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="font-medium text-primary">
                                    {formatCurrency(person.laborCost)}
                                  </span>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3">
                              <div className="space-y-1 pt-1">
                                {person.dailyEntries.map((day) => (
                                  <div 
                                    key={day.date} 
                                    className="flex items-center justify-between py-1.5 px-2 rounded text-sm bg-muted/30"
                                  >
                                    <span className="text-muted-foreground">
                                      {format(parseISO(day.date), 'EEE, MMM d')}
                                    </span>
                                    <span className="font-medium">{day.totalHours.toFixed(1)}h</span>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
