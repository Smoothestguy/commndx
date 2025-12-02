import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WeatherLog } from "@/types/roofing";

export function useWeatherLogs() {
  return useQuery({
    queryKey: ["weather-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_logs")
        .select(`
          *,
          project:projects(name)
        `)
        .order("log_date", { ascending: false });

      if (error) throw error;
      return data as unknown as WeatherLog[];
    },
  });
}

export function useWeatherLog(id: string) {
  return useQuery({
    queryKey: ["weather-log", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_logs")
        .select(`
          *,
          project:projects(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as WeatherLog;
    },
    enabled: !!id,
  });
}

export function useCreateWeatherLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: {
      project_id?: string;
      location: string;
      log_date?: string;
      temperature_high?: number;
      temperature_low?: number;
      precipitation?: number;
      wind_speed?: number;
      conditions?: string;
      work_suitable?: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("weather_logs")
        .insert(log)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-logs"] });
    },
  });
}

export function useDeleteWeatherLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weather_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-logs"] });
    },
  });
}
