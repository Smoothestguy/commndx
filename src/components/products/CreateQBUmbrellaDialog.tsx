import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateQBProductMapping } from "@/integrations/supabase/hooks/useQBProductMappings";

interface CreateQBUmbrellaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, name: string, type: string) => void;
}

export const CreateQBUmbrellaDialog = ({
  open,
  onOpenChange,
  onCreated,
}: CreateQBUmbrellaDialogProps) => {
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState("Service");
  const createMapping = useCreateQBProductMapping();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createMapping.mutateAsync({
      name: name.trim(),
      quickbooks_item_type: itemType,
    });

    onCreated(result.id, result.name, result.quickbooks_item_type || itemType);
    setName("");
    setItemType("Service");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Create QB Umbrella Category
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="umbrella-name">Name *</Label>
            <Input
              id="umbrella-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Subcontract Labor - Flooring"
              required
              autoFocus
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="umbrella-type">Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="NonInventory">Non-Inventory Product</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="glow"
              disabled={!name.trim() || createMapping.isPending}
            >
              {createMapping.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
