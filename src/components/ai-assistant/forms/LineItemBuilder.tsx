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
      
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex gap-2 items-start p-2 bg-background/50 rounded-lg border border-border/50"
          >
            <div className="flex-1 space-y-2">
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
                <SelectTrigger className="h-8 text-xs">
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

              {!item.product_id && (
                <Input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(item.id, "description", e.target.value)
                  }
                  placeholder="Description"
                  className="h-8 text-xs"
                />
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Price</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="w-16 text-right pt-4">
                  <span className="text-xs font-medium">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={addItem}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Item
      </Button>

      <div className="flex justify-between items-center pt-2 border-t border-border/50">
        <span className="text-xs font-medium text-muted-foreground">Subtotal</span>
        <span className="text-sm font-semibold">${subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
