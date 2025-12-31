import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Lightbulb } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useVendorBills, VendorBillFilters as FilterType } from "@/integrations/supabase/hooks/useVendorBills";
import { VendorBillEmptyState } from "@/components/vendor-bills/VendorBillEmptyState";
import { VendorBillStats } from "@/components/vendor-bills/VendorBillStats";
import { VendorBillFilters } from "@/components/vendor-bills/VendorBillFilters";
import { VendorBillTable } from "@/components/vendor-bills/VendorBillTable";
import { SmartVendorBillDialog } from "@/components/vendor-bills/SmartVendorBillDialog";

export default function VendorBills() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterType>({});
  const [smartDialogOpen, setSmartDialogOpen] = useState(false);

  const { data: bills, isLoading } = useVendorBills(filters);

  const filteredBills = bills?.filter(bill =>
    bill.number.toLowerCase().includes(search.toLowerCase()) ||
    bill.vendor_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <PageLayout title="Vendor Bills" description="Track bills from vendors and suppliers">
      <div className="w-full max-w-full overflow-hidden space-y-6">
        <div className="w-full max-w-full overflow-hidden flex flex-col sm:flex-row gap-4 justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search bills..."
            className="w-full sm:w-80"
          />
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setSmartDialogOpen(true)}>
              <Lightbulb className="h-4 w-4 mr-1" />
              Smart Create
            </Button>
            <Button onClick={() => navigate("/vendor-bills/new")}>
              <Plus className="h-4 w-4 mr-1" />
              New Bill
            </Button>
          </div>
        </div>

        <VendorBillFilters filters={filters} onFiltersChange={setFilters} />

        {bills && bills.length > 0 && <VendorBillStats bills={bills} />}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredBills.length === 0 ? (
          <VendorBillEmptyState />
        ) : (
          <VendorBillTable bills={filteredBills} />
        )}
      </div>

      <SmartVendorBillDialog open={smartDialogOpen} onOpenChange={setSmartDialogOpen} />
    </PageLayout>
  );
}
