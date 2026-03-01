import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
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
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useCreateHotelAssignment } from "@/integrations/supabase/hooks/useHotelAssignments";

const hotelSchema = z.object({
  personnelId: z.string().min(1, "Personnel is required"),
  hotelName: z.string().min(1, "Hotel name is required"),
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
}

export function AssignHotelDialog({ open, onOpenChange, projectId }: AssignHotelDialogProps) {
  const { data: personnel = [] } = usePersonnelByProject(projectId);
  const createMutation = useCreateHotelAssignment();

  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelSchema),
    defaultValues: {
      personnelId: "",
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
    await createMutation.mutateAsync({
      personnelId: values.personnelId,
      projectId,
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
  };

  const activePersonnel = personnel.filter(
    (p) => p.personnel
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Assign Hotel</DialogTitle>
          <DialogDescription>
            Assign a hotel stay to project personnel.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
              {/* Personnel */}
              <FormField
                control={form.control}
                name="personnelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personnel *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select personnel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activePersonnel.map((a) => (
                          <SelectItem key={a.personnel_id} value={a.personnel_id}>
                            {a.personnel?.first_name} {a.personnel?.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hotel Name */}
              <FormField
                control={form.control}
                name="hotelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hotel Name *</FormLabel>
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
                    <FormLabel>Hotel Phone</FormLabel>
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
                      <FormLabel>Room #</FormLabel>
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
                  Assign Hotel
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
