import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Pencil, Phone, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ProjectLocation, useAddProjectLocation, useDeleteProjectLocation, useProjectLocations, useUpdateProjectLocation,
} from "@/integrations/supabase/hooks/useProjectLocations";

const EMPTY = {
  name: "", project_number: "", scope: "", address: "", city: "", state: "", zip: "",
  poc_name: "", poc_phone: "", poc_email: "", status: "active", sort_order: "",
};
type FormState = typeof EMPTY;

function ScopeText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
      {open || !long ? text : `${text.slice(0, 140)}…`}
      {long && (
        <button type="button" className="ml-1 text-primary text-xs underline" onClick={() => setOpen(!open)}>
          {open ? "Less" : "More"}
        </button>
      )}
    </p>
  );
}

export function ProjectLocationsTab({ projectId }: { projectId: string }) {
  const { isAdmin, isManager } = useUserRole();
  const canWrite = isAdmin || isManager;
  const { data: locations = [], isLoading } = useProjectLocations(projectId);
  const add = useAddProjectLocation();
  const update = useUpdateProjectLocation();
  const del = useDeleteProjectLocation();

  const [editing, setEditing] = useState<ProjectLocation | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<ProjectLocation | null>(null);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (l: ProjectLocation) => {
    setEditing(l);
    setForm({
      name: l.name, project_number: l.project_number ?? "", scope: l.scope ?? "", address: l.address ?? "",
      city: l.city ?? "", state: l.state ?? "", zip: l.zip ?? "", poc_name: l.poc_name ?? "",
      poc_phone: l.poc_phone ?? "", poc_email: l.poc_email ?? "", status: l.status || "active",
      sort_order: l.sort_order != null ? String(l.sort_order) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const n = (v: string) => (v.trim() ? v.trim() : null);
    const payload = {
      project_id: projectId, name: form.name.trim(), project_number: n(form.project_number), scope: n(form.scope),
      address: n(form.address), city: n(form.city), state: n(form.state), zip: n(form.zip),
      poc_name: n(form.poc_name), poc_phone: n(form.poc_phone), poc_email: n(form.poc_email),
      status: form.status, sort_order: form.sort_order.trim() ? Number(form.sort_order) : 0,
    };
    if (editing) await update.mutateAsync({ id: editing.id, ...payload });
    else await add.mutateAsync(payload);
    setOpen(false);
  };

  const f = (k: keyof FormState) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }),
  });
  const saving = add.isPending || update.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Sites / Locations</h3>
        {canWrite && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add location</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : locations.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No locations yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {locations.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{l.name}</span>
                      {l.project_number && <Badge variant="outline">#{l.project_number}</Badge>}
                      <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">{l.status}</Badge>
                    </div>
                    {(l.city || l.state || l.address) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {[l.address, [l.city, l.state].filter(Boolean).join(", "), l.zip].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0">
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(l)} aria-label="Edit location"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setToDelete(l)} aria-label="Delete location"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
                {(l.poc_name || l.poc_phone || l.poc_email) && (
                  <div className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                    {l.poc_name && <span className="font-medium">{l.poc_name}</span>}
                    {l.poc_phone && <a href={`tel:${l.poc_phone}`} className="text-primary flex items-center gap-1"><Phone className="h-3 w-3" />{l.poc_phone}</a>}
                    {l.poc_email && <a href={`mailto:${l.poc_email}`} className="text-primary flex items-center gap-1"><Mail className="h-3 w-3" />{l.poc_email}</a>}
                  </div>
                )}
                {l.scope && <ScopeText text={l.scope} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input {...f("name")} /></div>
            <div><Label>Project #</Label><Input {...f("project_number")} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Address</Label><Input {...f("address")} /></div>
            <div><Label>City</Label><Input {...f("city")} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>State</Label><Input {...f("state")} maxLength={2} /></div>
              <div><Label>ZIP</Label><Input {...f("zip")} /></div>
            </div>
            <div><Label>POC name</Label><Input {...f("poc_name")} /></div>
            <div><Label>POC phone</Label><Input type="tel" {...f("poc_phone")} /></div>
            <div><Label>POC email</Label><Input type="email" {...f("poc_email")} /></div>
            <div><Label>Sort order</Label><Input type="number" {...f("sort_order")} /></div>
            <div className="col-span-2"><Label>Scope</Label><Textarea rows={4} {...f("scope")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name.trim() || saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.name}" will be removed from this project.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) del.mutate({ id: toDelete.id, project_id: projectId }); setToDelete(null); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
