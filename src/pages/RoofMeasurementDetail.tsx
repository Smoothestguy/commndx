import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Edit, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";
import { useRoofMeasurement, useDeleteRoofMeasurement, useUpdateRoofMeasurement } from "@/integrations/supabase/hooks/useRoofMeasurements";
import { MeasurementForm } from "@/components/roofing/measurements/MeasurementForm";
import { toast } from "sonner";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

function formatLength(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  const feet = Math.floor(value);
  const inches = Math.round((value - feet) * 12);
  return `${feet}ft ${inches}in`;
}

function MeasurementRow({ label, value, suffix = "" }: { label: string; value?: number | string | null; suffix?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value !== null && value !== undefined ? `${value}${suffix}` : "—"}
      </span>
    </div>
  );
}

function LengthRow({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatLength(value)}</span>
    </div>
  );
}

export default function RoofMeasurementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();
  const canManage = isAdmin || isManager;

  const { data: measurement, isLoading } = useRoofMeasurement(id || "");
  const deleteMutation = useDeleteRoofMeasurement();
  const updateMutation = useUpdateRoofMeasurement();

  const handleDelete = async () => {
    if (!id || !confirm("Are you sure you want to delete this measurement?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Measurement deleted");
      navigate("/roof-measurements");
    } catch (error) {
      toast.error("Failed to delete measurement");
    }
  };

  const handleUpdate = async (data: any) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, ...data });
      toast.success("Measurement updated");
      setEditOpen(false);
    } catch (error) {
      toast.error("Failed to update measurement");
    }
  };

  // Calculate derived values
  const hipsRidges = (measurement?.hips_length || 0) + (measurement?.ridges_length || 0);
  const eavesRakes = (measurement?.eaves_length || 0) + (measurement?.rakes_length || 0);

  if (isLoading) {
    return (
      <PageLayout title="Measurement Details">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (!measurement) {
    return (
      <PageLayout title="Measurement Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">This measurement could not be found.</p>
          <Button onClick={() => navigate("/roof-measurements")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Measurements
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Measurement Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/roof-measurements")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">{measurement.customer?.name}</h1>
            {measurement.project?.name && (
              <p className="text-muted-foreground">{measurement.project.name}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {format(new Date(measurement.measurement_date), "PPP")}
              </span>
              {measurement.roof_type && (
                <Badge variant="outline" className="capitalize ml-2">
                  {measurement.roof_type}
                </Badge>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Area Measurements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <MeasurementRow 
                label="Total roof area" 
                value={measurement.total_roof_area?.toLocaleString()} 
                suffix=" sqft" 
              />
              <MeasurementRow 
                label="Total pitched area" 
                value={measurement.total_pitched_area?.toLocaleString()} 
                suffix=" sqft" 
              />
              <MeasurementRow 
                label="Total flat area" 
                value={measurement.total_flat_area?.toLocaleString()} 
                suffix=" sqft" 
              />
              <MeasurementRow 
                label="Total roof facets" 
                value={measurement.total_facets} 
                suffix=" facets" 
              />
              <MeasurementRow 
                label="Predominant pitch" 
                value={measurement.pitch} 
              />
            </CardContent>
          </Card>

          {/* Linear Measurements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linear Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <LengthRow label="Total eaves" value={measurement.eaves_length} />
              <LengthRow label="Total valleys" value={measurement.valleys_length} />
              <LengthRow label="Total hips" value={measurement.hips_length} />
              <LengthRow label="Total ridges" value={measurement.ridges_length} />
              <LengthRow label="Total rakes" value={measurement.rakes_length} />
            </CardContent>
          </Card>

          {/* Flashing & Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flashing & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <LengthRow label="Total wall flashing" value={measurement.wall_flashing_length} />
              <LengthRow label="Total step flashing" value={measurement.step_flashing_length} />
              <LengthRow label="Total transitions" value={measurement.transitions_length} />
              <LengthRow label="Total parapet wall" value={measurement.parapet_wall_length} />
              <LengthRow label="Total unspecified" value={measurement.unspecified_length} />
            </CardContent>
          </Card>

          {/* Calculated Values */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calculated Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <LengthRow label="Hips + ridges" value={hipsRidges} />
              <LengthRow label="Eaves + rakes" value={eavesRakes} />
              {measurement.total_squares && (
                <MeasurementRow 
                  label="Roofing squares" 
                  value={measurement.total_squares} 
                  suffix=" squares" 
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {measurement.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{measurement.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <MeasurementForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleUpdate}
        initialData={measurement}
        isLoading={updateMutation.isPending}
      />
    </PageLayout>
  );
}
