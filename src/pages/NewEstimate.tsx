import { PageLayout } from "@/components/layout/PageLayout";
import { EstimateForm } from "@/components/estimates/EstimateForm";

const NewEstimate = () => {
  return (
    <PageLayout
      title="New Estimate"
      description="Create a new estimate for a customer"
    >
      <EstimateForm />
    </PageLayout>
  );
};

export default NewEstimate;
