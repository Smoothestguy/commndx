import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";

export interface DevActivity {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  activity_type: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  activity_date: string;
  activity_time: string | null;
  project_name: string | null;
  technologies: string[];
  tags: string[];
  extraction_confidence: string;
  source_screenshot_url: string | null;
  session_id: string | null;
}

export interface DevActivityInput {
  activity_type: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  activity_date: string;
  activity_time?: string | null;
  project_name?: string;
  technologies?: string[];
  tags?: string[];
  extraction_confidence?: string;
  source_screenshot_url?: string;
  session_id?: string;
}

export function useDevActivities(dateRange?: DateRange, targetUserId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = targetUserId || user?.id;

  const { data: activities, isLoading, error } = useQuery({
    queryKey: ["dev-activities", userId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("dev_activities")
        .select("*")
        .eq("user_id", userId)
        .order("activity_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (dateRange?.from) {
        query = query.gte("activity_date", dateRange.from.toISOString().split("T")[0]);
      }
      if (dateRange?.to) {
        query = query.lte("activity_date", dateRange.to.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DevActivity[];
    },
    enabled: !!userId,
  });

  const createActivity = useMutation({
    mutationFn: async (input: DevActivityInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("dev_activities")
        .insert([{ ...input, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success("Activity saved");
    },
    onError: (error) => {
      console.error("Failed to create activity:", error);
      toast.error("Failed to save activity");
    },
  });

  const createActivities = useMutation({
    mutationFn: async (inputs: DevActivityInput[]) => {
      if (!user) throw new Error("Not authenticated");

      const records = inputs.map((input) => ({ ...input, user_id: user.id }));
      const { data, error } = await supabase
        .from("dev_activities")
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success(`${data.length} activities saved`);
    },
    onError: (error) => {
      console.error("Failed to create activities:", error);
      toast.error("Failed to save activities");
    },
  });

  const updateActivity = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DevActivityInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("dev_activities")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success("Activity updated");
    },
    onError: (error) => {
      console.error("Failed to update activity:", error);
      toast.error("Failed to update activity");
    },
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dev_activities")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success("Activity deleted");
    },
    onError: (error) => {
      console.error("Failed to delete activity:", error);
      toast.error("Failed to delete activity");
    },
  });

  const bulkUpdateActivities = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<DevActivityInput> }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("dev_activities")
        .update(updates)
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success(`${ids.length} activities updated`);
    },
    onError: (error) => {
      console.error("Failed to bulk update activities:", error);
      toast.error("Failed to update activities");
    },
  });

  const bulkDeleteActivities = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("dev_activities")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["dev-activities"] });
      toast.success(`${ids.length} activities deleted`);
    },
    onError: (error) => {
      console.error("Failed to bulk delete activities:", error);
      toast.error("Failed to delete activities");
    },
  });

  // Get unique project names for autocomplete
  const { data: projectNames } = useQuery({
    queryKey: ["dev-activity-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("dev_activities")
        .select("project_name")
        .eq("user_id", user.id)
        .not("project_name", "is", null);

      if (error) throw error;
      
      const uniqueNames = [...new Set(data.map((d) => d.project_name).filter(Boolean))];
      return uniqueNames as string[];
    },
    enabled: !!user,
  });

  return {
    activities: activities || [],
    isLoading,
    error,
    createActivity,
    createActivities,
    updateActivity,
    deleteActivity,
    bulkUpdateActivities,
    bulkDeleteActivities,
    projectNames: projectNames || [],
  };
}

export function useAnalyzeScreenshot() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeScreenshot = async (imageBase64: string, imageType: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-dev-screenshot", {
        body: { imageBase64, imageType },
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return {
        activities: data.activities || [],
        message: data.message,
      };
    } catch (error) {
      console.error("Screenshot analysis failed:", error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { analyzeScreenshot, isAnalyzing };
}
