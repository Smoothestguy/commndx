import { useState } from "react";
import { format } from "date-fns";
import { 
  Package, 
  Plus, 
  ChevronDown, 
  Loader2, 
  Truck, 
  Key, 
  MapPin,
  Settings,
  UserMinus
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  useAssetAssignmentsByProject, 
  useUnassignAsset 
} from "@/integrations/supabase/hooks/useAssetAssignments";
import { AssignAssetDialog } from "./AssignAssetDialog";

interface ProjectAssetAssignmentsSectionProps {
  projectId: string;
  projectName?: string;
}

const assetTypeIcons: Record<string, React.ReactNode> = {
  vehicle: <Truck className="h-4 w-4" />,
  equipment: <Settings className="h-4 w-4" />,
  key: <Key className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  default: <Package className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  returned: "bg-muted text-muted-foreground",
  transferred: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export function ProjectAssetAssignmentsSection({ 
  projectId, 
  projectName = "this project" 
}: ProjectAssetAssignmentsSectionProps) {
  const isMobile = useIsMobile();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [unassignConfirmId, setUnassignConfirmId] = useState<string | null>(null);
  const [assetToUnassign, setAssetToUnassign] = useState<{ label: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: assignments = [], isLoading } = useAssetAssignmentsByProject(projectId);
  const unassignMutation = useUnassignAsset();

  const activeAssignments = assignments.filter(a => a.status === "active");

  const handleUnassign = (assignmentId: string, assetLabel: string) => {
    setUnassignConfirmId(assignmentId);
    setAssetToUnassign({ label: assetLabel });
  };

  const confirmUnassign = () => {
    if (!unassignConfirmId) return;
    
    unassignMutation.mutate(unassignConfirmId, {
      onSuccess: () => {
        setUnassignConfirmId(null);
        setAssetToUnassign(null);
      },
    });
  };

  const getAssetIcon = (type: string) => {
    return assetTypeIcons[type] || assetTypeIcons.default;
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
                  <Package className="h-5 w-5 text-primary" />
                  Asset Assignments
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} />
                </CardTitle>
                <CardDescription>
                  {activeAssignments.length} assets assigned to this project
                </CardDescription>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAssignDialogOpen(true);
                }} 
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isMobile ? "Assign" : "Assign Asset"}
              </Button>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {activeAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No assets assigned to this project yet
                  </p>
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Asset
                  </Button>
                </div>
              ) : isMobile ? (
                // Mobile Card View
                <div className="space-y-3">
                  {activeAssignments.map((assignment) => {
                    const asset = assignment.assets;
                    if (!asset) return null;
                    
                    return (
                      <div
                        key={assignment.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              {getAssetIcon(asset.type)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{asset.label}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {asset.type}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleUnassign(assignment.id, asset.label)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className={statusColors[assignment.status]}>
                            {assignment.status}
                          </Badge>
                          {assignment.personnel && (
                            <span className="text-muted-foreground">
                              → {assignment.personnel.first_name} {assignment.personnel.last_name}
                            </span>
                          )}
                          {assignment.start_at && (
                            <span className="text-muted-foreground ml-auto">
                              Since {format(new Date(assignment.start_at), "MMM d, yyyy")}
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
                        <TableHead>Asset</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAssignments.map((assignment) => {
                        const asset = assignment.assets;
                        if (!asset) return null;
                        
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  {getAssetIcon(asset.type)}
                                </div>
                                <div>
                                  <p className="font-medium">{asset.label}</p>
                                  {asset.serial_number && (
                                    <p className="text-xs text-muted-foreground">
                                      SN: {asset.serial_number}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {asset.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {assignment.personnel ? (
                                <span>
                                  {assignment.personnel.first_name} {assignment.personnel.last_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Project-wide</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {assignment.start_at 
                                ? format(new Date(assignment.start_at), "MMM d, yyyy")
                                : "—"
                              }
                            </TableCell>
                            <TableCell>
                              {assignment.end_at 
                                ? format(new Date(assignment.end_at), "MMM d, yyyy")
                                : "—"
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColors[assignment.status]}>
                                {assignment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleUnassign(assignment.id, asset.label)}
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

      {/* Assign Asset Dialog */}
      <AssignAssetDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        projectId={projectId}
      />

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={!!unassignConfirmId} onOpenChange={() => setUnassignConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign "{assetToUnassign?.label}" from {projectName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnassign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending ? "Unassigning..." : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
