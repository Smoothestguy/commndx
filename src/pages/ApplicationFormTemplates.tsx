import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Copy, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useApplicationFormTemplates,
  useDeleteApplicationFormTemplate,
  useUpdateApplicationFormTemplate,
  useCloneApplicationFormTemplate,
  TEMPLATE_CATEGORIES,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ApplicationFormTemplates() {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: templates, isLoading } = useApplicationFormTemplates();
  const deleteTemplate = useDeleteApplicationFormTemplate();
  const updateTemplate = useUpdateApplicationFormTemplate();
  const cloneTemplate = useCloneApplicationFormTemplate();

  const filteredTemplates = templates?.filter(t => 
    categoryFilter === "all" || t.category === categoryFilter || (!t.category && categoryFilter === "uncategorized")
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate.mutateAsync(deleteId);
      toast.success("Form template deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateTemplate.mutateAsync({ id, is_active: !currentStatus });
      toast.success(`Template ${!currentStatus ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  const handleClone = async (id: string) => {
    try {
      await cloneTemplate.mutateAsync(id);
      toast.success("Template cloned successfully");
    } catch (error) {
      toast.error("Failed to clone template");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Form Templates</h1>
          <p className="text-muted-foreground">Create and manage custom application forms</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/staffing/form-templates/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden sm:table-cell">Fields</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading templates...</TableCell>
                </TableRow>
              ) : filteredTemplates?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No form templates yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{template.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {template.category ? (
                        <Badge variant="outline">{template.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{template.fields.length} field{template.fields.length !== 1 ? "s" : ""}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(template.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={template.is_active ? "default" : "secondary"}
                        className={template.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : ""}
                      >
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleClone(template.id)} title="Clone">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(template.id, template.is_active)} title={template.is_active ? "Deactivate" : "Activate"}>
                          {template.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/staffing/form-templates/${template.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
