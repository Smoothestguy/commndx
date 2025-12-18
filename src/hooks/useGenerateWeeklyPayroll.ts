import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PayrollGenerationResult {
  success: boolean;
  message: string;
  paymentsCreated?: number;
  payPeriod?: { start: string; end: string };
  paymentDate?: string;
  error?: string;
}

export function useGenerateWeeklyPayroll() {
  return useMutation({
    mutationFn: async (payPeriodEnd?: string): Promise<PayrollGenerationResult> => {
      const { data, error } = await supabase.functions.invoke("generate-weekly-payroll", {
        body: payPeriodEnd ? { payPeriodEnd } : {},
      });

      // Check data first - even with HTTP errors, the response body may contain the message
      if (data && !data.success) {
        throw new Error(data.message || data.error || "Failed to generate payroll");
      }
      
      if (error) {
        throw new Error(error.message || "Failed to generate payroll");
      }
      
      if (!data) {
        throw new Error("No response from payroll generation");
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message, {
        description: `Created ${data.paymentsCreated} payment records for payment on ${data.paymentDate}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Payroll generation failed", {
        description: error.message,
      });
    },
  });
}
