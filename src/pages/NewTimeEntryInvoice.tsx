import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { TimeEntryInvoiceForm } from "@/components/invoices/TimeEntryInvoiceForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NewTimeEntryInvoice() {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Create Invoice from Time Entries"
        description="Generate an invoice from unbilled time entries"
      />
      <PageLayout
        title="Create Invoice from Time Entries"
        description="Select time entries to generate an invoice"
        actions={
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        }
      >
        <TimeEntryInvoiceForm />
      </PageLayout>
    </>
  );
}
