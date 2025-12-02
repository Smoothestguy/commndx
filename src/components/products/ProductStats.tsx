import { Package, Tag, TrendingUp, DollarSign } from "lucide-react";
import { Product } from "@/integrations/supabase/hooks/useProducts";

interface ProductStatsProps {
  products: Product[];
}

export function ProductStats({ products }: ProductStatsProps) {
  const totalProducts = products.length;
  const uniqueCategories = new Set(products.map((p) => p.category)).size;
  const avgMarkup = products.length > 0 
    ? (products.reduce((sum, p) => sum + p.markup, 0) / products.length).toFixed(1)
    : "0";
  const highestPrice = products.length > 0
    ? Math.max(...products.map((p) => p.price))
    : 0;

  const stats = [
    {
      label: "Total Products",
      value: totalProducts,
      icon: Package,
      color: "text-primary",
    },
    {
      label: "Categories",
      value: uniqueCategories,
      icon: Tag,
      color: "text-primary",
    },
    {
      label: "Avg Markup",
      value: `${avgMarkup}%`,
      icon: TrendingUp,
      color: "text-warning",
    },
    {
      label: "Highest Price",
      value: `$${highestPrice.toLocaleString()}`,
      icon: DollarSign,
      color: "text-success",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="glass rounded-lg p-4 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-heading font-bold text-foreground">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
