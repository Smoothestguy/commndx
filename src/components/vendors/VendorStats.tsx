import { Store, CheckCircle, XCircle, Star } from "lucide-react";

interface VendorStatsProps {
  total: number;
  active: number;
  inactive: number;
  averageRating: number;
}

export const VendorStats = ({
  total,
  active,
  inactive,
  averageRating,
}: VendorStatsProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <div className="glass rounded-lg p-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Vendors</p>
            <p className="text-2xl font-heading font-bold text-foreground">{total}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-4 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-heading font-bold text-success">{active}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/10">
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-heading font-bold text-muted-foreground">{inactive}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-4 animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <Star className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
            <p className="text-2xl font-heading font-bold text-warning">
              {averageRating > 0 ? averageRating.toFixed(1) : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
