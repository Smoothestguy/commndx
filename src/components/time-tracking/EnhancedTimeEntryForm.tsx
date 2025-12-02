import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, AlertCircle, Calendar, CalendarDays } from "lucide-react";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { WeekNavigator } from "./WeekNavigator";
import {
  useAssignedProjects,
  useAddTimeEntry,
  useBulkAddTimeEntries,
  TimeEntry,
  TimeEntryInsert,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { format, addDays, startOfWeek } from "date-fns";

const dailyFormSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  entry_date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.01, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
});

interface EnhancedTimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
  defaultDate?: string;
  defaultProjectId?: string;
}

type EntryType = "daily" | "weekly";

interface WeeklyHours {
  [key: string]: number;
}

export function EnhancedTimeEntryForm({
  open,
  onOpenChange,
  entry,
  defaultDate,
  defaultProjectId,
}: EnhancedTimeEntryFormProps) {
  const [entryType, setEntryType] = useState<EntryType>(() => {
    const saved = localStorage.getItem("preferredEntryType");
    return (saved as EntryType) || "daily";
  });
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>({});
  const [weeklyProjectId, setWeeklyProjectId] = useState("");
  const [weeklyDescription, setWeeklyDescription] = useState("");
  const [weeklyBillable, setWeeklyBillable] = useState(true);

  const { data: projects = [] } = useAssignedProjects();
  const { data: companySettings } = useCompanySettings();
  const addTimeEntry = useAddTimeEntry();
  const bulkAddTimeEntries = useBulkAddTimeEntries();

  const overtimeThreshold = companySettings?.overtime_threshold ?? 8;

  const form = useForm<z.infer<typeof dailyFormSchema>>({
    resolver: zodResolver(dailyFormSchema),
    defaultValues: {
      project_id: defaultProjectId || "",
      entry_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      hours: 0,
      description: "",
      billable: true,
    },
  });

  // Get week days
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentWeek]);

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    const total = Object.values(weeklyHours).reduce((sum, h) => sum + (h || 0), 0);
    const regular = Math.min(total, 40);
    const overtime = Math.max(0, total - 40);
    return { total, regular, overtime };
  }, [weeklyHours]);

  // Update form when entry changes (for editing)
  useEffect(() => {
    if (entry) {
      form.reset({
        project_id: entry.project_id,
        entry_date: entry.entry_date,
        hours: Number(entry.hours),
        description: entry.description || "",
        billable: entry.billable,
      });
      setEntryType("daily");
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

  // Save entry type preference
  useEffect(() => {
    localStorage.setItem("preferredEntryType", entryType);
  }, [entryType]);

  // Reset weekly form when dialog opens
  useEffect(() => {
    if (open && !entry) {
      setWeeklyHours({});
      setWeeklyProjectId("");
      setWeeklyDescription("");
      setWeeklyBillable(true);
    }
  }, [open, entry]);

  const handleDailySubmit = async (values: z.infer<typeof dailyFormSchema>) => {
    try {
      const { project_id, entry_date, hours, ...rest } = values;
      await addTimeEntry.mutateAsync({
        project_id,
        entry_date,
        hours,
        ...rest,
      });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Failed to save time entry:", error);
    }
  };

  const handleWeeklySubmit = async () => {
    if (!weeklyProjectId) {
      return;
    }

    const entries: TimeEntryInsert[] = weekDays
      .filter(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        return weeklyHours[dateKey] && weeklyHours[dateKey] > 0;
      })
      .map(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        return {
          project_id: weeklyProjectId,
          entry_date: dateKey,
          hours: weeklyHours[dateKey],
          description: weeklyDescription || undefined,
          billable: weeklyBillable,
        };
      });

    if (entries.length === 0) {
      return;
    }

    try {
      await bulkAddTimeEntries.mutateAsync(entries);
      onOpenChange(false);
      setWeeklyHours({});
    } catch (error) {
      console.error("Failed to save weekly entries:", error);
    }
  };

  const updateWeeklyHour = (date: string, value: string) => {
    const hours = parseFloat(value) || 0;
    setWeeklyHours(prev => ({
      ...prev,
      [date]: hours,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Time Entry" : "Log Time"}</DialogTitle>
        </DialogHeader>

        {/* Entry Type Selector */}
        {!entry && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Entry Type</Label>
            <RadioGroup
              value={entryType}
              onValueChange={(value) => setEntryType(value as EntryType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily" className="flex items-center gap-2 cursor-pointer">
                  <Calendar className="h-4 w-4" />
                  Daily Entry
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="flex items-center gap-2 cursor-pointer">
                  <CalendarDays className="h-4 w-4" />
                  Weekly Entry
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Daily Entry Form */}
        {(entryType === "daily" || entry) && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDailySubmit)} className="space-y-4">
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
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="e.g., 1.5, 2.25"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
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
                      <Textarea placeholder="What did you work on?" {...field} />
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={addTimeEntry.isPending}>
                  {entry ? "Update" : "Add"} Entry
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Weekly Entry Form */}
        {entryType === "weekly" && !entry && (
          <div className="space-y-4">
            {/* Week Navigator */}
            <div className="flex justify-center">
              <WeekNavigator currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={weeklyProjectId} onValueChange={setWeeklyProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Daily Hours Input */}
            <div className="space-y-3">
              <Label>Hours per Day</Label>
              <div className="grid gap-2">
                {weekDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  return (
                    <div key={dateKey} className="flex items-center gap-3">
                      <div className="w-24 text-sm">
                        <span className="font-medium">{format(day, "EEE")}</span>
                        <span className="text-muted-foreground ml-1">{format(day, "d")}</span>
                      </div>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        placeholder="0"
                        value={weeklyHours[dateKey] || ""}
                        onChange={(e) => updateWeeklyHour(dateKey, e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">hrs</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Total */}
            {weeklyTotals.total > 0 && (
              <div className="flex gap-4 text-sm bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Total: <strong>{weeklyTotals.total.toFixed(2)}h</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Regular: {weeklyTotals.regular.toFixed(2)}h</span>
                </div>
                {weeklyTotals.overtime > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-500">OT: {weeklyTotals.overtime.toFixed(2)}h</span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="What did you work on this week?"
                value={weeklyDescription}
                onChange={(e) => setWeeklyDescription(e.target.value)}
              />
            </div>

            {/* Billable Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Billable</Label>
              <Switch checked={weeklyBillable} onCheckedChange={setWeeklyBillable} />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleWeeklySubmit}
                className="flex-1"
                disabled={!weeklyProjectId || weeklyTotals.total === 0 || bulkAddTimeEntries.isPending}
              >
                Save Week
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
