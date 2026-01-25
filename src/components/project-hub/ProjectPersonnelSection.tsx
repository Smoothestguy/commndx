import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Users, UserPlus, UserMinus, Loader2, Mail, Briefcase, ChevronDown, MessageSquare, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRemovePersonnelFromProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { usePersonnelWithAssets } from "@/integrations/supabase/hooks/usePersonnelWithAssets";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { BulkSMSDialog } from "@/components/messaging/BulkSMSDialog";
import { PersonnelAssetsCell } from "@/components/project-hub/PersonnelAssetsCell";
import { exportPersonnelWithAssetsToXLSX } from "@/utils/personnelAssetsExportUtils";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ProjectPersonnelSectionProps {
  projectId: string;
  projectName?: string;
}

export function ProjectPersonnelSection({ projectId, projectName = "this project" }: ProjectPersonnelSectionProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isBulkSMSDialogOpen, setIsBulkSMSDialogOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [personnelToRemove, setPersonnelToRemove] = useState<{ name: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const { data: assignedPersonnel = [], isLoading } = usePersonnelWithAssets(projectId);
  const removeMutation = useRemovePersonnelFromProject();

  const handleRemove = (assignmentId: string, firstName: string, lastName: string) => {
    setRemoveConfirmId(assignmentId);
    setPersonnelToRemove({ name: `${firstName} ${lastName}` });
  };

  const confirmRemove = () => {
    if (!removeConfirmId) return;
    
    removeMutation.mutate(removeConfirmId, {
      onSuccess: () => {
        setRemoveConfirmId(null);
        setPersonnelToRemove(null);
      },
    });
  };

  const handleAssignmentChange = () => {
    queryClient.invalidateQueries({ 
      queryKey: ["personnel-with-assets", projectId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ["personnel-project-assignments", "by-project", projectId] 
    });
  };

  const handleExport = async () => {
    if (assignedPersonnel.length === 0) {
      toast.error("No personnel to export");
      return;
    }

    setIsExporting(true);
    try {
      exportPersonnelWithAssetsToXLSX(assignedPersonnel, {
        projectName: projectName,
        isAdmin: isAdmin || isManager, // Admins and managers can see access codes
      });
      toast.success("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export personnel data");
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Assigned Personnel
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} />
                </CardTitle>
                <CardDescription>
                  {assignedPersonnel.length} personnel assigned to this project
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport();
                  }} 
                  size="sm"
                  variant="outline"
                  disabled={assignedPersonnel.length === 0 || isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : isMobile ? "Export" : "Export Excel"}
                </Button>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBulkSMSDialogOpen(true);
                  }} 
                  size="sm"
                  variant="outline"
                  disabled={assignedPersonnel.length === 0}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isMobile ? "Text All" : "Blast Text"}
                </Button>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAssignDialogOpen(true);
                  }} 
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {isMobile ? "Assign" : "Assign Personnel"}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <CardContent>
          {assignedPersonnel.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No personnel assigned to this project yet
              </p>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Personnel
              </Button>
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {assignedPersonnel.map((person) => {
                return (
                  <div
                    key={person.assignmentId}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/personnel/${person.personnelId}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <SecureAvatar
                          bucket="personnel-photos"
                          photoUrl={null}
                          className="h-10 w-10 flex-shrink-0"
                          fallback={
                            <span>
                              {person.firstName?.[0]}
                              {person.lastName?.[0]}
                            </span>
                          }
                          alt={person.name}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {person.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {person.email}
                          </p>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(
                            person.assignmentId,
                            person.firstName,
                            person.lastName
                          )}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2 text-sm">
                      {person.rateBracket && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {person.rateBracket}
                        </Badge>
                      )}
                      {person.billRate != null && (
                        <span className="text-muted-foreground">
                          {formatCurrency(person.billRate)}/hr
                        </span>
                      )}
                      {person.assignedAt && (
                        <span className="text-muted-foreground ml-auto">
                          Assigned {format(new Date(person.assignedAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    {/* Assets on Mobile */}
                    {person.assets.length > 0 && (
                      <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <PersonnelAssetsCell assets={person.assets} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Desktop Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Rate Bracket</TableHead>
                    <TableHead>Bill Rate</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedPersonnel.map((person) => {
                    return (
                      <TableRow 
                        key={person.assignmentId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/personnel/${person.personnelId}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <SecureAvatar
                              bucket="personnel-photos"
                              photoUrl={null}
                              className="h-8 w-8"
                              fallback={
                                <span className="text-xs">
                                  {person.firstName?.[0]}
                                  {person.lastName?.[0]}
                                </span>
                              }
                              alt={person.name}
                            />
                            <div>
                              <p className="font-medium">
                                {person.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {person.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {person.rateBracket ? (
                            <Badge variant="secondary">
                              {person.rateBracket}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.billRate != null 
                            ? `${formatCurrency(person.billRate)}/hr`
                            : "—"
                          }
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <PersonnelAssetsCell assets={person.assets} />
                        </TableCell>
                        <TableCell>
                          {person.assignedAt 
                            ? format(new Date(person.assignedAt), "MMM d, yyyy")
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemove(
                                person.assignmentId,
                                person.firstName,
                                person.lastName
                              )}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Assign Personnel Dialog */}
      <PersonnelAssignmentDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        defaultProjectId={projectId}
        onAssignmentChange={handleAssignmentChange}
      />

      {/* Bulk SMS Dialog */}
      <BulkSMSDialog
        open={isBulkSMSDialogOpen}
        onOpenChange={setIsBulkSMSDialogOpen}
        projectId={projectId}
        projectName={projectName}
        recipients={assignedPersonnel.map(p => ({
          id: p.personnelId,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
        }))}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removeConfirmId} onOpenChange={() => setRemoveConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Personnel from Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {personnelToRemove?.name} from this project?
              This will unassign them but won't delete their time entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
