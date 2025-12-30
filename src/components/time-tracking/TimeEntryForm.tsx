import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, AlertCircle, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TimeDecimalInput } from "@/components/ui/time-decimal-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAssignedProjects, useExistingWeeklyHours } from "@/integrations/supabase/hooks/useTimeEntries";
import {
  TimeEntry,
  useAddTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { format } from "date-fns";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  entry_date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.01, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
});

interface TimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
  defaultDate?: string;
  defaultProjectId?: string;
}

export function TimeEntryForm({
  open,
  onOpenChange,
  entry,
  defaultDate,
  defaultProjectId,
}: TimeEntryFormProps) {
  const { data: projects = [] } = useAssignedProjects();
  const { data: companySettings } = useCompanySettings();
  const addTimeEntry = useAddTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();

  const [regularHours, setRegularHours] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: defaultProjectId || "",
      entry_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      hours: 0,
      description: "",
      billable: true,
    },
  });

  const entryDate = form.watch("entry_date");
  const { data: existingWeeklyHours = 0 } = useExistingWeeklyHours(
    entryDate,
    entry?.id
  );

  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Calculate overtime based on weekly threshold (40 hours)
  useEffect(() => {
    const hours = Number(form.watch("hours")) || 0;
    const totalWeeklyHours = existingWeeklyHours + hours;
    
    if (totalWeeklyHours <= weeklyOvertimeThreshold) {
      // All hours are regular - haven't exceeded weekly threshold
      setRegularHours(hours);
      setOvertimeHours(0);
    } else {
      // Some hours are overtime
      const remainingRegular = Math.max(0, weeklyOvertimeThreshold - existingWeeklyHours);
      setRegularHours(Math.min(hours, remainingRegular));
      setOvertimeHours(Math.max(0, hours - remainingRegular));
    }
  }, [form.watch("hours"), existingWeeklyHours, weeklyOvertimeThreshold]);

  // Update form when entry changes
  useEffect(() => {
    if (entry) {
      form.reset({
        project_id: entry.project_id,
        entry_date: entry.entry_date,
        hours: Number(entry.hours),
        description: entry.description || "",
        billable: entry.billable,
      });
    } else {
      form.reset({
        project_id: defaultProjectId || "",
        entry_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
        hours: 0,
        description: "",
        billable: true,
      });
    }
  }, [entry, defaultDate, defaultProjectId, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (entry) {
        await updateTimeEntry.mutateAsync({ 
          id: entry.id, 
          ...values,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
        });
      } else {
        // Ensure required fields are present for insert
        const { project_id, entry_date, hours, ...rest } = values;
        await addTimeEntry.mutateAsync({
          project_id,
          entry_date,
          hours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          ...rest,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Failed to save time entry:", error);
    }
  };

  const handleDelete = async () => {
    if (entry && confirm("Are you sure you want to delete this time entry?")) {
      await deleteTimeEntry.mutateAsync(entry.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Hours</FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px]">
                          <p className="text-xs font-medium mb-1">Time Format Examples:</p>
                          <ul className="text-xs space-y-0.5">
                            <li>• 8:20 or 820 → 8.33 hrs</li>
                            <li>• 7:15 or 715 → 7.25 hrs</li>
                            <li>• 4:30 or 430 → 4.50 hrs</li>
                            <li>• 8 → 8.00 hrs</li>
                            <li>• 8.5 → 8.50 hrs</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <TimeDecimalInput
                      value={field.value || 0}
                      onValueChange={field.onChange}
                      showIcon={true}
                      showPreview={true}
                      placeholder="e.g., 8:20 or 8.33"
                    />
                  </FormControl>
                  <FormMessage />
                  {(regularHours > 0 || overtimeHours > 0) && (
                    <div className="space-y-2 mt-2">
                      <div className="text-xs text-muted-foreground">
                        Weekly Hours: {(existingWeeklyHours + regularHours + overtimeHours).toFixed(1)}h / {weeklyOvertimeThreshold}h
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>Regular: <strong>{regularHours.toFixed(2)}h</strong></span>
                        </div>
                        {overtimeHours > 0 && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <span>Overtime: <strong>{overtimeHours.toFixed(2)}h</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you work on?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Billable</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              {entry && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {entry ? "Update" : "Add"} Entry
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
