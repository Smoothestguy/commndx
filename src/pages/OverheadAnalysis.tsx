import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, Clock, Building2, TrendingUp } from "lucide-react";
import { format, subDays, startOfMonth, startOfWeek, startOfQuarter } from "date-fns";
import { DateRange } from "react-day-picker";

const OVERHEAD_CATEGORIES = [
  { value: "admin", label: "Administration" },
  { value: "travel", label: "Travel" },
  { value: "training", label: "Training" },
  { value: "payroll", label: "Payroll Processing" },
  { value: "other", label: "Other" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

type DatePreset = "week" | "month" | "quarter" | "custom";

const OverheadAnalysis = () => {
  const [preset, setPreset] = useState<DatePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
      case "month": return { from: startOfMonth(now), to: now };
      case "quarter": return { from: startOfQuarter(now), to: now };
      case "custom": return customRange ? { from: customRange.from!, to: customRange.to || customRange.from! } : { from: subDays(now, 30), to: now };
    }
  }, [preset, customRange]);

  const startDate = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  // Fetch all time entries in range
  const { data: entries = [] } = useQuery({
    queryKey: ["overhead-analysis", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          hours,
          is_overhead,
          overhead_category,
          project_id,
          personnel_id,
          personnel:personnel_id (first_name, last_name),
          projects:project_id (name)
        `)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });

  // Hours by project
  const projectHours = useMemo(() => {
    const map = new Map<string, { name: string; hours: number }>();
    for (const e of entries) {
      if ((e as any).is_overhead) continue;
      const pName = (e.projects as any)?.name || "Unknown";
      const existing = map.get(e.project_id);
      if (existing) {
        existing.hours += e.hours || 0;
      } else {
        map.set(e.project_id, { name: pName, hours: e.hours || 0 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours).slice(0, 15);
  }, [entries]);

  // Overhead breakdown
  const overheadStats = useMemo(() => {
    let totalOverhead = 0;
    let totalProject = 0;
    const categoryMap = new Map<string, number>();

    for (const e of entries) {
      const hours = e.hours || 0;
      if ((e as any).is_overhead) {
        totalOverhead += hours;
        const cat = (e as any).overhead_category || "other";
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + hours);
      } else {
        totalProject += hours;
      }
    }

    const categories = Array.from(categoryMap.entries()).map(([key, hours]) => ({
      name: OVERHEAD_CATEGORIES.find(c => c.value === key)?.label || key,
      value: hours,
    }));

    return { totalOverhead, totalProject, total: totalOverhead + totalProject, categories };
  }, [entries]);

  // Personnel utilization
  const personnelUtilization = useMemo(() => {
    const map = new Map<string, { name: string; projectHours: number; overheadHours: number }>();
    for (const e of entries) {
      if (!e.personnel_id) continue;
      const p = e.personnel as any;
      const name = p ? `${p.first_name} ${p.last_name}` : "Unknown";
      const existing = map.get(e.personnel_id);
      const hours = e.hours || 0;
      const isOH = (e as any).is_overhead === true;

      if (existing) {
        if (isOH) existing.overheadHours += hours;
        else existing.projectHours += hours;
      } else {
        map.set(e.personnel_id, {
          name,
          projectHours: isOH ? 0 : hours,
          overheadHours: isOH ? hours : 0,
        });
      }
    }
    return Array.from(map.values())
      .map(d => ({
        ...d,
        total: d.projectHours + d.overheadHours,
        utilization: d.projectHours + d.overheadHours > 0
          ? Math.round((d.projectHours / (d.projectHours + d.overheadHours)) * 100)
          : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [entries]);

  const overallUtilization = overheadStats.total > 0
    ? Math.round((overheadStats.totalProject / overheadStats.total) * 100)
    : 0;

  return (
    <PageLayout title="Overhead & Utilization Analysis" description="Track project allocation vs overhead hours">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <DatePickerWithRange date={customRange} setDate={setCustomRange} />
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="glass border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
            <p className="text-2xl font-bold">{overheadStats.total.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Project Hours</p>
            </div>
            <p className="text-2xl font-bold text-green-500">{overheadStats.totalProject.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Overhead Hours</p>
            </div>
            <p className="text-2xl font-bold text-orange-500">{overheadStats.totalOverhead.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="glass border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Utilization</p>
            </div>
            <p className={`text-2xl font-bold ${overallUtilization >= 70 ? 'text-green-500' : overallUtilization >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
              {overallUtilization}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Hours by Project */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-base">Hours by Project</CardTitle>
          </CardHeader>
          <CardContent>
            {projectHours.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectHours} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Hours"]} />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No project hours in this period</p>
            )}
          </CardContent>
        </Card>

        {/* Overhead Categories */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="text-base">Overhead Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {overheadStats.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overheadStats.categories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {overheadStats.categories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Hours"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No overhead logged in this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personnel Utilization */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-base">Personnel Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          {personnelUtilization.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Personnel</th>
                    <th className="text-right p-2 font-medium">Project Hrs</th>
                    <th className="text-right p-2 font-medium">Overhead Hrs</th>
                    <th className="text-right p-2 font-medium">Total</th>
                    <th className="text-right p-2 font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {personnelUtilization.map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="p-2 font-medium">{p.name}</td>
                      <td className="text-right p-2">{p.projectHours.toFixed(1)}</td>
                      <td className="text-right p-2">{p.overheadHours.toFixed(1)}</td>
                      <td className="text-right p-2">{p.total.toFixed(1)}</td>
                      <td className="text-right p-2">
                        <span className={`font-medium ${p.utilization >= 70 ? 'text-green-500' : p.utilization >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {p.utilization}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No personnel data in this period</p>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default OverheadAnalysis;
