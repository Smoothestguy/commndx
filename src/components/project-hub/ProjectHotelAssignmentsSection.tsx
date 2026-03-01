import { useState } from "react";
import { format } from "date-fns";
import {
  Hotel,
  Plus,
  ChevronDown,
  Loader2,
  LogOut,
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
  type HotelAssignmentWithDetails,
} from "@/integrations/supabase/hooks/useHotelAssignments";
import { AssignHotelDialog } from "./AssignHotelDialog";

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
                  Hotel Assignments
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </CardTitle>
                <CardDescription>
                  {activeAssignments.length} active hotel stay{activeAssignments.length !== 1 ? "s" : ""}
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
                {isMobile ? "Add" : "Add Hotel"}
              </Button>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {activeAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No active hotel assignments for this project
                  </p>
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Hotel
                  </Button>
                </div>
              ) : isMobile ? (
                <MobileCards
                  assignments={activeAssignments}
                  onCheckOut={handleCheckOut}
                />
              ) : (
                <DesktopTable
                  assignments={activeAssignments}
                  onCheckOut={handleCheckOut}
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
      />

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
}: {
  assignments: HotelAssignmentWithDetails[];
  onCheckOut: (id: string, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <div key={a.id} className="p-4 rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.hotel_name}</p>
              <p className="text-sm text-muted-foreground">
                {a.personnel?.first_name} {a.personnel?.last_name}
              </p>
            </div>
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
                <span className="text-muted-foreground">Room:</span> {a.room_number}
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
}: {
  assignments: HotelAssignmentWithDetails[];
  onCheckOut: (id: string, label: string) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Personnel</TableHead>
            <TableHead>Hotel</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Confirmation #</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
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
                  <p>{a.hotel_name}</p>
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
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
