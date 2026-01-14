import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft, Send, Download, CheckCircle, Trash2, DollarSign, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useInvoice, useMarkInvoicePaid, useDeleteInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePDF } from "@/utils/invoicePdfExport";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceAttachments } from "@/components/invoices/InvoiceAttachments";
import { InvoicePaymentDialog } from "@/components/invoices/InvoicePaymentDialog";
import { InvoicePaymentHistory } from "@/components/invoices/InvoicePaymentHistory";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: invoice, isLoading, error, refetch } = useInvoice(id || "");
  const { data: companySettings } = useCompanySettings();
  const markPaid = useMarkInvoicePaid();
  const deleteInvoice = useDeleteInvoice();
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const handleMarkPaid = () => {
    if (id) {
      markPaid.mutate(id);
    }
  };

  const handleSend = async () => {
    if (!id) return;
    
    try {
      const { error, data } = await supabase.functions.invoke("send-invoice", {
        body: { invoiceId: id },
      });

      if (error) throw error;

      toast({
        title: "Invoice sent",
        description: "The invoice has been emailed to the customer.",
      });
      
      refetch();
    } catch (error: any) {
      console.error("Error sending invoice:", error);
      const errorMessage = error.message?.includes("domain") 
        ? "Failed to send invoice. Please verify your email domain in Resend."
        : "Failed to send invoice. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (id) {
      deleteInvoice.mutate(id, {
        onSuccess: () => {
          toast({
            title: "Invoice deleted",
            description: "The invoice has been deleted successfully.",
          });
          navigate("/invoices");
        },
      });
    }
  };

  const handleDownloadPDF = () => {
    if (invoice) {
      // Convert company settings to CompanyInfo format
      const companyInfo = companySettings ? {
        company_name: companySettings.company_name || "Your Company",
        address: companySettings.address || "",
        city: companySettings.city || "",
        state: companySettings.state || "",
        zip: companySettings.zip || "",
        phone: companySettings.phone || "",
        email: companySettings.email || "",
        website: companySettings.website || "",
        logo_url: companySettings.logo_url || null,
      } : undefined;
      
      generateInvoicePDF(invoice, companyInfo);
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Loading..." description="">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (error || !invoice) {
    return (
      <PageLayout title="Invoice Not Found" description="">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      </PageLayout>
    );
  }

  const remainingAmount = Number(invoice.remaining_amount) || Number(invoice.total) - Number(invoice.paid_amount || 0);

  const canEdit = invoice.status !== "paid";

  // Mobile actions configuration
  const mobileActions = {
    primary: [
      ...(canEdit ? [{
        label: "Edit",
        icon: <Edit className="h-4 w-4" />,
        onClick: () => navigate(`/invoices/${id}/edit`),
        variant: "default" as const,
      }] : []),
      ...(invoice.status !== "paid" ? [{
        label: "Record Payment",
        icon: <DollarSign className="h-4 w-4" />,
        onClick: () => setShowPaymentDialog(true),
        variant: "default" as const,
      }] : []),
      {
        label: "Download",
        icon: <Download className="h-4 w-4" />,
        onClick: handleDownloadPDF,
        variant: "glow" as const,
      },
    ],
    secondary: [
      ...(invoice.status !== "paid" ? [{
        label: "Send Invoice",
        icon: <Send className="h-4 w-4" />,
        onClick: () => setShowSendConfirm(true),
        variant: "outline" as const,
      }] : []),
      {
        label: "Delete Invoice",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => {
          if (confirm("Are you sure you want to delete this invoice?")) {
            handleDelete();
          }
        },
        variant: "destructive" as const,
      },
    ],
  };

  // Desktop actions configuration
  const desktopActions = (
    <div className="flex items-center gap-3">
      <StatusBadge status={invoice.status} />
      {canEdit && (
        <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      )}
      {invoice.status !== "paid" && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send Invoice to Customer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will send invoice {invoice.number} to {invoice.customer_name} via email. Are you sure you want to proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend}>
                  Send Invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="success" onClick={() => setShowPaymentDialog(true)}>
            <DollarSign className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </>
      )}
      <Button variant="glow" onClick={handleDownloadPDF}>
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const invoiceContent = (
    <>
      {!isMobile && (
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/invoices")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      )}

      <div className="glass rounded-xl p-4 sm:p-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-8 border-b border-border">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-xl font-bold text-primary">X</span>
              </div>
              <span className="font-heading text-2xl font-bold">Command X</span>
            </div>
            <p className="text-sm text-muted-foreground">Your Company Address</p>
            <p className="text-sm text-muted-foreground">City, State 12345</p>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-heading font-bold text-primary mb-2">INVOICE</h2>
            <p className="text-lg font-semibold">{invoice.number}</p>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
            <p className="text-sm text-muted-foreground">Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">BILL TO</h3>
          <p className="font-semibold text-lg">{invoice.customer_name}</p>
          {invoice.project_name && (
            <p className="text-muted-foreground">Project: {invoice.project_name}</p>
          )}
        </div>

        {/* Line Items */}
        <div className="mb-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-sm font-medium text-muted-foreground">Product</th>
                <th className="text-left py-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                <th className="text-right py-3 text-sm font-medium text-muted-foreground">Qty</th>
                <th className="text-right py-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">Unit Price</th>
                <th className="text-right py-3 text-sm font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-4">
                    <div className="font-medium">{item.product_name || item.description || "—"}</div>
                    {/* Show description below product on mobile only */}
                    {item.description && item.product_name && (
                      <div className="text-sm text-muted-foreground sm:hidden mt-1">{item.description}</div>
                    )}
                  </td>
                  <td className="py-4 text-muted-foreground hidden sm:table-cell">
                    {item.description || "—"}
                  </td>
                  <td className="py-4 text-right">{item.quantity}</td>
                  <td className="py-4 text-right hidden sm:table-cell">{formatCurrency(Number(item.unit_price))}</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(Number(item.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Tax ({Number(invoice.tax_rate).toFixed(1)}%)</span>
              <span>{formatCurrency(Number(invoice.tax_amount))}</span>
            </div>
            <div className="flex justify-between py-3 border-t border-border font-semibold">
              <span>Total</span>
              <span className="text-xl">{formatCurrency(Number(invoice.total))}</span>
            </div>
            {Number(invoice.paid_amount) > 0 && (
              <>
                <div className="flex justify-between py-2 text-success">
                  <span>Paid</span>
                  <span>-{formatCurrency(Number(invoice.paid_amount))}</span>
                </div>
                <div className="flex justify-between py-3 border-t border-border font-semibold">
                  <span>Balance Due</span>
                  <span className="text-2xl text-primary">{formatCurrency(remainingAmount)}</span>
                </div>
              </>
            )}
            {Number(invoice.paid_amount) === 0 && (
              <div className="flex justify-between py-3 border-t border-border font-semibold">
                <span>Balance Due</span>
                <span className="text-2xl text-primary">{formatCurrency(Number(invoice.total))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Status */}
        {invoice.paid_date && invoice.status === "paid" && (
          <div className="mt-8 p-4 rounded-lg bg-success/10 border border-success/20">
            <p className="text-success font-medium flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Paid in full on {format(new Date(invoice.paid_date), "MMM d, yyyy")}
            </p>
          </div>
        )}
      </div>

      {/* Payment History Section */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="glass rounded-xl p-4 sm:p-8 max-w-4xl mt-6">
          <h3 className="text-lg font-semibold mb-4">Payment History</h3>
          <InvoicePaymentHistory payments={invoice.payments} invoiceId={id!} />
        </div>
      )}

      {/* Attachments Section */}
      <div className="max-w-4xl mt-6">
        <InvoiceAttachments invoiceId={id!} />
      </div>

      {/* Payment Dialog */}
      <InvoicePaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        invoiceId={id!}
        remainingAmount={remainingAmount}
      />

      {/* Mobile Send Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Invoice to Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send invoice {invoice.number} to {invoice.customer_name} via email. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowSendConfirm(false);
              handleSend();
            }}>
              Send Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isMobile) {
    return (
      <DetailPageLayout
        title={`Invoice ${invoice.number}`}
        subtitle={invoice.customer_name}
        backPath="/invoices"
        mobileActions={mobileActions}
      >
        {invoiceContent}
      </DetailPageLayout>
    );
  }

  return (
    <PageLayout
      title={`Invoice ${invoice.number}`}
      description={`Invoice for ${invoice.customer_name}`}
      actions={desktopActions}
    >
      {invoiceContent}
    </PageLayout>
  );
};

export default InvoiceDetail;