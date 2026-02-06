/**
 * Server-side locked period validation for edge functions.
 * Prevents syncing transactions to QuickBooks if they fall within a locked accounting period.
 */

export interface LockedPeriodResult {
  allowed: boolean;
  message?: string;
}

/**
 * Validates a transaction date against the locked period setting.
 * If the date is before or equal to the locked period cutoff, blocks the action and logs the violation.
 * 
 * @param supabase - Supabase client with service role
 * @param txnDate - The transaction date to validate (YYYY-MM-DD format)
 * @param entityType - Type of entity (e.g., 'vendor_bill', 'invoice', 'estimate')
 * @param entityId - ID of the entity (can be null for new entities)
 * @param userId - ID of the user attempting the action
 * @param action - The action being attempted ('create' or 'update')
 * @returns Object with allowed boolean and optional error message
 */
export async function validateLockedPeriod(
  supabase: any,
  txnDate: string,
  entityType: string,
  entityId: string | null,
  userId: string,
  action: "create" | "update"
): Promise<LockedPeriodResult> {
  try {
    // Fetch company settings
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("locked_period_date, locked_period_enabled")
      .single();

    if (settingsError) {
      console.warn("Could not fetch company settings for locked period check:", settingsError);
      // If we can't read settings, allow the operation (fail open for availability)
      return { allowed: true };
    }

    // If locked period is not enabled or no date set, allow
    if (!settings?.locked_period_enabled || !settings?.locked_period_date) {
      return { allowed: true };
    }

    // Parse dates for comparison (use date-only comparison)
    const txn = new Date(txnDate + "T12:00:00"); // Add midday to avoid timezone issues
    const cutoff = new Date(settings.locked_period_date + "T12:00:00");

    // Compare dates (transaction date must be AFTER the locked period)
    if (txn <= cutoff) {
      console.warn(`Locked period violation: ${entityType} with date ${txnDate} is before cutoff ${settings.locked_period_date}`);

      // Log the violation
      try {
        await supabase.from("locked_period_violations").insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          attempted_date: txnDate,
          locked_period_date: settings.locked_period_date,
          action,
          blocked: true,
          details: { source: "edge_function" }
        });
      } catch (logError) {
        console.error("Failed to log locked period violation:", logError);
        // Don't fail the validation just because logging failed
      }

      return {
        allowed: false,
        message: `Transaction date ${txnDate} is in a locked accounting period (through ${settings.locked_period_date}). This change will not be synced to QuickBooks.`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error in locked period validation:", error);
    // On unexpected errors, allow the operation (fail open)
    return { allowed: true };
  }
}
