import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";

export default function NewInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobOrderId = searchParams.get("jobOrderId") || undefined;
  const addInvoice = useAddInvoice();

  const handleSubmit = async (data: any) => {
    await addInvoice.mutateAsync(data);
    if (jobOrderId) {
      navigate(`/job-orders/${jobOrderId}`);
    } else {
      navigate("/invoices");
    }
  };

  return (
    <PageLayout
      title="Create Invoice"
      description="Generate a new invoice from a job order with progress billing"
    >
      <InvoiceForm onSubmit={handleSubmit} jobOrderId={jobOrderId} />
    </PageLayout>
  );
}
