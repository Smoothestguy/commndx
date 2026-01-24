import { Store, CheckCircle, XCircle } from "lucide-react";

interface VendorStatsProps {
  total: number;
  active: number;
  inactive: number;
}

export const VendorStats = ({
  total,
  active,
  inactive,
}: VendorStatsProps) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 pr-4 mb-6 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:gap-4 md:pr-0">
      <div className="glass rounded-lg p-3 sm:p-4 min-w-[140px] flex-shrink-0 md:min-w-0 animate-fade-in">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
            <Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Vendors</p>
            <p className="text-xl sm:text-2xl font-heading font-bold text-foreground">{total}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-3 sm:p-4 min-w-[130px] flex-shrink-0 md:min-w-0 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Active</p>
            <p className="text-xl sm:text-2xl font-heading font-bold text-success">{active}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-3 sm:p-4 min-w-[130px] flex-shrink-0 md:min-w-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-muted/10">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Inactive</p>
            <p className="text-xl sm:text-2xl font-heading font-bold text-muted-foreground">{inactive}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
