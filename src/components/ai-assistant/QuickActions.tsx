import React from "react";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Search, 
  TrendingUp, 
  Users, 
  Package,
  Receipt
} from "lucide-react";

interface QuickActionsProps {
  onAction: (message: string) => void;
}

const quickActions = [
  {
    icon: Search,
    label: "Find Invoices",
    message: "Show me all unpaid invoices",
  },
  {
    icon: FileText,
    label: "Recent Estimates",
    message: "List recent estimates",
  },
  {
    icon: TrendingUp,
    label: "Active Projects",
    message: "What are the active projects?",
  },
  {
    icon: Users,
    label: "Find Customer",
    message: "Search for a customer",
  },
  {
    icon: Package,
    label: "Open POs",
    message: "Show open purchase orders",
  },
  {
    icon: Receipt,
    label: "Pending Bills",
    message: "Show pending vendor bills",
  },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">Quick actions:</p>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs"
            onClick={() => onAction(action.message)}
          >
            <action.icon className="h-4 w-4" />
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
