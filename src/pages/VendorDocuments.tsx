import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllVendorDocuments } from "@/integrations/supabase/hooks/useVendorDocuments";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import {
  FileText,
  Download,
  Search,
  AlertTriangle,
  Clock,
  Files,
  FileCheck,
  ClipboardList,
} from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "w9", label: "W9" },
  { value: "insurance_certificate", label: "Insurance Certificate" },
  { value: "license", label: "License" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

const EXPIRY_STATUSES = [
  { value: "all", label: "All Status" },
  { value: "expired", label: "Expired" },
  { value: "expiring_soon", label: "Expiring Soon (30 days)" },
  { value: "valid", label: "Valid" },
];

const documentTypeLabels: Record<string, string> = {
  w9: "W9",
  insurance_certificate: "Insurance Certificate",
  license: "License",
  contract: "Contract",
  other: "Other",
};

export default function VendorDocuments() {
  const navigate = useNavigate();
  const { data: documents, isLoading: docsLoading } = useAllVendorDocuments();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  const isLoading = docsLoading || vendorsLoading;

  // Create vendor lookup map
  const vendorMap = useMemo(() => {
    if (!vendors) return {};
    return vendors.reduce((acc, v) => {
      acc[v.id] = v.company || v.name || "Unknown";
      return acc;
    }, {} as Record<string, string>);
  }, [vendors]);

  // Enrich documents with vendor names
  const enrichedDocuments = useMemo(() => {
    if (!documents) return [];
    return documents.map((doc) => ({
      ...doc,
      vendor_name: vendorMap[doc.vendor_id] || "Unknown Vendor",
    }));
  }, [documents, vendorMap]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return enrichedDocuments.filter((doc) => {
      // Search filter
      if (
        searchTerm &&
        !doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !doc.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && doc.document_type !== typeFilter) {
        return false;
      }

      // Vendor filter
      if (vendorFilter !== "all" && doc.vendor_id !== vendorFilter) {
        return false;
      }

      // Expiry filter
      if (expiryFilter !== "all" && doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date);
        const now = new Date();
        const thirtyDaysFromNow = addDays(now, 30);

        if (expiryFilter === "expired" && !isBefore(expiryDate, now)) {
          return false;
        }
        if (
          expiryFilter === "expiring_soon" &&
          !(isAfter(expiryDate, now) && isBefore(expiryDate, thirtyDaysFromNow))
        ) {
          return false;
        }
        if (expiryFilter === "valid" && isBefore(expiryDate, now)) {
          return false;
        }
      } else if (expiryFilter === "expired" || expiryFilter === "expiring_soon") {
        // If no expiry date and filtering for expired/expiring, exclude
        if (!doc.expiry_date) return false;
      }

      return true;
    });
  }, [enrichedDocuments, searchTerm, typeFilter, vendorFilter, expiryFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    let total = enrichedDocuments.length;
    let expired = 0;
    let expiringSoon = 0;
    const byType: Record<string, number> = {};

    enrichedDocuments.forEach((doc) => {
      // Count by type
      byType[doc.document_type] = (byType[doc.document_type] || 0) + 1;

      // Check expiry
      if (doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date);
        if (isBefore(expiryDate, now)) {
          expired++;
        } else if (isBefore(expiryDate, thirtyDaysFromNow)) {
          expiringSoon++;
        }
      }
    });

    return { total, expired, expiringSoon, byType };
  }, [enrichedDocuments]);

  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;

    const date = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    if (isBefore(date, now)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }

    if (isBefore(date, thirtyDaysFromNow)) {
      return (
        <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          <Clock className="h-3 w-3" />
          Expiring Soon
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1">
        <FileCheck className="h-3 w-3" />
        Valid
      </Badge>
    );
  };

  return (
    <PageLayout title="Vendor Documents">
      {/* Quick Navigation Tabs */}
      <Tabs value="vendor-documents" className="mb-6">
        <TabsList>
          <TabsTrigger value="vendor-documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Vendor Documents
          </TabsTrigger>
          <TabsTrigger 
            value="contractor-submissions" 
            className="gap-2"
            onClick={() => navigate("/admin/contractor-submissions")}
          >
            <ClipboardList className="h-4 w-4" />
            Contractor Submissions
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.expiringSoon}
            </div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.expired}
            </div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Type</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {documentTypeLabels[type] || type}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents or vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors?.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.company || vendor.name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Expiry Status" />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Link
                        to={`/vendors/${doc.vendor_id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {doc.vendor_name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {doc.document_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {documentTypeLabels[doc.document_type] || doc.document_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {doc.expiry_date ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {format(new Date(doc.expiry_date), "MMM d, yyyy")}
                          </span>
                          {getExpiryBadge(doc.expiry_date)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
