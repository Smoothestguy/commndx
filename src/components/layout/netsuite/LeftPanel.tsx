import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  Calendar,
  History
} from "lucide-react";
import { useRecentPages } from "@/hooks/useRecentPages";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface LeftPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  backgroundColor?: string;
  textColor?: string;
}

export function LeftPanel({ collapsed, onToggleCollapse, backgroundColor, textColor }: LeftPanelProps) {
  const [recentPagesOpen, setRecentPagesOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  
  const recentPages = useRecentPages();

  // Fetch pending approvals (estimates pending approval)
  const { data: pendingEstimates } = useQuery({
    queryKey: ["pending-estimates-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, number, customer_name, total, created_at")
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch overdue invoices
  const { data: overdueInvoices } = useQuery({
    queryKey: ["overdue-invoices-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, customer_name, total, due_date")
        .eq("status", "overdue")
        .is("deleted_at", null)
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent projects
  const { data: recentProjects } = useQuery({
    queryKey: ["recent-projects-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const panelStyle = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <div 
          className={cn(
            "w-12 border-r border-border flex flex-col items-center py-2",
            !backgroundColor && "bg-card"
          )}
          style={panelStyle}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="mb-4"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="space-y-3">
            {/* Recently Accessed */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => { onToggleCollapse(); setRecentPagesOpen(true); }}
                >
                  <Clock className="h-4 w-4" />
                  {recentPages.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
                      {recentPages.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Recently Accessed</TooltipContent>
            </Tooltip>

            {/* Reminders */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => { onToggleCollapse(); setRemindersOpen(true); }}
                >
                  <Bell className="h-4 w-4" />
                  {(pendingEstimates?.length ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {pendingEstimates?.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Reminders</TooltipContent>
            </Tooltip>

            {/* Alerts */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => { onToggleCollapse(); setAlertsOpen(true); }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {(overdueInvoices?.length ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                      {overdueInvoices?.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Alerts</TooltipContent>
            </Tooltip>

            {/* Recent Projects */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => { onToggleCollapse(); setRecentOpen(true); }}
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Recent Projects</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div 
      className={cn(
        "w-72 border-r border-border flex flex-col",
        !backgroundColor && "bg-card"
      )}
      style={panelStyle}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">Quick Access</h3>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-6 w-6">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Recently Accessed Section */}
          <Collapsible open={recentPagesOpen} onOpenChange={setRecentPagesOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Recently Accessed</span>
                {recentPages.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {recentPages.length}
                  </Badge>
                )}
              </div>
              <ChevronRight className={cn("h-4 w-4 transition-transform", recentPagesOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="space-y-1 pl-6">
                {recentPages.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No recent pages</p>
                )}
                {recentPages.map((page, index) => (
                  <Link
                    key={`${page.path}-${index}`}
                    to={page.path}
                    className="block rounded-md p-2 text-xs hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{page.name}</span>
                      <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                        {formatDistanceToNow(page.visitedAt, { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Reminders Section */}
          <Collapsible open={remindersOpen} onOpenChange={setRemindersOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span>Reminders</span>
                {(pendingEstimates?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {pendingEstimates?.length}
                  </Badge>
                )}
              </div>
              <ChevronRight className={cn("h-4 w-4 transition-transform", remindersOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="space-y-1 pl-6">
                {pendingEstimates?.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No pending items</p>
                )}
                {pendingEstimates?.map((estimate) => (
                  <Link
                    key={estimate.id}
                    to={`/estimates/${estimate.id}`}
                    className="block rounded-md p-2 text-xs hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{estimate.number}</span>
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                    </div>
                    <p className="text-muted-foreground break-words leading-tight">{estimate.customer_name}</p>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Alerts Section */}
          <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>Alerts</span>
                {(overdueInvoices?.length ?? 0) > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                    {overdueInvoices?.length}
                  </Badge>
                )}
              </div>
              <ChevronRight className={cn("h-4 w-4 transition-transform", alertsOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="space-y-1 pl-6">
                {overdueInvoices?.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No alerts</p>
                )}
                {overdueInvoices?.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/invoices/${invoice.id}`}
                    className="block rounded-md p-2 text-xs hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{invoice.number}</span>
                      <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                    </div>
                    <p className="text-muted-foreground break-words leading-tight">{invoice.customer_name}</p>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Recent Records Section */}
          <Collapsible open={recentOpen} onOpenChange={setRecentOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span>Recent Projects</span>
              </div>
              <ChevronRight className={cn("h-4 w-4 transition-transform", recentOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="space-y-1 pl-6">
                {recentProjects?.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No recent projects</p>
                )}
                {recentProjects?.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block rounded-md p-2 text-xs hover:bg-muted transition-colors"
                  >
                    <p className="font-medium break-words leading-tight">{project.name}</p>
                    <p className="text-muted-foreground">
                      {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                    </p>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
