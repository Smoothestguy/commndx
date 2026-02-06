import { useState } from "react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import { Plus, Upload, Search, Edit, Trash2, ChevronDown, ChevronUp, CheckSquare, Square, X, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateRange } from "react-day-picker";
import { useDevActivities, DevActivity } from "@/hooks/useDevActivities";
import { DevActivityUpload } from "./DevActivityUpload";
import { DevActivityReviewModal } from "./DevActivityReviewModal";
import { DevActivityManualForm } from "./DevActivityManualForm";
import { DevActivityStats } from "./DevActivityStats";
import { BulkEditModal } from "./BulkEditModal";
import { getActivityTypeConfig, formatDuration, ACTIVITY_TYPES } from "./devActivityUtils";
import { exportDevActivitiesToCSV, exportDevActivitiesToJSON } from "@/utils/exportUtils";
import { toast } from "sonner";

interface DevActivityDashboardProps {
  dateRange?: DateRange;
  targetUserId?: string | null;
}

export function DevActivityDashboard({ dateRange, targetUserId }: DevActivityDashboardProps) {
  const { activities, isLoading, deleteActivity, bulkUpdateActivities, bulkDeleteActivities, projectNames } = useDevActivities(dateRange, targetUserId);
  const [showUpload, setShowUpload] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editActivity, setEditActivity] = useState<DevActivity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [extractedActivities, setExtractedActivities] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Get unique projects for filter
  const uniqueProjects = [...new Set(activities.map((a) => a.project_name).filter(Boolean))];

  // Filter activities
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      searchQuery === "" ||
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === "all" || activity.activity_type === typeFilter;
    const matchesProject =
      projectFilter === "all" ||
      (projectFilter === "none" && !activity.project_name) ||
      activity.project_name === projectFilter;

    return matchesSearch && matchesType && matchesProject;
  });

  // Group by date
  const groupedByDate = filteredActivities.reduce((acc, activity) => {
    const date = activity.activity_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, DevActivity[]>);

  const handleAnalysisComplete = (activities: any[]) => {
    setExtractedActivities(activities);
    setShowUpload(false);
    setShowReviewModal(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteActivity.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredActivities.map((a) => a.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkEdit = async (updates: Partial<typeof activities[0]>) => {
    await bulkUpdateActivities.mutateAsync({
      ids: Array.from(selectedIds),
      updates,
    });
    setShowBulkEditModal(false);
    exitSelectionMode();
  };

  const handleBulkDelete = async () => {
    await bulkDeleteActivities.mutateAsync(Array.from(selectedIds));
    setShowBulkDeleteDialog(false);
    exitSelectionMode();
  };

  const allSelected = filteredActivities.length > 0 && selectedIds.size === filteredActivities.length;

  // Export handlers
  const handleExportCSV = () => {
    try {
      const filename = `dev-activities-${format(new Date(), 'yyyy-MM-dd')}`;
      exportDevActivitiesToCSV(filteredActivities, filename);
      toast.success(`Exported ${filteredActivities.length} activities to CSV`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export');
    }
  };

  const handleExportJSON = () => {
    try {
      const filename = `dev-activities-${format(new Date(), 'yyyy-MM-dd')}`;
      exportDevActivitiesToJSON(filteredActivities, filename);
      toast.success(`Exported ${filteredActivities.length} activities to JSON`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <DevActivityStats activities={activities} />

      {/* Actions & Filters */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowUpload(true)} size="sm" className="flex-1 sm:flex-none">
            <Upload className="h-4 w-4 mr-2" />
            <span className="sm:hidden">Upload</span>
            <span className="hidden sm:inline">Upload Screenshot</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowManualForm(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Manual</span>
          </Button>
          {!isSelectionMode && filteredActivities.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)} className="flex-1 sm:flex-none">
              <CheckSquare className="h-4 w-4 mr-2" />
              Select
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={filteredActivities.length === 0} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="none">No project</SelectItem>
                {uniqueProjects.map((project) => (
                  <SelectItem key={project} value={project!}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {isSelectionMode && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 border rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => (checked ? selectAll() : deselectAll())}
            />
            <span className="text-sm font-medium">
              {selectedIds.size}/{filteredActivities.length}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkEditModal(true)}
              disabled={selectedIds.size === 0}
              className="flex-1 sm:flex-none"
            >
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Bulk Edit</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={selectedIds.size === 0}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
              <X className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        </div>
      )}

      {/* Upload Panel */}
      {showUpload && (
        <DevActivityUpload
          onAnalysisComplete={handleAnalysisComplete}
          onManualEntry={() => {
            setShowUpload(false);
            setShowManualForm(true);
          }}
        />
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No development activities found.</p>
              <p className="text-sm mt-1">
                Upload a screenshot or add activities manually to get started.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedByDate).map(([date, dayActivities]) => (
                  <div key={date}>
                    <div className="sticky top-0 bg-background py-2 z-10">
                      <Badge variant="secondary" className="text-xs">
                        {format(parseLocalDate(date), "EEEE, MMMM d, yyyy")}
                      </Badge>
                    </div>
                    <div className="space-y-3 mt-2">
                      {dayActivities.map((activity) => {
                        const config = getActivityTypeConfig(activity.activity_type);
                        const Icon = config.icon;
                        const isExpanded = expandedId === activity.id;
                        const isSelected = selectedIds.has(activity.id);

                        return (
                          <div
                            key={activity.id}
                            className={`relative pl-6 border-l-2 border-muted ml-2 ${
                              isSelected ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""
                            }`}
                          >
                            <div
                              className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full ${config.bgClass}`}
                            />
                            <div className="bg-card border rounded-lg p-4">
                              <div className="flex items-start justify-between gap-2">
                                {isSelectionMode && (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelection(activity.id)}
                                    className="mt-1"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={config.className}>
                                      <Icon className="h-3 w-3 mr-1" />
                                      {config.label}
                                    </Badge>
                                    {activity.project_name && (
                                      <Badge variant="outline">{activity.project_name}</Badge>
                                    )}
                                    {activity.activity_time && (
                                      <span className="text-xs text-muted-foreground">
                                        {(() => {
                                          const [hours, minutes] = activity.activity_time.split(':').map(Number);
                                          const period = hours >= 12 ? 'PM' : 'AM';
                                          const hour12 = hours % 12 || 12;
                                          return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
                                        })()}
                                      </span>
                                    )}
                                    {activity.duration_minutes && (
                                      <span className="text-xs text-muted-foreground">
                                        {formatDuration(activity.duration_minutes)}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-medium mt-2">{activity.title}</h4>
                                  {activity.description && !isExpanded && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {activity.description}
                                    </p>
                                  )}
                                  {isExpanded && activity.description && (
                                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                      {activity.description}
                                    </p>
                                  )}
                                  {activity.technologies.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-2">
                                      {activity.technologies.map((tech) => (
                                        <Badge key={tech} variant="secondary" className="text-xs">
                                          {tech}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {!isSelectionMode && (
                                  <div className="flex items-center gap-1">
                                    {activity.description && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          setExpandedId(isExpanded ? null : activity.id)
                                        }
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditActivity(activity)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => setDeleteId(activity.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <DevActivityReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        activities={extractedActivities}
        onComplete={() => setExtractedActivities([])}
      />

      <DevActivityManualForm
        open={showManualForm || !!editActivity}
        onOpenChange={(open) => {
          if (!open) {
            setShowManualForm(false);
            setEditActivity(null);
          }
        }}
        editActivity={editActivity}
      />

      <BulkEditModal
        open={showBulkEditModal}
        onOpenChange={setShowBulkEditModal}
        selectedCount={selectedIds.size}
        projectNames={projectNames}
        onApply={handleBulkEdit}
        isLoading={bulkUpdateActivities.isPending}
      />

      {/* Single Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Activities</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected activities? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteActivities.isPending}
            >
              {bulkDeleteActivities.isPending ? "Deleting..." : `Delete ${selectedIds.size} Activities`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
