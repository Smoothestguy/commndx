import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstimateCard } from "@/components/estimates/EstimateCard";
import { EstimateStats } from "@/components/estimates/EstimateStats";
import { EstimateEmptyState } from "@/components/estimates/EstimateEmptyState";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceEmptyState } from "@/components/invoices/InvoiceEmptyState";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { Skeleton } from "@/components/ui/skeleton";

export default function Sales() {
  const [activeTab, setActiveTab] = useState("estimates");
  const navigate = useNavigate();
  const { data: estimates, isLoading: estimatesLoading } = useEstimates();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();

  const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;
  const pendingAmount = estimates?.filter(e => e.status === 'pending').reduce((sum, est) => sum + est.total, 0) || 0;

  return (
    <PageLayout title="Sales">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="estimates">Estimates</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="estimates" className="mt-0 space-y-6">
          {estimatesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : estimates && estimates.length > 0 ? (
            <>
              <EstimateStats estimates={estimates} />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {estimates.map((estimate, index) => (
                  <EstimateCard 
                    key={estimate.id} 
                    estimate={estimate}
                    onClick={() => navigate(`/estimates/${estimate.id}`)}
                    index={index}
                  />
                ))}
              </div>
            </>
          ) : (
            <EstimateEmptyState 
              onCreateEstimate={() => navigate('/estimates/new')}
            />
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-0 space-y-6">
          {invoicesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : invoices && invoices.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <div className="glass rounded-lg p-6">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    ${totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-lg p-6">
                  <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
                  <p className="text-2xl font-bold mt-1">
                    {invoices.filter(i => i.status !== 'paid').length}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {invoices.map((invoice, index) => (
                  <InvoiceCard 
                    key={invoice.id} 
                    invoice={invoice}
                    onView={(id) => navigate(`/invoices/${id}`)}
                    index={index}
                  />
                ))}
              </div>
            </>
          ) : (
            <InvoiceEmptyState 
              onAddInvoice={() => navigate('/invoices/new')}
            />
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
