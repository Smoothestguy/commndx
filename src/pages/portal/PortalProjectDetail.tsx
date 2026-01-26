import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries, usePersonnelAllAssignments } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelProjectAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Briefcase, Calendar, Clock, MapPin, User, Building, Phone, Mail, FileText, DollarSign, Package, AlertCircle } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { ProjectWeeklyPayHistory } from "@/components/portal/ProjectWeeklyPayHistory";
import { formatCurrency } from "@/lib/utils";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  // Use ALL assignments (not just active) to allow viewing historical projects
  const { data: allAssignments, isLoading: assignmentsLoading } = usePersonnelAllAssignments(personnel?.id);
  const { data: timeEntries, isLoading: timeLoading } = usePersonnelTimeEntries(personnel?.id);
  const { data: projectAssets, isLoading: assetsLoading } = usePersonnelProjectAssets(personnel?.id, id);
  const { data: companySettings } = useCompanySettings();

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;

  // Find ANY assignment for this project (not just active - allows viewing history)
  const assignment = allAssignments?.find(a => a.project?.id === id);
  const project = assignment?.project;
  const isActiveAssignment = assignment?.status === 'active';

  // Filter time entries for this project
  const projectTimeEntries = timeEntries?.filter(entry => entry.project_id === id) || [];

  // Calculate hours for this project using 40-hour weekly overtime threshold
  const { totalRegularHours, totalOvertimeHours, totalHolidayHours, totalHours } = useMemo(() => {
    // Group entries by week
    const entriesByWeek = new Map<string, { hours: number; holidayHours: number }>();
    
    projectTimeEntries.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }).toISOString();
      const entryHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      const existing = entriesByWeek.get(weekStart) || { hours: 0, holidayHours: 0 };
      entriesByWeek.set(weekStart, {
        hours: existing.hours + entryHours,
        holidayHours: existing.holidayHours + ((entry as any).is_holiday ? entryHours : 0)
      });
    });
    
    // Calculate regular and overtime based on 40-hour weekly threshold
    let regular = 0;
    let overtime = 0;
    let holiday = 0;
    
    entriesByWeek.forEach(({ hours: weekHours, holidayHours }) => {
      if (weekHours <= 40) {
        regular += weekHours;
      } else {
        regular += 40;
        overtime += weekHours - 40;
      }
      holiday += holidayHours;
    });
    
    return {
      totalRegularHours: regular,
      totalOvertimeHours: overtime,
      totalHolidayHours: holiday,
      totalHours: regular + overtime
    };
  }, [projectTimeEntries]);

  // Calculate pay using each entry's snapshotted hourly_rate (fallback to personnel rate if missing)
  const fallbackRate = personnel?.hourly_rate || 0;
  
  // Group entries by week and calculate pay respecting 40-hour OT threshold per week
  const weeklyData = useMemo(() => {
    const weekMap = new Map<string, typeof projectTimeEntries>();
    
    projectTimeEntries.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }).toISOString();
      const weekEntries = weekMap.get(weekStart) || [];
      weekEntries.push(entry);
      weekMap.set(weekStart, weekEntries);
    });
    
    let totalRegularPay = 0;
    let totalOvertimePay = 0;
    let totalHolidayPay = 0;
    
    weekMap.forEach((weekEntries) => {
      // Sort entries by date within the week
      const sorted = [...weekEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      let hoursAccumulated = 0;
      
      sorted.forEach((entry) => {
        const entryRate = entry.hourly_rate ?? fallbackRate;
        const entryTotalHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
        const isHoliday = (entry as any).is_holiday === true;
        
        let entryRegular = 0;
        let entryOvertime = 0;
        
        if (hoursAccumulated >= 40) {
          entryOvertime = entryTotalHours;
        } else if (hoursAccumulated + entryTotalHours > 40) {
          entryRegular = 40 - hoursAccumulated;
          entryOvertime = entryTotalHours - entryRegular;
        } else {
          entryRegular = entryTotalHours;
        }
        
        hoursAccumulated += entryTotalHours;
        
        if (isHoliday) {
          // Holiday pay uses holiday multiplier
          totalHolidayPay += entryRegular * entryRate * holidayMultiplier;
          totalHolidayPay += entryOvertime * entryRate * Math.max(overtimeMultiplier, holidayMultiplier);
        } else {
          totalRegularPay += entryRegular * entryRate;
          totalOvertimePay += entryOvertime * entryRate * overtimeMultiplier;
        }
      });
    });
    
    return { totalRegularPay, totalOvertimePay, totalHolidayPay };
  }, [projectTimeEntries, fallbackRate, overtimeMultiplier, holidayMultiplier]);
  
  const totalRegularPay = weeklyData.totalRegularPay;
  const totalOvertimePay = weeklyData.totalOvertimePay;
  const totalHolidayPay = weeklyData.totalHolidayPay;
  const totalPay = totalRegularPay + totalOvertimePay + totalHolidayPay;

  const isLoading = assignmentsLoading || timeLoading || assetsLoading;

  // Format address
  const formatAddress = () => {
    if (!project) return null;
    const parts = [project.address, project.city, project.state, project.zip].filter(Boolean);
    if (parts.length === 0) return null;
    
    if (project.city && project.state) {
      return `${project.address || ''}\n${project.city}, ${project.state} ${project.zip || ''}`.trim();
    }
    return parts.join(', ');
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  if (!assignment || !project) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("/portal/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project not found</h3>
              <p className="text-muted-foreground text-center">
                This project may not be assigned to you or doesn't exist.
              </p>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  const address = formatAddress();
  const customer = project.customer;

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portal/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">Project Details</p>
          </div>
          <div className="flex items-center gap-2">
            {!isActiveAssignment && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Past Assignment
              </Badge>
            )}
            <Badge variant={project.status === "active" ? "default" : "secondary"}>
              {project.status}
            </Badge>
          </div>
        </div>

        {/* Inactive Assignment Banner */}
        {!isActiveAssignment && (
          <Alert variant="default" className="border-amber-200 bg-amber-50/50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You are no longer actively assigned to this project. You can view your historical time entries and pay information below.
              {assignment.unassigned_at && (
                <span className="block text-sm text-amber-600 mt-1">
                  Assignment ended: {format(parseISO(assignment.unassigned_at), "MMM d, yyyy")}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Project Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Assigned {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.start_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Started: {format(parseISO(project.start_date), "MMM d, yyyy")}</span>
                </div>
              )}
              {project.end_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Ends: {format(parseISO(project.end_date), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location & Contact Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Jobsite Location */}
          {address && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Jobsite Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{address}</p>
              </CardContent>
            </Card>
          )}

          {/* Point of Contact */}
          {(project.poc_name || project.poc_phone || project.poc_email) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Point of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.poc_name && (
                  <p className="text-sm font-medium">{project.poc_name}</p>
                )}
                {project.poc_phone && (
                  <a href={`tel:${project.poc_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Phone className="h-3 w-3" />
                    {project.poc_phone}
                  </a>
                )}
                {project.poc_email && (
                  <a href={`mailto:${project.poc_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Mail className="h-3 w-3" />
                    {project.poc_email}
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Customer Info */}
        {(customer || project.customer_po) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer</p>
                    <p className="text-sm font-medium">{customer.company || customer.name}</p>
                  </div>
                )}
                {project.customer_po && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer PO</p>
                    <p className="text-sm font-medium">{project.customer_po}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Description */}
        {project.description && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Project Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{project.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Assigned Equipment */}
        {projectAssets && projectAssets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Assigned Equipment
              </CardTitle>
              <CardDescription>
                {projectAssets.length} item{projectAssets.length !== 1 ? "s" : ""} assigned for this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectAssets.map((assignment) => (
                <PortalAssetCard 
                  key={assignment.id} 
                  assignment={assignment}
                  showProject={false}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hours & Pay Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Project Totals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalRegularHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Regular</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-amber-600">{totalOvertimeHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">OT</div>
              </div>
              {totalHolidayHours > 0 && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-purple-600">{totalHolidayHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">HO</div>
                </div>
              )}
              {fallbackRate > 0 && (
                <div className="text-center p-4 rounded-lg bg-primary/10">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totalPay)}</div>
                  <div className="text-sm text-muted-foreground">Total Pay</div>
                </div>
              )}
            </div>

            {/* Pay breakdown formula */}
            {fallbackRate > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border">
                <div className="flex flex-wrap items-center gap-2 justify-center text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{formatCurrency(totalRegularPay)}</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="text-amber-600">{formatCurrency(totalOvertimePay)}</span>
                  <span className="text-xs text-muted-foreground">(1.5x)</span>
                  {totalHolidayPay > 0 && (
                    <>
                      <span className="text-muted-foreground">+</span>
                      <span className="text-purple-600">{formatCurrency(totalHolidayPay)}</span>
                      <span className="text-xs text-muted-foreground">(2x)</span>
                    </>
                  )}
                  <span className="text-muted-foreground">=</span>
                  <span className="font-semibold text-primary">{formatCurrency(totalPay)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Pay History */}
        <ProjectWeeklyPayHistory 
          timeEntries={projectTimeEntries}
          hourlyRate={personnel?.hourly_rate || null}
          overtimeMultiplier={overtimeMultiplier}
          holidayMultiplier={holidayMultiplier}
        />
      </div>
    </PortalLayout>
  );
}
