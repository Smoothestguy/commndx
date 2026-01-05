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
  { label: "Add Personnel", href: "/personnel/new", icon: Users },
];

export function QuickActionsWidget({ widget, theme, isEditMode }: QuickActionsWidgetProps) {
  const fontSizeClass = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }[theme?.fontSize ?? "medium"];

  const spacingClass = {
    compact: "gap-1",
    normal: "gap-2",
    relaxed: "gap-3",
  }[theme?.spacing ?? "normal"];

  return (
    <div className={cn("flex flex-wrap", spacingClass)}>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            variant="outline"
            size="sm"
            asChild
            disabled={isEditMode}
            className={cn(fontSizeClass)}
            style={{
              borderColor: theme?.accentColor,
              color: theme?.accentColor,
            }}
          >
            <Link to={action.href}>
              <Plus className="h-3 w-3 mr-1" />
              <Icon className="h-3 w-3 mr-1" />
              {action.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
