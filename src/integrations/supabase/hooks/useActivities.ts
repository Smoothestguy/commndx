import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Activity, ActivityType, ActivityPriority } from "@/types/roofing";

interface ActivityInput {
  customer_id: string;
  project_id?: string;
  activity_type: ActivityType;
  subject: string;
  description?: string;
  activity_date?: string;
  priority?: ActivityPriority;
  follow_up_date?: string;
}

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          creator:profiles!activities_created_by_fkey(first_name, last_name)
        `)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return data as Activity[];
    },
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          creator:profiles!activities_created_by_fkey(first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Activity;
    },
    enabled: !!id,
  });
}

export function useActivitiesByCustomer(customerId: string) {
  return useQuery({
    queryKey: ["activities", "customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          creator:profiles!activities_created_by_fkey(first_name, last_name)
        `)
        .eq("customer_id", customerId)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!customerId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ActivityInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("activities")
        .insert({
          ...input,
          created_by: user.id,
          activity_date: input.activity_date || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity logged successfully");
    },
    onError: (error) => {
      toast.error("Failed to log activity: " + error.message);
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ActivityInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("activities")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update activity: " + error.message);
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete activity: " + error.message);
    },
  });
}
