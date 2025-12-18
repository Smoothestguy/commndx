import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface TaskOrder {
  id: string;
  project_id: string;
  title: string;
  job_description: string | null;
  headcount_needed: number;
  start_at: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  status: 'draft' | 'open' | 'filled' | 'closed';
  created_at: string;
  updated_at: string;
  projects?: {
    name: string;
    customer_id?: string;
  };
}

export interface JobPosting {
  id: string;
  task_order_id: string;
  public_token: string;
  is_open: boolean;
  form_template_id: string | null;
  created_at: string;
  project_task_orders?: TaskOrder;
}

export interface Applicant {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  home_zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  status: 'new' | 'approved' | 'rejected' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  job_posting_id: string;
  applicant_id: string;
  answers: Record<string, unknown>;
  status: 'submitted' | 'reviewing' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  updated_at: string;
  applicants?: Applicant;
  job_postings?: JobPosting & {
    project_task_orders?: TaskOrder & {
      projects?: { name: string };
    };
  };
}

// ============ TASK ORDERS ============

export const useTaskOrders = (projectId?: string) => {
  return useQuery({
    queryKey: ["task-orders", projectId],
    queryFn: async () => {
      let query = supabase
        .from("project_task_orders")
        .select(`
          *,
          projects:project_id (name, customer_id)
        `)
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TaskOrder[];
    },
  });
};

export const useCreateTaskOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskOrder: Omit<TaskOrder, 'id' | 'created_at' | 'updated_at' | 'projects'>) => {
      const { data, error } = await supabase
        .from("project_task_orders")
        .insert(taskOrder)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-orders"] });
    },
  });
};

export const useUpdateTaskOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TaskOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from("project_task_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-orders"] });
    },
  });
};

// ============ JOB POSTINGS ============

export const useJobPostings = (taskOrderId?: string) => {
  return useQuery({
    queryKey: ["job-postings", taskOrderId],
    queryFn: async () => {
      let query = supabase
        .from("job_postings")
        .select(`
          *,
          project_task_orders (
            *,
            projects:project_id (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (taskOrderId) {
        query = query.eq("task_order_id", taskOrderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobPosting[];
    },
  });
};

export const useJobPostingByToken = (token: string) => {
  return useQuery({
    queryKey: ["job-posting-token", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select(`
          *,
          project_task_orders (
            *,
            projects:project_id (name)
          )
        `)
        .eq("public_token", token)
        .eq("is_open", true)
        .maybeSingle();

      if (error) throw error;
      return data as (JobPosting & { project_task_orders: TaskOrder & { projects: { name: string } } }) | null;
    },
    enabled: !!token,
  });
};

export const useCreateJobPosting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskOrderId: string) => {
      const { data, error } = await supabase
        .from("job_postings")
        .insert({ task_order_id: taskOrderId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
};

export const useToggleJobPosting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_open }: { id: string; is_open: boolean }) => {
      const { data, error } = await supabase
        .from("job_postings")
        .update({ is_open })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
};

// ============ APPLICANTS ============

export const useApplicants = () => {
  return useQuery({
    queryKey: ["applicants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Applicant[];
    },
  });
};

// ============ APPLICATIONS ============

export const useApplications = (filters?: { postingId?: string; status?: string; projectId?: string }) => {
  return useQuery({
    queryKey: ["applications", filters],
    queryFn: async () => {
      let query = supabase
        .from("applications")
        .select(`
          *,
          applicants (*),
          job_postings (
            *,
            project_task_orders (
              *,
              projects:project_id (name)
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.postingId) {
        query = query.eq("job_posting_id", filters.postingId);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status as 'submitted' | 'reviewing' | 'approved' | 'rejected');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by project if needed (must be done client-side due to nested join)
      let result = data as Application[];
      if (filters?.projectId) {
        result = result.filter(
          (app) => app.job_postings?.project_task_orders?.project_id === filters.projectId
        );
      }

      return result;
    },
  });
};

// ============ PUBLIC SUBMISSION (no auth required) ============

export const useSubmitApplication = () => {
  return useMutation({
    mutationFn: async ({
      posting_id,
      applicant: applicantData,
      answers,
    }: {
      posting_id: string;
      applicant: {
        first_name: string;
        last_name: string;
        phone?: string;
        email: string;
        home_zip?: string;
      };
      answers: Record<string, unknown>;
    }) => {
      // First, upsert the applicant by email
      const { data: existingApplicant, error: fetchError } = await supabase
        .from("applicants")
        .select("id")
        .eq("email", applicantData.email)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let applicantId: string;

      if (existingApplicant) {
        // Update existing applicant
        const { error: updateError } = await supabase
          .from("applicants")
          .update({
            first_name: applicantData.first_name,
            last_name: applicantData.last_name,
            phone: applicantData.phone || null,
            home_zip: applicantData.home_zip || null,
          } as any)
          .eq("id", existingApplicant.id);

        if (updateError) throw updateError;
        applicantId = existingApplicant.id;
      } else {
        // Create new applicant
        const { data: newApplicant, error: insertError } = await supabase
          .from("applicants")
          .insert({
            first_name: applicantData.first_name,
            last_name: applicantData.last_name,
            phone: applicantData.phone || null,
            email: applicantData.email,
            home_zip: applicantData.home_zip || null,
            status: 'new' as const,
          } as any)
          .select("id")
          .single();

        if (insertError) throw insertError;
        applicantId = newApplicant.id;
      }

      // Create the application
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          job_posting_id: posting_id,
          applicant_id: applicantId,
          answers,
          status: 'submitted' as const,
        } as any)
        .select()
        .single();

      if (appError) throw appError;
      return application;
    },
  });
};

// ============ APPROVE/REJECT ============

export const useApproveApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes?: string }) => {
      // Get the application with applicant data
      const { data: application, error: fetchError } = await supabase
        .from("applications")
        .select(`
          *,
          applicants (*)
        `)
        .eq("id", applicationId)
        .single();

      if (fetchError) throw fetchError;

      const applicant = application.applicants as Applicant;

      // Update application status
      const { error: appUpdateError } = await supabase
        .from("applications")
        .update({ status: 'approved', notes })
        .eq("id", applicationId);

      if (appUpdateError) throw appUpdateError;

      // Update applicant status
      const { error: applicantUpdateError } = await supabase
        .from("applicants")
        .update({ status: 'approved' })
        .eq("id", application.applicant_id);

      if (applicantUpdateError) throw applicantUpdateError;

      // Create personnel record
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .insert({
          first_name: applicant.first_name,
          last_name: applicant.last_name,
          email: applicant.email,
          phone: applicant.phone,
          applicant_id: applicant.id,
          status: 'active' as const,
        } as any)
        .select()
        .single();

      if (personnelError) throw personnelError;

      return personnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
    },
  });
};

export const useRejectApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes?: string }) => {
      // Update application status
      const { data: application, error: appError } = await supabase
        .from("applications")
        .update({ status: 'rejected', notes })
        .eq("id", applicationId)
        .select("applicant_id")
        .single();

      if (appError) throw appError;

      // Check if applicant has any other non-rejected applications
      const { data: otherApps, error: checkError } = await supabase
        .from("applications")
        .select("id")
        .eq("applicant_id", application.applicant_id)
        .neq("status", "rejected");

      if (checkError) throw checkError;

      // Only mark applicant as rejected if no other active applications
      if (!otherApps || otherApps.length === 0) {
        const { error: applicantError } = await supabase
          .from("applicants")
          .update({ status: 'rejected' })
          .eq("id", application.applicant_id);

        if (applicantError) throw applicantError;
      }

      return application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
    },
  });
};

export const useUpdateApplicationNotes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes: string }) => {
      const { data, error } = await supabase
        .from("applications")
        .update({ notes })
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
