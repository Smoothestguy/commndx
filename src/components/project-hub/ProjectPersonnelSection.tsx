import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Users, UserPlus, UserMinus, Loader2, Mail, Briefcase, ChevronDown } from "lucide-react";
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
import { 
  usePersonnelByProject, 
  useRemovePersonnelFromProject 
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { useQueryClient } from "@tanstack/react-query";

interface ProjectPersonnelSectionProps {
  projectId: string;
}

export function ProjectPersonnelSection({ projectId }: ProjectPersonnelSectionProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [personnelToRemove, setPersonnelToRemove] = useState<{ name: string } | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  
  const { data: assignedPersonnel = [], isLoading } = usePersonnelByProject(projectId);
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
      queryKey: ["personnel-project-assignments", "by-project", projectId] 
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Filter out assignments without personnel data
  const validAssignments = assignedPersonnel.filter(a => a.personnel);

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
                  {validAssignments.length} personnel assigned to this project
                </CardDescription>
              </div>
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
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <CardContent>
          {validAssignments.length === 0 ? (
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
              {validAssignments.map((assignment) => {
                const personnel = assignment.personnel!;
                const rateBracket = assignment.project_rate_brackets;
                const billRate = assignment.bill_rate ?? rateBracket?.bill_rate;
                
                return (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                        onClick={() => navigate(`/personnel/${assignment.personnel_id}`)}
                      >
                        <SecureAvatar
                          bucket="personnel-photos"
                          photoUrl={null}
                          className="h-10 w-10 flex-shrink-0"
                          fallback={
                            <span>
                              {personnel.first_name?.[0]}
                              {personnel.last_name?.[0]}
                            </span>
                          }
                          alt={`${personnel.first_name} ${personnel.last_name}`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {personnel.first_name} {personnel.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {personnel.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(
                          assignment.id,
                          personnel.first_name,
                          personnel.last_name
                        )}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2 text-sm">
                      {rateBracket?.name && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {rateBracket.name}
                        </Badge>
                      )}
                      {billRate != null && (
                        <span className="text-muted-foreground">
                          {formatCurrency(billRate)}/hr
                        </span>
                      )}
                      {assignment.assigned_at && (
                        <span className="text-muted-foreground ml-auto">
                          Assigned {format(new Date(assignment.assigned_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
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
                    <TableHead>Assigned</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validAssignments.map((assignment) => {
                    const personnel = assignment.personnel!;
                    const rateBracket = assignment.project_rate_brackets;
                    const billRate = assignment.bill_rate ?? rateBracket?.bill_rate;
                    
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <div 
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                            onClick={() => navigate(`/personnel/${assignment.personnel_id}`)}
                          >
                            <SecureAvatar
                              bucket="personnel-photos"
                              photoUrl={null}
                              className="h-8 w-8"
                              fallback={
                                <span className="text-xs">
                                  {personnel.first_name?.[0]}
                                  {personnel.last_name?.[0]}
                                </span>
                              }
                              alt={`${personnel.first_name} ${personnel.last_name}`}
                            />
                            <div>
                              <p className="font-medium">
                                {personnel.first_name} {personnel.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {personnel.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rateBracket?.name ? (
                            <Badge variant="secondary">
                              {rateBracket.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {billRate != null 
                            ? `${formatCurrency(billRate)}/hr`
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          {assignment.assigned_at 
                            ? format(new Date(assignment.assigned_at), "MMM d, yyyy")
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemove(
                              assignment.id,
                              personnel.first_name,
                              personnel.last_name
                            )}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
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
