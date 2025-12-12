import { usePersonnelStats } from "@/integrations/supabase/hooks/usePersonnel";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

export const PersonnelStats = () => {
  const { data: stats, isLoading } = usePersonnelStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-4 w-full max-w-full">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 sm:h-24 bg-muted animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-4 w-full max-w-full">
      <StatCard title="Total" value={stats?.total || 0} icon={Users} compact />
      <StatCard title="Active" value={stats?.active || 0} icon={UserCheck} compact />
      <StatCard title="Inactive" value={stats?.inactive || 0} icon={UserX} compact />
      <StatCard title="DNH" value={stats?.doNotHire || 0} icon={AlertTriangle} compact />
      <StatCard title="Expiring" value={stats?.expiringCerts || 0} icon={AlertCircle} compact />
    </div>
  );
};
