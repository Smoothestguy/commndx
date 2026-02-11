import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts, Product } from "@/integrations/supabase/hooks/useProducts";
import { cn } from "@/lib/utils";
import { BulkAddByUmbrellaPopover, BulkLineItem } from "@/components/products/BulkAddByUmbrellaPopover";

export interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface LineItemBuilderProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  className?: string;
}

export function LineItemBuilder({ items, onChange, className }: LineItemBuilderProps) {
  const { data: products = [] } = useProducts();

  const addItem = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      onChange(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const selectProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      onChange(
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                product_id: productId,
                description: product.name,
                unit_price: product.price,
              }
            : item
        )
      );
    }
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  // Group products by type
  const groupedProducts = products.reduce((acc, product) => {
    const type = product.item_type || "product";
    if (!acc[type]) acc[type] = [];
    acc[type].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Line Items
      </div>
      
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-3"
          >
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Select
                  value={item.product_id || ""}
                  onValueChange={(value) => {
                    if (value === "_manual_") {
                      updateItem(item.id, "product_id", "");
                    } else {
                      selectProduct(item.id, value);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select or type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_manual_">
                      <span className="text-muted-foreground">Manual entry</span>
                    </SelectItem>
                    {Object.entries(groupedProducts).map(([type, prods]) => (
                      <React.Fragment key={type}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          {type}s
                        </div>
                        {prods.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} — ${product.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {!item.product_id && (
              <Input
                value={item.description}
                onChange={(e) =>
                  updateItem(item.id, "description", e.target.value)
                }
                placeholder="Description"
                className="h-10 text-sm"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)
                  }
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unit_price}
                  onChange={(e) =>
                    updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)
                  }
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="text-right pt-1 border-t border-border/30">
              <span className="text-sm font-medium">
                Line Total: ${(item.quantity * item.unit_price).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="default"
          className="flex-1 h-11 text-sm"
          onClick={addItem}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
        <BulkAddByUmbrellaPopover
          onAddItems={(bulkItems) => {
            const newItems: LineItem[] = bulkItems.map((bi) => ({
              id: bi.id,
              product_id: bi.product_id,
              description: bi.description,
              quantity: bi.quantity,
              unit_price: bi.unit_price,
            }));
            onChange([...items, ...newItems]);
          }}
        />
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-border/50">
        <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
        <span className="text-base font-semibold">${subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
