import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";
import { useMessageStats } from "@/integrations/supabase/hooks/useMessages";
import { MessageSquare, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Redirect from old tab param to clean URL
  if (searchParams.get("tab") === "blasts") {
    searchParams.delete("tab");
    setSearchParams(searchParams, { replace: true });
  }
  
  const { data: stats } = useMessageStats();

  return (
    <PageLayout title="Messages">
      <SEO 
        title="Messages | Command X"
        description="Send and manage SMS messages to customers and personnel"
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.sent || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.failed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Inbox - now the primary view */}
        <MessagesInbox />
      </div>
    </PageLayout>
  );
}
