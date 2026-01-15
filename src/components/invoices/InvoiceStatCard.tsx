import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIDensity } from "@/contexts/UIDensityContext";

interface InvoiceStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  isActive?: boolean;
  onClick: () => void;
  variant?: "default" | "success" | "warning" | "danger";
}

export const InvoiceStatCard = ({
  label,
  value,
  icon: Icon,
  isActive = false,
  onClick,
  variant = "default",
}: InvoiceStatCardProps) => {
  const { isSpreadsheetMode } = useUIDensity();
  
  const variantStyles = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  if (isSpreadsheetMode) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-between gap-2 px-2 py-1 border bg-card text-card-foreground transition-colors cursor-pointer text-left w-full text-xs",
          isActive
            ? "ring-1 ring-primary border-primary bg-primary/5"
            : "border-border hover:bg-muted/50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3 w-3", variantStyles[variant])} />
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className="font-semibold">{value}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 p-3 sm:p-4 rounded-lg border bg-card text-card-foreground transition-all duration-200 cursor-pointer hover:shadow-md text-left w-full min-w-0 overflow-hidden",
        isActive
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", variantStyles[variant])} />
        <span className="text-xs sm:text-sm text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{value}</span>
    </button>
  );
};
