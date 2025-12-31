import { supabase } from "@/integrations/supabase/client";
import type { DocumentSourceType } from "@/integrations/supabase/hooks/useAllSystemDocuments";

// Map source types to their storage buckets
// null means the file_path is already a full URL (e.g., vendor_document)
const BUCKET_MAP: Record<DocumentSourceType, string | null> = {
  reimbursement: "document-attachments",
  invoice_attachment: "document-attachments",
  estimate_attachment: "document-attachments",
  vendor_bill_attachment: "document-attachments",
  vendor_document: null, // Already stores full public URL
  personnel_document: "personnel-documents",
  project_document: "project-documents",
  po_addendum_attachment: "document-attachments",
  invoice_payment_attachment: "document-attachments",
  vendor_bill_payment_attachment: "document-attachments",
};

/**
 * Get a usable URL for a document based on its source type.
 * For private buckets, generates a signed URL.
 * For public URLs (vendor_document), returns the path as-is.
 */
export async function getDocumentUrl(
  filePath: string,
  sourceType: DocumentSourceType
): Promise<string | null> {
  const bucket = BUCKET_MAP[sourceType];

  // If no bucket mapping, the filePath is already a full URL
  if (bucket === null) {
    return filePath;
  }

  // Generate signed URL for private bucket
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error("Error getting document URL:", error);
    return null;
  }
}

/**
 * Download a document by fetching its content and triggering a browser download.
 */
export async function downloadDocument(
  filePath: string,
  sourceType: DocumentSourceType,
  fileName: string
): Promise<boolean> {
  try {
    const url = await getDocumentUrl(filePath, sourceType);
    if (!url) {
      console.error("Could not get document URL");
      return false;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    
    return true;
  } catch (error) {
    console.error("Error downloading document:", error);
    return false;
  }
}
