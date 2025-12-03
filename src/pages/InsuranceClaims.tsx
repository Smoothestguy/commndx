import { useState } from "react";
import { Plus, Filter, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClaimCard } from "@/components/roofing/claims/ClaimCard";
import { ClaimForm } from "@/components/roofing/claims/ClaimForm";
import { ClaimEmptyState } from "@/components/roofing/claims/ClaimEmptyState";
import { useInsuranceClaims, useDeleteInsuranceClaim } from "@/integrations/supabase/hooks/useInsuranceClaims";
import type { InsuranceClaim, ClaimStatus } from "@/types/roofing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusOptions: { value: ClaimStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "filed", label: "Filed" },
  { value: "pending_adjuster", label: "Pending Adjuster" },
  { value: "adjuster_scheduled", label: "Adjuster Scheduled" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function InsuranceClaims() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<InsuranceClaim | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("all");

  const { data: claims, isLoading } = useInsuranceClaims();
  const deleteClaim = useDeleteInsuranceClaim();

  const filteredClaims = claims?.filter((claim) => {
    const matchesSearch = 
      claim.insurance_company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.claim_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalApproved = claims?.filter(c => c.status === "approved" || c.status === "completed")
    .reduce((sum, c) => sum + (c.approved_amount || 0), 0) || 0;
  const activeClaims = claims?.filter(c => !["completed", "denied"].includes(c.status)).length || 0;
  const approvedCount = claims?.filter(c => c.status === "approved" || c.status === "completed").length || 0;
  const deniedCount = claims?.filter(c => c.status === "denied").length || 0;

  const handleEdit = (claim: InsuranceClaim) => {
    setEditingClaim(claim);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteClaim.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) setEditingClaim(undefined);
  };

  return (
    <PageLayout
      title="Insurance Claims"
      description="Track and manage insurance claims"
      actions={
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Claim
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Approved</p>
                  <p className="text-2xl font-bold">${totalApproved.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Claims</p>
                  <p className="text-2xl font-bold">{activeClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Denied</p>
                  <p className="text-2xl font-bold">{deniedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search claims..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClaimStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Claims List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredClaims?.length === 0 ? (
          <ClaimEmptyState onAdd={() => setIsFormOpen(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClaims?.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                onEdit={handleEdit}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}
      </div>

      <ClaimForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        claim={editingClaim}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this insurance claim? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
