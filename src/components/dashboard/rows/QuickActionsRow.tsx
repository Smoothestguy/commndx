import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Receipt,
  FolderKanban,
  Users,
  Clock,
  UserPlus,
} from "lucide-react";

const QUICK_ACTIONS = [
  { label: "New Estimate", href: "/estimates/new", icon: FileText },
  { label: "New Invoice", href: "/invoices/new", icon: Receipt },
  { label: "New Project", href: "/projects/new", icon: FolderKanban },
  { label: "New Customer", href: "/customers/new", icon: Users },
  { label: "Log Time", href: "/time-tracking", icon: Clock },
  { label: "Add Personnel", href: "/personnel/new", icon: UserPlus },
];

export function QuickActionsRow() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            variant="ghost"
            size="sm"
            onClick={() => navigate(action.href)}
            className="h-8 px-3 whitespace-nowrap flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
