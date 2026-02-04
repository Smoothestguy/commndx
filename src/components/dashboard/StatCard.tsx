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
  spreadsheet?: boolean;
  backgroundColor?: string;
  textColor?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  href,
  compact = false,
  spreadsheet = false,
  backgroundColor,
  textColor,
}: StatCardProps) {
  // Spreadsheet mode: ultra-dense single-line display
  if (spreadsheet) {
    const spreadsheetContent = (
      <div className="flex items-center justify-between py-1 px-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground truncate">{title}</span>
        </div>
        <span className="font-bold font-mono">{value}</span>
      </div>
    );

    const spreadsheetClasses = "bg-card border-b border-border hover:bg-muted/50 transition-colors";

    if (href) {
      return (
        <Link to={href} className={spreadsheetClasses} style={{ backgroundColor, color: textColor }}>
          {spreadsheetContent}
        </Link>
      );
    }

    return <div className={spreadsheetClasses} style={{ backgroundColor, color: textColor }}>{spreadsheetContent}</div>;
  }

  const cardContent = compact ? (
    <>
      <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1 min-w-0">
        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded bg-primary/10 flex-shrink-0">
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
        </div>
        <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate min-w-0">{title}</p>
      </div>
      <p className="font-heading text-base sm:text-lg font-bold text-foreground truncate">{value}</p>
    </>
  ) : (
    <>
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 transition-all duration-200 group-hover:bg-primary/15 flex-shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2 min-w-0 flex-1">{title}</p>
      </div>
      <p className="font-heading text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground break-words">
        {value}
      </p>
      {change && (
        <p
          className={cn(
            "mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium line-clamp-2",
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
    "bg-card rounded-lg border border-border shadow-sm transition-all duration-200 hover:shadow-md group block min-w-0 overflow-hidden",
    compact ? "p-1.5 sm:p-2" : "p-4 sm:p-5",
    href && "cursor-pointer hover:border-primary/50"
  );

  const cardStyle = {
    backgroundColor,
    color: textColor,
  };

  if (href) {
    return (
      <Link to={href} className={cardClasses} style={cardStyle}>
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClasses} style={cardStyle}>{cardContent}</div>;
}
