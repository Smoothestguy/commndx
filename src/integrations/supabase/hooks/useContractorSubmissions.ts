import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "currency" | "dropdown" | "customer_select" | "project_select" | "file_upload" | "checkbox" | "radio" | "number";
  required: boolean;
  order: number;
  options?: string[];
  placeholder?: string;
}

export interface FormConfiguration {
  id: string;
  form_type: "bill" | "expense";
  fields: FormField[];
  created_at: string;
  updated_at: string;
}

export interface SubmissionFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface ContractorSubmission {
  id: string;
  submission_type: "bill" | "expense";
  contractor_name: string;
  job_name: string | null;
  customer_name: string | null;
  project_name: string | null;
  expense_description: string | null;
  amount: number | null;
  submission_date: string;
  files: SubmissionFile[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Fetch form configuration
export function useFormConfiguration(formType: "bill" | "expense") {
  return useQuery({
    queryKey: ["contractor-form-config", formType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractor_form_configurations")
        .select("*")
        .eq("form_type", formType)
        .single();

      if (error) throw error;
      return {
        ...data,
        fields: (data.fields as unknown as FormField[]).sort((a, b) => a.order - b.order)
      } as FormConfiguration;
    },
  });
}

// Fetch all form configurations (for admin)
export function useAllFormConfigurations() {
  return useQuery({
    queryKey: ["contractor-form-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractor_form_configurations")
        .select("*");

      if (error) throw error;
      return data.map(config => ({
        ...config,
        fields: (config.fields as unknown as FormField[]).sort((a, b) => a.order - b.order)
      })) as FormConfiguration[];
    },
  });
}

// Update form configuration
export function useUpdateFormConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formType, fields }: { formType: "bill" | "expense"; fields: FormField[] }) => {
      const { data, error } = await supabase
        .from("contractor_form_configurations")
        .update({ fields: JSON.parse(JSON.stringify(fields)) })
        .eq("form_type", formType)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-form-config"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-form-configs"] });
    },
  });
}

// Submit a new contractor submission (public)
export function useCreateContractorSubmission() {
  return useMutation({
    mutationFn: async (submission: Omit<ContractorSubmission, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("contractor_submissions")
        .insert([{
          submission_type: submission.submission_type,
          contractor_name: submission.contractor_name,
          job_name: submission.job_name,
          customer_name: submission.customer_name,
          project_name: submission.project_name,
          expense_description: submission.expense_description,
          amount: submission.amount,
          submission_date: submission.submission_date,
          files: JSON.parse(JSON.stringify(submission.files)),
          custom_fields: JSON.parse(JSON.stringify(submission.custom_fields)),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// Fetch all submissions (admin only)
export function useContractorSubmissions(filters?: {
  type?: "bill" | "expense";
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["contractor-submissions", filters],
    queryFn: async () => {
      let query = supabase
        .from("contractor_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.type) {
        query = query.eq("submission_type", filters.type);
      }
      if (filters?.startDate) {
        query = query.gte("submission_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("submission_date", filters.endDate);
      }
      if (filters?.search) {
        query = query.ilike("contractor_name", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data.map(item => ({
        ...item,
        files: item.files as unknown as SubmissionFile[],
        custom_fields: item.custom_fields as Record<string, unknown>,
      })) as ContractorSubmission[];
    },
  });
}

// Delete a submission (admin only)
export function useDeleteContractorSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contractor_submissions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-submissions"] });
    },
  });
}

// Upload files to contractor-submissions bucket
export async function uploadContractorFile(
  file: File,
  submissionType: "bill" | "expense",
  contractorName: string,
  date: string
): Promise<SubmissionFile> {
  const sanitizedName = contractorName.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
  const dateFolder = date || new Date().toISOString().split("T")[0];
  const timestamp = Date.now();
  const filePath = `${submissionType}s/${sanitizedName}/${dateFolder}/${timestamp}_${file.name}`;

  const { error } = await supabase.storage
    .from("contractor-submissions")
    .upload(filePath, file);

  if (error) throw error;

  return {
    name: file.name,
    path: filePath,
    size: file.size,
    type: file.type,
  };
}

// Get signed URL for a file (admin only)
export async function getContractorFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("contractor-submissions")
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
