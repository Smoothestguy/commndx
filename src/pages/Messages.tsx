import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";
import { SEO } from "@/components/SEO";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Redirect from old tab param to clean URL
  // IMPORTANT: do this in an effect to avoid navigation/state updates during render (can cause loops)
  useEffect(() => {
    if (searchParams.get("tab") !== "blasts") return;

    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
