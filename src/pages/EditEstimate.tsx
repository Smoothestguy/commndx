import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const EditEstimate = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Placeholder for edit functionality
  return (
    <PageLayout
      title="Edit Estimate"
      description="Update estimate details"
    >
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Estimate editing functionality coming soon.
            </p>
            <Button onClick={() => navigate(`/estimates/${id}`)}>
              Back to Estimate
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default EditEstimate;
