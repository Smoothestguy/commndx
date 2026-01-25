import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Users, UserPlus, UserMinus, Loader2, Mail, Briefcase, ChevronDown, MessageSquare, Download, History, MapPin, Phone, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePersonnelWithAssets } from "@/integrations/supabase/hooks/usePersonnelWithAssets";
import { UNASSIGNMENT_REASONS } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { BulkSMSDialog } from "@/components/messaging/BulkSMSDialog";
import { UnassignPersonnelDialog } from "@/components/project-hub/UnassignPersonnelDialog";
import { PersonnelAssetsCell } from "@/components/project-hub/PersonnelAssetsCell";
import { ColumnPicker } from "@/components/project-hub/personnel-table/ColumnPicker";
import { SelectionToolbar } from "@/components/project-hub/personnel-table/SelectionToolbar";
import { ExportDialog } from "@/components/project-hub/personnel-table/ExportDialog";
import { useColumnPreferences } from "@/components/project-hub/personnel-table/useColumnPreferences";
import type { PersonnelRowData } from "@/components/project-hub/personnel-table/types";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EditPayRateDialog } from "@/components/project-hub/EditPayRateDialog";
import { ViewRateHistoryDialog } from "@/components/project-hub/ViewRateHistoryDialog";

interface ProjectPersonnelSectionProps {
  projectId: string;
  projectName?: string;
}

export function ProjectPersonnelSection({ projectId, projectName = "this project" }: ProjectPersonnelSectionProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const { columns, setColumns } = useColumnPreferences();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isBulkSMSDialogOpen, setIsBulkSMSDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [unassignDialog, setUnassignDialog] = useState<{
    personnelId: string;
    personnelName: string;
    assignmentId: string;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editPayRateDialog, setEditPayRateDialog] = useState<{
    personnelId: string;
    personnelName: string;
    assignmentId: string;
    currentRate: number | null;
  } | null>(null);
  const [viewRateHistoryDialog, setViewRateHistoryDialog] = useState<{
    personnelId: string;
    personnelName: string;
  } | null>(null);
  
  const { data: assignedPersonnel = [], isLoading } = usePersonnelWithAssets(projectId, {
    includeUnassigned: showUnassigned,
  });

  // Transform to PersonnelRowData
  const personnelData: PersonnelRowData[] = useMemo(() => 
    assignedPersonnel.map((p) => ({
      ...p,
      status: p.status,
      unassignedAt: p.unassignedAt,
      unassignedReason: p.unassignedReason,
      unassignedNotes: p.unassignedNotes,
    })),
    [assignedPersonnel]
  );

  const handleUnassign = (assignmentId: string, firstName: string, lastName: string, personnelId: string) => {
    setUnassignDialog({
      personnelId,
      personnelName: `${firstName} ${lastName}`,
      assignmentId,
    });
  };

  const handleAssignmentChange = () => {
    queryClient.invalidateQueries({ 
      queryKey: ["personnel-with-assets", projectId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ["personnel-project-assignments", "by-project", projectId] 
    });
    setSelectedIds(new Set());
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getReasonLabel = (reason: string | null) => {
    if (!reason) return "Unknown";
    const found = UNASSIGNMENT_REASONS.find(r => r.value === reason);
    return found?.label || reason;
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeIds = personnelData
        .filter(p => p.status === "active")
        .map(p => p.assignmentId);
      setSelectedIds(new Set(activeIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (assignmentId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(assignmentId);
    } else {
      newSelected.delete(assignmentId);
    }
    setSelectedIds(newSelected);
  };

  // Split into active and unassigned
  const activePersonnel = personnelData.filter(p => p.status === "active");
  const unassignedPersonnel = personnelData.filter(p => p.status !== "active");

  const allActiveSelected = activePersonnel.length > 0 && 
    activePersonnel.every(p => selectedIds.has(p.assignmentId));
  const someActiveSelected = activePersonnel.some(p => selectedIds.has(p.assignmentId));

  // Get visible columns
  const visibleColumns = columns.filter(c => c.visible);

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
                  {activePersonnel.length} personnel assigned to this project
                  {showUnassigned && unassignedPersonnel.length > 0 && (
                    <span className="text-muted-foreground"> • {unassignedPersonnel.length} unassigned</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ColumnPicker columns={columns} onColumnsChange={setColumns} />
                <Button 
                  onClick={() => setIsExportDialogOpen(true)} 
                  size="sm"
                  variant="outline"
                  disabled={personnelData.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isMobile ? "Export" : "Export"}
                </Button>
                <Button 
                  onClick={() => setIsBulkSMSDialogOpen(true)} 
                  size="sm"
                  variant="outline"
                  disabled={activePersonnel.length === 0}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isMobile ? "Text All" : "Blast Text"}
                </Button>
                <Button 
                  onClick={() => setIsAssignDialogOpen(true)} 
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
              {/* Show Unassigned Toggle */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-unassigned"
                    checked={showUnassigned}
                    onCheckedChange={setShowUnassigned}
                  />
                  <Label htmlFor="show-unassigned" className="text-sm cursor-pointer flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Show Unassigned History
                  </Label>
                </div>
              </div>

              {/* Selection Toolbar */}
              {selectedIds.size > 0 && (
                <div className="mb-4">
                  <SelectionToolbar
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onExportSelected={() => setIsExportDialogOpen(true)}
                  />
                </div>
              )}

              {activePersonnel.length === 0 && !showUnassigned ? (
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
                  {personnelData.map((person) => {
                    const isUnassigned = person.status !== "active";
                    const isSelected = selectedIds.has(person.assignmentId);
                    
                    return (
                      <div
                        key={person.assignmentId}
                        className={cn(
                          "p-4 rounded-lg border bg-card transition-colors",
                          isUnassigned 
                            ? "opacity-60 bg-muted/30" 
                            : "hover:bg-accent/50",
                          isSelected && "ring-2 ring-primary"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {!isUnassigned && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectRow(person.assignmentId, !!checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <div 
                              className="cursor-pointer"
                              onClick={() => !isUnassigned && navigate(`/personnel/${person.personnelId}`)}
                            >
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
                            </div>
                            <div className="min-w-0 cursor-pointer" onClick={() => !isUnassigned && navigate(`/personnel/${person.personnelId}`)}>
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">
                                  {person.name}
                                </p>
                                {isUnassigned && (
                                  <Badge variant="outline" className="text-xs">
                                    Unassigned
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {person.email}
                              </p>
                              {(person.city || person.state) && (
                                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[person.city, person.state].filter(Boolean).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          {!isUnassigned && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleUnassign(
                                  person.assignmentId,
                                  person.firstName,
                                  person.lastName,
                                  person.personnelId
                                )}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2 text-sm">
                          {person.rateBracket && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {person.rateBracket}
                            </Badge>
                          )}
                          {person.payRate != null && (
                            <span className="text-muted-foreground">
                              Pay: {formatCurrency(person.payRate)}/hr
                            </span>
                          )}
                          {person.billRate != null && (
                            <span className="text-muted-foreground">
                              Bill: {formatCurrency(person.billRate)}/hr
                            </span>
                          )}
                          {isUnassigned && person.unassignedAt ? (
                            <span className="text-muted-foreground ml-auto">
                              Unassigned {format(new Date(person.unassignedAt), "MMM d, yyyy")}
                            </span>
                          ) : (
                            person.assignedAt && (
                              <span className="text-muted-foreground ml-auto">
                                Assigned {format(new Date(person.assignedAt), "MMM d, yyyy")}
                              </span>
                            )
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
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allActiveSelected}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        {visibleColumns.some(c => c.key === "name") && <TableHead>Personnel</TableHead>}
                        {visibleColumns.some(c => c.key === "phone") && <TableHead>Phone</TableHead>}
                        {visibleColumns.some(c => c.key === "city" || c.key === "state") && <TableHead>Location</TableHead>}
                        {visibleColumns.some(c => c.key === "rateBracket") && <TableHead>Rate Bracket</TableHead>}
                        {visibleColumns.some(c => c.key === "payRate") && <TableHead>Pay Rate</TableHead>}
                        {visibleColumns.some(c => c.key === "billRate") && <TableHead>Bill Rate</TableHead>}
                        {visibleColumns.some(c => c.key === "assets") && <TableHead>Assets</TableHead>}
                        {visibleColumns.some(c => c.key === "assignedDate") && <TableHead>Assigned</TableHead>}
                        {showUnassigned && <TableHead>Status</TableHead>}
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personnelData.map((person) => {
                        const isUnassigned = person.status !== "active";
                        const isSelected = selectedIds.has(person.assignmentId);
                        
                        return (
                          <TableRow 
                            key={person.assignmentId}
                            className={cn(
                              isUnassigned 
                                ? "opacity-60 bg-muted/20" 
                                : "cursor-pointer hover:bg-muted/50",
                              isSelected && "bg-primary/5"
                            )}
                            onClick={() => !isUnassigned && navigate(`/personnel/${person.personnelId}`)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {!isUnassigned && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleSelectRow(person.assignmentId, !!checked)}
                                />
                              )}
                            </TableCell>
                            {visibleColumns.some(c => c.key === "name") && (
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
                                    {visibleColumns.some(c => c.key === "email") && (
                                      <p className="text-sm text-muted-foreground">
                                        {person.email}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "phone") && (
                              <TableCell>
                                {person.phone ? (
                                  <span className="text-sm flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {person.phone}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "city" || c.key === "state") && (
                              <TableCell>
                                {(person.city || person.state) ? (
                                  <span className="text-sm">
                                    {[person.city, person.state].filter(Boolean).join(", ")}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "rateBracket") && (
                              <TableCell>
                                {person.rateBracket ? (
                                  <Badge variant="secondary">
                                    {person.rateBracket}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "payRate") && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 group">
                                  <span>
                                    {person.payRate != null 
                                      ? `${formatCurrency(person.payRate)}/hr`
                                      : "—"
                                    }
                                  </span>
                                  {!isUnassigned && (isAdmin || isManager) && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => setEditPayRateDialog({
                                                personnelId: person.personnelId,
                                                personnelName: person.name,
                                                assignmentId: person.assignmentId,
                                                currentRate: person.payRate,
                                              })}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Edit Pay Rate</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => setViewRateHistoryDialog({
                                                personnelId: person.personnelId,
                                                personnelName: person.name,
                                              })}
                                            >
                                              <History className="h-3 w-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>View Rate History</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "billRate") && (
                              <TableCell>
                                {person.billRate != null 
                                  ? `${formatCurrency(person.billRate)}/hr`
                                  : "—"
                                }
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "assets") && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <PersonnelAssetsCell assets={person.assets} />
                              </TableCell>
                            )}
                            {visibleColumns.some(c => c.key === "assignedDate") && (
                              <TableCell>
                                {person.assignedAt 
                                  ? format(new Date(person.assignedAt), "MMM d, yyyy")
                                  : "—"
                                }
                              </TableCell>
                            )}
                            {showUnassigned && (
                              <TableCell>
                                {isUnassigned ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <Badge variant="outline" className="text-xs">
                                            Unassigned
                                          </Badge>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-medium">
                                            {person.unassignedAt && format(new Date(person.unassignedAt), "MMM d, yyyy 'at' h:mm a")}
                                          </p>
                                          <p className="text-sm">
                                            Reason: {getReasonLabel(person.unassignedReason)}
                                          </p>
                                          {person.unassignedNotes && (
                                            <p className="text-sm text-muted-foreground">
                                              {person.unassignedNotes}
                                            </p>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              {!isUnassigned ? (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleUnassign(
                                      person.assignmentId,
                                      person.firstName,
                                      person.lastName,
                                      person.personnelId
                                    )}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
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
        recipients={activePersonnel.map(p => ({
          id: p.personnelId,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
        }))}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        data={personnelData}
        columns={columns}
        selectedIds={selectedIds}
        projectName={projectName}
        isAdmin={isAdmin || isManager}
      />

      {/* Unassign Personnel Dialog */}
      {unassignDialog && (
        <UnassignPersonnelDialog
          open={!!unassignDialog}
          onOpenChange={(open) => !open && setUnassignDialog(null)}
          personnelId={unassignDialog.personnelId}
          personnelName={unassignDialog.personnelName}
          assignmentId={unassignDialog.assignmentId}
          projectId={projectId}
          onComplete={handleAssignmentChange}
        />
      )}

      {/* Edit Pay Rate Dialog */}
      {editPayRateDialog && (
        <EditPayRateDialog
          open={!!editPayRateDialog}
          onOpenChange={(open) => !open && setEditPayRateDialog(null)}
          projectId={projectId}
          personnelId={editPayRateDialog.personnelId}
          personnelName={editPayRateDialog.personnelName}
          assignmentId={editPayRateDialog.assignmentId}
          currentRate={editPayRateDialog.currentRate}
        />
      )}

      {/* View Rate History Dialog */}
      {viewRateHistoryDialog && (
        <ViewRateHistoryDialog
          open={!!viewRateHistoryDialog}
          onOpenChange={(open) => !open && setViewRateHistoryDialog(null)}
          projectId={projectId}
          personnelId={viewRateHistoryDialog.personnelId}
          personnelName={viewRateHistoryDialog.personnelName}
        />
      )}
    </>
  );
}
