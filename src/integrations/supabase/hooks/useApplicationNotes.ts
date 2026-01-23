import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApplicationNote {
  id: string;
  application_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

// Fetch notes for an application
export const useApplicationNotes = (applicationId: string | undefined) => {
  return useQuery({
    queryKey: ["application-notes", applicationId],
    queryFn: async () => {
      if (!applicationId) return [];

      // Fetch notes
      const { data: notes, error } = await supabase
        .from("application_notes")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user names for notes
      const userIds = [...new Set(notes.map((n) => n.user_id))];
      if (userIds.length === 0) return notes as ApplicationNote[];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown User"]) || []
      );

      return notes.map((note) => ({
        ...note,
        user_name: profileMap.get(note.user_id) || "Unknown User",
      })) as ApplicationNote[];
    },
    enabled: !!applicationId,
  });
};

// Add a new note
export const useAddApplicationNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      content,
    }: {
      applicationId: string;
      content: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("application_notes")
        .insert({
          application_id: applicationId,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Get user's name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      return {
        ...data,
        user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown User",
      } as ApplicationNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["application-notes", variables.applicationId],
      });
    },
  });
};

// Toggle application contacted status
export const useToggleApplicationContacted = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      contacted,
    }: {
      applicationId: string;
      contacted: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("applications")
        .update({
          contacted_at: contacted ? new Date().toISOString() : null,
          contacted_by: contacted ? user?.id : null,
        })
        .eq("id", applicationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
};
