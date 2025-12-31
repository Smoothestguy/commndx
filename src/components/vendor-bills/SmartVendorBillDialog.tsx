import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useSmartProjectForVendor } from "@/integrations/supabase/hooks/useVendorPersonnelData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SmartVendorBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmartVendorBillDialog({ open, onOpenChange }: SmartVendorBillDialogProps) {
  const navigate = useNavigate();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const { data: vendors } = useVendors();
  const { data: projectSuggestion, isLoading: suggestionLoading } = useSmartProjectForVendor(selectedVendorId || undefined);

  const activeVendors = vendors?.filter(v => v.status === "active") || [];
  const selectedVendor = vendors?.find(v => v.id === selectedVendorId);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedVendorId("");
    }
  }, [open]);

  const handleProceed = () => {
    const params = new URLSearchParams();
    if (selectedVendorId) {
      params.set("vendor_id", selectedVendorId);
    }
    if (projectSuggestion?.project_id) {
      params.set("project_id", projectSuggestion.project_id);
    }
    
    onOpenChange(false);
    navigate(`/vendor-bills/new?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Smart Bill Creation
          </DialogTitle>
          <DialogDescription>
            Select a vendor and we'll suggest the best project based on personnel assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Select Vendor</Label>
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a vendor..." />
              </SelectTrigger>
              <SelectContent>
                {activeVendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVendorId && (
            <div className="space-y-2">
              <Label>Suggested Project</Label>
              {suggestionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding best project...
                </div>
              ) : projectSuggestion ? (
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="font-medium">{projectSuggestion.project_name}</p>
                  <Badge variant="outline" className="text-xs">
                    {projectSuggestion.reason}
                  </Badge>
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  No project suggestion available. You can select manually.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleProceed} disabled={!selectedVendorId}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Create Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
