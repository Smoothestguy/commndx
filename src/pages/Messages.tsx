import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";
import { SMSBlastsTab } from "@/components/messaging/SMSBlastsTab";
import { useMessageStats } from "@/integrations/supabase/hooks/useMessages";
import { useTotalUnreadCount } from "@/integrations/supabase/hooks/useConversations";
import { MessageSquare, Send, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "inbox";
  
  const { data: stats } = useMessageStats();
  const { data: unreadCount } = useTotalUnreadCount();

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

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

        {/* Tabs for Inbox and SMS Blasts */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Inbox
              {unreadCount && unreadCount > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="blasts" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              SMS Blasts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-6">
            <MessagesInbox />
          </TabsContent>

          <TabsContent value="blasts" className="mt-6">
            <SMSBlastsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
