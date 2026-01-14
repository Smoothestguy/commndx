import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function RevenueChartRow() {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["revenue-chart-row"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data } = await supabase
        .from("invoices")
        .select("total, created_at, status")
        .eq("status", "paid")
        .gte("created_at", sixMonthsAgo.toISOString())
        .is("deleted_at", null);

      if (!data) return [];

      const monthlyData: Record<string, number> = {};
      data.forEach((invoice) => {
        const month = new Date(invoice.created_at).toLocaleDateString("en-US", { month: "short" });
        monthlyData[month] = (monthlyData[month] || 0) + (invoice.total || 0);
      });

      return Object.entries(monthlyData).map(([name, value]) => ({ name, value }));
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="border border-border rounded-sm bg-card p-4">
        <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="border border-border rounded-sm bg-card p-4">
        <p className="text-xs text-muted-foreground mb-2">Monthly Revenue</p>
        <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
          No revenue data
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-sm bg-card p-4">
      <p className="text-xs text-muted-foreground mb-2">Monthly Revenue (Last 6 Months)</p>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis 
              tick={{ fontSize: 10 }} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 4,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))'
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
