import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export const LODGING_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "airbnb", label: "Airbnb" },
  { value: "rental_house", label: "Rental House" },
  { value: "bunk_trailer", label: "Bunk Trailer" },
  { value: "other", label: "Other" },
];
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useCreateHotelAssignment } from "@/integrations/supabase/hooks/useHotelAssignments";
import { useActivePersonnelLite, useActiveProjectAssignmentMap } from "@/integrations/supabase/hooks/useLocationStaffing";

const hotelSchema = z.object({
  personnelIds: z.array(z.string()).min(1, "Select at least one person"),
  lodgingType: z.string().default("hotel"),
  accessCodes: z.string().optional(),
  hostInstructions: z.string().optional(),
  hotelName: z.string().min(1, "Name is required"),
  hotelAddress: z.string().optional(),
  hotelCity: z.string().optional(),
  hotelState: z.string().optional(),
  hotelZip: z.string().optional(),
  hotelPhone: z.string().optional(),
  roomNumber: z.string().optional(),
  confirmationNumber: z.string().optional(),
  checkIn: z.date({ required_error: "Check-in date is required" }),
  checkOut: z.date().optional(),
  nightlyRate: z.string().optional(),
  notes: z.string().optional(),
});

type HotelFormValues = z.infer<typeof hotelSchema>;

interface AssignHotelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  locationId?: string | null;
  onCreated?: (assignmentIds: string[]) => void;
}

export function AssignHotelDialog({ open, onOpenChange, projectId, locationId, onCreated }: AssignHotelDialogProps) {
  const { data: personnel = [] } = usePersonnelByProject(projectId);
  const createMutation = useCreateHotelAssignment();
  const [mode, setMode] = useState<"project" | "all">("project");
  const [search, setSearch] = useState("");
  const { data: allPersonnel = [] } = useActivePersonnelLite(mode === "all");
  const { data: assignmentMap = {} } = useActiveProjectAssignmentMap(mode === "all");

  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      personnelIds: [],
      lodgingType: "hotel",
      accessCodes: "",
      hostInstructions: "",
      hotelName: "",
      hotelAddress: "",
      hotelCity: "",
      hotelState: "",
      hotelZip: "",
      hotelPhone: "",
      roomNumber: "",
      confirmationNumber: "",
      checkIn: new Date(),
      nightlyRate: "",
      notes: "",
    },
  });

  const onSubmit = async (values: HotelFormValues) => {
    const ids = await createMutation.mutateAsync({
      personnelIds: values.personnelIds,
      lodgingType: values.lodgingType,
      accessCodes: values.accessCodes,
      hostInstructions: values.hostInstructions,
      projectId,
      locationId: locationId ?? null,
      hotelName: values.hotelName,
      hotelAddress: values.hotelAddress,
      hotelCity: values.hotelCity,
      hotelState: values.hotelState,
      hotelZip: values.hotelZip,
      hotelPhone: values.hotelPhone,
      roomNumber: values.roomNumber,
      confirmationNumber: values.confirmationNumber,
      checkIn: values.checkIn.toISOString().split("T")[0],
      checkOut: values.checkOut?.toISOString().split("T")[0],
      nightlyRate: values.nightlyRate ? parseFloat(values.nightlyRate) : undefined,
      notes: values.notes,
    });

    form.reset();
    onOpenChange(false);
    onCreated?.(ids);
  };

  const activePersonnel = personnel.filter(
    (p) => p.personnel
  );

  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const filteredAll = (q
    ? allPersonnel.filter((p) => {
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
        const phone = (p.phone ?? "").replace(/\D/g, "");
        return name.includes(q) || (qDigits.length > 0 && phone.includes(qDigits));
      })
    : allPersonnel
  ).slice(0, 200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Assign Lodging</DialogTitle>
          <DialogDescription>
            Assign lodging to one or more project personnel.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
              {/* Personnel (multi) */}
              <FormField
                control={form.control}
                name="personnelIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personnel * <span className="text-xs text-muted-foreground font-normal">(select everyone sharing this lodging)</span></FormLabel>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
                        {(["project", "all"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={cn(
                              "px-3 py-1.5 min-h-11 sm:min-h-0",
                              mode === m ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {m === "project" ? "This project" : "All personnel"}
                          </button>
                        ))}
                      </div>
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search name or phone..."
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                      {mode === "project" ? (
                        <>
                          {activePersonnel.length === 0 && <p className="p-3 text-sm text-muted-foreground">No crew on this project.</p>}
                          {activePersonnel
                            .filter((a) => {
                              if (!q) return true;
                              const name = `${a.personnel?.first_name ?? ""} ${a.personnel?.last_name ?? ""}`.toLowerCase();
                              const phone = (a.personnel?.phone ?? "").replace(/\D/g, "");
                              return name.includes(q) || (qDigits.length > 0 && phone.includes(qDigits));
                            })
                            .map((a) => {
                              const checked = field.value.includes(a.personnel_id);
                              return (
                                <label key={a.personnel_id} className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer">
                                  <Checkbox checked={checked} onCheckedChange={(c) =>
                                    field.onChange(c ? [...field.value, a.personnel_id] : field.value.filter((x) => x !== a.personnel_id))} />
                                  <span className="text-sm">{a.personnel?.first_name} {a.personnel?.last_name}</span>
                                </label>
                              );
                            })}
                        </>
                      ) : (
                        <>
                          {filteredAll.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching personnel.</p>}
                          {filteredAll.map((p) => {
                            const checked = field.value.includes(p.id);
                            const onProject = assignmentMap[p.id];
                            return (
                              <label key={p.id} className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer">
                                <Checkbox checked={checked} onCheckedChange={(c) =>
                                  field.onChange(c ? [...field.value, p.id] : field.value.filter((x) => x !== p.id))} />
                                <span className="text-sm">{p.first_name} {p.last_name}</span>
                                {onProject && <span className="text-xs text-muted-foreground ml-auto">on {onProject}</span>}
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                    {field.value.length > 0 && (
                      <p className="text-xs text-muted-foreground">{field.value.length} selected</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lodgingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {LODGING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Hotel Name */}
              <FormField
                control={form.control}
                name="hotelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Hampton Inn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Row */}
              <FormField
                control={form.control}
                name="hotelAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="hotelCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hotelState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="ST" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hotelZip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP</FormLabel>
                      <FormControl>
                        <Input placeholder="ZIP" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Phone */}
              <FormField
                control={form.control}
                name="hotelPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 555-5555" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Room & Confirmation */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="roomNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room / Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="Room number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmation #</FormLabel>
                      <FormControl>
                        <Input placeholder="Confirmation #" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Check-in / Check-out */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="checkIn"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-in *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? format(field.value, "MMM d, yyyy")
                                : "Pick date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkOut"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-out</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? format(field.value, "MMM d, yyyy")
                                : "Open-ended"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />
              </div>

              {/* Nightly Rate */}
              <FormField
                control={form.control}
                name="nightlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nightly Rate ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accessCodes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door/lock codes</FormLabel>
                    <FormControl><Input placeholder="e.g. Front door 4821" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hostInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host instructions / house rules</FormLabel>
                    <FormControl><Textarea placeholder="Parking, trash, quiet hours..." {...field} /></FormControl>
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Assign Lodging
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
