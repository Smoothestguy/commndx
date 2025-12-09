import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendorBills } from "@/integrations/supabase/hooks/useVendorBills";
import { VendorDocumentUpload } from "@/components/vendors/VendorDocumentUpload";
import { VendorPersonnelSection } from "@/components/vendors/VendorPersonnelSection";
import { 
  ArrowLeft, Building2, Mail, Phone, FileText, AlertCircle, Users, 
  MapPin, DollarSign, Receipt, CreditCard, ShoppingCart, ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
};

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: vendors, isLoading } = useVendors();
  const { data: expenseCategories } = useExpenseCategories("vendor");
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: vendorBills } = useVendorBills({ vendor_id: id });

  const vendor = vendors?.find((v) => v.id === id);
  const expenseCategory = expenseCategories?.find((c) => c.id === vendor?.default_expense_category_id);
  
  // Filter purchase orders for this vendor
  const vendorPurchaseOrders = purchaseOrders?.filter(po => po.vendor_id === id) || [];

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

  // Format address
  const addressParts = [vendor.address, vendor.city, vendor.state, vendor.zip].filter(Boolean);
  const formattedAddress = addressParts.length > 0 
    ? `${vendor.address || ""}${vendor.address && (vendor.city || vendor.state || vendor.zip) ? ", " : ""}${vendor.city || ""}${vendor.city && vendor.state ? ", " : " "}${vendor.state || ""} ${vendor.zip || ""}`.trim()
    : null;

  return (
    <PageLayout
      title={vendor.name}
      description="Vendor details and documents"
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="outline" onClick={() => navigate("/vendors")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vendors
        </Button>
        {/* Basic Information Card */}
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

        {/* Address Card */}
        {formattedAddress && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{formattedAddress}</p>
            </CardContent>
          </Card>
        )}

        {/* Financial Information Card */}
        {(vendor.tax_id || vendor.track_1099 || vendor.billing_rate || vendor.payment_terms || 
          vendor.account_number || vendor.default_expense_category_id || vendor.opening_balance) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {vendor.tax_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Tax ID</p>
                  <p className="font-medium font-mono">
                    {vendor.tax_id.slice(0, -4).replace(/./g, "•") + vendor.tax_id.slice(-4)}
                  </p>
                </div>
              )}
              {vendor.track_1099 && (
                <div>
                  <p className="text-sm text-muted-foreground">1099 Tracking</p>
                  <Badge variant="secondary">Enabled</Badge>
                </div>
              )}
              {vendor.billing_rate && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Billing Rate
                  </p>
                  <p className="font-medium">${vendor.billing_rate.toFixed(2)}/hr</p>
                </div>
              )}
              {vendor.payment_terms && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Terms
                  </p>
                  <p className="font-medium">{PAYMENT_TERMS_LABELS[vendor.payment_terms] || vendor.payment_terms}</p>
                </div>
              )}
              {vendor.account_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="font-medium font-mono">{vendor.account_number}</p>
                </div>
              )}
              {expenseCategory && (
                <div>
                  <p className="text-sm text-muted-foreground">Default Expense Category</p>
                  <p className="font-medium">{expenseCategory.name}</p>
                </div>
              )}
              {vendor.opening_balance != null && vendor.opening_balance > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Opening Balance</p>
                  <p className="font-medium">${vendor.opening_balance.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes Card */}
        {vendor.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{vendor.notes}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="personnel" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personnel">
              <Users className="mr-2 h-4 w-4" />
              Personnel
            </TabsTrigger>
            <TabsTrigger value="purchase-orders">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="bills">
              <ClipboardList className="mr-2 h-4 w-4" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="personnel" className="mt-6">
            <VendorPersonnelSection vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>
          <TabsContent value="purchase-orders" className="mt-6">
            {vendorPurchaseOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchase orders for this vendor</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vendorPurchaseOrders.map((po) => (
                  <Card 
                    key={po.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{po.number}</p>
                          <p className="text-sm text-muted-foreground">{po.project_name}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <StatusBadge status={po.status} />
                          <p className="text-sm font-medium">${po.total.toFixed(2)}</p>
                          {po.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(po.due_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bills" className="mt-6">
            {!vendorBills || vendorBills.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No bills for this vendor</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vendorBills.map((bill) => (
                  <Card 
                    key={bill.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/vendor-bills/${bill.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{bill.number}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(bill.bill_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'open' ? 'secondary' : 'outline'}>
                            {bill.status.replace('_', ' ')}
                          </Badge>
                          <p className="text-sm font-medium">${bill.total.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Paid: ${bill.paid_amount.toFixed(2)} | Remaining: ${bill.remaining_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="mt-6">
            <VendorDocumentUpload vendorId={vendor.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
