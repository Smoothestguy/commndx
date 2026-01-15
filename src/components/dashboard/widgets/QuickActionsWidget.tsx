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
  { label: "New Project", href: "/projects?action=add", icon: FolderOpen },
  { label: "New Customer", href: "/customers?action=add", icon: Briefcase },
  { label: "Log Time", href: "/time-tracking", icon: Clock },
  { label: "Add Personnel", href: "/personnel?action=add", icon: Users },
];

export function QuickActionsWidget({ widget, theme, isEditMode }: QuickActionsWidgetProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            variant="ghost"
            size="sm"
            asChild
            disabled={isEditMode}
            className={cn(
              "h-8 px-3 text-xs font-medium",
              "bg-muted/50 hover:bg-muted border-0",
              "text-foreground/80 hover:text-foreground"
            )}
          >
            <Link to={action.href} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span>{action.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
