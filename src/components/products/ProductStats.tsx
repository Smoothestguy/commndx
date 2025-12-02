import { Package, Wrench, HardHat, DollarSign } from "lucide-react";
import { Product } from "@/integrations/supabase/hooks/useProducts";

interface ProductStatsProps {
  products: Product[];
}

export function ProductStats({ products }: ProductStatsProps) {
  const productCount = products.filter((p) => p.item_type === "product").length;
  const serviceCount = products.filter((p) => p.item_type === "service").length;
  const laborCount = products.filter((p) => p.item_type === "labor").length;
  const highestPrice = products.length > 0
    ? Math.max(...products.map((p) => p.price))
    : 0;

  const stats = [
    {
      label: "Products",
      value: productCount,
      icon: Package,
      color: "text-blue-500",
    },
    {
      label: "Services",
      value: serviceCount,
      icon: Wrench,
      color: "text-purple-500",
    },
    {
      label: "Labor",
      value: laborCount,
      icon: HardHat,
      color: "text-orange-500",
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
