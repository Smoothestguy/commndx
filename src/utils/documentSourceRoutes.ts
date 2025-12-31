import type { DocumentSourceType } from "@/integrations/supabase/hooks/useAllSystemDocuments";

/**
 * Get the route to navigate to the source entity for a document
 */
export function getSourceEntityRoute(
  sourceType: DocumentSourceType,
  entityId: string | null
): string | null {
  if (!entityId) return null;

  const routeMap: Record<DocumentSourceType, string | null> = {
    invoice_attachment: `/invoices/${entityId}`,
    estimate_attachment: `/estimates/${entityId}`,
    vendor_bill_attachment: `/vendor-bills/${entityId}`,
    vendor_document: `/vendors/${entityId}`,
    personnel_document: `/personnel/${entityId}`,
    project_document: `/projects/${entityId}`,
    po_addendum_attachment: `/purchase-orders/${entityId}`,
    invoice_payment_attachment: `/invoices/${entityId}`,
    vendor_bill_payment_attachment: `/vendor-bills/${entityId}`,
    reimbursement: null, // Reimbursements don't have their own detail page
  };

  return routeMap[sourceType];
}

/**
 * Get a user-friendly label for the source entity type
 */
export function getSourceEntityLabel(sourceType: DocumentSourceType): string {
  const labelMap: Record<DocumentSourceType, string> = {
    invoice_attachment: "Invoice",
    estimate_attachment: "Estimate",
    vendor_bill_attachment: "Vendor Bill",
    vendor_document: "Vendor",
    personnel_document: "Personnel",
    project_document: "Project",
    po_addendum_attachment: "Purchase Order",
    invoice_payment_attachment: "Invoice",
    vendor_bill_payment_attachment: "Vendor Bill",
    reimbursement: "Reimbursement",
  };

  return labelMap[sourceType];
}
