import {useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
export function AssetNumberFields({type,number,rooms,onChange,suggest=false}:{type:string;number:string;rooms:number;onChange:(number:string,rooms:number)=>void;suggest?:boolean}) {
 const [year,setYear]=useState(new Date().getFullYear()),[letter,setLetter]=useState('B');
 return <div className="space-y-2"><Label htmlFor="asset-number">Asset number (optional)</Label><Input id="asset-number" value={number} onChange={e=>onChange(e.target.value,rooms)}/>{type==='bunk_trailer'&&<><Label htmlFor="room-count">Rooms</Label><Input id="room-count" type="number" min={1} max={200} value={rooms} onChange={e=>onChange(number,Number(e.target.value))}/>{suggest&&<div className="flex gap-2 items-end"><label className="text-xs">Purchase year<Input aria-label="Purchase year" type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/></label><label className="text-xs">Letter<Input aria-label="Asset letter" maxLength={1} value={letter} onChange={e=>setLetter(e.target.value)}/></label><Button type="button" variant="outline" onClick={async()=>{const {data,error}=await supabase.rpc('asset_number_suggestion',{p_year:year,p_letter:letter});if(error)toast.error(error.message);else if(data)onChange(data,rooms);}}>Suggest number</Button></div>}</>}</div>;
}