import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries, usePersonnelAssignments } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Briefcase, Calendar, Clock, MapPin, User, Building, Phone, Mail, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  const { data: assignments, isLoading: assignmentsLoading } = usePersonnelAssignments(personnel?.id);
  const { data: timeEntries, isLoading: timeLoading } = usePersonnelTimeEntries(personnel?.id);

  // Find the assignment for this project
  const assignment = assignments?.find(a => a.project?.id === id);
  const project = assignment?.project;

  // Filter time entries for this project
  const projectTimeEntries = timeEntries?.filter(entry => entry.project_id === id) || [];

  // Calculate hours for this project
  const totalRegularHours = projectTimeEntries.reduce((sum, entry) => sum + (entry.regular_hours || 0), 0);
  const totalOvertimeHours = projectTimeEntries.reduce((sum, entry) => sum + (entry.overtime_hours || 0), 0);
  const totalHours = totalRegularHours + totalOvertimeHours;

  const isLoading = assignmentsLoading || timeLoading;

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
          <Badge variant={project.status === "active" ? "default" : "secondary"}>
            {project.status}
          </Badge>
        </div>

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

        {/* Hours Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Your Hours on This Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalRegularHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Regular</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-orange-500">{totalOvertimeHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Overtime</div>
              </div>
            </div>

            {/* Recent Time Entries */}
            {projectTimeEntries.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Recent Time Entries</h4>
                {projectTimeEntries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center p-3 rounded-lg border">
                    <div>
                      <div className="font-medium">
                        {format(parseISO(entry.entry_date), "EEEE, MMM d, yyyy")}
                      </div>
                      {entry.description && (
                        <div className="text-sm text-muted-foreground">{entry.description}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {((entry.regular_hours || 0) + (entry.overtime_hours || 0)).toFixed(1)} hrs
                      </div>
                      {(entry.overtime_hours || 0) > 0 && (
                        <div className="text-xs text-orange-500">
                          +{entry.overtime_hours?.toFixed(1)} OT
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {projectTimeEntries.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    Showing 10 of {projectTimeEntries.length} entries
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No time entries logged for this project yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
