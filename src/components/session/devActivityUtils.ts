import {
  GitCommit,
  Rocket,
  Database,
  Layers,
  Code,
  Bug,
  GitPullRequest,
  Settings,
  TestTube,
  FileText,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";

export const ACTIVITY_TYPES = [
  { value: "git_commit", label: "Git Commit" },
  { value: "deployment", label: "Deployment" },
  { value: "database_migration", label: "Database Migration" },
  { value: "schema_change", label: "Schema Change" },
  { value: "feature_development", label: "Feature Development" },
  { value: "bug_fix", label: "Bug Fix" },
  { value: "code_review", label: "Code Review" },
  { value: "configuration", label: "Configuration" },
  { value: "testing", label: "Testing" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number]["value"];

interface ActivityTypeConfig {
  icon: LucideIcon;
  label: string;
  className: string;
  bgClass: string;
}

export function getActivityTypeConfig(type: string): ActivityTypeConfig {
  const configs: Record<string, ActivityTypeConfig> = {
    git_commit: {
      icon: GitCommit,
      label: "Git Commit",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      bgClass: "bg-blue-500",
    },
    deployment: {
      icon: Rocket,
      label: "Deployment",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      bgClass: "bg-green-500",
    },
    database_migration: {
      icon: Database,
      label: "Migration",
      className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      bgClass: "bg-purple-500",
    },
    schema_change: {
      icon: Layers,
      label: "Schema Change",
      className: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
      bgClass: "bg-violet-500",
    },
    feature_development: {
      icon: Code,
      label: "Feature",
      className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      bgClass: "bg-teal-500",
    },
    bug_fix: {
      icon: Bug,
      label: "Bug Fix",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      bgClass: "bg-red-500",
    },
    code_review: {
      icon: GitPullRequest,
      label: "Code Review",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      bgClass: "bg-orange-500",
    },
    configuration: {
      icon: Settings,
      label: "Config",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      bgClass: "bg-gray-500",
    },
    testing: {
      icon: TestTube,
      label: "Testing",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      bgClass: "bg-yellow-500",
    },
    documentation: {
      icon: FileText,
      label: "Docs",
      className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      bgClass: "bg-indigo-500",
    },
    other: {
      icon: MoreHorizontal,
      label: "Other",
      className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
      bgClass: "bg-slate-500",
    },
  };

  return configs[type] || configs.other;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "-";
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function calculateTotalMinutes(activities: { duration_minutes: number | null }[]): number {
  return activities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
}
