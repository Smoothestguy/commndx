import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { DashboardWidget, DashboardTheme } from "./types";

interface ChartWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#6366f1"];

export function ChartWidget({ widget, theme, isEditMode }: ChartWidgetProps) {
  const { dataSource, displayOptions } = widget.config;
  const chartType = displayOptions?.chartType ?? "pie";

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

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : chartType === "bar" ? (
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
