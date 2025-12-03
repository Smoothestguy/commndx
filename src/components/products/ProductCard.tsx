import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Package, Wrench, HardHat } from "lucide-react";
import { Product, ItemType } from "@/integrations/supabase/hooks/useProducts";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  index: number;
  selectable?: boolean;
  isSelected?: boolean;
  onSelectChange?: (id: string, checked: boolean) => void;
}

const typeConfig: Record<ItemType, { icon: typeof Package; label: string; className: string }> = {
  product: {
    icon: Package,
    label: "Product",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  service: {
    icon: Wrench,
    label: "Service",
    className: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  labor: {
    icon: HardHat,
    label: "Labor",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
};

export function ProductCard({ product, onEdit, onDelete, index, selectable, isSelected, onSelectChange }: ProductCardProps) {
  const config = typeConfig[product.item_type] || typeConfig.product;
  const TypeIcon = config.icon;

  return (
    <div
      className={cn(
        "glass rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-l-4 border-primary/60 animate-fade-in min-h-[160px] flex flex-col justify-between",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectChange?.(product.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0"
              />
            )}
            <TypeIcon className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="font-heading font-semibold text-lg text-foreground truncate">
              {product.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Category & SKU */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {product.category}
          </span>
          {product.sku && (
            <span className="text-xs text-muted-foreground">
              SKU: {product.sku}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Pricing Info */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-sm font-semibold text-foreground">
              ${product.cost.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Markup</p>
            <p className="text-sm font-semibold text-warning">
              {product.markup}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-base font-bold text-primary">
              ${product.price.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Unit */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="capitalize">{product.unit}</span>
          {!product.is_taxable && (
            <span className="text-xs px-2 py-0.5 bg-muted rounded">Non-taxable</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(product);
          }}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(product.id);
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}
