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
  address: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  photo_url: string | null;
  status: 'new' | 'approved' | 'rejected' | 'inactive';
  geocoded_at: string | null;
  geocode_source: string | null;
  is_geocodable: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  job_posting_id: string;
  applicant_id: string;
  answers: Record<string, unknown>;
  status: 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'needs_info' | 'updated';
  notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  edit_token?: string | null;
  edit_token_expires_at?: string | null;
  missing_fields?: string[];
  admin_message?: string | null;
  contacted_at?: string | null;
  contacted_by?: string | null;
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

export interface GeoSubmissionData {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  source: "device" | "ip_fallback" | null;
  capturedAt: string | null;
  error: string | null;
}

export const useSubmitApplication = () => {
  return useMutation({
    mutationFn: async ({
      posting_id,
      applicant: applicantData,
      answers,
      geo,
      clientSubmittedAt,
      userAgent,
      smsConsent,
      smsConsentPhone,
      smsConsentTextVersion,
    }: {
      posting_id: string;
      applicant: {
        first_name: string;
        last_name: string;
        phone: string;
        email: string;
        address?: string;
        city?: string;
        state?: string;
        home_zip?: string;
        photo_url?: string;
      };
      answers: Record<string, unknown>;
      geo?: GeoSubmissionData;
      clientSubmittedAt?: string;
      userAgent?: string;
      smsConsent?: boolean;
      smsConsentPhone?: string;
      smsConsentTextVersion?: string;
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

      // Allow repeat applications - existing personnel/applicants can apply to new positions
      // or re-apply to the same position (creates a new application each time)
      console.log("[Application] Allowing application regardless of existing applications");

      let applicantId: string;

      if (existingApplicant) {
        // Use existing applicant ID - don't attempt to update (would fail RLS for public users)
        // Applicant info updates can happen during admin review if needed
        applicantId = existingApplicant.id;
        console.log("[Application] Using existing applicant:", applicantId);
        
        // Check if this applicant has an ACTIVE (non-rejected) application for this job posting
        // Allow re-application if previous application was rejected/removed
        const { data: existingApplication, error: checkError } = await supabase
          .from("applications")
          .select("id")
          .eq("applicant_id", applicantId)
          .eq("job_posting_id", posting_id)
          .neq("status", "rejected")
          .maybeSingle();
        
        if (checkError) {
          console.error("[Application] Error checking existing application:", checkError);
          throw checkError;
        }
        
        if (existingApplication) {
          console.log("[Application] Duplicate application detected for same job posting");
          throw new Error("DUPLICATE_APPLICATION");
        }
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
            address: applicantData.address || null,
            city: applicantData.city || null,
            state: applicantData.state || null,
            home_zip: applicantData.home_zip || null,
            photo_url: applicantData.photo_url || null,
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

      // Create the application with geo data and timestamps
      console.log("[Application] Creating application record for applicant:", applicantId);
      console.log("[Application] Geo data:", geo);
      
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          job_posting_id: posting_id,
          applicant_id: applicantId,
          answers: processedAnswers,
          status: 'submitted' as const,
          submitted_at: new Date().toISOString(),
          client_submitted_at: clientSubmittedAt || null,
          geo_lat: geo?.lat || null,
          geo_lng: geo?.lng || null,
          geo_accuracy: geo?.accuracy || null,
          geo_source: geo?.source || null,
          geo_captured_at: geo?.capturedAt || null,
          geo_error: geo?.error || null,
          user_agent: userAgent || null,
          sms_consent: smsConsent || false,
          sms_consent_phone: smsConsent ? smsConsentPhone : null,
          sms_consent_at: smsConsent ? new Date().toISOString() : null,
          sms_consent_method: smsConsent ? 'web_form' : null,
          sms_consent_text_version: smsConsent ? (smsConsentTextVersion || 'v1.0') : null,
        } as any)
        .select()
        .single();

      if (appError) {
        console.error("[Application] Error creating application:", appError);
        throw appError;
      }
      console.log("[Application] Application created successfully:", application.id);

      // Send SMS confirmation if consent was given
      if (smsConsent && smsConsentPhone) {
        try {
          console.log("[Application] Sending SMS confirmation to:", smsConsentPhone);
          await supabase.functions.invoke("send-application-sms-confirmation", {
            body: {
              applicationId: application.id,
              phone: smsConsentPhone,
              firstName: applicantData.first_name,
            },
          });
          console.log("[Application] SMS confirmation sent successfully");
        } catch (smsError) {
          // Non-critical error - log but don't fail the submission
          console.error("[Application] Error sending SMS confirmation (non-critical):", smsError);
        }
      }

      // Auto-geocode applicant if they have address info but no coordinates
      try {
        // Check if applicant already has coordinates
        const { data: applicant } = await supabase
          .from("applicants")
          .select("home_lat, home_lng, address, city, state, home_zip")
          .eq("id", applicantId)
          .single();

        if (!applicant?.home_lat && !applicant?.home_lng) {
          // Build address from applicant data or form answers
          const addressParts = [
            applicant?.address || applicantData.address || answers.address || answers.street_address,
            applicant?.city || applicantData.city || answers.city,
            applicant?.state || applicantData.state || answers.state,
            applicant?.home_zip || applicantData.home_zip || answers.zip || answers.zipcode,
          ].filter(Boolean);

          const address = addressParts.join(", ");
          
          if (address) {
            console.log("[Application] Auto-geocoding applicant address:", address);
            const { data: geo } = await supabase.functions.invoke("geocode", {
              body: { address },
            });

            if (geo?.ok && geo.lat && geo.lng) {
              console.log("[Application] Geocode successful:", geo.lat, geo.lng);
              await supabase
                .from("applicants")
                .update({
                  home_lat: geo.lat,
                  home_lng: geo.lng,
                  geocoded_at: new Date().toISOString(),
                  geocode_source: 'mapbox_submission',
                  is_geocodable: true,
                })
                .eq("id", applicantId);
            } else {
              console.log("[Application] Geocode returned no result:", geo?.reason || geo?.error);
              // Mark as geocodable but without coordinates
              await supabase
                .from("applicants")
                .update({ is_geocodable: false })
                .eq("id", applicantId);
            }
          } else {
            // No address data available
            await supabase
              .from("applicants")
              .update({ is_geocodable: false })
              .eq("id", applicantId);
          }
        }
      } catch (geoError) {
        // Non-critical error - log but don't fail the submission
        console.error("[Application] Geocoding failed (non-critical):", geoError);
      }

      return application;
    },
  });
};

// ============ APPROVE/REJECT ============

export type ApprovalRecordType = "personnel" | "vendor" | "customer" | "personnel_vendor";

export const useApproveApplicationWithType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      recordType,
      notes 
    }: { 
      applicationId: string; 
      recordType: ApprovalRecordType;
      notes?: string;
    }) => {
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

      // Prevent double-approval
      if (application.status === 'approved') {
        throw new Error('Application is already approved');
      }

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

      let createdPersonnel = null;
      let createdVendor = null;
      let createdCustomer = null;

      // Create records based on record type
      if (recordType === "personnel" || recordType === "personnel_vendor") {
        // Check if personnel already exists with same email
        const { data: existingPersonnel } = await supabase
          .from("personnel")
          .select("id")
          .eq("email", applicant.email)
          .maybeSingle();

        if (existingPersonnel) {
          // Update existing personnel with applicant_id if not set
          await supabase
            .from("personnel")
            .update({ applicant_id: applicant.id } as any)
            .eq("id", existingPersonnel.id);
          createdPersonnel = existingPersonnel;
        } else {
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
          createdPersonnel = personnel;

          // Send onboarding email
          try {
            await supabase.functions.invoke("send-personnel-onboarding-email", {
              body: {
                personnelId: personnel.id,
                email: applicant.email,
                firstName: applicant.first_name,
                lastName: applicant.last_name,
              },
            });
          } catch (emailErr) {
            console.error("[Approve] Error sending onboarding email:", emailErr);
          }
        }
      }

      if (recordType === "vendor" || recordType === "personnel_vendor") {
        // Check if vendor already exists
        const { data: existingVendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("email", applicant.email)
          .maybeSingle();

        if (!existingVendor) {
          const { data: vendor, error: vendorError } = await supabase
            .from("vendors")
            .insert({
              name: `${applicant.first_name} ${applicant.last_name}`,
              email: applicant.email,
              phone: applicant.phone || null,
              company: null,
              specialty: null,
              status: 'active' as const,
              rating: 0,
            })
            .select()
            .single();

          if (vendorError) throw vendorError;
          createdVendor = vendor;

          // Link personnel to vendor if both were created
          if (createdPersonnel && createdVendor) {
            await supabase
              .from("personnel")
              .update({ vendor_id: createdVendor.id } as any)
              .eq("id", createdPersonnel.id);
          }
        } else {
          createdVendor = existingVendor;
        }
      }

      if (recordType === "customer") {
        // Check if customer already exists
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("email", applicant.email)
          .maybeSingle();

        if (!existingCustomer) {
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: `${applicant.first_name} ${applicant.last_name}`,
              email: applicant.email,
              phone: applicant.phone || null,
              company: null,
              address: applicant.address || null,
            })
            .select()
            .single();

          if (customerError) throw customerError;
          createdCustomer = customer;
        } else {
          createdCustomer = existingCustomer;
        }
      }

      // For personnel-only type, always create a linked vendor for QuickBooks sync
      if (recordType === 'personnel' && createdPersonnel && !createdVendor) {
        console.log('[Approve] Personnel-only type, creating linked vendor for QB sync');
        const { data: existingVendorByEmail } = await supabase
          .from("vendors")
          .select()
          .eq("email", applicant.email)
          .maybeSingle();

        if (!existingVendorByEmail) {
          const { data: personnelVendor, error: pvError } = await supabase
            .from("vendors")
            .insert({
              name: `${applicant.first_name} ${applicant.last_name}`,
              email: applicant.email,
              phone: applicant.phone || null,
              vendor_type: 'personnel',
              status: 'active',
            })
            .select()
            .single();

          if (!pvError && personnelVendor) {
            // Link personnel to this vendor
            await supabase
              .from("personnel")
              .update({ vendor_id: personnelVendor.id } as any)
              .eq("id", createdPersonnel.id);
            
            createdVendor = personnelVendor;
            console.log('[Approve] Created linked vendor for personnel:', personnelVendor.id);
          }
        } else {
          // Link to existing vendor
          await supabase
            .from("personnel")
            .update({ vendor_id: existingVendorByEmail.id } as any)
            .eq("id", createdPersonnel.id);
          
          createdVendor = existingVendorByEmail;
          console.log('[Approve] Linked personnel to existing vendor:', existingVendorByEmail.id);
        }
      }

      // QuickBooks sync - sync as vendor for personnel/vendor types, customer for customer type
      try {
        const { data: qbConfig } = await supabase
          .from('quickbooks_config')
          .select('is_connected')
          .eq('is_connected', true)
          .maybeSingle();

        if (qbConfig?.is_connected) {
          if (recordType === 'customer' && createdCustomer) {
            // Sync as QuickBooks Customer
            console.log('[Approve] Syncing customer to QuickBooks:', createdCustomer.id);
            await supabase.functions.invoke('quickbooks-sync-customers', {
              body: { action: 'sync-single', customerId: createdCustomer.id }
            });
          } else if (createdVendor) {
            // Personnel, Vendor, or Personnel+Vendor → all have createdVendor set now
            console.log('[Approve] Syncing vendor to QuickBooks:', createdVendor.id);
            await supabase.functions.invoke('quickbooks-sync-vendors', {
              body: { action: 'sync-single', vendorId: createdVendor.id }
            });
          }
        }
      } catch (qbError) {
        console.error('[Approve] QuickBooks sync error (non-fatal):', qbError);
        // Don't throw - approval succeeded, QB sync is secondary
      }

      return { personnel: createdPersonnel, vendor: createdVendor, customer: createdCustomer, recordType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

// Keep the original hook for backwards compatibility
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

      // Prevent double-approval
      if (application.status === 'approved') {
        throw new Error('Application is already approved');
      }

      const applicant = application.applicants as Applicant;

      // Check if personnel already exists with same email (prevent duplicates)
      const { data: existingPersonnel } = await supabase
        .from("personnel")
        .select("id")
        .eq("email", applicant.email)
        .maybeSingle();

      if (existingPersonnel) {
        // Personnel already exists - just update application status and link
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

        // Update existing personnel with applicant_id if not set
        await supabase
          .from("personnel")
          .update({ applicant_id: applicant.id } as any)
          .eq("id", existingPersonnel.id);

        return existingPersonnel;
      }

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

      // Create personnel record (only if none exists with this email)
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
      photo_url,
    }: {
      id: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      home_zip?: string;
      photo_url?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (first_name !== undefined) updates.first_name = first_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone || null;
      if (home_zip !== undefined) updates.home_zip = home_zip || null;
      if (photo_url !== undefined) updates.photo_url = photo_url;

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
      status,
      missing_fields,
    }: {
      id: string;
      notes?: string;
      answers?: Record<string, unknown>;
      status?: string;
      missing_fields?: string[] | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (notes !== undefined) updates.notes = notes;
      if (answers !== undefined) updates.answers = answers;
      if (status !== undefined) updates.status = status;
      if (missing_fields !== undefined) updates.missing_fields = missing_fields;

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

// ============ REMOVE FROM POSTING (only rejects this specific application) ============

export const useRemoveFromPosting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      // Only update the specific application to rejected - keeps applicant and other applications intact
      const { data, error } = await supabase
        .from("applications")
        .update({ status: 'rejected' as const })
        .eq("id", applicationId)
        .select("*, applicants (*)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
};

// ============ REVOKE APPROVAL (deletes entire applicant record) ============

export const useRevokeApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      // 1. Get the application with applicant data
      const { data: application, error: fetchError } = await supabase
        .from("applications")
        .select("*, applicants (*)")
        .eq("id", applicationId)
        .single();

      if (fetchError) throw fetchError;
      if (!application) throw new Error("Application not found");

      const applicantId = application.applicant_id;

      // 2. Delete the personnel record linked to this applicant (if exists)
      await supabase
        .from("personnel")
        .delete()
        .eq("applicant_id", applicantId);

      // 3. Delete the application record
      const { error: appError } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

      if (appError) throw appError;

      // 4. Delete the applicant record so they can reapply fresh
      const { error: applicantError } = await supabase
        .from("applicants")
        .delete()
        .eq("id", applicantId);

      if (applicantError) throw applicantError;

      return application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
    },
  });
};

// ============ REVERSE APPROVAL (sets back to submitted, marks records inactive) ============

export const useReverseApprovalWithReason = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      // 1. Get the application with applicant data
      const { data: application, error: fetchError } = await supabase
        .from("applications")
        .select("*, applicants (*)")
        .eq("id", applicationId)
        .single();

      if (fetchError) throw fetchError;
      if (!application) throw new Error("Application not found");

      const applicant = application.applicants;
      if (!applicant) throw new Error("Applicant not found");

      // 2. Update application status back to submitted with reversal note
      const existingNotes = application.notes || "";
      const reversalNote = `[REVERSED ${new Date().toISOString()}] Reason: ${reason}`;
      const newNotes = existingNotes ? `${existingNotes}\n\n${reversalNote}` : reversalNote;

      const { error: appUpdateError } = await supabase
        .from("applications")
        .update({ 
          status: 'submitted',
          notes: newNotes
        })
        .eq("id", applicationId);

      if (appUpdateError) throw appUpdateError;

      // 3. Update applicant status back to new (so they can be re-reviewed)
      await supabase
        .from("applicants")
        .update({ status: 'new' })
        .eq("id", applicant.id);

      // 4. Mark linked personnel as inactive (if exists)
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id")
        .eq("applicant_id", applicant.id)
        .maybeSingle();

      if (personnel) {
        await supabase
          .from("personnel")
          .update({ status: 'inactive' })
          .eq("id", personnel.id);
      }

      // 5. Mark linked vendor as inactive (by email match)
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("email", applicant.email)
        .maybeSingle();

      if (vendor) {
        await supabase
          .from("vendors")
          .update({ status: 'inactive' })
          .eq("id", vendor.id);
      }

      // 6. Add note to customer record (if exists) - customers don't have status field
      const { data: customer } = await supabase
        .from("customers")
        .select("id, notes")
        .eq("email", applicant.email)
        .maybeSingle();

      if (customer) {
        const customerNotes = customer.notes || "";
        const customerReversalNote = `[APPROVAL REVERSED ${new Date().toISOString()}] ${reason}`;
        await supabase
          .from("customers")
          .update({ notes: customerNotes ? `${customerNotes}\n\n${customerReversalNote}` : customerReversalNote })
          .eq("id", customer.id);
      }

      return { application, reason };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

// Get application linked to a personnel record
export const useApplicationByPersonnelId = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["application-by-personnel", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;
      
      // Get personnel's applicant_id
      const { data: personnel } = await supabase
        .from("personnel")
        .select("applicant_id")
        .eq("id", personnelId)
        .single();
      
      if (!personnel?.applicant_id) return null;
      
      // Get the application for this applicant
      const { data: application } = await supabase
        .from("applications")
        .select("id, status, applicants(*)")
        .eq("applicant_id", personnel.applicant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return application;
    },
    enabled: !!personnelId,
  });
};
