import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface VendorBillStatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick?: () => void;
  variant?: "default" | "success" | "warning" | "danger";
}

export function VendorBillStatCard({
  label,
  value,
  subValue,
  icon: Icon,
  isActive = false,
  onClick,
  variant = "default",
}: VendorBillStatCardProps) {
  const variantStyles = {
    default: {
      icon: "text-primary",
      activeBorder: "ring-primary/50",
    },
    success: {
      icon: "text-green-500",
      activeBorder: "ring-green-500/50",
    },
    warning: {
      icon: "text-amber-500",
      activeBorder: "ring-amber-500/50",
    },
    danger: {
      icon: "text-red-500",
      activeBorder: "ring-red-500/50",
    },
  };

  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "p-3 sm:p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:border-primary/30",
        isActive && `ring-2 ${styles.activeBorder} bg-accent/50`
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold truncate">{value}</p>
          {subValue && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{subValue}</p>
          )}
        </div>
        <div className={cn("p-2 rounded-full bg-muted shrink-0", styles.icon)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </Card>
  );
}
