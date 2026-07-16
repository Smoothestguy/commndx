import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Edit, Trash2, User, Phone, Mail } from "lucide-react";
import {
  useMilestonesByProject,
  useAddMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  Milestone,
} from "@/integrations/supabase/hooks/useMilestones";
import { useJobOrdersByProject } from "@/integrations/supabase/hooks/useJobOrders";

interface Props {
  projectId: string;
  project: any;
}

export function ProjectOverviewTab({ projectId, project }: Props) {
  const { data: milestones = [] } = useMilestonesByProject(projectId);
  const { data: jobOrders = [] } = useJobOrdersByProject(projectId);
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "pending" as "pending" | "in-progress" | "completed" | "delayed",
    completion_percentage: 0,
  });

  const overallCompletion = (() => {
    if (milestones && milestones.length > 0) {
      const avg =
        milestones.reduce((s, m) => s + m.completion_percentage, 0) / milestones.length;
      return Math.round(avg);
    }
    if (jobOrders.length === 0) return 0;
    const completed = jobOrders.filter((j: any) => j.status === "completed").length;
    return Math.round((completed / jobOrders.length) * 100);
  })();

  const openNew = () => {
    setEditingMilestone(null);
    setFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pending",
      completion_percentage: 0,
    });
    setIsMilestoneDialogOpen(true);
  };

  const openEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setFormData({
      title: m.title,
      description: m.description || "",
      due_date: m.due_date,
      status: m.status,
      completion_percentage: m.completion_percentage,
    });
    setIsMilestoneDialogOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMilestone) {
      await updateMilestone.mutateAsync({ id: editingMilestone.id, ...formData });
    } else {
      await addMilestone.mutateAsync({ project_id: projectId, ...formData });
    }
    setIsMilestoneDialogOpen(false);
    setEditingMilestone(null);
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Project Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Completion</span>
              <span className="font-medium">{overallCompletion}%</span>
            </div>
            <Progress value={overallCompletion} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {milestones && milestones.length > 0
                ? `Based on ${milestones.length} milestone${milestones.length > 1 ? "s" : ""}`
                : `Based on ${jobOrders.length} job order${jobOrders.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {(project.poc_name || project.description) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {project.poc_name && (
            <Card className="glass border-border">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="font-heading text-sm text-muted-foreground">
                  Point of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{project.poc_name}</p>
                {project.poc_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{project.poc_phone}</span>
                  </div>
                )}
                {project.poc_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{project.poc_email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {project.description && (
            <Card className="glass border-border">
              <CardHeader>
                <CardTitle className="font-heading text-sm text-muted-foreground">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Milestones ({milestones?.length || 0})
            </h3>
          </div>
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Milestone
          </Button>
        </div>

        {!milestones || milestones.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No milestones yet. Add milestones to track project progress.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => (
              <Card key={m.id} className="glass border-border">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{m.title}</h4>
                        <StatusBadge status={m.status} />
                      </div>
                      {m.description && (
                        <p className="text-sm text-muted-foreground mb-2">{m.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(m.due_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMilestone.mutate(m.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{m.completion_percentage}%</span>
                    </div>
                    <Progress value={m.completion_percentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingMilestone ? "Edit Milestone" : "Add New Milestone"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Completion Percentage (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.completion_percentage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    completion_percentage: parseInt(e.target.value) || 0,
                  })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMilestoneDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingMilestone ? "Save Changes" : "Add Milestone"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
