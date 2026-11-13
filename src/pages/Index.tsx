import { useIsMobile } from '@/hooks/use-mobile';
import { PhoneHome } from '@/components/dashboard/PhoneHome';
import { OperationsHome } from '@/components/dashboard/OperationsHome';
import { MyDayHome } from '@/components/dashboard/MyDayHome';
import { useUserRole } from '@/hooks/useUserRole';
import { useSearchParams } from 'react-router-dom';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { RowBasedDashboard } from "@/components/dashboard/rows/RowBasedDashboard";

const Dashboard = () => {
  const mobile=useIsMobile(),{isAdmin,isManager}=useUserRole(),[params,setParams]=useSearchParams();
  const view=params.get('mobile');
  if(mobile)return <><SEO title="Home | Command X" description="Your field command center"/><PhoneHome/><Dialog open={!!view} onOpenChange={v=>{if(!v)setParams(prev=>{const n=new URLSearchParams(prev);n.delete('mobile');return n;});}}><DialogContent className="phone-surface max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{view==='activity'?'Activity':view==='hours'?'My Hours':view==='signatures'?'Signatures':'My Day'}</DialogTitle></DialogHeader>{isAdmin||isManager?<OperationsHome/>:<MyDayHome section={view==='hours'?'hours':view==='signatures'?'signatures':undefined}/>}</DialogContent></Dialog></>;

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
