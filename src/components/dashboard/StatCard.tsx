import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  href?: string;
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  href,
  compact = false,
}: StatCardProps) {
  const cardContent = compact ? (
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-[10px] font-medium text-muted-foreground truncate">{title}</p>
      </div>
      <p className="font-heading text-lg font-bold text-foreground">{value}</p>
    </>
  ) : (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-glow flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      </div>
      <p className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
        {value}
      </p>
      {change && (
        <p
          className={cn(
            "mt-2 text-sm font-medium",
            changeType === "positive" && "text-success",
            changeType === "negative" && "text-destructive",
            changeType === "neutral" && "text-muted-foreground"
          )}
        >
          {change}
        </p>
      )}
    </>
  );

  const cardClasses = cn(
    "rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-floating transition-all duration-300 group block",
    "hover:shadow-elevated hover:border-primary/30 hover:-translate-y-1",
    compact ? "p-3" : "p-5",
    href && "cursor-pointer"
  );

  if (href) {
    return (
      <Link to={href} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClasses}>{cardContent}</div>;
}