import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PersonnelDocument {
  id: string;
  personnel_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  created_at: string;
}

/**
 * Hook to fetch all documents for a specific personnel
 */
export function usePersonnelDocuments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-documents", personnelId],
    queryFn: async (): Promise<PersonnelDocument[]> => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_documents")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as PersonnelDocument[];
    },
    enabled: !!personnelId,
  });
}

/**
 * Hook to delete a personnel document
 */
export function useDeletePersonnelDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, filePath }: { documentId: string; filePath: string }) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("personnel-documents")
        .remove([filePath]);

      if (storageError) {
        console.warn("[Documents] Storage deletion warning:", storageError);
        // Continue anyway - file might already be deleted or in different location
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("personnel_documents")
        .delete()
        .eq("id", documentId);

      if (dbError) throw dbError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-documents"] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      console.error("[Documents] Delete failed:", error);
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

/**
 * Hook to get a signed URL for downloading a document
 */
export function useGetPersonnelDocumentUrl() {
  return async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from("personnel-documents")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error("[Documents] Failed to get signed URL:", error);
      return null;
    }
  };
}

// Document type labels for display
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  government_id: "Government ID",
  ssn_card: "Social Security Card",
  work_permit: "Work Permit",
  i94: "I-94 Travel Record",
  passport: "Passport",
  drivers_license: "Driver's License",
  birth_certificate: "Birth Certificate",
  other: "Other Document",
};

export function getDocumentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
