import { supabase } from "@/integrations/supabase/client";

/**
 * Generates the next invoice number using the appropriate source:
 * - If QuickBooks is connected, fetches from QuickBooks API
 * - Otherwise, uses the database function generate_invoice_number()
 * 
 * @returns Promise<{ number: string; source: 'quickbooks' | 'local' }>
 * @throws Error if unable to generate a number
 */
export async function getNextInvoiceNumber(): Promise<{ number: string; source: 'quickbooks' | 'local' }> {
  // Check if QuickBooks is connected
  const { data: qbConfig } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .eq("is_connected", true)
    .maybeSingle();

  if (qbConfig?.is_connected) {
    // Use QuickBooks sequence
    const { data: qbData, error: qbError } = await supabase.functions.invoke(
      'quickbooks-get-next-number',
      { body: { type: 'invoice' } }
    );

    if (!qbError && qbData?.nextNumber) {
      return { number: qbData.nextNumber, source: 'quickbooks' };
    }

    console.warn('⚠️ QuickBooks number generation failed, falling back to local numbering:', qbError || qbData?.error);
    // Fall through to local generation
  }

  // Use the database function for local generation
  const { data, error } = await supabase.rpc('generate_invoice_number');

  if (error) {
    console.error('Local invoice number generation failed:', error);
    throw new Error('Failed to generate invoice number');
  }

  return { number: data as string, source: 'local' };
}

/**
 * Preview the next invoice number (for display purposes).
 * This is the same as getNextInvoiceNumber but named for clarity.
 */
export const previewNextInvoiceNumber = getNextInvoiceNumber;
