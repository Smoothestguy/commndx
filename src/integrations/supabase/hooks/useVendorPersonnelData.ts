import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";

export interface VendorPersonnel {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  vendor_id: string | null;
  linked_vendor_id: string | null;
}

export interface SmartProjectSuggestion {
  project_id: string;
  project_name: string;
  reason: string;
}

// Get all personnel linked to a vendor (via vendor_id or linked_vendor_id)
export const usePersonnelForVendor = (vendorId: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-for-vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, email, phone, vendor_id, linked_vendor_id")
        .or(`vendor_id.eq.${vendorId},linked_vendor_id.eq.${vendorId}`)
        .eq("status", "active");

      if (error) throw error;
      return data as VendorPersonnel[];
    },
    enabled: !!vendorId,
  });
};

// Get smart project suggestion for a vendor based on personnel assignments
export const useSmartProjectForVendor = (vendorId: string | undefined) => {
  return useQuery({
    queryKey: ["smart-project-for-vendor", vendorId],
    queryFn: async (): Promise<SmartProjectSuggestion | null> => {
      if (!vendorId) return null;

      // Step 1: Find personnel linked to this vendor
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("id, first_name, last_name")
        .or(`vendor_id.eq.${vendorId},linked_vendor_id.eq.${vendorId}`)
        .eq("status", "active");

      if (personnelError) throw personnelError;

      // Step 2: If personnel found, check their active project assignments
      if (personnel && personnel.length > 0) {
        const personnelIds = personnel.map(p => p.id);
        
        const { data: assignments, error: assignError } = await supabase
          .from("personnel_project_assignments")
          .select(`
            id,
            personnel_id,
            project_id,
            assigned_at,
            projects:project_id (id, name)
          `)
          .in("personnel_id", personnelIds)
          .eq("status", "active")
          .order("assigned_at", { ascending: false })
          .limit(1);

        if (assignError) throw assignError;

        if (assignments && assignments.length > 0 && assignments[0].projects) {
          const project = assignments[0].projects as { id: string; name: string };
          const personnelRecord = personnel.find(p => p.id === assignments[0].personnel_id);
          return {
            project_id: project.id,
            project_name: project.name,
            reason: `Active assignment for ${personnelRecord?.first_name} ${personnelRecord?.last_name}`,
          };
        }

        // Step 3: Check most recent (non-active) assignment
        const { data: recentAssignments, error: recentError } = await supabase
          .from("personnel_project_assignments")
          .select(`
            id,
            personnel_id,
            project_id,
            assigned_at,
            projects:project_id (id, name)
          `)
          .in("personnel_id", personnelIds)
          .order("assigned_at", { ascending: false })
          .limit(1);

        if (recentError) throw recentError;

        if (recentAssignments && recentAssignments.length > 0 && recentAssignments[0].projects) {
          const project = recentAssignments[0].projects as { id: string; name: string };
          const personnelRecord = personnel.find(p => p.id === recentAssignments[0].personnel_id);
          return {
            project_id: project.id,
            project_name: project.name,
            reason: `Recent project for ${personnelRecord?.first_name} ${personnelRecord?.last_name}`,
          };
        }
      }

      // Step 4: Fallback to vendor's most recent purchase order
      const { data: recentPO, error: poError } = await supabase
        .from("purchase_orders")
        .select("project_id, project_name")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (poError) throw poError;

      if (recentPO && recentPO.project_id) {
        return {
          project_id: recentPO.project_id,
          project_name: recentPO.project_name,
          reason: "Most recent purchase order",
        };
      }

      return null;
    },
    enabled: !!vendorId,
  });
};
