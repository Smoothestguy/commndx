import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import {
  useWatchdogSettings,
  useUpdateWatchdogSettings,
  useWatchdogIncidents,
  useSetIncidentStatus,
  useUndoWatchdogAction,
  useRunWatchdog,
} from "@/hooks/useApplicationWatchdog";
import { formatDistanceToNow } from "date-fns";

const severityVariant = (severity: string) =>
  severity === "high" ? "destructive" : severity === "medium" ? "default" : "secondary";

export function ApplicationWatchdogCard() {
  const [searchParams] = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: settings, isLoading } = useWatchdogSettings();
  const updateSettings = useUpdateWatchdogSettings();
  const { data: incidents = [], isLoading: incidentsLoading } = useWatchdogIncidents();
  const setStatus = useSetIncidentStatus();
  const undoAction = useUndoWatchdogAction();
  const runWatchdog = useRunWatchdog();

  const [alertPhone, setAlertPhone] = useState("");
  const [alertEmail, setAlertEmail] = useState("");

  useEffect(() => {
    if (settings) {
      setAlertPhone(settings.alert_phone ?? "");
      setAlertEmail(settings.alert_email ?? "");
    }
  }, [settings]);

  useEffect(() => {
    if (searchParams.get("tab") === "watchdog") {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef} className="scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Application Watchdog
            </CardTitle>
            <CardDescription>
              Watches public job applications for failures, diagnoses them, and applies safe
              reversible fixes. Trigger: event-driven.
              {settings?.last_run_at && (
                <> Last check {formatDistanceToNow(new Date(settings.last_run_at), { addSuffix: true })}
                  {settings.last_run_trigger ? ` (${settings.last_run_trigger})` : ""}.</>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runWatchdog.mutate()}
            disabled={runWatchdog.isPending}
          >
            {runWatchdog.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Run now
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="wd-enabled" className="pr-3">Watchdog enabled</Label>
            <Switch
              id="wd-enabled"
              checked={!!settings?.enabled}
              onCheckedChange={(v) => updateSettings.mutate({ enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="wd-autofix" className="pr-3">Auto-apply safe fixes</Label>
            <Switch
              id="wd-autofix"
              checked={!!settings?.auto_fix_enabled}
              onCheckedChange={(v) => updateSettings.mutate({ auto_fix_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="wd-sms" className="pr-3">Auto recovery SMS</Label>
            <Switch
              id="wd-sms"
              checked={!!settings?.auto_recovery_sms_enabled}
              onCheckedChange={(v) => updateSettings.mutate({ auto_recovery_sms_enabled: v })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wd-phone">Alert phone</Label>
            <Input
              id="wd-phone"
              value={alertPhone}
              placeholder="(555) 555-5555"
              onChange={(e) => setAlertPhone(e.target.value)}
              onBlur={() => updateSettings.mutate({ alert_phone: alertPhone || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-email">Alert email</Label>
            <Input
              id="wd-email"
              type="email"
              value={alertEmail}
              placeholder="ops@fairfieldrg.com"
              onChange={(e) => setAlertEmail(e.target.value)}
              onBlur={() => updateSettings.mutate({ alert_email: alertEmail || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-cooldown">Fix cooldown (hours)</Label>
            <Input
              id="wd-cooldown"
              type="number"
              min={1}
              value={settings?.cooldown_hours ?? 24}
              onChange={(e) =>
                updateSettings.mutate({ cooldown_hours: Number(e.target.value) || 24 })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Active incidents</h4>
          {incidentsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active incidents. Applications are submitting normally.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead className="hidden md:table-cell">Diagnosis</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityVariant(incident.severity)}>
                            {incident.severity}
                          </Badge>
                          <span className="text-sm font-medium">
                            {incident.event_type}
                            {incident.stage ? ` · ${incident.stage}` : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last seen {formatDistanceToNow(new Date(incident.last_seen), { addSuffix: true })}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-md align-top text-sm text-muted-foreground md:table-cell">
                        {incident.diagnosis || incident.sample_message || "—"}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {incident.session_count} people · {incident.event_count} events
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={incident.status === "auto_fixed" ? "default" : "outline"}>
                          {incident.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {incident.status === "auto_fixed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={undoAction.isPending}
                              onClick={() => undoAction.mutate(incident.id)}
                            >
                              Undo
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus.mutate({ id: incident.id, status: "resolved" })}
                          >
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus.mutate({ id: incident.id, status: "ignored" })}
                          >
                            Ignore
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
