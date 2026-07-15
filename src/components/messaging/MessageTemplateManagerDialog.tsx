import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import {
  MessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpsertMessageTemplate,
} from "@/integrations/supabase/hooks/useMessageTemplates";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  id?: string;
  name: string;
  category: string;
  content_en: string;
  content_es: string;
  is_active: boolean;
  sort_order: number;
};

const empty: FormState = {
  name: "",
  category: "General",
  content_en: "",
  content_es: "",
  is_active: true,
  sort_order: 0,
};

export function MessageTemplateManagerDialog({ open, onOpenChange }: Props) {
  const { data: templates, isLoading } = useMessageTemplates(true);
  const upsert = useUpsertMessageTemplate();
  const del = useDeleteMessageTemplate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(empty);
      setEditing(false);
    }
  }, [open]);

  const startEdit = (t: MessageTemplate) => {
    setForm({
      id: t.id,
      name: t.name,
      category: t.category || "General",
      content_en: t.content_en || "",
      content_es: t.content_es || "",
      is_active: t.is_active,
      sort_order: t.sort_order || 0,
    });
    setEditing(true);
  };

  const startNew = () => {
    setForm(empty);
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        category: form.category.trim() || "General",
        content_en: form.content_en || null,
        content_es: form.content_es || null,
        is_active: form.is_active,
        sort_order: form.sort_order,
        created_by: form.id ? undefined : user?.id,
      });
      toast({ title: form.id ? "Template updated" : "Template created" });
      setForm(empty);
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await del.mutateAsync(id);
      toast({ title: "Template deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Create and manage reusable message content. Placeholders like{" "}
            <code className="text-xs">{"{{poc_name}}"}</code> are inserted as-is.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                {isLoading ? "Loading…" : `${templates?.length || 0} templates`}
              </div>
              <Button size="sm" onClick={startNew}>
                <Plus className="h-4 w-4 mr-1" /> New template
              </Button>
            </div>
            <ScrollArea className="h-[400px] border rounded-md">
              <div className="divide-y">
                {(templates || []).map((t) => (
                  <div key={t.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.name}</span>
                        <Badge variant="outline">{t.category}</Badge>
                        {!t.is_active && <Badge variant="secondary">inactive</Badge>}
                      </div>
                      {t.content_en && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <span className="font-semibold">EN:</span> {t.content_en}
                        </p>
                      )}
                      {t.content_es && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <span className="font-semibold">ES:</span> {t.content_es}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!isLoading && (!templates || templates.length === 0) && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No templates yet. Click "New template" to add one.
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Content (English)</Label>
              <Textarea rows={4} value={form.content_en} onChange={(e) => setForm({ ...form, content_en: e.target.value })} />
            </div>
            <div>
              <Label>Content (Spanish)</Label>
              <Textarea rows={4} value={form.content_es} onChange={(e) => setForm({ ...form, content_es: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0", 10) })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
