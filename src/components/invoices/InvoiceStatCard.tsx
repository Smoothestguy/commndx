import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const variantStyles = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 p-4 rounded-lg border bg-card text-card-foreground transition-all duration-200 cursor-pointer hover:shadow-md text-left w-full",
        isActive
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", variantStyles[variant])} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </button>
  );
};
