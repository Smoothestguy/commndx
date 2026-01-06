import { SEO } from "@/components/SEO";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { PersonalActivityHistory } from "@/components/activity/PersonalActivityHistory";

export default function ActivityHistory() {
  return (
    <>
      <SEO 
        title="Activity History" 
        description="View your complete activity history and track all your actions in the application"
      />
      <DetailPageLayout
        title="Activity History"
        subtitle="View and track all your actions in the application"
        backPath="/"
      >
        <PersonalActivityHistory limit={200} showFilters={true} />
      </DetailPageLayout>
    </>
  );
}
