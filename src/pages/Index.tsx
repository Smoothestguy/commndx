import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { RowBasedDashboard } from "@/components/dashboard/rows/RowBasedDashboard";

const Dashboard = () => {
  return (
    <>
      <SEO
        title="Dashboard"
        description="Overview of your business metrics, estimates, invoices, and recent activity"
        keywords="business dashboard, metrics, estimates overview, invoice tracking"
      />
      <PageLayout
        title="Dashboard"
        description="Welcome back"
      >
        <RowBasedDashboard />
      </PageLayout>
    </>
  );
};

export default Dashboard;
