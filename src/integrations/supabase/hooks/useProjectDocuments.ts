import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface ProjectDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
}

export const useProjectDocuments = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProjectDocument[];
    },
    enabled: !!projectId,
  });
};

export const useUploadProjectDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
    }: {
      projectId: string;
      file: File;
    }) => {
      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${projectId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create document record
      const { data, error: insertError } = await supabase
        .from("project_documents")
        .insert([
          {
            project_id: projectId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user?.id || null,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-documents", variables.projectId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
};

export const useDeleteProjectDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath, projectId }: { id: string; filePath: string; projectId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("project-documents")
        .remove([filePath]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete record
      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
};

export const useGetProjectDocumentUrl = () => {
  return async (filePath: string) => {
    const { data } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  };
};
