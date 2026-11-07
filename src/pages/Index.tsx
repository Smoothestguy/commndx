import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { RowBasedDashboard } from "@/components/dashboard/rows/RowBasedDashboard";

const Dashboard = () => {
  return (
    <>
      <SEO
        title="Home | Command X"
        description="Your operational command center and personal workday"
        keywords="operations, locations, staffing, attendance"
      />
      <PageLayout
        title="Home"
        description="Welcome back"
      >
        <RowBasedDashboard />
      </PageLayout>
    </>
  );
};

export default Dashboard;
