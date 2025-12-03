import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { SEO } from "@/components/SEO";
import {
  useBadgeTemplates,
  useDeleteBadgeTemplate,
  useSetDefaultTemplate,
} from "@/integrations/supabase/hooks/useBadgeTemplates";
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

const BadgeTemplates = () => {
  const navigate = useNavigate();
  const { data: templates, isLoading } = useBadgeTemplates();
  const deleteMutation = useDeleteBadgeTemplate();
  const setDefaultMutation = useSetDefaultTemplate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const handleDelete = async () => {
    if (selectedTemplateId) {
      await deleteMutation.mutateAsync(selectedTemplateId);
      setDeleteDialogOpen(false);
      setSelectedTemplateId("");
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultMutation.mutateAsync(id);
  };

  return (
    <PageLayout title="Badge Templates">
      <SEO
        title="Badge Templates"
        description="Manage digital ID badge templates for your personnel"
      />

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Create and manage customizable badge templates for your personnel
          </p>
          <Button onClick={() => navigate("/badge-templates/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.is_default && (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Orientation: </span>
                      <span className="capitalize">{template.orientation}</span>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Fields: </span>
                      <span>{template.fields?.length || 0} configured</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {!template.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/badge-templates/${template.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No badge templates yet. Create your first template to get started.
              </p>
              <Button onClick={() => navigate("/badge-templates/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this badge template? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default BadgeTemplates;
