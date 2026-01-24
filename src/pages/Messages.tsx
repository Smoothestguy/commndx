import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";
import { SEO } from "@/components/SEO";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Redirect from old tab param to clean URL
  if (searchParams.get("tab") === "blasts") {
    searchParams.delete("tab");
    setSearchParams(searchParams, { replace: true });
  }

  return (
    <PageLayout title="Messages">
      <SEO 
        title="Messages | Command X"
        description="Send and manage SMS messages to customers and personnel"
      />

      <div className="space-y-6">
        {/* Unified Inbox - all conversations including migrated legacy SMS */}
        <MessagesInbox />
      </div>
    </PageLayout>
  );
}
