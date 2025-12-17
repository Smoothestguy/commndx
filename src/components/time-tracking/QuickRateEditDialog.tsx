import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickRateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  personnelName: string;
  currentRate: number;
}

export function QuickRateEditDialog({
  open,
  onOpenChange,
  personnelId,
  personnelName,
  currentRate,
}: QuickRateEditDialogProps) {
  const [rate, setRate] = useState(currentRate.toString());
  const queryClient = useQueryClient();

  const updateRate = useMutation({
    mutationFn: async (newRate: number) => {
      const { error } = await supabase
        .from("personnel")
        .update({ hourly_rate: newRate })
        .eq("id", personnelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.success("Hourly rate updated");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to update rate");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRate = parseFloat(rate);
    if (isNaN(newRate) || newRate < 0) {
      toast.error("Please enter a valid rate");
      return;
    }
    updateRate.mutate(newRate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Hourly Rate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              {personnelName}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Hourly Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRate.isPending}>
              {updateRate.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
