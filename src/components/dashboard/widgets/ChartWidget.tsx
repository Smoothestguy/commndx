import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { DashboardWidget, DashboardTheme } from "./types";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChartWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#6366f1"];

export function ChartWidget({ widget, theme, isEditMode }: ChartWidgetProps) {
  const { dataSource, displayOptions } = widget.config;
  const chartType = displayOptions?.chartType ?? "pie";
  const isMobile = useIsMobile();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["chart-widget", dataSource, chartType],
    queryFn: async () => {
      switch (dataSource) {
        case "projects": {
          const { data } = await supabase
            .from("projects")
            .select("status")
            .is("deleted_at", null);

          if (!data) return [];

          // Group by status
          const statusCounts: Record<string, number> = {};
          data.forEach((project) => {
            const status = project.status || "unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });

          return Object.entries(statusCounts).map(([name, value]) => ({
            name: formatStatus(name),
            value,
          }));
        }
        case "invoices": {
          // Get monthly revenue for the last 6 months
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

          const { data } = await supabase
            .from("invoices")
            .select("total, created_at")
            .gte("created_at", sixMonthsAgo.toISOString())
            .is("deleted_at", null);

          if (!data) return [];

          // Group by month
          const monthlyData: Record<string, number> = {};
          data.forEach((invoice) => {
            const month = new Date(invoice.created_at).toLocaleDateString("en-US", { month: "short" });
            monthlyData[month] = (monthlyData[month] || 0) + (invoice.total || 0);
          });

          return Object.entries(monthlyData).map(([name, value]) => ({ name, value }));
        }
        default:
          return [];
      }
    },
    enabled: !!dataSource,
    staleTime: 60000, // Cache for 1 minute
  });

  // Responsive chart height
  const chartHeight = isMobile ? 160 : 200;

  if (isLoading) {
    return (
      <div className="h-40 sm:h-48 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading chart...</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-40 sm:h-48 flex items-center justify-center text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div 
        className="min-w-[250px]" 
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 30 : 40}
                outerRadius={isMobile ? 55 : 70}
                paddingAngle={2}
                dataKey="value"
                label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: isMobile ? -15 : 0, bottom: isMobile ? 20 : 5 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: isMobile ? 9 : 12 }} 
                interval={0}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 45 : 30}
              />
              <YAxis 
                tick={{ fontSize: isMobile ? 9 : 12 }} 
                width={isMobile ? 35 : 50}
                tickFormatter={(value) => isMobile ? `${(value/1000).toFixed(0)}k` : value.toLocaleString()}
              />
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: isMobile ? -15 : 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: isMobile ? 9 : 12 }} />
              <YAxis tick={{ fontSize: isMobile ? 9 : 12 }} width={isMobile ? 35 : 50} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: isMobile ? 3 : 4 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
