import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Layers } from "lucide-react";
import { useQBProductMappings } from "@/integrations/supabase/hooks/useQBProductMappings";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

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
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const matchingProducts = useMemo(() => {
    if (!selectedUmbrellaId) return [];
    return products.filter((p) => (p as any).qb_product_mapping_id === selectedUmbrellaId);
  }, [selectedUmbrellaId, products]);

  const selectedUmbrella = umbrellas.find((u) => u.id === selectedUmbrellaId);

  const handleSelectCategory = (umbrellaId: string) => {
    const matching = products.filter((p) => (p as any).qb_product_mapping_id === umbrellaId);
    if (matching.length === 0) {
      toast.info("No products found under this category");
      return;
    }
    setSelectedUmbrellaId(umbrellaId);
    setSelectedProductIds(new Set(matching.map((p) => p.id)));
  };

  const handleBack = () => {
    setSelectedUmbrellaId(null);
    setSelectedProductIds(new Set());
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const allSelected = matchingProducts.length > 0 && matchingProducts.every((p) => selectedProductIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(matchingProducts.map((p) => p.id)));
    }
  };

  const handleAddSelected = () => {
    const selected = matchingProducts.filter((p) => selectedProductIds.has(p.id));
    if (selected.length === 0) {
      toast.info("No items selected");
      return;
    }
    const items: BulkLineItem[] = selected.map((p) => ({
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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedUmbrellaId(null);
      setSelectedProductIds(new Set());
    }
  };

  if (umbrellas.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="default" className="text-sm">
          <Layers className="h-4 w-4 mr-2" />
          Add by Category
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {!selectedUmbrellaId ? (
          <>
            <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
              Select a category to choose items
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {umbrellas.map((u) => {
                const count = products.filter((p) => (p as any).qb_product_mapping_id === u.id).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => handleSelectCategory(u.id)}
                  >
                    <span className="truncate">{u.name}</span>
                    <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2 pb-2">
              <button
                type="button"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium truncate">{selectedUmbrella?.name}</span>
              <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                {matchingProducts.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-xs font-medium cursor-pointer select-none">
                Select All
              </label>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {matchingProducts.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={selectedProductIds.has(p.id)}
                    onCheckedChange={() => toggleProduct(p.id)}
                  />
                  <span className="text-sm truncate flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatCurrency(priceField === "cost" ? p.cost : p.price)}
                  </span>
                </label>
              ))}
            </div>

            <div className="pt-2 px-1">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={selectedProductIds.size === 0}
                onClick={handleAddSelected}
              >
                Add {selectedProductIds.size} Selected
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
