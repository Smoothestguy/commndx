import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DocumentSourceType = 
  | "reimbursement"
  | "invoice_attachment"
  | "estimate_attachment"
  | "vendor_bill_attachment"
  | "vendor_document"
  | "personnel_document"
  | "project_document"
  | "po_addendum_attachment"
  | "invoice_payment_attachment"
  | "vendor_bill_payment_attachment";

export interface SystemDocument {
  id: string;
  source_type: DocumentSourceType;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploader_name: string | null;
  // Related entity info
  related_entity_type: string | null;
  related_entity_id: string | null;
  related_entity_name: string | null;
  // Additional metadata
  expiry_date?: string | null;
  document_type?: string | null;
}

export function useAllSystemDocuments() {
  return useQuery({
    queryKey: ["all-system-documents"],
    queryFn: async () => {
      const documents: SystemDocument[] = [];

      // Fetch all document types in parallel
      const [
        reimbursementsResult,
        invoiceAttachmentsResult,
        estimateAttachmentsResult,
        vendorBillAttachmentsResult,
        vendorDocumentsResult,
        personnelDocumentsResult,
        projectDocumentsResult,
        poAddendumAttachmentsResult,
        invoicePaymentAttachmentsResult,
        vendorBillPaymentAttachmentsResult,
      ] = await Promise.all([
        // Reimbursement receipts
        supabase
          .from("reimbursements")
          .select(`
            id, receipt_url, description, submitted_at, personnel_id, project_id,
            personnel:personnel_id(first_name, last_name),
            project:project_id(name)
          `)
          .not("receipt_url", "is", null),

        // Invoice attachments
        supabase
          .from("invoice_attachments")
          .select(`
            id, invoice_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            invoice:invoice_id(number, customer_name)
          `),

        // Estimate attachments
        supabase
          .from("estimate_attachments")
          .select(`
            id, estimate_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            estimate:estimate_id(number, customer_name)
          `),

        // Vendor bill attachments
        supabase
          .from("vendor_bill_attachments")
          .select(`
            id, bill_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            vendor_bill:bill_id(number, vendor_name)
          `),

        // Vendor documents
        supabase
          .from("vendor_documents")
          .select(`
            id, vendor_id, document_type, document_name, document_url, expiry_date, uploaded_at,
            vendor:vendor_id(name, company)
          `),

        // Personnel documents
        supabase
          .from("personnel_documents")
          .select(`
            id, personnel_id, document_type, file_name, file_path, file_type, file_size, uploaded_at,
            personnel:personnel_id(first_name, last_name)
          `),

        // Project documents
        supabase
          .from("project_documents")
          .select(`
            id, project_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            project:project_id(name)
          `),

        // PO Addendum attachments
        supabase
          .from("po_addendum_attachments")
          .select(`
            id, addendum_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            addendum:addendum_id(number, purchase_order_id, purchase_order:purchase_order_id(number))
          `),

        // Invoice payment attachments
        supabase
          .from("invoice_payment_attachments")
          .select(`
            id, payment_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            payment:payment_id(invoice_id, invoice:invoice_id(number))
          `),

        // Vendor bill payment attachments
        supabase
          .from("vendor_bill_payment_attachments")
          .select(`
            id, payment_id, file_name, file_path, file_type, file_size, created_at, uploaded_by,
            payment:payment_id(bill_id, vendor_bill:bill_id(number))
          `),
      ]);

      // Process reimbursements
      if (reimbursementsResult.data) {
        for (const r of reimbursementsResult.data) {
          const personnel = r.personnel as { first_name: string; last_name: string } | null;
          const project = r.project as { name: string } | null;
          documents.push({
            id: r.id,
            source_type: "reimbursement",
            file_name: r.description || "Receipt",
            file_path: r.receipt_url,
            file_type: r.receipt_url?.split(".").pop()?.toLowerCase() || null,
            file_size: null,
            uploaded_at: r.submitted_at,
            uploaded_by: r.personnel_id,
            uploader_name: personnel ? `${personnel.first_name} ${personnel.last_name}` : null,
            related_entity_type: "project",
            related_entity_id: r.project_id || null,
            related_entity_name: project?.name || null,
          });
        }
      }

      // Process invoice attachments
      if (invoiceAttachmentsResult.data) {
        for (const a of invoiceAttachmentsResult.data) {
          const invoice = a.invoice as { number: string; customer_name: string } | null;
          documents.push({
            id: a.id,
            source_type: "invoice_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "invoice",
            related_entity_id: a.invoice_id,
            related_entity_name: invoice ? `${invoice.number} - ${invoice.customer_name}` : null,
          });
        }
      }

      // Process estimate attachments
      if (estimateAttachmentsResult.data) {
        for (const a of estimateAttachmentsResult.data) {
          const estimate = a.estimate as { number: string; customer_name: string } | null;
          documents.push({
            id: a.id,
            source_type: "estimate_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "estimate",
            related_entity_id: a.estimate_id,
            related_entity_name: estimate ? `${estimate.number} - ${estimate.customer_name}` : null,
          });
        }
      }

      // Process vendor bill attachments
      if (vendorBillAttachmentsResult.data) {
        for (const a of vendorBillAttachmentsResult.data) {
          const bill = a.vendor_bill as { number: string; vendor_name: string } | null;
          documents.push({
            id: a.id,
            source_type: "vendor_bill_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "vendor_bill",
            related_entity_id: a.bill_id,
            related_entity_name: bill ? `${bill.number} - ${bill.vendor_name}` : null,
          });
        }
      }

      // Process vendor documents
      if (vendorDocumentsResult.data) {
        for (const d of vendorDocumentsResult.data) {
          const vendor = d.vendor as { name: string; company: string | null } | null;
          documents.push({
            id: d.id,
            source_type: "vendor_document",
            file_name: d.document_name,
            file_path: d.document_url,
            file_type: d.document_url?.split(".").pop()?.toLowerCase() || null,
            file_size: null,
            uploaded_at: d.uploaded_at,
            uploaded_by: null,
            uploader_name: null,
            related_entity_type: "vendor",
            related_entity_id: d.vendor_id,
            related_entity_name: vendor?.company || vendor?.name || null,
            expiry_date: d.expiry_date,
            document_type: d.document_type,
          });
        }
      }

      // Process personnel documents
      if (personnelDocumentsResult.data) {
        for (const d of personnelDocumentsResult.data) {
          const personnel = d.personnel as { first_name: string; last_name: string } | null;
          documents.push({
            id: d.id,
            source_type: "personnel_document",
            file_name: d.file_name,
            file_path: d.file_path,
            file_type: d.file_type,
            file_size: d.file_size,
            uploaded_at: d.uploaded_at,
            uploaded_by: null,
            uploader_name: personnel ? `${personnel.first_name} ${personnel.last_name}` : null,
            related_entity_type: "personnel",
            related_entity_id: d.personnel_id,
            related_entity_name: personnel ? `${personnel.first_name} ${personnel.last_name}` : null,
            document_type: d.document_type,
          });
        }
      }

      // Process project documents
      if (projectDocumentsResult.data) {
        for (const d of projectDocumentsResult.data) {
          const project = d.project as { name: string } | null;
          documents.push({
            id: d.id,
            source_type: "project_document",
            file_name: d.file_name,
            file_path: d.file_path,
            file_type: d.file_type,
            file_size: d.file_size,
            uploaded_at: d.created_at,
            uploaded_by: d.uploaded_by,
            uploader_name: null,
            related_entity_type: "project",
            related_entity_id: d.project_id,
            related_entity_name: project?.name || null,
          });
        }
      }

      // Process PO addendum attachments
      if (poAddendumAttachmentsResult.data) {
        for (const a of poAddendumAttachmentsResult.data) {
          const addendum = a.addendum as { number: string; purchase_order_id: string; purchase_order: { number: string } | null } | null;
          documents.push({
            id: a.id,
            source_type: "po_addendum_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "po_addendum",
            related_entity_id: addendum?.purchase_order_id || null,
            related_entity_name: addendum?.purchase_order ? `PO ${addendum.purchase_order.number} - ${addendum.number}` : null,
          });
        }
      }

      // Process invoice payment attachments
      if (invoicePaymentAttachmentsResult.data) {
        for (const a of invoicePaymentAttachmentsResult.data) {
          const payment = a.payment as { invoice_id: string; invoice: { number: string } | null } | null;
          documents.push({
            id: a.id,
            source_type: "invoice_payment_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "invoice_payment",
            related_entity_id: payment?.invoice_id || null,
            related_entity_name: payment?.invoice ? `Invoice ${payment.invoice.number} Payment` : null,
          });
        }
      }

      // Process vendor bill payment attachments
      if (vendorBillPaymentAttachmentsResult.data) {
        for (const a of vendorBillPaymentAttachmentsResult.data) {
          const payment = a.payment as { bill_id: string; vendor_bill: { number: string } | null } | null;
          documents.push({
            id: a.id,
            source_type: "vendor_bill_payment_attachment",
            file_name: a.file_name,
            file_path: a.file_path,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_at: a.created_at,
            uploaded_by: a.uploaded_by,
            uploader_name: null,
            related_entity_type: "vendor_bill_payment",
            related_entity_id: payment?.bill_id || null,
            related_entity_name: payment?.vendor_bill ? `Bill ${payment.vendor_bill.number} Payment` : null,
          });
        }
      }

      // Sort by uploaded_at desc
      documents.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      return documents;
    },
  });
}

export function useDeleteSystemDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sourceType }: { id: string; sourceType: DocumentSourceType }) => {
      let error;
      
      switch (sourceType) {
        case "reimbursement":
          // Clear the receipt_url for reimbursement
          ({ error } = await supabase
            .from("reimbursements")
            .update({ receipt_url: null })
            .eq("id", id));
          break;
        case "invoice_attachment":
          ({ error } = await supabase
            .from("invoice_attachments")
            .delete()
            .eq("id", id));
          break;
        case "estimate_attachment":
          ({ error } = await supabase
            .from("estimate_attachments")
            .delete()
            .eq("id", id));
          break;
        case "vendor_bill_attachment":
          ({ error } = await supabase
            .from("vendor_bill_attachments")
            .delete()
            .eq("id", id));
          break;
        case "vendor_document":
          ({ error } = await supabase
            .from("vendor_documents")
            .delete()
            .eq("id", id));
          break;
        case "personnel_document":
          ({ error } = await supabase
            .from("personnel_documents")
            .delete()
            .eq("id", id));
          break;
        case "project_document":
          ({ error } = await supabase
            .from("project_documents")
            .delete()
            .eq("id", id));
          break;
        case "po_addendum_attachment":
          ({ error } = await supabase
            .from("po_addendum_attachments")
            .delete()
            .eq("id", id));
          break;
        case "invoice_payment_attachment":
          ({ error } = await supabase
            .from("invoice_payment_attachments")
            .delete()
            .eq("id", id));
          break;
        case "vendor_bill_payment_attachment":
          ({ error } = await supabase
            .from("vendor_bill_payment_attachments")
            .delete()
            .eq("id", id));
          break;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-system-documents"] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

export const DOCUMENT_SOURCE_LABELS: Record<DocumentSourceType, string> = {
  reimbursement: "Reimbursement Receipt",
  invoice_attachment: "Invoice Attachment",
  estimate_attachment: "Estimate Attachment",
  vendor_bill_attachment: "Vendor Bill Attachment",
  vendor_document: "Vendor Document",
  personnel_document: "Personnel Document",
  project_document: "Project Document",
  po_addendum_attachment: "PO Addendum Attachment",
  invoice_payment_attachment: "Invoice Payment Attachment",
  vendor_bill_payment_attachment: "Vendor Bill Payment Attachment",
};
