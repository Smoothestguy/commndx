import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAllProjectAssignments } from "@/integrations/supabase/hooks/useProjectAssignments";
import { AssignmentList } from "@/components/project-assignments/AssignmentList";
import { AssignUserDialog } from "@/components/project-assignments/AssignUserDialog";

export default function ProjectAssignments() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { data: assignments = [], isLoading } = useAllProjectAssignments();

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const removedAssignments = assignments.filter(a => a.status === 'removed');

  return (
    <PageLayout title="Project Assignments">
      <SEO 
        title="Project Assignments - Command X"
        description="Manage personnel assignments to projects. Assign and reassign team members to active projects."
      />
      
      <div className="w-full max-w-full overflow-hidden space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold truncate">Project Assignments</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage which personnel are assigned to which projects
            </p>
          </div>
          <Button onClick={() => setAssignDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            <span className="truncate">Assign User</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentList 
              assignments={activeAssignments} 
              isLoading={isLoading}
              showActions
            />
          </CardContent>
        </Card>

        {removedAssignments.length > 0 && (
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

        <AssignUserDialog 
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      </div>
    </PageLayout>
  );
}