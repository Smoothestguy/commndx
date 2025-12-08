import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { EstimateForm } from "@/components/estimates/EstimateForm";
import { useEstimate } from "@/integrations/supabase/hooks/useEstimates";
import { Loader2 } from "lucide-react";

const NewEstimate = () => {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  
  // Load existing draft if present
  const { data: draftEstimate, isLoading } = useEstimate(draftId || "");
  
  if (draftId && isLoading) {
    return (
      <PageLayout
        title="New Estimate"
        description="Loading draft..."
      >
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={draftId ? "Continue Estimate" : "New Estimate"}
      description={draftId ? "Continue editing your draft estimate" : "Create a new estimate for a customer"}
    >
      <EstimateForm 
        initialData={draftId && draftEstimate ? draftEstimate : undefined}
        draftId={draftId || undefined}
      />
    </PageLayout>
  );
};

export default NewEstimate;
