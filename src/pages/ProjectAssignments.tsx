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
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Project Assignments</h2>
            <p className="text-muted-foreground">
              Manage which personnel are assigned to which projects
            </p>
          </div>
          <Button onClick={() => setAssignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign User
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