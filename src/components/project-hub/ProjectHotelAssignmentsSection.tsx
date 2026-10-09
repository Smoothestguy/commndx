import { useState } from "react";
import { format } from "date-fns";
import {
  Hotel,
  Plus,
  ChevronDown,
  Loader2,
  LogOut,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useHotelAssignmentsByProject,
  useCheckOutHotel,
  useSendLodgingDetails,
  type HotelAssignmentWithDetails,
} from "@/integrations/supabase/hooks/useHotelAssignments";
import { AssignHotelDialog, LODGING_TYPES } from "./AssignHotelDialog";

const typeLabel = (t?: string | null) => LODGING_TYPES.find((x) => x.value === t)?.label ?? "Hotel";

function SentNote({ a }: { a: HotelAssignmentWithDetails }) {
  if (!a.notified_at) return null;
  return <span className="text-xs text-muted-foreground">Sent {format(new Date(a.notified_at), "MMM d")}</span>;
}

interface ProjectHotelAssignmentsSectionProps {
  projectId: string;
  projectName?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  checked_out: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ProjectHotelAssignmentsSection({
  projectId,
  projectName = "this project",
}: ProjectHotelAssignmentsSectionProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [checkOutId, setCheckOutId] = useState<string | null>(null);
  const [checkOutLabel, setCheckOutLabel] = useState("");

  const { data: assignments = [], isLoading } = useHotelAssignmentsByProject(projectId);
  const checkOutMutation = useCheckOutHotel();
  const sendDetails = useSendLodgingDetails();
  const [pendingSend, setPendingSend] = useState<string[]>([]);
  const onSend = (id: string) => sendDetails.mutate([id]);

  const activeAssignments = assignments.filter((a) => a.status === "active");

  const handleCheckOut = (id: string, label: string) => {
    setCheckOutId(id);
    setCheckOutLabel(label);
  };

  const confirmCheckOut = () => {
    if (!checkOutId) return;
    checkOutMutation.mutate(checkOutId, {
      onSuccess: () => {
        setCheckOutId(null);
        setCheckOutLabel("");
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Hotel className="h-5 w-5 text-primary" />
                  Lodging Assignments
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </CardTitle>
                <CardDescription>
                  {activeAssignments.length} active lodging assignment{activeAssignments.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAssignDialogOpen(true);
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isMobile ? "Add" : "Add Lodging"}
              </Button>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {activeAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No active lodging assignments for this project
                  </p>
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lodging
                  </Button>
                </div>
              ) : isMobile ? (
                <MobileCards
                  assignments={activeAssignments}
                  onCheckOut={handleCheckOut}
                  onSend={onSend}
                />
              ) : (
                <DesktopTable
                  assignments={activeAssignments}
                  onCheckOut={handleCheckOut}
                  onSend={onSend}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AssignHotelDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        projectId={projectId}
        onCreated={(ids) => setPendingSend(ids)}
      />

      <AlertDialog open={pendingSend.length > 0} onOpenChange={(o) => !o && setPendingSend([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send lodging details?</AlertDialogTitle>
            <AlertDialogDescription>
              Send lodging details to {pendingSend.length} personnel by text/email?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={() => { sendDetails.mutate(pendingSend); setPendingSend([]); }}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!checkOutId} onOpenChange={() => setCheckOutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check Out</AlertDialogTitle>
            <AlertDialogDescription>
              Mark "{checkOutLabel}" as checked out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCheckOut}
              disabled={checkOutMutation.isPending}
            >
              {checkOutMutation.isPending ? "Checking out..." : "Check Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MobileCards({
  assignments,
  onCheckOut,
  onSend,
}: {
  assignments: HotelAssignmentWithDetails[];
  onCheckOut: (id: string, label: string) => void;
  onSend: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <div key={a.id} className="p-4 rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.hotel_name} <span className="text-xs text-muted-foreground">· {typeLabel(a.lodging_type)}</span>{a.project_locations?.name && <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground font-normal">{a.project_locations.name}</Badge>}</p>
              <SentNote a={a} />
              <p className="text-sm text-muted-foreground">
                {a.personnel?.first_name} {a.personnel?.last_name}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => onSend(a.id)} title="Send details" aria-label="Send details">
              <Send className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() =>
                onCheckOut(
                  a.id,
                  `${a.personnel?.first_name} ${a.personnel?.last_name} — ${a.hotel_name}`
                )
              }
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t space-y-1 text-sm">
            {a.room_number && (
              <p>
                <span className="text-muted-foreground">Room/Unit:</span> {a.room_number}
              </p>
            )}
            {a.confirmation_number && (
              <p>
                <span className="text-muted-foreground">Conf#:</span> {a.confirmation_number}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Check-in:</span>{" "}
              {format(new Date(a.check_in), "MMM d, yyyy")}
            </p>
            {a.check_out && (
              <p>
                <span className="text-muted-foreground">Check-out:</span>{" "}
                {format(new Date(a.check_out), "MMM d, yyyy")}
              </p>
            )}
            <Badge variant="outline" className={statusColors[a.status]}>
              {a.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopTable({
  assignments,
  onCheckOut,
  onSend,
}: {
  assignments: HotelAssignmentWithDetails[];
  onCheckOut: (id: string, label: string) => void;
  onSend: (id: string) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Personnel</TableHead>
            <TableHead>Lodging</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Confirmation #</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                {a.personnel?.first_name} {a.personnel?.last_name}
              </TableCell>
              <TableCell>
                <div>
                  <p>{a.hotel_name} <span className="text-xs text-muted-foreground">· {typeLabel(a.lodging_type)}</span>{a.project_locations?.name && <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground font-normal">{a.project_locations.name}</Badge>}</p>
                  {a.hotel_city && (
                    <p className="text-xs text-muted-foreground">
                      {a.hotel_city}
                      {a.hotel_state ? `, ${a.hotel_state}` : ""}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>{a.room_number || "—"}</TableCell>
              <TableCell>{a.confirmation_number || "—"}</TableCell>
              <TableCell>{format(new Date(a.check_in), "MMM d, yyyy")}</TableCell>
              <TableCell>
                {a.check_out
                  ? format(new Date(a.check_out), "MMM d, yyyy")
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColors[a.status]}>
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Button variant="ghost" size="icon" onClick={() => onSend(a.id)} title="Send details" aria-label="Send details">
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onCheckOut(
                      a.id,
                      `${a.personnel?.first_name} ${a.personnel?.last_name} — ${a.hotel_name}`
                    )
                  }
                  title="Check out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
                <SentNote a={a} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
