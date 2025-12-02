import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { UserMinus, RotateCcw } from "lucide-react";
import { useRemoveFromProject, useReactivateAssignment } from "@/integrations/supabase/hooks/useProjectAssignments";
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