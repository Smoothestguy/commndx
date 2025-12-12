import { Package, Wrench, HardHat, DollarSign } from "lucide-react";
import { Product, ItemType } from "@/integrations/supabase/hooks/useProducts";
import { cn } from "@/lib/utils";

interface ProductStatsProps {
  products: Product[];
  selectedType?: ItemType | "";
  onTypeClick?: (type: ItemType | "") => void;
}

export function ProductStats({ products, selectedType, onTypeClick }: ProductStatsProps) {
  const productCount = products.filter((p) => p.item_type === "product").length;
  const serviceCount = products.filter((p) => p.item_type === "service").length;
  const laborCount = products.filter((p) => p.item_type === "labor").length;
  const highestPrice =
    products.length > 0 ? Math.max(...products.map((p) => p.price)) : 0;

  const stats = [
    {
      label: "Products",
      value: productCount,
      icon: Package,
      color: "text-blue-500",
      filterType: "product" as ItemType,
    },
    {
      label: "Services",
      value: serviceCount,
      icon: Wrench,
      color: "text-purple-500",
      filterType: "service" as ItemType,
    },
    {
      label: "Labor",
      value: laborCount,
      icon: HardHat,
      color: "text-orange-500",
      filterType: "labor" as ItemType,
    },
    {
      label: "Highest Price",
      value: `$${highestPrice.toLocaleString()}`,
      icon: DollarSign,
      color: "text-success",
      filterType: null as ItemType | null,
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const isClickable = stat.filterType !== null;
        const isSelected = selectedType === stat.filterType;
        
        return (
          <div
            key={stat.label}
            className={cn(
              "glass rounded-lg p-3 sm:p-4 animate-fade-in transition-all",
              isClickable && "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
              isSelected && "ring-2 ring-primary border-primary bg-primary/5"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => {
              if (isClickable && onTypeClick) {
                onTypeClick(isSelected ? "" : stat.filterType!);
              }
            }}
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {stat.label}
              </p>
              <Icon
                className={cn("h-3 w-3 sm:h-4 sm:w-4 shrink-0", stat.color)}
              />
            </div>
            <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
