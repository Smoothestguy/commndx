import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Car, Key, Building, Package, Smartphone, Wrench, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  useUnassignPersonnelFromProject, 
  UNASSIGNMENT_REASONS,
  type UnassignmentReason 
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActiveAsset {
  assignmentId: string;
  assetId: string;
  type: string;
  label: string;
  address: string | null;
}

type AssetDisposition = "return_to_pool" | "returned_released" | "not_returned";

interface AssetDispositionChoice {
  disposition: AssetDisposition;
  notes?: string;
}

interface UnassignPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  personnelName: string;
  assignmentId: string;
  projectId: string;
  onComplete?: () => void;
}

const getAssetIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "vehicle":
      return Car;
    case "key":
      return Key;
    case "location":
    case "hotel room":
      return Building;
    case "equipment":
    case "tool":
      return Wrench;
    case "badge":
      return Package;
    case "device":
      return Smartphone;
    default:
      return HelpCircle;
  }
};

const formatAssetType = (type: string) => {
  return type
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export function UnassignPersonnelDialog({
  open,
  onOpenChange,
  personnelId,
  personnelName,
  assignmentId,
  projectId,
  onComplete,
}: UnassignPersonnelDialogProps) {
  const queryClient = useQueryClient();
  const unassignMutation = useUnassignPersonnelFromProject();
  
  const [reason, setReason] = useState<UnassignmentReason | "">("");
  const [notes, setNotes] = useState("");
  const [activeAssets, setActiveAssets] = useState<ActiveAsset[]>([]);
  const [assetDispositions, setAssetDispositions] = useState<Record<string, AssetDispositionChoice>>({});
  const [assetNotes, setAssetNotes] = useState<Record<string, string>>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch active assets for this personnel on this project
  useEffect(() => {
    if (!open || !personnelId || !projectId) {
      setActiveAssets([]);
      setAssetDispositions({});
      setAssetNotes({});
      setReason("");
      setNotes("");
      return;
    }

    async function fetchActiveAssets() {
      setIsLoadingAssets(true);
      try {
        const { data, error } = await supabase
          .from("asset_assignments")
          .select(`
            id,
            asset_id,
            assets (
              id,
              type,
              label,
              address
            )
          `)
          .eq("project_id", projectId)
          .eq("assigned_to_personnel_id", personnelId)
          .eq("status", "active")
          .is("unassigned_at", null);

        if (error) throw error;

        const assets: ActiveAsset[] = (data || []).map((aa: any) => ({
          assignmentId: aa.id,
          assetId: aa.asset_id,
          type: aa.assets?.type || "unknown",
          label: aa.assets?.label || "Unknown Asset",
          address: aa.assets?.address,
        }));

        setActiveAssets(assets);
        
        // Initialize dispositions as empty (forces user to select)
        const initialDispositions: Record<string, AssetDispositionChoice> = {};
        assets.forEach(asset => {
          initialDispositions[asset.assignmentId] = { disposition: "" as AssetDisposition };
        });
        setAssetDispositions(initialDispositions);
      } catch (error) {
        console.error("Failed to fetch active assets:", error);
        toast.error("Failed to load assets");
      } finally {
        setIsLoadingAssets(false);
      }
    }

    fetchActiveAssets();
  }, [open, personnelId, projectId]);

  const handleDispositionChange = (assignmentId: string, disposition: AssetDisposition) => {
    setAssetDispositions(prev => ({
      ...prev,
      [assignmentId]: { disposition },
    }));
  };

  const handleAssetNotesChange = (assignmentId: string, notesValue: string) => {
    setAssetNotes(prev => ({
      ...prev,
      [assignmentId]: notesValue,
    }));
  };

  const allAssetsHaveDisposition = activeAssets.every(
    asset => assetDispositions[asset.assignmentId]?.disposition
  );

  const notReturnedAssetsMissingNotes = activeAssets.some(
    asset => 
      assetDispositions[asset.assignmentId]?.disposition === "not_returned" &&
      !assetNotes[asset.assignmentId]?.trim()
  );

  const canSubmit = 
    reason && 
    (activeAssets.length === 0 || (allAssetsHaveDisposition && !notReturnedAssetsMissingNotes));

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Process each asset disposition
      for (const asset of activeAssets) {
        const disposition = assetDispositions[asset.assignmentId]?.disposition;
        const assetNote = assetNotes[asset.assignmentId] || null;

        if (disposition === "return_to_pool") {
          // Close current assignment and create new project-level assignment
          await supabase
            .from("asset_assignments")
            .update({
              status: "transferred",
              unassigned_at: new Date().toISOString(),
              unassigned_by: user?.id || null,
              unassigned_reason: "transfer_to_project",
              unassigned_notes: assetNote,
            })
            .eq("id", asset.assignmentId);

          // Create new assignment without personnel (project pool)
          await supabase
            .from("asset_assignments")
            .insert({
              project_id: projectId,
              asset_id: asset.assetId,
              assigned_to_personnel_id: null,
              assigned_by: user?.id || null,
              start_at: new Date().toISOString(),
              notes: `Transferred from ${personnelName}`,
            });

        } else if (disposition === "returned_released") {
          // Mark as returned
          await supabase
            .from("asset_assignments")
            .update({
              status: "returned",
              unassigned_at: new Date().toISOString(),
              unassigned_by: user?.id || null,
              unassigned_reason: "returned_or_released",
              unassigned_notes: assetNote,
            })
            .eq("id", asset.assignmentId);

          // Update asset status to available
          await supabase
            .from("assets")
            .update({ status: "available" })
            .eq("id", asset.assetId);

        } else if (disposition === "not_returned") {
          // Mark as not returned (issue)
          await supabase
            .from("asset_assignments")
            .update({
              status: "returned", // Still close the assignment
              unassigned_at: new Date().toISOString(),
              unassigned_by: user?.id || null,
              unassigned_reason: "not_returned",
              unassigned_notes: assetNote,
            })
            .eq("id", asset.assignmentId);

          // Mark asset as maintenance/issue status
          await supabase
            .from("assets")
            .update({ status: "maintenance" })
            .eq("id", asset.assetId);
        }
      }

      // Now unassign the personnel
      await unassignMutation.mutateAsync({
        assignmentId,
        reason: reason as UnassignmentReason,
        notes: notes || undefined,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-with-assets"] });

      toast.success(`${personnelName} has been unassigned`);
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      console.error("Failed to unassign personnel:", error);
      toast.error("Failed to unassign personnel");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Unassign Personnel</DialogTitle>
          <DialogDescription>
            Unassign <strong>{personnelName}</strong> from this project.
            This will preserve their history and time entries.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Reason Selection */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Unassignment *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as UnassignmentReason)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {UNASSIGNMENT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details about the unassignment..."
                rows={2}
              />
            </div>

            {/* Asset Disposition Section */}
            {isLoadingAssets ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading assets...</span>
              </div>
            ) : activeAssets.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h4 className="font-medium">Asset Disposition Required</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {personnelName} has {activeAssets.length} active asset(s). 
                    Please specify what happens to each asset.
                  </p>

                  <div className="space-y-4">
                    {activeAssets.map((asset) => {
                      const Icon = getAssetIcon(asset.type);
                      const currentDisposition = assetDispositions[asset.assignmentId]?.disposition;
                      const needsNotes = currentDisposition === "not_returned";

                      return (
                        <div key={asset.assignmentId} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="font-medium">{formatAssetType(asset.type)}:</span>
                            <span>{asset.label}</span>
                          </div>
                          {asset.address && (
                            <p className="text-xs text-muted-foreground pl-6">{asset.address}</p>
                          )}

                          <RadioGroup
                            value={currentDisposition || ""}
                            onValueChange={(v) => handleDispositionChange(asset.assignmentId, v as AssetDisposition)}
                            className="space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="return_to_pool" id={`${asset.assignmentId}-pool`} />
                              <Label htmlFor={`${asset.assignmentId}-pool`} className="font-normal cursor-pointer">
                                Return to Project Pool
                                <span className="text-xs text-muted-foreground ml-1">(stays on project, not tied to person)</span>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="returned_released" id={`${asset.assignmentId}-returned`} />
                              <Label htmlFor={`${asset.assignmentId}-returned`} className="font-normal cursor-pointer">
                                Mark Returned / Released
                                <span className="text-xs text-muted-foreground ml-1">(asset leaves the project)</span>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="not_returned" id={`${asset.assignmentId}-missing`} />
                              <Label htmlFor={`${asset.assignmentId}-missing`} className="font-normal cursor-pointer text-destructive">
                                Mark Not Returned (Issue)
                                <span className="text-xs text-muted-foreground ml-1">(missing or taken)</span>
                              </Label>
                            </div>
                          </RadioGroup>

                          {needsNotes && (
                            <div className="space-y-1 pl-6">
                              <Label className="text-xs">
                                Please provide details about this issue *
                              </Label>
                              <Textarea
                                value={assetNotes[asset.assignmentId] || ""}
                                onChange={(e) => handleAssetNotesChange(asset.assignmentId, e.target.value)}
                                placeholder="What happened to this asset?"
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isProcessing}
            variant="destructive"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Unassign Personnel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
