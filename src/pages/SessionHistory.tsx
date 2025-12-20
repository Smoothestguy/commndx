import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { SessionHistoryStats } from "@/components/session/SessionHistoryStats";
import { SessionHistoryTable } from "@/components/session/SessionHistoryTable";
import { SessionActivityTimeline } from "@/components/session/SessionActivityTimeline";
import { DevActivityDashboard } from "@/components/session/DevActivityDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";

const TARGET_USER_EMAIL = "chris.guevara97@gmail.com";

export default function SessionHistory() {
  const { user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  if (user?.email !== TARGET_USER_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <SEO
        title="Session History"
        description="View your work session history and activity logs"
        keywords="session history, time tracking, activity log, work hours"
      />
      <PageLayout
        title="Session History"
        description="Review your work sessions, active time, and activity logs"
      >
        <div className="space-y-6">
          <div className="flex justify-end">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>

          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
              <TabsTrigger value="dev-activities">Dev Activities</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions">
              <SessionHistoryStats dateRange={dateRange} />
              <div className="mt-4">
                <SessionHistoryTable
                  dateRange={dateRange}
                  onSelectSession={setSelectedSessionId}
                  selectedSessionId={selectedSessionId}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <SessionActivityTimeline
                dateRange={dateRange}
                sessionId={selectedSessionId}
              />
            </TabsContent>

            <TabsContent value="dev-activities">
              <DevActivityDashboard dateRange={dateRange} />
            </TabsContent>
          </Tabs>
        </div>
      </PageLayout>
    </>
  );
}