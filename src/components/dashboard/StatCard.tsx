import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-4 sm:p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/20 flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">{title}</p>
      </div>
      <p className="font-heading text-2xl sm:text-3xl font-bold text-foreground truncate">{value}</p>
      {change && (
        <p
          className={cn(
            "mt-2 text-sm font-medium line-clamp-2",
            changeType === "positive" && "text-success",
            changeType === "negative" && "text-destructive",
            changeType === "neutral" && "text-muted-foreground"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
