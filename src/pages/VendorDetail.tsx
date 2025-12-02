import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { VendorDocumentUpload } from "@/components/vendors/VendorDocumentUpload";
import { ArrowLeft, Building2, Mail, Phone, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: vendors, isLoading } = useVendors();

  const vendor = vendors?.find((v) => v.id === id);

  if (isLoading) {
    return (
      <PageLayout title="Vendor Details">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!vendor) {
    return (
      <PageLayout title="Vendor Not Found">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Vendor not found</p>
            <Button onClick={() => navigate("/vendors")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vendors
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const isInsuranceExpired = vendor.insurance_expiry && new Date(vendor.insurance_expiry) < new Date();

  return (
    <PageLayout
      title={vendor.name}
      description="Vendor details and documents"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Vendor Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-medium">{vendor.company || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Specialty</p>
              <p className="font-medium">{vendor.specialty || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <p className="font-medium">{vendor.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </p>
              <p className="font-medium">{vendor.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">License Number</p>
              <p className="font-medium">{vendor.license_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Insurance Expiry
                {isInsuranceExpired && <AlertCircle className="h-4 w-4 text-destructive" />}
              </p>
              <p className={`font-medium ${isInsuranceExpired ? "text-destructive" : ""}`}>
                {vendor.insurance_expiry ? format(new Date(vendor.insurance_expiry), "MMM d, yyyy") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">W-9 on File</p>
              <p className="font-medium">{vendor.w9_on_file ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                vendor.status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}>
                {vendor.status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-6">
            <VendorDocumentUpload vendorId={vendor.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
