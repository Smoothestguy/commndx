import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { UserMinus, RotateCcw, User, FolderOpen, Calendar, Clock } from "lucide-react";
import { useRemoveFromProject, useReactivateAssignment } from "@/integrations/supabase/hooks/useProjectAssignments";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AssignmentListProps {
  assignments: any[];
  isLoading: boolean;
  showActions?: boolean;
  showReactivate?: boolean;
}

export function AssignmentList({ 
  assignments, 
  isLoading, 
  showActions = false,
  showReactivate = false 
}: AssignmentListProps) {
  const { mutate: removeAssignment } = useRemoveFromProject();
  const { mutate: reactivateAssignment } = useReactivateAssignment();
  const isMobile = useIsMobile();

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>;
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No assignments found
      </div>
    );
  }

  // Mobile card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="space-y-2">
                {/* User info */}
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {assignment.profiles?.email}
                    </p>
                  </div>
                </div>

                {/* Project */}
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{assignment.projects?.name}</span>
                </div>

                {/* Dates row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Assigned: {format(new Date(assignment.assigned_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      Last: {assignment.last_time_entry_at
                        ? format(new Date(assignment.last_time_entry_at), "MMM d, yyyy")
                        : "No activity"}
                    </span>
                  </div>
                </div>

                {/* Status and Actions row */}
                <div className="flex items-center justify-between pt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    assignment.status === 'active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {assignment.status}
                  </span>
                  
                  {showActions && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Remove this user from the project?")) {
                          removeAssignment(assignment.id);
                        }
                      }}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      <span className="text-xs">Remove</span>
                    </Button>
                  )}
                  
                  {showReactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reactivateAssignment(assignment.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      <span className="text-xs">Reassign</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assigned Date</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Status</TableHead>
            {(showActions || showReactivate) && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell>
                {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                <div className="text-xs text-muted-foreground">
                  {assignment.profiles?.email}
                </div>
              </TableCell>
              <TableCell>{assignment.projects?.name}</TableCell>
              <TableCell>
                {format(new Date(assignment.assigned_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {assignment.last_time_entry_at
                  ? format(new Date(assignment.last_time_entry_at), "MMM d, yyyy")
                  : "No activity"}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  assignment.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}>
                  {assignment.status}
                </span>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remove this user from the project?")) {
                        removeAssignment(assignment.id);
                      }
                    }}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
              {showReactivate && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reactivateAssignment(assignment.id)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reassign
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}