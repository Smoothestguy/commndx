import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  Users, 
  FolderKanban,
  Receipt,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface RightPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  backgroundColor?: string;
  textColor?: string;
}

interface KPIMeterProps {
  label: string;
  value: number;
  target: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  format?: "currency" | "number" | "percent";
}

function KPIMeter({ label, value, target, icon: Icon, color = "primary", format = "number" }: KPIMeterProps) {
  const percentage = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  
  const formatValue = (val: number) => {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: "USD", 
        notation: "compact",
        maximumFractionDigits: 1 
      }).format(val);
    }
    if (format === "percent") {
      return `${Math.round(val)}%`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", `text-${color}`)} />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
      </div>
      <div className="text-lg font-bold">{formatValue(value)}</div>
      <div className="space-y-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all", `bg-${color}`)}
            style={{ width: `${percentage}%`, backgroundColor: `hsl(var(--${color}))` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{Math.round(percentage)}% of target</span>
          <span>{formatValue(target)}</span>
        </div>
      </div>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}

function MiniStat({ label, value, trend, icon: Icon }: MiniStatProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{value}</span>
        {trend && (
          <TrendingUp 
            className={cn(
              "h-3 w-3",
              trend === "up" && "text-primary",
              trend === "down" && "text-destructive rotate-180",
              trend === "neutral" && "text-muted-foreground"
            )} 
          />
        )}
      </div>
    </div>
  );
}

export function RightPanel({ collapsed, onToggleCollapse, backgroundColor, textColor }: RightPanelProps) {
  const [kpisOpen, setKpisOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);

  const panelStyle = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
  };

  // Fetch summary stats
  const { data: invoiceStats } = useQuery({
    queryKey: ["invoice-stats-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total, paid_amount, status")
        .is("deleted_at", null);
      if (error) throw error;
      
      const totalInvoiced = data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalCollected = data?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0;
      const openInvoices = data?.filter(inv => inv.status === "sent" || inv.status === "overdue").length || 0;
      
      return { totalInvoiced, totalCollected, openInvoices };
    },
  });

  const { data: projectStats } = useQuery({
    queryKey: ["project-stats-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("status")
        .is("deleted_at", null);
      if (error) throw error;
      
      const active = data?.filter(p => p.status === "active").length || 0;
      const total = data?.length || 0;
      
      return { active, total };
    },
  });

  const { data: personnelStats } = useQuery({
    queryKey: ["personnel-stats-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("status")
        .is("deleted_at", null);
      if (error) throw error;
      
      const active = data?.filter(p => p.status === "active").length || 0;
      const total = data?.length || 0;
      
      return { active, total };
    },
  });

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <div 
          className={cn(
            "w-12 border-l border-border flex flex-col items-center py-2",
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
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-3">
            {/* KPI Overview */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => { onToggleCollapse(); setKpisOpen(true); }}
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">KPI Overview</TooltipContent>
            </Tooltip>

            {/* Quick Stats */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => { onToggleCollapse(); setStatsOpen(true); }}
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Quick Stats</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div 
      className={cn(
        "w-72 border-l border-border flex flex-col",
        !backgroundColor && "bg-card"
      )}
      style={panelStyle}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">Key Metrics</h3>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-6 w-6">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* KPI Meters */}
          <Collapsible open={kpisOpen} onOpenChange={setKpisOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <span>KPI Overview</span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", kpisOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <KPIMeter
                label="Revenue Collected"
                value={invoiceStats?.totalCollected || 0}
                target={invoiceStats?.totalInvoiced || 1}
                icon={DollarSign}
                color="primary"
                format="currency"
              />
              <KPIMeter
                label="Collection Rate"
                value={invoiceStats?.totalInvoiced ? (invoiceStats.totalCollected / invoiceStats.totalInvoiced) * 100 : 0}
                target={100}
                icon={TrendingUp}
                color="primary"
                format="percent"
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Quick Stats */}
          <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <span>Quick Stats</span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              <MiniStat
                label="Active Projects"
                value={projectStats?.active || 0}
                icon={FolderKanban}
                trend="neutral"
              />
              <MiniStat
                label="Open Invoices"
                value={invoiceStats?.openInvoices || 0}
                icon={Receipt}
                trend="neutral"
              />
              <MiniStat
                label="Active Personnel"
                value={personnelStats?.active || 0}
                icon={Users}
                trend="neutral"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
