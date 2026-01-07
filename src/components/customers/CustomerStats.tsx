import { Users, FolderOpen, TrendingUp, AlertCircle } from "lucide-react";

interface CustomerStatsProps {
  total: number;
  withProjects: number;
  newThisMonth: number;
  noProjects: number;
}

export const CustomerStats = ({
  total,
  withProjects,
  newThisMonth,
  noProjects,
}: CustomerStatsProps) => {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
      <div className="glass rounded-lg p-3 lg:p-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-heading font-bold text-foreground">{total}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-3 lg:p-4 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <FolderOpen className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">With Projects</p>
            <p className="text-2xl font-heading font-bold text-success">{withProjects}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-3 lg:p-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10">
            <TrendingUp className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">New This Month</p>
            <p className="text-2xl font-heading font-bold text-info">{newThisMonth}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-3 lg:p-4 animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">No Projects</p>
            <p className="text-2xl font-heading font-bold text-warning">{noProjects}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
