import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { calculateSingleEmployeeOvertime } from "@/lib/overtimeUtils";

export default function PortalHours() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: timeEntries, isLoading } = usePersonnelTimeEntries(personnel?.id);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });

  // Filter entries for selected week
  const weekEntries = timeEntries?.filter(entry => {
    const entryDate = parseISO(entry.entry_date);
    return isWithinInterval(entryDate, { start: selectedWeekStart, end: weekEnd });
  }) || [];

  // Calculate totals using 40-hour weekly threshold for this single employee
  const { totalRegular, totalOvertime, totalHours } = useMemo(() => {
    // Sum all hours for the week (ignore stored regular/overtime split)
    const weeklyTotal = weekEntries.reduce((sum, e) => 
      sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
    );
    const { regularHours, overtimeHours } = calculateSingleEmployeeOvertime(weeklyTotal, 40);
    return { totalRegular: regularHours, totalOvertime: overtimeHours, totalHours: weeklyTotal };
  }, [weekEntries]);

  // Group by project
  const entriesByProject = weekEntries.reduce((acc, entry) => {
    const projectName = entry.project?.name || "Unknown Project";
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(entry);
    return acc;
  }, {} as Record<string, typeof weekEntries>);

  const goToPreviousWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const goToCurrentWeek = () => {
    setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Hours</h1>
            <p className="text-muted-foreground">View your recorded work hours</p>
          </div>
        </div>

        {/* Week Navigator */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <p className="font-medium">
                  {format(selectedWeekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </p>
                <Button variant="link" size="sm" onClick={goToCurrentWeek} className="text-xs">
                  Go to Current Week
                </Button>
              </div>
              
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regular Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRegular.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overtime Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{totalOvertime.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Hours by Project */}
        {Object.keys(entriesByProject).length > 0 ? (
          Object.entries(entriesByProject).map(([projectName, entries]) => {
            // Sum total hours for this project and recalculate based on 40-hour threshold
            const projectTotalHours = entries.reduce((sum, e) => 
              sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
            );
            // Note: For per-project breakdown, we show raw hours since overtime is calculated weekly across all projects
            const projectRegular = projectTotalHours;
            const projectOvertime = 0; // Overtime is calculated at weekly level, not per-project
            
            return (
              <Card key={projectName}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {projectName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">Overtime</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(parseISO(entry.entry_date), "EEE, MMM d")}
                          </TableCell>
                          <TableCell className="text-right">
                            {(entry.regular_hours || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right text-orange-500">
                            {(entry.overtime_hours || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {((entry.regular_hours || 0) + (entry.overtime_hours || 0)).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-medium">Subtotal</TableCell>
                        <TableCell className="text-right font-medium">{projectRegular.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium text-orange-500">{projectOvertime.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium">{(projectRegular + projectOvertime).toFixed(1)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hours recorded</h3>
              <p className="text-muted-foreground text-center">
                No time entries found for this week.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
