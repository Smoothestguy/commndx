import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Receipt, Settings, Loader2, Inbox, ClipboardList, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { PageLayout } from "@/components/layout/PageLayout";
import { SubmissionCard } from "@/components/contractor/SubmissionCard";
import { SubmissionFilters } from "@/components/contractor/SubmissionFilters";
import { useContractorSubmissions } from "@/integrations/supabase/hooks/useContractorSubmissions";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { SEO } from "@/components/SEO";

export default function ContractorSubmissions() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [copied, setCopied] = useState(false);

  const { data: companySettings } = useCompanySettings();
  const baseUrl = companySettings?.website || window.location.origin;
  const portalUrl = `${baseUrl.replace(/\/$/, '')}/contractor`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const { data: submissions, isLoading } = useContractorSubmissions({
    type: typeFilter !== "all" ? (typeFilter as "bill" | "expense") : undefined,
    startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    search: search || undefined,
  });

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setDateRange(undefined);
  };

  const billCount = submissions?.filter(s => s.submission_type === "bill").length || 0;
  const expenseCount = submissions?.filter(s => s.submission_type === "expense").length || 0;

  return (
    <>
      <SEO
        title="Contractor Submissions"
        description="View and manage contractor bills and expenses"
      />
      <PageLayout 
        title="Contractor Submissions" 
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/contractor-form-builder">
              <Settings className="h-4 w-4 mr-2" />
              Form Builder
            </Link>
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Quick Navigation Tabs */}
          <Tabs value="contractor-submissions">
            <TabsList>
              <TabsTrigger 
                value="vendor-documents" 
                className="gap-2"
                onClick={() => navigate("/vendor-documents")}
              >
                <FileText className="h-4 w-4" />
                Vendor Documents
              </TabsTrigger>
              <TabsTrigger value="contractor-submissions" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Contractor Submissions
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Submissions</CardDescription>
                <CardTitle className="text-3xl">{submissions?.length || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Bills
                </CardDescription>
                <CardTitle className="text-3xl">{billCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Expenses
                </CardDescription>
                <CardTitle className="text-3xl">{expenseCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Filters */}
          <SubmissionFilters
            search={search}
            onSearchChange={setSearch}
            type={typeFilter}
            onTypeChange={setTypeFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onClearFilters={clearFilters}
          />

          {/* Submissions List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  No submissions found
                </h3>
                <p className="text-muted-foreground">
                  {search || typeFilter !== "all" || dateRange?.from
                    ? "Try adjusting your filters"
                    : "Submissions from contractors will appear here"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Portal Link */}
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Contractor Portal Link</h4>
                    <p className="text-sm text-muted-foreground">
                      Share this link with contractors to submit their bills and expenses
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={copyToClipboard}>
                      {copied ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button variant="secondary" asChild>
                      <Link to="/contractor" target="_blank">
                        Open Portal
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={portalUrl}
                    className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md text-muted-foreground select-all cursor-text"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </>
  );
}
