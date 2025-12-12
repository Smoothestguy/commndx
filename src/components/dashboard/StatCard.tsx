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
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  href,
}: StatCardProps) {
  const cardContent = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-all duration-200 group-hover:bg-primary/15 flex-shrink-0">
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
    "bg-card rounded-lg border border-border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md group block",
    href && "cursor-pointer hover:border-primary/50"
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
