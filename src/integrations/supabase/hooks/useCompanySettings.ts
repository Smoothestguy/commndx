import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface CompanySettings {
  id: string;
  company_name: string;
  legal_name: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  default_tax_rate: number;
  overtime_threshold: number;
  weekly_overtime_threshold: number;
  overtime_multiplier: number;
  holiday_multiplier: number;
  invoice_footer: string | null;
  estimate_footer: string | null;
  // Locked period fields
  locked_period_date: string | null;
  locked_period_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const useCompanySettings = () => {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .single();

      if (error) throw error;
      return data as CompanySettings;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};

export const useUpdateCompanySettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      const { data, error } = await supabase
        .from("company_settings")
        .update(updates)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["company-settings"], data);
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["all-time-entries"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["time-entries"], refetchType: "all" });
      toast.success("Company settings updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update company settings: ${error.message}`);
    },
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('personnel-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('personnel-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Logo uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload logo: ${error.message}`);
    },
  });
};
