import { supabase } from "@/integrations/supabase/client";

/**
 * Generates the next estimate number using bidirectional sync:
 * - If QuickBooks is connected, fetches from QuickBooks API which now checks BOTH systems
 * - Otherwise, uses the database function generate_estimate_number()
 * 
 * Also checks for collisions with both active and soft-deleted records.
 * 
 * @returns Promise<{ number: string; source: 'quickbooks' | 'local' }>
 * @throws Error if unable to generate a number
 */
export async function getNextEstimateNumber(): Promise<{ number: string; source: 'quickbooks' | 'local' }> {
  // Check if QuickBooks is connected
  const { data: qbConfig } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .eq("is_connected", true)
    .maybeSingle();

  if (qbConfig?.is_connected) {
    // Use QuickBooks sequence - now checks BOTH QB and local DB
    const { data: qbData, error: qbError } = await supabase.functions.invoke(
      'quickbooks-get-next-number',
      { body: { type: 'estimate' } }
    );

    if (!qbError && qbData?.nextNumber) {
      // Still verify uniqueness in local DB (in case of race conditions)
      const suggestedNumber = qbData.nextNumber;
      const uniqueNumber = await ensureUniqueNumber(suggestedNumber);
      return { number: uniqueNumber, source: 'quickbooks' };
    }

    console.error('QuickBooks number generation failed, falling back to local:', qbError || qbData?.error);
    // Fall through to local generation
  }

  // Use the database function for local generation
  const { data, error } = await supabase.rpc('generate_estimate_number');

  if (error) {
    console.error('Local estimate number generation failed:', error);
    throw new Error('Failed to generate estimate number');
  }

  // Ensure uniqueness even for local generation
  const uniqueNumber = await ensureUniqueNumber(data as string);
  return { number: uniqueNumber, source: 'local' };
}

/**
 * Ensures the given estimate number is unique by checking against
 * both active and soft-deleted records. If a collision is found,
 * it generates a new unique number.
 */
async function ensureUniqueNumber(suggestedNumber: string): Promise<string> {
  // Check if this number already exists (including soft-deleted)
  const { data: existing } = await supabase
    .from("estimates")
    .select("number")
    .eq("number", suggestedNumber)
    .maybeSingle();

  if (!existing) {
    return suggestedNumber;
  }

  // Collision found - find next available number
  console.log(`Estimate number ${suggestedNumber} already exists, finding next available...`);

  // Extract the base pattern and find the next available
  const baseMatch = suggestedNumber.match(/^(.+?)(\d+)$/);
  
  if (baseMatch) {
    const [, prefix, numStr] = baseMatch;
    let nextNum = parseInt(numStr, 10) + 1;
    const padLength = numStr.length;
    
    // Try sequential numbers until we find one that doesn't exist
    for (let attempts = 0; attempts < 100; attempts++) {
      const candidateNumber = `${prefix}${nextNum.toString().padStart(padLength, '0')}`;
      
      const { data: check } = await supabase
        .from("estimates")
        .select("number")
        .eq("number", candidateNumber)
        .maybeSingle();
      
      if (!check) {
        return candidateNumber;
      }
      
      nextNum++;
    }
  }

  // Fallback: add a suffix
  const timestamp = Date.now().toString().slice(-4);
  return `${suggestedNumber}-${timestamp}`;
}

/**
 * Preview the next estimate number (for display purposes).
 * This is the same as getNextEstimateNumber but named for clarity.
 */
export const previewNextEstimateNumber = getNextEstimateNumber;
