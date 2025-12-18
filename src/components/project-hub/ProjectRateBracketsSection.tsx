import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, DollarSign } from "lucide-react";
import { 
  useProjectRateBrackets, 
  useAddRateBracket, 
  useUpdateRateBracket, 
  useDeleteRateBracket,
  ProjectRateBracket 
} from "@/integrations/supabase/hooks/useProjectRateBrackets";
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

interface ProjectRateBracketsSectionProps {
  projectId: string;
}

interface FormData {
  name: string;
  bill_rate: string;
  overtime_multiplier: string;
}

const initialFormData: FormData = {
  name: "",
  bill_rate: "",
  overtime_multiplier: "1.5",
};

export function ProjectRateBracketsSection({ projectId }: ProjectRateBracketsSectionProps) {
  const { data: brackets = [], isLoading } = useProjectRateBrackets(projectId);
  const addBracket = useAddRateBracket();
  const updateBracket = useUpdateRateBracket();
  const deleteBracket = useDeleteRateBracket();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBracket, setEditingBracket] = useState<ProjectRateBracket | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingBracket(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (bracket: ProjectRateBracket) => {
    setEditingBracket(bracket);
    setFormData({
      name: bracket.name,
      bill_rate: bracket.bill_rate.toString(),
      overtime_multiplier: bracket.overtime_multiplier.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const billRate = parseFloat(formData.bill_rate);
    const otMultiplier = parseFloat(formData.overtime_multiplier);

    if (!formData.name.trim() || isNaN(billRate) || isNaN(otMultiplier)) {
      return;
    }

    if (editingBracket) {
      await updateBracket.mutateAsync({
        id: editingBracket.id,
        name: formData.name.trim(),
        bill_rate: billRate,
        overtime_multiplier: otMultiplier,
      });
    } else {
      await addBracket.mutateAsync({
        project_id: projectId,
        name: formData.name.trim(),
        bill_rate: billRate,
        overtime_multiplier: otMultiplier,
      });
    }

    setIsDialogOpen(false);
    setFormData(initialFormData);
    setEditingBracket(null);
  };

  const handleDelete = async (id: string) => {
    await deleteBracket.mutateAsync({ id, projectId });
    setDeleteConfirmId(null);
  };

  const handleToggleActive = async (bracket: ProjectRateBracket) => {
    await updateBracket.mutateAsync({
      id: bracket.id,
      is_active: !bracket.is_active,
    });
  };

  const activeBrackets = brackets.filter(b => b.is_active);
  const inactiveBrackets = brackets.filter(b => !b.is_active);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rate Brackets
          </CardTitle>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Bracket
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : brackets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No rate brackets defined</p>
              <p className="text-sm mt-1">
                Add rate brackets to define billing roles for this project
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead className="text-right">Bill Rate</TableHead>
                  <TableHead className="text-right">OT Multiplier</TableHead>
                  <TableHead className="text-right">OT Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBrackets.map((bracket) => (
                  <TableRow key={bracket.id}>
                    <TableCell className="font-medium">{bracket.name}</TableCell>
                    <TableCell className="text-right">
                      ${bracket.bill_rate.toFixed(2)}/hr
                    </TableCell>
                    <TableCell className="text-right">
                      {bracket.overtime_multiplier}x
                    </TableCell>
                    <TableCell className="text-right">
                      ${(bracket.bill_rate * bracket.overtime_multiplier).toFixed(2)}/hr
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(bracket)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(bracket)}>
                            Deactivate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteConfirmId(bracket.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {inactiveBrackets.map((bracket) => (
                  <TableRow key={bracket.id} className="opacity-60">
                    <TableCell className="font-medium">{bracket.name}</TableCell>
                    <TableCell className="text-right">
                      ${bracket.bill_rate.toFixed(2)}/hr
                    </TableCell>
                    <TableCell className="text-right">
                      {bracket.overtime_multiplier}x
                    </TableCell>
                    <TableCell className="text-right">
                      ${(bracket.bill_rate * bracket.overtime_multiplier).toFixed(2)}/hr
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Inactive</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(bracket)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(bracket)}>
                            Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteConfirmId(bracket.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBracket ? "Edit Rate Bracket" : "Add Rate Bracket"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                placeholder="e.g., Admin, Supervisor, Janitorial"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bill_rate">Bill Rate ($/hr)</Label>
                <Input
                  id="bill_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="25.00"
                  value={formData.bill_rate}
                  onChange={(e) => setFormData({ ...formData, bill_rate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtime_multiplier">OT Multiplier</Label>
                <Input
                  id="overtime_multiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder="1.5"
                  value={formData.overtime_multiplier}
                  onChange={(e) => setFormData({ ...formData, overtime_multiplier: e.target.value })}
                />
              </div>
            </div>
            {formData.bill_rate && formData.overtime_multiplier && (
              <p className="text-sm text-muted-foreground">
                Overtime rate: ${(parseFloat(formData.bill_rate || "0") * parseFloat(formData.overtime_multiplier || "1.5")).toFixed(2)}/hr
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name.trim() || !formData.bill_rate || addBracket.isPending || updateBracket.isPending}
            >
              {editingBracket ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Bracket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this rate bracket. Personnel assigned to this bracket will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
