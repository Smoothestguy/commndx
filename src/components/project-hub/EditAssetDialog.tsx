import { AssetOwnershipFields, emptyOwnership } from './AssetOwnershipFields';
import {AssetNumberFields} from './AssetNumberFields';
import { AssetCostBadge, AssetCostFields, costDraftFrom, costDraftToRow, costDraftValid } from './AssetCostFields';
import type { AssetCostInputs } from '@/lib/assetCost';
import { validAssetCost, type Ownership, type RentalPeriod } from '@/lib/assetDetails';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_STATUSES, ASSET_TYPES, AssetStatus, useUpdateAsset } from "@/integrations/supabase/hooks/useAssets";

export interface EditableAsset extends Omit<AssetCostInputs, 'ownership' | 'unit_cost' | 'rental_rate' | 'rental_period'> {
  insurance_carrier?: string | null; insurance_policy_number?: string | null; other_annual_cost_note?: string | null;
  asset_number?: string | null; room_count?: number; raw_label?: string;
  id: string; label: string; type: string; serial_number: string | null; description: string | null;
  ownership?: Ownership; vendor_id?: string | null; unit_cost?: number | null; rental_rate?: number | null; rental_period?: RentalPeriod; notes?: string | null;
  status: string; default_day_rate?: number | null;
}

/** Edits the registry asset (source of truth for default day rate). Callers gate to manager+. */
export function EditAssetDialog({ asset, open, onOpenChange }: { asset: EditableAsset | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateAsset();
  const [number,setNumber]=useState(''),[rooms,setRooms]=useState(10);
  const [ownership, setOwnership] = useState(emptyOwnership);
  const [cost, setCost] = useState(() => costDraftFrom(null));
  const [f, setF] = useState({ label: "", type: "", serial: "", description: "", status: "available", rate: "" });
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if(open&&asset){setNumber(asset.asset_number??'');setRooms(asset.room_count??10);setCost(costDraftFrom(asset));}
    if (open && asset) setOwnership({ ownership: asset.ownership ?? 'owned', vendor: asset.vendor_id ?? '', unitCost: asset.unit_cost != null ? String(asset.unit_cost) : '', rentalRate: asset.rental_rate != null ? String(asset.rental_rate) : '', rentalPeriod: asset.rental_period ?? 'day', notes: asset.notes ?? '' });
    if (open && asset) setF({
      label: asset.raw_label??asset.label, type: asset.type, serial: asset.serial_number ?? "", description: asset.description ?? "",
      status: asset.status, rate: asset.default_day_rate != null ? String(asset.default_day_rate) : "",
    });
  }
  const rateNum = f.rate.trim() === "" ? null : Number(f.rate);
  const rateBad = rateNum != null && (!Number.isFinite(rateNum) || rateNum < 0);
  const types = ASSET_TYPES.some((t) => t.value === f.type) || !f.type ? ASSET_TYPES : [...ASSET_TYPES, { value: f.type as any, label: f.type }];

  const save = () => {
    if (!asset) return;
    update.mutate({
      id: asset.id, label: f.label.trim(), type: f.type, serial_number: f.serial.trim() || null,
      asset_number:number.trim()||null,room_count:rooms,
      ownership: ownership.ownership, vendor_id: ownership.ownership === 'rented' ? ownership.vendor || null : null,
      unit_cost: ownership.unitCost.trim() ? Number(ownership.unitCost) : null, rental_rate: ownership.rentalRate.trim() ? Number(ownership.rentalRate) : null,
      rental_period: ownership.rentalPeriod, notes: ownership.notes.trim() || null, ...costDraftToRow(cost),
      description: f.description.trim() || null, status: f.status as AssetStatus, default_day_rate: rateNum,
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit asset</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Label / Name</Label><Input className="h-11" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Serial number</Label><Input className="h-11" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></div>
          <AssetOwnershipFields value={ownership} onChange={setOwnership} full />
          <AssetCostFields value={cost} onChange={setCost} base={{ ownership: ownership.ownership, unit_cost: ownership.unitCost.trim() ? Number(ownership.unitCost) : null, rental_rate: ownership.rentalRate.trim() ? Number(ownership.rentalRate) : null, rental_period: ownership.rentalPeriod }} />
          <AssetNumberFields type={f.type} number={number} rooms={rooms} onChange={(n,r)=>{setNumber(n);setRooms(r);}} suggest />
          <div className="space-y-1.5"><Label>Default bill rate ($/day) — what we charge</Label>
            <Input type="number" inputMode="decimal" min={0} step="0.01" className="h-11" value={f.rate} placeholder="No default rate"
              onChange={(e) => setF({ ...f, rate: e.target.value })} />
            <p className="text-xs text-muted-foreground">{rateBad ? <span className="text-destructive">Enter a valid rate</span> : "Default for billable assignments without their own rate."}</p>
            <AssetCostBadge asset={{ ownership: ownership.ownership, unit_cost: ownership.unitCost.trim() ? Number(ownership.unitCost) : null, rental_rate: ownership.rentalRate.trim() ? Number(ownership.rentalRate) : null, rental_period: ownership.rentalPeriod, ...costDraftToRow(cost) }} billRate={rateNum} />
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!f.label.trim() || !f.type || rateBad || !costDraftValid(cost) || !validAssetCost(ownership.unitCost) || !validAssetCost(ownership.rentalRate) || (ownership.ownership === "rented" && !ownership.vendor) || update.isPending} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
