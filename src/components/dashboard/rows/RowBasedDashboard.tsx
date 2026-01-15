import { WelcomeStrip } from "./WelcomeStrip";
import { KPIBar } from "./KPIBar";
import { QuickActionsRow } from "./QuickActionsRow";
import { RevenueChartRow } from "./RevenueChartRow";
import { RecentInvoicesTable } from "./RecentInvoicesTable";
import { RecentActivityTable } from "./RecentActivityTable";
import { InvoiceAgingSummary } from "./InvoiceAgingSummary";

export function RowBasedDashboard() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Row 1: Welcome Strip */}
      <WelcomeStrip />

      {/* Row 2: KPI Bar */}
      <KPIBar />

      {/* Row 3: Quick Actions */}
      <QuickActionsRow />

      {/* Row 4: Revenue Chart */}
      <RevenueChartRow />

      {/* Row 5: Tables Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentInvoicesTable />
        <RecentActivityTable />
      </div>

      {/* Row 6: Invoice Aging Summary */}
      <InvoiceAgingSummary />
    </div>
  );
}
