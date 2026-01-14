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

    const spreadsheetClasses = "bg-transparent border-b border-border/30 hover:bg-muted/30 transition-colors";

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
      <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary/10 flex-shrink-0">
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
        </div>
        <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate min-w-0">{title}</p>
      </div>
      <p className="font-heading text-base sm:text-lg font-bold text-foreground truncate">{value}</p>
    </>
  ) : (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10 flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground truncate min-w-0 flex-1">{title}</p>
      </div>
      <p className="font-heading text-lg sm:text-xl font-semibold text-foreground truncate">
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
    "bg-card/60 rounded-md transition-colors group block min-w-0 overflow-hidden hover:bg-card/90",
    compact ? "p-1.5 sm:p-2" : "p-3 sm:p-4",
    href && "cursor-pointer"
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
