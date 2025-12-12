import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export type ActionType = 
  | "create" | "update" | "delete" | "view" 
  | "approve" | "reject" | "send" | "complete"
  | "sign_in" | "sign_out" | "sign_up"
  | "payment" | "sync" | "upload" | "download"
  | "invite" | "status_change";

export type ResourceType = 
  | "estimate" | "invoice" | "purchase_order" | "job_order" 
  | "change_order" | "vendor_bill" | "personnel" | "vendor" 
  | "project" | "customer" | "auth" | "user" | "permission"
  | "file" | "quickbooks" | "tm_ticket" | "time_entry";

interface AuditLogParams {
  actionType: ActionType;
  resourceType: ResourceType;
  resourceId?: string;
  resourceNumber?: string;
  changesBefore?: Json;
  changesAfter?: Json;
  success?: boolean;
  errorMessage?: string;
  metadata?: Json;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = useCallback(async ({
    actionType,
    resourceType,
    resourceId,
    resourceNumber,
    changesBefore,
    changesAfter,
    success = true,
    errorMessage,
    metadata = {}
  }: AuditLogParams) => {
    if (!user?.email) return;

    try {
      const { error } = await supabase
        .from("audit_logs")
        .insert([{
          user_id: user.id,
          user_email: user.email,
          action_type: actionType,
          resource_type: resourceType,
          resource_id: resourceId || null,
          resource_number: resourceNumber || null,
          changes_before: changesBefore || null,
          changes_after: changesAfter || null,
          ip_address: null,
          user_agent: navigator.userAgent,
          success,
          error_message: errorMessage || null,
          metadata: metadata || {}
        }]);

      if (error) {
        console.error("Failed to log audit action:", error);
      }
    } catch (err) {
      console.error("Error in audit logging:", err);
    }
  }, [user]);

  return { logAction };
};

// Utility function for computing change differences
export const computeChanges = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): { changesBefore: Json; changesAfter: Json } => {
  if (!before || !after) {
    return { 
      changesBefore: (before || {}) as Json, 
      changesAfter: (after || {}) as Json 
    };
  }

  const changesBefore: Record<string, unknown> = {};
  const changesAfter: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    // Skip timestamps and internal fields
    if (["updated_at", "created_at"].includes(key)) continue;

    const beforeVal = before[key];
    const afterVal = after[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changesBefore[key] = beforeVal;
      changesAfter[key] = afterVal;
    }
  }

  return { 
    changesBefore: changesBefore as Json, 
    changesAfter: changesAfter as Json 
  };
};
