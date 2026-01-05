import { Users, Shield, UserCog, User, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  role: AppRole | null;
}

interface UserStatsProps {
  users: UserWithRole[];
}

export function UserStats({ users }: UserStatsProps) {
  const isMobile = useIsMobile();
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const accountingCount = users.filter((u) => u.role === "accounting").length;
  const userCount = users.filter((u) => u.role === "user").length;

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      showOnMobile: true,
    },
    {
      title: "Admins",
      value: adminCount,
      icon: Shield,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      showOnMobile: true,
    },
    {
      title: "Managers",
      value: managerCount,
      icon: UserCog,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      showOnMobile: false,
    },
    {
      title: "Accounting",
      value: accountingCount,
      icon: Calculator,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      showOnMobile: false,
    },
    {
      title: "Regular Users",
      value: userCount,
      icon: User,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      showOnMobile: false,
    },
  ];

  // On mobile, show only key stats (Total, Admins)
  const visibleStats = isMobile ? stats.filter(s => s.showOnMobile) : stats;

  return (
    <div className={cn(
      "grid gap-3 md:gap-4 mb-6",
      isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-5"
    )}>
      {visibleStats.map((stat, index) => (
        <Card
          key={stat.title}
          className="glass hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className={cn("p-4 md:p-6")}>
            <div className="flex items-center gap-3 md:gap-4">
              <div className={cn(stat.bgColor, "p-2 md:p-3 rounded-lg")}>
                <stat.icon className={cn("h-5 w-5 md:h-6 md:w-6", stat.color)} />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
