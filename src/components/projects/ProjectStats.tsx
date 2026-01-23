import { FolderKanban, CheckCircle2, Clock, PauseCircle, User, Users } from "lucide-react";
import { Project } from "@/integrations/supabase/hooks/useProjects";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProjectStatsProps {
  projects: Project[];
  individualCount?: number;
  teamCount?: number;
}

export function ProjectStats({ projects, individualCount = 0, teamCount = 0 }: ProjectStatsProps) {
  const isMobile = useIsMobile();
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === "active").length;
  const completedProjects = projects.filter(p => p.status === "completed").length;
  const onHoldProjects = projects.filter(p => p.status === "on-hold").length;

  const stats = [
    {
      title: "Total",
      value: totalProjects,
      icon: FolderKanban,
      color: "text-primary",
      bgColor: "bg-primary/10",
      showOnMobile: true,
    },
    {
      title: "Active",
      value: activeProjects,
      icon: Clock,
      color: "text-success",
      bgColor: "bg-success/10",
      showOnMobile: true,
    },
    {
      title: "Individual",
      value: individualCount,
      icon: User,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      showOnMobile: false,
    },
    {
      title: "Team",
      value: teamCount,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      showOnMobile: false,
    },
  ];

  // Show all stats on tablet and desktop, only first 2 on mobile
  const displayStats = isMobile ? stats.filter(s => s.showOnMobile) : stats;

  return (
    <div className="grid gap-1.5 sm:gap-4 mb-4 sm:mb-6 grid-cols-2 md:grid-cols-4 w-full">
      {displayStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.title}
            className="glass rounded-lg p-2 sm:p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 animate-fade-in min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">{stat.title}</p>
                <p className="font-heading text-lg sm:text-3xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className={`flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${stat.bgColor} transition-all duration-300 flex-shrink-0`}>
                <Icon className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
