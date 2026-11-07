import { ownershipText } from '@/lib/assetDetails';
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
  UserMinus,
  Pencil
} from "lucide-react";
import { EditAssetDialog, type EditableAsset } from "./EditAssetDialog";
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
  AssetBillingRow,
  useAssignAssetToLocation,
  useProjectAssetBilling,
  useUnassignAsset 
} from "@/integrations/supabase/hooks/useAssetAssignments";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";
import { useUserRole } from "@/hooks/useUserRole";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assetBillingText } from "./LocationAssets";

/** Inline location + billing editors; same asset_assignments row the location views use. */
function AssetLocationCell({ row, projectId, locations, canEdit }: {
  row: AssetBillingRow; projectId: string; locations: { id: string; name: string }[]; canEdit: boolean;
}) {
  const assign = useAssignAssetToLocation();
  const name = locations.find((l) => l.id === row.location_id)?.name;
  if (!canEdit) return name ? <Badge variant="outline" className="font-normal"><MapPin className="h-3 w-3 mr-1" />{name}</Badge> : <span className="text-muted-foreground">Project-wide</span>;
  return (
    <Select value={row.location_id ?? "none"} onValueChange={(v) => assign.mutate({ projectId, assignmentId: row.id, locationId: v === "none" ? null : v })}>
      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Project-wide</SelectItem>
        {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function AssetBillingCell({ row, projectId, canEdit }: { row: AssetBillingRow; projectId: string; canEdit: boolean }) {
  const assign = useAssignAssetToLocation();
  const [rate, setRate] = useState(row.day_rate != null ? String(row.day_rate) : "");
  const text = assetBillingText(row);
  if (!canEdit) return null;
  const save = (billable: boolean, r: string) => {
    const n = r.trim() === "" ? null : Number(r);
    assign.mutate({ projectId, assignmentId: row.id, locationId: row.location_id, billable, dayRate: n != null && Number.isFinite(n) ? n : null });
  };
  return (
    <div className="flex items-center gap-2">
      <Switch checked={row.billable} onCheckedChange={(b) => save(b, rate)} aria-label="Bill customer" />
      {row.billable && (
        <Input aria-label="Bill rate" type="number" inputMode="decimal" min={0} step="0.01" className="h-8 w-24 text-xs" value={rate}
          placeholder={row.assets?.default_day_rate != null ? `${row.assets.default_day_rate} (default)` : "$/day"}
          onChange={(e) => setRate(e.target.value)}
          onBlur={() => { if (rate !== (row.day_rate != null ? String(row.day_rate) : "")) save(true, rate); }} />
      )}
      {text && <span className={cn("text-xs whitespace-nowrap", row.rate == null ? "text-warning" : "text-muted-foreground")}>{text}</span>}
    </div>
  );
}
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
  const [editAsset, setEditAsset] = useState<EditableAsset | null>(null);
  
  const { rows: assignments, isLoading } = useProjectAssetBilling(projectId);
  const { data: locations = [] } = useProjectLocations(projectId);
  const { isAdmin, isManager } = useUserRole();
  const canEdit = isAdmin || isManager;
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
                              <p className="font-medium truncate">{asset.label}</p><Badge variant="outline">{ownershipText(asset)}</Badge>
                              <p className="text-sm text-muted-foreground capitalize">
                                {asset.type}
                              </p>
                            </div>
                          </div>
                          {canEdit && (
                            <Button variant="ghost" size="icon" aria-label="Edit asset" title="Edit asset" onClick={() => setEditAsset(asset)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
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
                          <AssetLocationCell row={assignment} projectId={projectId} locations={locations} canEdit={canEdit} />
                          {canEdit && <div className="w-full"><AssetBillingCell row={assignment} projectId={projectId} canEdit={canEdit} /></div>}
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
                        <TableHead>Location</TableHead>
                        {canEdit && <TableHead>Bill rate</TableHead>}
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
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
                                  <p className="font-medium">{asset.label}</p><Badge variant="outline">{ownershipText(asset)}</Badge>
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
                            <TableCell><AssetLocationCell row={assignment} projectId={projectId} locations={locations} canEdit={canEdit} /></TableCell>
                            {canEdit && <TableCell><AssetBillingCell row={assignment} projectId={projectId} canEdit={canEdit} /></TableCell>}
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
                              {canEdit && (
                                <Button variant="ghost" size="icon" aria-label="Edit asset" title="Edit asset" onClick={() => setEditAsset(asset)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
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
      <EditAssetDialog asset={editAsset} open={!!editAsset} onOpenChange={(o) => !o && setEditAsset(null)} />
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
