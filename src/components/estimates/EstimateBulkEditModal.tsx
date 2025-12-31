import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, XCircle } from "lucide-react";

interface EstimateBulkEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onApply: (updates: { status?: "draft" | "pending" | "approved" | "sent" | "closed" }) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "closed", label: "Closed" },
];

export function EstimateBulkEditModal({
  open,
  onOpenChange,
  selectedCount,
  onApply,
  onClose,
  isLoading = false,
}: EstimateBulkEditModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const handleApply = () => {
    if (selectedStatus) {
      onApply({ status: selectedStatus as "draft" | "pending" | "approved" | "sent" | "closed" });
    }
  };

  const handleClose = () => {
    onClose();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedCount} Estimate{selectedCount !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Apply changes to all selected estimates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Change Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select new status..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleClose}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Close Selected Estimates
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Closed estimates will be hidden from the default view
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selectedStatus || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
