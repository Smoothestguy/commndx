import { FolderKanban, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { Project } from "@/integrations/supabase/hooks/useProjects";

interface ProjectStatsProps {
  projects: Project[];
}

export function ProjectStats({ projects }: ProjectStatsProps) {
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
    },
    {
      title: "Active",
      value: activeProjects,
      icon: Clock,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Completed",
      value: completedProjects,
      icon: CheckCircle2,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "On Hold",
      value: onHoldProjects,
      icon: PauseCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 overflow-hidden">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.title}
            className="glass rounded-lg p-2.5 sm:p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 animate-fade-in min-w-0"
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{stat.title}</p>
                <p className="font-heading text-xl sm:text-3xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${stat.bgColor} transition-all duration-300 flex-shrink-0`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
