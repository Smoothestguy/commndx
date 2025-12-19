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
    mutationFn: async ({ taskOrderId, formTemplateId }: { taskOrderId: string; formTemplateId?: string }) => {
      const { data, error } = await supabase
        .from("job_postings")
        .insert({ 
          task_order_id: taskOrderId,
          form_template_id: formTemplateId || null
        })
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

export const useUpdateJobPosting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formTemplateId }: { id: string; formTemplateId: string | null }) => {
      const { data, error } = await supabase
        .from("job_postings")
        .update({ form_template_id: formTemplateId })
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
        phone: string;
        email: string;
        home_zip?: string;
      };
      answers: Record<string, unknown>;
    }) => {
      console.log("[Application] Starting submission for posting:", posting_id);
      console.log("[Application] Applicant data:", applicantData);
      
      // First, check if applicant exists
      console.log("[Application] Checking for existing applicant by email:", applicantData.email);
      const { data: existingApplicant, error: fetchError } = await supabase
        .from("applicants")
        .select("id")
        .eq("email", applicantData.email)
        .maybeSingle();

      if (fetchError) {
        console.error("[Application] Error checking existing applicant:", fetchError);
        throw fetchError;
      }
      console.log("[Application] Existing applicant result:", existingApplicant);

      // If applicant exists, check if they already applied to this posting
      if (existingApplicant) {
        console.log("[Application] Checking for duplicate application for applicant:", existingApplicant.id);
        const { data: existingApplication, error: appCheckError } = await supabase
          .from("applications")
          .select("id")
          .eq("applicant_id", existingApplicant.id)
          .eq("job_posting_id", posting_id)
          .maybeSingle();

        if (appCheckError) {
          console.error("[Application] Error checking duplicate application:", appCheckError);
          throw appCheckError;
        }

        if (existingApplication) {
          console.log("[Application] Duplicate application found:", existingApplication.id);
          throw new Error("DUPLICATE_APPLICATION");
        }
        console.log("[Application] No duplicate application found");
      }

      let applicantId: string;

      if (existingApplicant) {
        // Update existing applicant
        console.log("[Application] Updating existing applicant:", existingApplicant.id);
        const { error: updateError } = await supabase
          .from("applicants")
          .update({
            first_name: applicantData.first_name,
            last_name: applicantData.last_name,
            phone: applicantData.phone,
            home_zip: applicantData.home_zip || null,
          } as any)
          .eq("id", existingApplicant.id);

        if (updateError) {
          console.error("[Application] Error updating applicant:", updateError);
          throw updateError;
        }
        applicantId = existingApplicant.id;
        console.log("[Application] Applicant updated successfully");
      } else {
        // Create new applicant
        console.log("[Application] Creating new applicant");
        const { data: newApplicant, error: insertError } = await supabase
          .from("applicants")
          .insert({
            first_name: applicantData.first_name,
            last_name: applicantData.last_name,
            phone: applicantData.phone,
            email: applicantData.email,
            home_zip: applicantData.home_zip || null,
            status: 'new' as const,
          } as any)
          .select("id")
          .single();

        if (insertError) {
          console.error("[Application] Error creating applicant:", insertError);
          throw insertError;
        }
        applicantId = newApplicant.id;
        console.log("[Application] New applicant created:", applicantId);
      }

      // Files are now uploaded immediately by FormFileUpload component
      // Just filter out any empty objects or null values that might have been left from failed uploads
      const processedAnswers: Record<string, unknown> = {};
      for (const [fieldId, value] of Object.entries(answers)) {
        // Skip empty objects (failed uploads or unset file fields)
        if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
          console.log("[Application] Skipping empty object for field:", fieldId);
          continue;
        }
        // Keep all other values (including URL strings from successful uploads)
        processedAnswers[fieldId] = value;
      }
      console.log("[Application] Processed answers:", processedAnswers);

      // Create the application
      console.log("[Application] Creating application record for applicant:", applicantId);
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          job_posting_id: posting_id,
          applicant_id: applicantId,
          answers: processedAnswers,
          status: 'submitted' as const,
        } as any)
        .select()
        .single();

      if (appError) {
        console.error("[Application] Error creating application:", appError);
        throw appError;
      }
      console.log("[Application] Application created successfully:", application.id);
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

      // Send onboarding email
      try {
        const { error: emailError } = await supabase.functions.invoke(
          "send-personnel-onboarding-email",
          {
            body: {
              personnelId: personnel.id,
              email: applicant.email,
              firstName: applicant.first_name,
              lastName: applicant.last_name,
            },
          }
        );

        if (emailError) {
          console.error("[Approve] Failed to send onboarding email:", emailError);
          // Don't throw - approval succeeded, email is secondary
        }
      } catch (emailErr) {
        console.error("[Approve] Error sending onboarding email:", emailErr);
        // Don't throw - approval succeeded, email is secondary
      }

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

// ============ UPDATE APPLICANT ============

export const useUpdateApplicant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      first_name,
      last_name,
      email,
      phone,
      home_zip,
    }: {
      id: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      home_zip?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (first_name !== undefined) updates.first_name = first_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone || null;
      if (home_zip !== undefined) updates.home_zip = home_zip || null;

      const { data, error } = await supabase
        .from("applicants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
    },
  });
};

// ============ UPDATE APPLICATION ============

export const useUpdateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
      answers,
    }: {
      id: string;
      notes?: string;
      answers?: Record<string, unknown>;
    }) => {
      const updates: Record<string, unknown> = {};
      if (notes !== undefined) updates.notes = notes;
      if (answers !== undefined) updates.answers = answers;

      const { data, error } = await supabase
        .from("applications")
        .update(updates)
        .eq("id", id)
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
