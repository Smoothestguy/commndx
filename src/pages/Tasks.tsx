import { useState } from "react";
import { Plus, Filter, CheckSquare, Clock, AlertTriangle } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/roofing/tasks/TaskCard";
import { TaskForm } from "@/components/roofing/tasks/TaskForm";
import { TaskEmptyState } from "@/components/roofing/tasks/TaskEmptyState";
import { useTasks, useDeleteTask, useUpdateTask } from "@/integrations/supabase/hooks/useTasks";
import type { Task, TaskStatus, TaskPriority } from "@/types/roofing";
import { isPast, isToday } from "date-fns";
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

const priorityOptions: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function Tasks() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");

  const { data: tasks, isLoading } = useTasks();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const pendingTasks = filteredTasks?.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = filteredTasks?.filter(t => t.status === "completed");
  
  // Stats
  const overdueTasks = tasks?.filter(t => 
    t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed" && t.status !== "cancelled"
  ).length || 0;
  const dueTodayTasks = tasks?.filter(t => 
    t.due_date && isToday(new Date(t.due_date)) && t.status !== "completed"
  ).length || 0;
  const completedCount = tasks?.filter(t => t.status === "completed").length || 0;

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteTask.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await updateTask.mutateAsync({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : undefined,
    });
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) setEditingTask(undefined);
  };

  return (
    <PageLayout
      title="Tasks"
      description="Manage your tasks and to-dos"
      actions={
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overdueTasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Today</p>
                  <p className="text-2xl font-bold">{dueTodayTasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as TaskPriority | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tasks */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">
              Active ({pendingTasks?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedTasks?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !pendingTasks?.length ? (
              <TaskEmptyState onAdd={() => setIsFormOpen(true)} />
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {!completedTasks?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No completed tasks yet
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TaskForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        task={editingTask}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
