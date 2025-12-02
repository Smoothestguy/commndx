import { useParams, useNavigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Calendar, Building, ArrowLeft, AlertTriangle } from "lucide-react";
import { format, differenceInDays, isBefore } from "date-fns";
import { useRoofWarranty } from "@/integrations/supabase/hooks/useRoofWarranties";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  claimed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const typeColors: Record<string, string> = {
  manufacturer: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  workmanship: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  extended: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
};

export default function WarrantyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: warranty, isLoading } = useRoofWarranty(id || "");

  if (isLoading) {
    return (
      <DetailPageLayout title="Loading..." onBack={() => navigate("/warranties")}>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DetailPageLayout>
    );
  }

  if (!warranty) {
    return (
      <DetailPageLayout title="Warranty Not Found" onBack={() => navigate("/warranties")}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">The requested warranty could not be found.</p>
          <Button className="mt-4" onClick={() => navigate("/warranties")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warranties
          </Button>
        </div>
      </DetailPageLayout>
    );
  }

  const endDate = new Date(warranty.end_date);
  const today = new Date();
  const daysUntilExpiry = differenceInDays(endDate, today);
  const isExpiringSoon = daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  const isExpired = isBefore(endDate, today);

  return (
    <DetailPageLayout
      title={`Warranty - ${warranty.customer?.name || "Unknown"}`}
      onBack={() => navigate("/warranties")}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge className={statusColors[warranty.status]}>
            {warranty.status}
          </Badge>
          <Badge className={typeColors[warranty.warranty_type]}>
            {warranty.warranty_type}
          </Badge>
        </div>

        {isExpiringSoon && !isExpired && (
          <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-5 w-5" />
            <span>This warranty expires in {daysUntilExpiry} days</span>
          </div>
        )}

        {isExpired && warranty.status === "active" && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200">
            <AlertTriangle className="h-5 w-5" />
            <span>This warranty has expired</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Warranty Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-muted-foreground">Provider:</span>
                <p className="font-medium">{warranty.provider}</p>
              </div>

              {warranty.warranty_number && (
                <div>
                  <span className="text-muted-foreground">Warranty Number:</span>
                  <p className="font-medium">{warranty.warranty_number}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{warranty.customer?.name}</span>
              </div>

              {warranty.project?.name && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{warranty.project.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Coverage Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-muted-foreground">Start Date:</span>
                <p className="font-medium">{format(new Date(warranty.start_date), "PPP")}</p>
              </div>

              <div>
                <span className="text-muted-foreground">End Date:</span>
                <p className="font-medium">{format(endDate, "PPP")}</p>
              </div>

              {warranty.coverage_details && (
                <div>
                  <span className="text-muted-foreground">Coverage Details:</span>
                  <p className="text-sm mt-1">{warranty.coverage_details}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DetailPageLayout>
  );
}
