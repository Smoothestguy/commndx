import { useParams, useNavigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Calendar, User, Building, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useRoofInspection } from "@/integrations/supabase/hooks/useRoofInspections";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const conditionColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function RoofInspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: inspection, isLoading } = useRoofInspection(id || "");

  if (isLoading) {
    return (
      <DetailPageLayout title="Loading..." backPath="/roof-inspections">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DetailPageLayout>
    );
  }

  if (!inspection) {
    return (
      <DetailPageLayout title="Inspection Not Found" backPath="/roof-inspections">
        <div className="text-center py-12">
          <p className="text-muted-foreground">The requested inspection could not be found.</p>
          <Button className="mt-4" onClick={() => navigate("/roof-inspections")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inspections
          </Button>
        </div>
      </DetailPageLayout>
    );
  }

  return (
    <DetailPageLayout
      title={`Inspection - ${inspection.customer?.name || "Unknown"}`}
      backPath="/roof-inspections"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge className={statusColors[inspection.status]}>
            {inspection.status.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {inspection.inspection_type.replace("_", " ")}
          </Badge>
          {inspection.overall_condition && (
            <Badge className={conditionColors[inspection.overall_condition]}>
              {inspection.overall_condition}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Inspection Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{format(new Date(inspection.inspection_date), "PPP")}</span>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{inspection.customer?.name}</span>
              </div>

              {inspection.project?.name && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{inspection.project.name}</span>
                </div>
              )}

              {inspection.inspector && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Inspector:</span>
                  <span className="font-medium">
                    {inspection.inspector.first_name} {inspection.inspector.last_name}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inspection.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                  <p className="text-sm">{inspection.notes}</p>
                </div>
              )}
              {inspection.recommendations && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Recommendations</h4>
                  <p className="text-sm">{inspection.recommendations}</p>
                </div>
              )}
              {!inspection.notes && !inspection.recommendations && (
                <p className="text-sm text-muted-foreground">No notes or recommendations recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {inspection.photos && inspection.photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inspection.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Inspection photo ${index + 1}`}
                    className="rounded-lg object-cover aspect-square"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DetailPageLayout>
  );
}
