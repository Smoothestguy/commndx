import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Activity, Folder, Code } from "lucide-react";
import { DevActivity } from "@/hooks/useDevActivities";
import { formatDuration, calculateTotalMinutes, getActivityTypeConfig } from "./devActivityUtils";

interface DevActivityStatsProps {
  activities: DevActivity[];
}

export function DevActivityStats({ activities }: DevActivityStatsProps) {
  const stats = useMemo(() => {
    const totalMinutes = calculateTotalMinutes(activities);
    const totalActivities = activities.length;
    
    // Count by type
    const byType = activities.reduce((acc, a) => {
      acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top type
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

    // Unique projects
    const uniqueProjects = new Set(activities.map((a) => a.project_name).filter(Boolean));

    // Unique technologies
    const allTechnologies = activities.flatMap((a) => a.technologies);
    const techCounts = allTechnologies.reduce((acc, tech) => {
      acc[tech] = (acc[tech] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topTech = Object.entries(techCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return {
      totalMinutes,
      totalActivities,
      byType,
      topType,
      uniqueProjects: uniqueProjects.size,
      topTechnologies: topTech,
    };
  }, [activities]);

  const statCards = [
    {
      title: "Total Time",
      value: formatDuration(stats.totalMinutes),
      icon: Clock,
      description: `${stats.totalActivities} activities logged`,
    },
    {
      title: "Activities",
      value: stats.totalActivities.toString(),
      icon: Activity,
      description: stats.topType
        ? `Most: ${getActivityTypeConfig(stats.topType[0]).label} (${stats.topType[1]})`
        : "No activities yet",
    },
    {
      title: "Projects",
      value: stats.uniqueProjects.toString(),
      icon: Folder,
      description: stats.uniqueProjects === 1 ? "project" : "projects worked on",
    },
    {
      title: "Technologies",
      value: stats.topTechnologies.length.toString(),
      icon: Code,
      description: stats.topTechnologies.length > 0
        ? stats.topTechnologies.map(([t]) => t).join(", ")
        : "No technologies logged",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
