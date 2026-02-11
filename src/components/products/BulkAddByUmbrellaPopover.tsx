import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { useQBProductMappings } from "@/integrations/supabase/hooks/useQBProductMappings";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useState } from "react";
import { toast } from "sonner";

export interface BulkLineItem {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface BulkAddByUmbrellaPopoverProps {
  onAddItems: (items: BulkLineItem[]) => void;
  /** Use "cost" for vendor-facing forms (PO, vendor bills), "price" for customer-facing */
  priceField?: "price" | "cost";
}

export function BulkAddByUmbrellaPopover({ onAddItems, priceField = "price" }: BulkAddByUmbrellaPopoverProps) {
  const { data: umbrellas = [] } = useQBProductMappings();
  const { data: products = [] } = useProducts();
  const [open, setOpen] = useState(false);

  const handleSelect = (umbrellaId: string) => {
    const matching = products.filter((p) => (p as any).qb_product_mapping_id === umbrellaId);

    if (matching.length === 0) {
      toast.info("No products found under this category");
      return;
    }

    const items: BulkLineItem[] = matching.map((p) => ({
      id: crypto.randomUUID(),
      product_id: p.id,
      description: p.name,
      quantity: 1,
      unit_price: priceField === "cost" ? p.cost : p.price,
    }));

    onAddItems(items);
    setOpen(false);
    toast.success(`Added ${items.length} item${items.length > 1 ? "s" : ""}`);
  };

  if (umbrellas.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="default" className="text-sm">
          <Layers className="h-4 w-4 mr-2" />
          Add by Category
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
          Select a category to add all its items
        </p>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {umbrellas.map((u) => {
            const count = products.filter((p) => (p as any).qb_product_mapping_id === u.id).length;
            return (
              <button
                key={u.id}
                type="button"
                className="w-full flex items-center justify-between px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                onClick={() => handleSelect(u.id)}
              >
                <span className="truncate">{u.name}</span>
                <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
