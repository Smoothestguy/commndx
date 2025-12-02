import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useMyProjectAssignments,
  useAllProjectAssignments,
} from "@/integrations/supabase/hooks/useProjectAssignments";
import { AssignmentList } from "@/components/project-assignments/AssignmentList";
import { AssignUserDialog } from "@/components/project-assignments/AssignUserDialog";

export function ProjectAssignmentsSection() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();
  const canManageAssignments = isAdmin || isManager;

  // Fetch appropriate assignments based on role
  const { data: myAssignments = [], isLoading: myLoading } = useMyProjectAssignments();
  const { data: allAssignments = [], isLoading: allLoading } = useAllProjectAssignments();

  const assignments = canManageAssignments ? allAssignments : myAssignments;
  const isLoading = canManageAssignments ? allLoading : myLoading;

  const activeAssignments = assignments.filter((a) => a.status === "active");
  const removedAssignments = assignments.filter((a) => a.status === "removed");

  return (
    <div className="space-y-6">
      {canManageAssignments && (
        <div className="flex justify-end">
          <Button onClick={() => setAssignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign User
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {canManageAssignments ? "Active Assignments" : "My Project Assignments"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssignmentList
            assignments={activeAssignments}
            isLoading={isLoading}
            showActions={canManageAssignments}
          />
        </CardContent>
      </Card>

      {canManageAssignments && removedAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Removed Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentList
              assignments={removedAssignments}
              isLoading={isLoading}
              showReactivate
            />
          </CardContent>
        </Card>
      )}

      {canManageAssignments && (
        <AssignUserDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      )}
    </div>
  );
}
