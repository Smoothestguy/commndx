import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useLocationAssignments } from '@/integrations/supabase/hooks/useLocationStaffing';

export function AssetResponsiblePicker({ locationId, value, onChange }: { locationId: string; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const q = useLocationAssignments(locationId);
  const people = (q.data ?? []).filter(p => !p.demobilized && (!p.assigned_at || Date.parse(p.assigned_at) <= Date.now()));
  const selected = people.find(p => p.personnel_id === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-label="Responsible person" aria-expanded={open} className="w-full justify-between h-11">
      <span className="truncate">{selected ? `${selected.personnel?.first_name ?? ''} ${selected.personnel?.last_name ?? ''}` : 'No responsible person'}</span><ChevronsUpDown className="h-4 w-4 shrink-0" />
    </Button></PopoverTrigger><PopoverContent className="w-80 p-0"><Command>
      <CommandInput placeholder="Search assigned personnel…" /><CommandList><CommandEmpty>{q.isError ? 'Could not load assigned personnel.' : 'No assigned personnel found.'}</CommandEmpty><CommandGroup>
        <CommandItem value="No responsible person" onSelect={() => { onChange(null); setOpen(false); }}>No responsible person</CommandItem>
        {people.map(p => <CommandItem key={p.personnel_id} value={`${p.personnel?.first_name} ${p.personnel?.last_name} ${p.personnel_id}`} onSelect={() => { onChange(p.personnel_id); setOpen(false); }}>
          {p.personnel?.first_name} {p.personnel?.last_name}{value === p.personnel_id && <Check className="ml-auto h-4 w-4" />}
        </CommandItem>)}
      </CommandGroup></CommandList></Command></PopoverContent></Popover>;
}