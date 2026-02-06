import { useMemo } from "react";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { parseLocalDate } from "@/lib/dateUtils";
import { addDays } from "date-fns";

interface LockedPeriodValidation {
  isEnabled: boolean;
  lockedPeriodDate: string | null;
  isDateLocked: (date: string | Date) => boolean;
  validateDate: (date: string, entityType: string) => { valid: true } | { valid: false; message: string };
  minAllowedDate: Date | undefined;
}

/**
 * Hook for locked period validation in UI components.
 * Prevents creating/editing transactions before the configured cutoff date.
 */
export function useLockedPeriod(): LockedPeriodValidation {
  const { data: settings } = useCompanySettings();

  const lockedPeriodDate = settings?.locked_period_date ?? null;
  const isEnabled = settings?.locked_period_enabled ?? false;

  const isDateLocked = useMemo(() => {
    return (date: string | Date): boolean => {
      if (!isEnabled || !lockedPeriodDate) return false;
      
      const checkDate = typeof date === "string" ? parseLocalDate(date) : date;
      const cutoff = parseLocalDate(lockedPeriodDate);
      
      // Compare only the date parts (ignore time)
      const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
      const cutoffDateOnly = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate());
      
      return checkDateOnly <= cutoffDateOnly;
    };
  }, [isEnabled, lockedPeriodDate]);

  const validateDate = useMemo(() => {
    return (date: string, entityType: string): { valid: true } | { valid: false; message: string } => {
      if (!date) return { valid: true };
      
      if (isDateLocked(date)) {
        return {
          valid: false,
          message: `Cannot create/edit ${entityType} dated ${date}. Accounting period is locked through ${lockedPeriodDate}.`
        };
      }
      return { valid: true };
    };
  }, [isDateLocked, lockedPeriodDate]);

  const minAllowedDate = useMemo(() => {
    if (!isEnabled || !lockedPeriodDate) return undefined;
    return addDays(parseLocalDate(lockedPeriodDate), 1);
  }, [isEnabled, lockedPeriodDate]);

  return {
    isEnabled,
    lockedPeriodDate,
    isDateLocked,
    validateDate,
    minAllowedDate
  };
}
