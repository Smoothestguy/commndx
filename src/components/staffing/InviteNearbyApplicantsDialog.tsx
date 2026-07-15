import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Send, MapPin, Search } from "lucide-react";
import { useNearbyApplicants } from "@/integrations/supabase/hooks/useNearbyApplicants";
import { renderMergeTags, AVAILABLE_MERGE_TAGS } from "@/lib/mergeTags";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posting: any; // JobPosting with project_task_orders.projects
}

export const InviteNearbyApplicantsDialog = ({ open, onOpenChange, posting }: Props) => {
  const project = posting?.project_task_orders?.projects;
  const projectName = project?.name ?? "";
  const taskTitle = posting?.project_task_orders?.title ?? "this job";
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/apply/${posting?.public_token}`
      : "";

  const [radius, setRadius] = useState<number>(50);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: candidates, isLoading } = useNearbyApplicants(project, open);

  useEffect(() => {
    if (!open) return;
    setMessage(
      `Hi {first_name}, we have a new opportunity on {{project_name}} near {{location}}. Apply here: {link}`
    );
    setSelected(new Set());
    setSearch("");
  }, [open, projectName, taskTitle]);

  const positions: any[] = (posting as any)?.positions ?? [];
  const resolvedMessage = useMemo(
    () =>
      renderMergeTags(message, {
        project: project ?? null,
        taskOrder: posting?.project_task_orders ?? null,
        positions,
      }),
    [message, project, posting, positions]
  );

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const s = search.trim().toLowerCase();
    return candidates.filter((a) => {
      // Distance / match filter
      if (a.match_type === "distance") {
        if (a.distance_mi == null || a.distance_mi > radius) return false;
      } else if (a.match_type === "none") {
        return false; // hide totally unrelated when no geo match
      }
      if (!s) return true;
      const hay = `${a.first_name ?? ""} ${a.last_name ?? ""} ${a.city ?? ""} ${a.state ?? ""} ${a.home_zip ?? ""} ${a.phone ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [candidates, radius, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((a) => a.id)));
  const clearAll = () => setSelected(new Set());

  const handleSend = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one applicant");
      return;
    }
    if (!message.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-applicants-sms", {
        body: {
          applicantIds: Array.from(selected),
          message: resolvedMessage,
          postingId: posting.id,
        },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      const skipped = data?.skipped ?? 0;
      toast.success(
        `Invites sent: ${sent}${failed ? ` • Failed: ${failed}` : ""}${skipped ? ` • Skipped: ${skipped}` : ""}`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  const projLoc = [project?.city, project?.state, project?.zip].filter(Boolean).join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Invite Nearby Applicants
          </DialogTitle>
          <DialogDescription>
            {projectName} — {taskTitle}
            {projLoc && <span className="ml-1 text-muted-foreground">· {projLoc}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Radius (miles)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={radius}
                onChange={(e) => setRadius(Math.max(1, Number(e.target.value) || 50))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, phone, city, state…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              {isLoading
                ? "Loading candidates…"
                : `${filtered.length} candidate${filtered.length === 1 ? "" : "s"} · ${selected.size} selected`}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll} disabled={!filtered.length}>
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll} disabled={!selected.size}>
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[280px] rounded border">
            <div className="divide-y">
              {filtered.map((a) => {
                const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "(no name)";
                const loc = [a.city, a.state].filter(Boolean).join(", ");
                const distLabel =
                  a.distance_mi != null
                    ? `${a.distance_mi.toFixed(1)} mi`
                    : a.match_type === "zip"
                      ? "same ZIP"
                      : a.match_type === "city"
                        ? "same city"
                        : a.match_type === "state"
                          ? "same state"
                          : "";
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggle(a.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{name}</span>
                        {distLabel && (
                          <Badge variant="secondary" className="text-xs">
                            {distLabel}
                          </Badge>
                        )}
                        {a.status && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {a.status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.phone ?? "no phone"}
                        {loc ? ` · ${loc}` : ""}
                        {a.home_zip ? ` · ${a.home_zip}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No previously-applied applicants match this location. Widen the radius or check the project's address.
                </div>
              )}
            </div>
          </ScrollArea>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Message</Label>
              <span className="text-[11px] text-muted-foreground">
                Available: {AVAILABLE_MERGE_TAGS.map((t) => `{{${t}}}`).join(" ")} {"{first_name}"} {"{link}"}
              </span>
            </div>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi {first_name}, we have a new opportunity near you…"
            />
            <div className="text-xs bg-muted/40 rounded p-2 mt-2 whitespace-pre-wrap">
              <span className="text-muted-foreground">Preview: </span>
              {resolvedMessage.replace("{link}", link)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || selected.size === 0}>
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send {selected.size ? `to ${selected.size}` : "Invites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
