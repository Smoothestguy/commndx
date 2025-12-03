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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useResolveProductConflict } from "@/integrations/supabase/hooks/useQuickBooks";
import { AlertTriangle, DollarSign } from "lucide-react";

interface ProductConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: {
    product_id: string;
    products: {
      id: string;
      name: string;
      price: number;
      sku: string | null;
    };
    conflict_data: {
      commandx_price: number;
      quickbooks_price: number;
      quickbooks_name: string;
    };
  } | null;
}

export const ProductConflictDialog = ({
  open,
  onOpenChange,
  conflict,
}: ProductConflictDialogProps) => {
  const [resolution, setResolution] = useState<'use_commandx' | 'use_quickbooks' | 'custom'>('use_commandx');
  const [customPrice, setCustomPrice] = useState('');
  const resolveConflict = useResolveProductConflict();

  if (!conflict) return null;

  const { products: product, conflict_data } = conflict;

  const handleResolve = () => {
    resolveConflict.mutate({
      productId: product.id,
      resolution,
      newPrice: resolution === 'custom' ? parseFloat(customPrice) : undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setResolution('use_commandx');
        setCustomPrice('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Price Conflict
          </DialogTitle>
          <DialogDescription>
            Product "{product.name}" has different prices in CommandX and QuickBooks. Choose how to resolve this conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">CommandX Price</p>
              <p className="text-2xl font-bold text-primary">
                ${conflict_data.commandx_price?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">QuickBooks Price</p>
              <p className="text-2xl font-bold text-blue-600">
                ${conflict_data.quickbooks_price?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>

          <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="use_commandx" id="use_commandx" />
              <Label htmlFor="use_commandx" className="flex-1 cursor-pointer">
                Use CommandX price (${conflict_data.commandx_price?.toFixed(2)})
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="use_quickbooks" id="use_quickbooks" />
              <Label htmlFor="use_quickbooks" className="flex-1 cursor-pointer">
                Use QuickBooks price (${conflict_data.quickbooks_price?.toFixed(2)})
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="flex-1 cursor-pointer">
                Enter custom price
              </Label>
            </div>
          </RadioGroup>

          {resolution === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customPrice">Custom Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolve}
            disabled={resolveConflict.isPending || (resolution === 'custom' && !customPrice)}
          >
            {resolveConflict.isPending ? "Resolving..." : "Resolve Conflict"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
