import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RowBasedDashboard } from "@/components/dashboard/RowBasedDashboard";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Dashboard"
        description="Overview of your business metrics, estimates, invoices, and recent activity"
        keywords="business dashboard, metrics, estimates overview, invoice tracking"
      />
      <PageLayout
        title="Dashboard"
        description="Overview of your business"
        actions={
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/staffing/map")}
              className="h-8 px-3"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Map View</span>
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={() => navigate("/estimates/new")}
              className="h-8 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">New Estimate</span>
            </Button>
          </div>
        }
      >
        <RowBasedDashboard />
      </PageLayout>
    </>
  );
};

export default Dashboard;
