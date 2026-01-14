import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Receipt, Users, FolderOpen, Clock, Briefcase } from "lucide-react";
import { DashboardWidget, DashboardTheme } from "./types";
import { cn } from "@/lib/utils";

interface QuickActionsWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

const QUICK_ACTIONS = [
  { label: "New Estimate", href: "/estimates/new", icon: Receipt },
  { label: "New Invoice", href: "/invoices/new", icon: FileText },
  { label: "New Project", href: "/projects/new", icon: FolderOpen },
  { label: "New Customer", href: "/customers/new", icon: Briefcase },
  { label: "Log Time", href: "/time-tracking", icon: Clock },
  { label: "Add Personnel", href: "/personnel?action=add", icon: Users },
];

export function QuickActionsWidget({ widget, theme, isEditMode }: QuickActionsWidgetProps) {
  return (
    <div className={cn(
      "grid gap-2",
      // Mobile: 2 columns, Tablet: 3 columns, Desktop: flex wrap
      "grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap"
    )}>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            variant="outline"
            size="sm"
            asChild
            disabled={isEditMode}
            className={cn(
              // Responsive text sizes
              "text-[10px] sm:text-xs lg:text-sm",
              // Responsive padding
              "px-2 sm:px-3",
              // Ensure proper height for touch
              "h-8 sm:h-9",
              // Truncate text on small screens
              "justify-start"
            )}
            style={{
              borderColor: theme?.accentColor,
              color: theme?.accentColor,
            }}
          >
            <Link to={action.href} className="flex items-center min-w-0">
              <Plus className="h-3 w-3 mr-1 flex-shrink-0 hidden sm:block" />
              <Icon className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{action.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
