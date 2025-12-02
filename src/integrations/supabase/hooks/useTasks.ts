import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Task, TaskStatus, TaskPriority } from "@/types/roofing";

interface TaskInput {
  customer_id?: string;
  project_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          assignee:profiles!tasks_assigned_to_fkey(first_name, last_name)
        `)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          assignee:profiles!tasks_assigned_to_fkey(first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Task;
    },
    enabled: !!id,
  });
}

export function useTasksByAssignee(assigneeId: string) {
  return useQuery({
    queryKey: ["tasks", "assignee", assigneeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          assignee:profiles!tasks_assigned_to_fkey(first_name, last_name)
        `)
        .eq("assigned_to", assigneeId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Task[];
    },
    enabled: !!assigneeId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create task: " + error.message);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<TaskInput> & { id: string; completed_at?: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update task: " + error.message);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete task: " + error.message);
    },
  });
}
