import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddRoom } from "@/integrations/supabase/hooks/useProjectRooms";

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AddRoomDialog({ open, onOpenChange, projectId }: AddRoomDialogProps) {
  const addRoom = useAddRoom();
  const [form, setForm] = useState({
    unit_number: '',
    shower_size: '',
    ceiling_height: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_number.trim()) return;

    const unitNum = form.unit_number.trim();
    const floorNumber = unitNum.length >= 3 ? parseInt(unitNum[0]) : undefined;

    await addRoom.mutateAsync({
      project_id: projectId,
      unit_number: unitNum,
      floor_number: floorNumber && !isNaN(floorNumber) ? floorNumber : undefined,
      shower_size: form.shower_size || undefined,
      ceiling_height: form.ceiling_height ? parseInt(form.ceiling_height) : undefined,
      notes: form.notes || undefined,
    });

    setForm({ unit_number: '', shower_size: '', ceiling_height: '', notes: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unit Number *</Label>
              <Input
                value={form.unit_number}
                onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))}
                placeholder="251"
                required
              />
            </div>
            <div>
              <Label>Shower Size</Label>
              <Input
                value={form.shower_size}
                onChange={e => setForm(f => ({ ...f, shower_size: e.target.value }))}
                placeholder="4.6x2.10"
              />
            </div>
            <div>
              <Label>Ceiling Height</Label>
              <Input
                type="number"
                value={form.ceiling_height}
                onChange={e => setForm(f => ({ ...f, ceiling_height: e.target.value }))}
                placeholder="9"
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="ADA, Double Curb, etc."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={addRoom.isPending}>
              {addRoom.isPending ? 'Adding...' : 'Add Room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
