import { usePersonnelStats } from "@/integrations/supabase/hooks/usePersonnel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from '@/components/ui/button';
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  AlertCircle,
  LucideIcon,
} from "lucide-react";

interface StatConfig {
  title: string;
  value: number;
  icon: LucideIcon;
  showOnMobile: boolean;
}

export const PersonnelStats = () => {
  const { data: statsData, isLoading, error, refetch } = usePersonnelStats();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5 sm:gap-4 w-full max-w-full overflow-hidden">
        {[...Array(isMobile ? 2 : 5)].map((_, i) => (
          <div
            key={i}
            className="h-14 sm:h-24 bg-muted animate-pulse rounded-lg min-w-0"
          />
        ))}
      </div>
    );
  }

  if (error) return <div role="alert" className="text-sm text-warning">Personnel totals unavailable. <Button size="sm" variant="ghost" onClick={() => refetch()}>Retry</Button></div>;
  const stats: StatConfig[] = [
    { title: "Total", value: statsData?.total || 0, icon: Users, showOnMobile: true },
    { title: "Active", value: statsData?.active || 0, icon: UserCheck, showOnMobile: true },
    { title: "Inactive", value: statsData?.inactive || 0, icon: UserX, showOnMobile: false },
    { title: "DNH", value: statsData?.doNotHire || 0, icon: AlertTriangle, showOnMobile: false },
    { title: "Expiring", value: statsData?.expiringCerts || 0, icon: AlertCircle, showOnMobile: false },
  ];

  const displayStats = isMobile ? stats.filter(s => s.showOnMobile) : stats;

  return (
    <div className="list-stat-strip grid grid-cols-2 gap-1.5 md:grid-cols-5 sm:gap-4 w-full max-w-full overflow-hidden">
      {displayStats.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          compact
        />
      ))}
    </div>
  );
};
