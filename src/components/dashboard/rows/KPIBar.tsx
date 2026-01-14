import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface KPIItem {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  href?: string;
}

interface KPIBarProps {
  items: KPIItem[];
  isLoading?: boolean;
}

export function KPIBar({ items, isLoading }: KPIBarProps) {
  return (
    <div className="flex items-stretch divide-x divide-border border border-border rounded-sm bg-card">
      {items.map((item, index) => {
        const Icon = item.icon;
        const content = (
          <div className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors min-w-0">
            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className="text-lg font-bold text-foreground truncate">
                {isLoading ? "..." : item.value}
              </p>
              {item.subtext && (
                <p className="text-xs text-muted-foreground truncate">{item.subtext}</p>
              )}
            </div>
          </div>
        );

        if (item.href) {
          return (
            <Link
              key={index}
              to={item.href}
              className={cn("flex-1 flex", index === 0 && "rounded-l-sm", index === items.length - 1 && "rounded-r-sm")}
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={index} className="flex-1 flex">
            {content}
          </div>
        );
      })}
    </div>
  );
}
