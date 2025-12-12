import { usePersonnelStats } from "@/integrations/supabase/hooks/usePersonnel";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const PersonnelStats = () => {
  const { data: stats, isLoading } = usePersonnelStats();

  if (isLoading) {
    return (
      <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="min-w-[120px] sm:min-w-[140px] h-20 sm:h-24 bg-muted animate-pulse rounded-lg md:min-w-0"
          />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 sm:gap-4 pb-2 md:grid md:grid-cols-5">
        <div className="min-w-[120px] sm:min-w-[140px] md:min-w-0">
          <StatCard title="Total" value={stats?.total || 0} icon={Users} />
        </div>
        <div className="min-w-[120px] sm:min-w-[140px] md:min-w-0">
          <StatCard
            title="Active"
            value={stats?.active || 0}
            icon={UserCheck}
          />
        </div>
        <div className="min-w-[120px] sm:min-w-[140px] md:min-w-0">
          <StatCard
            title="Inactive"
            value={stats?.inactive || 0}
            icon={UserX}
          />
        </div>
        <div className="min-w-[120px] sm:min-w-[140px] md:min-w-0">
          <StatCard
            title="DNH"
            value={stats?.doNotHire || 0}
            icon={AlertTriangle}
          />
        </div>
        <div className="min-w-[120px] sm:min-w-[140px] md:min-w-0">
          <StatCard
            title="Expiring"
            value={stats?.expiringCerts || 0}
            icon={AlertCircle}
          />
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
