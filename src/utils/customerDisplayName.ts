/**
 * Utility functions for consistent customer display name handling.
 * Company name is always shown as the primary display name.
 */

interface CustomerDisplayInfo {
  name?: string | null;
  company?: string | null;
}

/**
 * Returns the primary display name for a customer.
 * Prioritizes company name, falls back to contact name.
 */
export function getCustomerDisplayName(customer: CustomerDisplayInfo | null | undefined): string {
  if (!customer) return "Unknown";
  return customer.company || customer.name || "Unknown";
}

/**
 * Returns the secondary/contact name for a customer.
 * Returns the contact name if company is primary and differs from name.
 */
export function getCustomerSecondaryName(customer: CustomerDisplayInfo | null | undefined): string | null {
  if (!customer) return null;
  if (customer.company && customer.name && customer.company !== customer.name) {
    return customer.name;
  }
  return null;
}

/**
 * Returns a formatted display string with both company and contact if applicable.
 * Format: "Company Name (Contact Name)" or just "Contact Name" if no company
 */
export function getCustomerFullDisplayName(customer: CustomerDisplayInfo | null | undefined): string {
  if (!customer) return "Unknown";
  const primary = getCustomerDisplayName(customer);
  const secondary = getCustomerSecondaryName(customer);
  return secondary ? `${primary} (${secondary})` : primary;
}
