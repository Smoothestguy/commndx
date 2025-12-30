import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { useAddProjectInvoice } from "@/integrations/supabase/hooks/useProjectInvoice";
import { useAuth } from "@/contexts/AuthContext";
import { PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments } from "@/utils/attachmentUtils";
import { toast } from "sonner";

export default function NewInvoice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const jobOrderId = searchParams.get("jobOrderId") || undefined;
  const addInvoice = useAddInvoice();
  const addProjectInvoice = useAddProjectInvoice();

  const handleSubmit = async (data: any, pendingAttachments?: PendingFile[]) => {
    const result = await addInvoice.mutateAsync(data);
    
    // Finalize pending attachments
    if (result?.id && pendingAttachments && pendingAttachments.length > 0 && user) {
      const attachResult = await finalizeAttachments(
        pendingAttachments,
        result.id,
        "invoice",
        user.id
      );
      if (!attachResult.success) {
        toast.warning("Invoice saved but some attachments failed to upload");
      }
    }
    
    if (jobOrderId) {
      navigate(`/job-orders/${jobOrderId}`);
    } else {
      navigate("/invoices");
    }
  };

  const handleMultiItemSubmit = async (data: any, pendingAttachments?: PendingFile[]) => {
    const result = await addProjectInvoice.mutateAsync(data);
    
    // Finalize pending attachments
    if (result?.id && pendingAttachments && pendingAttachments.length > 0 && user) {
      const attachResult = await finalizeAttachments(
        pendingAttachments,
        result.id,
        "invoice",
        user.id
      );
      if (!attachResult.success) {
        toast.warning("Invoice saved but some attachments failed to upload");
      }
    }
    
    navigate("/invoices");
  };

  return (
    <PageLayout
      title="Create Invoice"
      description="Generate a new invoice from a job order with progress billing"
    >
      <InvoiceForm 
        onSubmit={handleSubmit} 
        onSubmitMultiItem={handleMultiItemSubmit}
        jobOrderId={jobOrderId} 
      />
    </PageLayout>
  );
}
