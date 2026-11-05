import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { projectDocumentFileType } from "@/lib/projectDocumentUpload";

export interface ProjectDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
  location_id: string | null;
  requires_signature: boolean;
  notes: string | null;
  is_signin_template?: boolean;
  is_reusable_template?: boolean;
  rows_per_page?: number | null;
  row_height_pct?: number | null;
  location_ids?: string[];
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
      const docs = data as ProjectDocument[];
      if (!docs.length) return docs;
      const { data: links, error: linkError } = await supabase.from('document_locations').select('document_id,location_id').in('document_id', docs.map(d => d.id));
      if (linkError) throw linkError;
      return docs.map(d => ({ ...d, location_ids: (links ?? []).filter(l => l.document_id === d.id).map(l => l.location_id) }));
    },
    enabled: !!projectId,
  });
};

export const useUploadProjectDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      file, locationId, requiresSignature = false, notes, isSigninTemplate = false, isReusableTemplate = false, locationIds = [],
    }: {
      projectId: string;
      file: File;
      locationId?: string | null;
      requiresSignature?: boolean;
      notes?: string;
      isSigninTemplate?: boolean;
      isReusableTemplate?: boolean;
      locationIds?: string[];
    }) => {
      const fileType = projectDocumentFileType(file);
      if ((requiresSignature || isSigninTemplate) && fileType !== "application/pdf") throw new Error("Signature requests and sign-in templates require a PDF");
      // Resolve the authenticated uploader before making any storage writes.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError || new Error("Please sign in again before uploading a document");
      // Upload to storage
      const fileName = `${projectId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(fileName, file.type ? file : new File([file], file.name, { type: fileType }), { upsert: false });

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error: insertError } = await supabase
        .from("project_documents")
        .insert([
          {
            project_id: projectId,
            location_id: locationId || null,
            requires_signature: requiresSignature,
            is_signin_template: isSigninTemplate,
            is_reusable_template: isSigninTemplate && isReusableTemplate,
            rows_per_page: isSigninTemplate ? 12 : null,
            row_height_pct: isSigninTemplate ? 0.045 : null,
            notes: notes?.trim() || null,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: fileType,
            uploaded_by: user.id,
          },
        ])
        .select()
        .single();

      if (insertError) { await supabase.storage.from("project-documents").remove([fileName]); throw insertError; }
      if (isSigninTemplate && locationIds.length) {
        const { error } = await supabase.from('document_locations').insert(locationIds.map(location_id => ({ document_id: data.id, location_id })));
        if (error) { await supabase.from('project_documents').delete().eq('id', data.id); await supabase.storage.from('project-documents').remove([fileName]); throw error; }
      }
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
      // Delete record
      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      // Reusable copies can share an object across projects. Never remove shared originals here.
      // Object cleanup must be performed by a privileged reference-aware lifecycle, not a staff client.
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
