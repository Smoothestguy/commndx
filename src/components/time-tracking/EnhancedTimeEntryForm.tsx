import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { Clock, AlertCircle, Calendar, CalendarDays, Gift, AlertTriangle } from "lucide-react";
import { DailyPersonnelHoursSection } from "./DailyPersonnelHoursSection";
import { PersonnelSelectionSection } from "./PersonnelSelectionSection";
import { WeeklyPersonnelGrid } from "./WeeklyPersonnelGrid";
import { WeeklyQuickFillSection } from "./WeeklyQuickFillSection";
import { PersonnelHoursTable } from "./PersonnelHoursTable";
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
import { TimeDecimalInput } from "@/components/ui/time-decimal-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { WeekNavigator } from "./WeekNavigator";
import { QuickAddPersonnelDialog } from "./QuickAddPersonnelDialog";
import { PersonnelAssignmentDialog } from "./PersonnelAssignmentDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAssignedProjects,
  useAddTimeEntry,
  useUpdateTimeEntry,
  useBulkAddTimeEntries,
  useBulkAddPersonnelTimeEntries,
  usePersonnelTimeEntriesByWeek,
  TimeEntry,
  TimeEntryInsert,
  PersonnelTimeEntryInsert,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { format, addDays, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

const OVERHEAD_CATEGORIES = [
  { value: "admin", label: "Administration" },
  { value: "travel", label: "Travel" },
  { value: "training", label: "Training" },
  { value: "payroll", label: "Payroll Processing" },
  { value: "other", label: "Other" },
];

const dailyFormSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  entry_date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.01, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
  is_holiday: z.boolean().default(false),
  is_overhead: z.boolean().default(false),
  overhead_category: z.string().optional(),
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
  [key: string]: string;
}

// Per-personnel hours: key = `${personnelId}_${dateKey}`
interface PersonnelHours {
  [key: string]: string;
}

// Holiday days: key = dateKey, value = boolean
interface HolidayDays {
  [key: string]: boolean;
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
  // Store as array for stable identity; derive Set for lookups
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const selectedPersonnel = useMemo(() => new Set(selectedPersonnelIds), [selectedPersonnelIds]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [assignExistingOpen, setAssignExistingOpen] = useState(false);
  
  // New states for per-personnel hours and template
  const [personnelHours, setPersonnelHours] = useState<PersonnelHours>({});
  const [templateHours, setTemplateHours] = useState<WeeklyHours>({});
  // Holiday tracking for weekly mode
  const [holidayDays, setHolidayDays] = useState<HolidayDays>({});
  // Daily mode: per-personnel hours
  const [dailyPersonnelHours, setDailyPersonnelHours] = useState<Record<string, number>>({});

  const { isAdmin, isManager } = useUserRole();
  const { data: assignedProjects = [] } = useAssignedProjects();
  const { data: allProjects = [] } = useProjects();
  const { data: companySettings } = useCompanySettings();
  
  // Use all projects for admin/manager, assigned projects for regular users
  const projects = useMemo(() => {
    return (isAdmin || isManager) ? allProjects : assignedProjects;
  }, [isAdmin, isManager, allProjects, assignedProjects]);
  const addTimeEntry = useAddTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const bulkAddTimeEntries = useBulkAddTimeEntries();
  const bulkAddPersonnelTimeEntries = useBulkAddPersonnelTimeEntries();

  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;

  const form = useForm<z.infer<typeof dailyFormSchema>>({
    resolver: zodResolver(dailyFormSchema),
    defaultValues: {
      project_id: defaultProjectId || "",
      entry_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      hours: 0,
      description: "",
      billable: true,
      is_holiday: false,
      is_overhead: false,
      overhead_category: "",
    },
  });

  // Watch hours for overtime preview
  const watchedHoursRaw = form.watch("hours");
  const watchedHours = Number(watchedHoursRaw) || 0;
  const watchedIsHoliday = form.watch("is_holiday");

  // Get current project ID based on entry type
  const currentProjectId = entryType === "daily" ? form.watch("project_id") : weeklyProjectId;
  const currentProject = projects?.find(p => p.id === currentProjectId);

  // Fetch personnel assigned to current project
  const { data: assignedPersonnel = [], refetch: refetchPersonnel } = usePersonnelByProject(
    currentProjectId || undefined
  );

  // Normalize personnel list for child components (prevents ref-churn from inline .map())
  const assignedPersonnelForSelection = useMemo(
    () => assignedPersonnel.map((a) => ({ personnel: a.personnel })),
    [assignedPersonnel]
  );

  const selectedPersonnelListDaily = useMemo(
    () =>
      assignedPersonnel
        .filter((a) => a.personnel !== null && selectedPersonnel.has(a.personnel.id))
        .map((a) => ({ personnel: a.personnel })),
    [assignedPersonnel, selectedPersonnel]
  );

  // Fetch existing time entries for the selected project/week (for pre-populating)
  const { data: existingWeeklyEntries = [] } = usePersonnelTimeEntriesByWeek(
    weeklyProjectId,
    currentWeek
  );

  // Personnel selection functions (array-based for stable identity)
  const selectAllPersonnel = useCallback(() => {
    const allIds = assignedPersonnel
      .filter(a => a.personnel)
      .map(a => a.personnel!.id);
    setSelectedPersonnelIds(allIds);
  }, [assignedPersonnel]);

  const clearPersonnelSelection = useCallback(() => {
    setSelectedPersonnelIds([]);
  }, []);

  const togglePersonnel = useCallback((personnelId: string) => {
    setSelectedPersonnelIds(prev => 
      prev.includes(personnelId) 
        ? prev.filter(id => id !== personnelId)
        : [...prev, personnelId]
    );
  }, []);

  // Get week days
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentWeek]);

  // Calculate weekly totals (for old single-user mode)
  const weeklyTotals = useMemo(() => {
    const total = Object.values(weeklyHours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0);
    const regular = Math.min(total, 40);
    const overtime = Math.max(0, total - 40);
    return { total, regular, overtime };
  }, [weeklyHours]);

  // Calculate per-personnel totals with holiday multiplier
  const getPersonnelTotals = (personnelId: string) => {
    let total = 0;
    let cost = 0;
    const person = assignedPersonnel.find(a => a.personnel?.id === personnelId)?.personnel;
    const hourlyRate = person?.hourly_rate || 0;
    
    weekDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      const hours = parseFloat(personnelHours[`${personnelId}_${dateKey}`]) || 0;
      const isHoliday = holidayDays[dateKey] === true;
      
      total += hours;
      // Apply holiday multiplier (2x) if day is marked as holiday
      cost += hours * hourlyRate * (isHoliday ? holidayMultiplier : 1);
    });
    
    return { total, cost };
  };

  // Calculate estimated cost for daily mode with holiday multiplier (using individual hours)
  const estimatedDailyCost = useMemo(() => {
    if (selectedPersonnel.size === 0) return 0;
    
    let total = 0;
    selectedPersonnel.forEach(personnelId => {
      const person = assignedPersonnel.find(a => a.personnel?.id === personnelId)?.personnel;
      const rate = person?.hourly_rate || 0;
      const hours = dailyPersonnelHours[personnelId] || 0;
      const multiplier = watchedIsHoliday ? holidayMultiplier : 1;
      total += hours * rate * multiplier;
    });
    
    return total;
  }, [dailyPersonnelHours, watchedIsHoliday, selectedPersonnel, assignedPersonnel, holidayMultiplier]);

  // Calculate total hours for daily mode when personnel are selected
  const dailyTotalHours = useMemo(() => {
    if (selectedPersonnel.size === 0) return 0;
    return Array.from(selectedPersonnel).reduce((sum, personnelId) => {
      return sum + (dailyPersonnelHours[personnelId] || 0);
    }, 0);
  }, [selectedPersonnel, dailyPersonnelHours]);

  // Calculate grand totals for all selected personnel
  const grandTotals = useMemo(() => {
    let totalHours = 0;
    let totalCost = 0;
    
    selectedPersonnel.forEach(personnelId => {
      const { total, cost } = getPersonnelTotals(personnelId);
      totalHours += total;
      totalCost += cost;
    });
    
    return { totalHours, totalCost };
  }, [selectedPersonnel, personnelHours, assignedPersonnel]);

  // Update form when entry changes (for editing)
  useEffect(() => {
    if (entry) {
      form.reset({
        project_id: entry.project_id,
        entry_date: entry.entry_date,
        hours: Number(entry.hours),
        description: entry.description || "",
        billable: entry.billable,
        is_holiday: entry.is_holiday || false,
        is_overhead: (entry as any).is_overhead || false,
        overhead_category: (entry as any).overhead_category || "",
      });
      setEntryType("daily");
    } else {
      form.reset({
        project_id: defaultProjectId || "",
        entry_date: defaultDate || format(new Date(), "yyyy-MM-dd"),
        hours: 0,
        description: "",
        billable: true,
        is_holiday: false,
        is_overhead: false,
        overhead_category: "",
      });
    }
  }, [entry, defaultDate, defaultProjectId, form]);

  // Save entry type preference
  useEffect(() => {
    localStorage.setItem("preferredEntryType", entryType);
  }, [entryType]);

  // Reset weekly form and personnel selection when dialog opens
  useEffect(() => {
    if (open && !entry) {
      setWeeklyHours({});
      setWeeklyProjectId("");
      setWeeklyDescription("");
      setWeeklyBillable(true);
      setSelectedPersonnelIds([]);
      setPersonnelHours({});
      setTemplateHours({});
      setHolidayDays({});
      setDailyPersonnelHours({});
    }
  }, [open, entry]);

  // Clear personnel selection when project changes (only for daily mode or fresh project selection)
  useEffect(() => {
    // Don't clear if we're in weekly mode and have existing entries to load
    if (entryType === "weekly" && existingWeeklyEntries.length > 0) {
      return;
    }
    setSelectedPersonnelIds([]);
    setPersonnelHours({});
    setDailyPersonnelHours({});
  }, [currentProjectId]);

  // Pre-populate personnelHours and auto-select personnel with existing entries
  useEffect(() => {
    if (entryType === "weekly" && weeklyProjectId && existingWeeklyEntries.length > 0) {
      const newPersonnelHours: PersonnelHours = {};
      const personnelWithEntries = new Set<string>();
      
      existingWeeklyEntries.forEach(entry => {
        if (entry.personnel_id) {
          const key = `${entry.personnel_id}_${entry.entry_date}`;
          newPersonnelHours[key] = String(entry.hours);
          personnelWithEntries.add(entry.personnel_id);
        }
      });
      
      // Update personnel hours with existing data
      setPersonnelHours(prev => ({
        ...newPersonnelHours,
        ...prev, // Keep any user changes made this session
      }));
      
      // Auto-select personnel who have existing entries (if none selected yet)
      if (selectedPersonnelIds.length === 0 && personnelWithEntries.size > 0) {
        setSelectedPersonnelIds(Array.from(personnelWithEntries));
      }
    }
  }, [existingWeeklyEntries, entryType, weeklyProjectId]);

  // Sync hidden hours field when personnel are selected (for schema validation)
  // Clamp to 24 so the schema's max(24) check always passes for multi-personnel totals
  // Guard: only update if value changed to prevent re-render loops
  const lastSyncedHoursRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedPersonnelIds.length > 0) {
      const schemaValue = dailyTotalHours > 0 ? Math.min(dailyTotalHours, 24) : 0;
      if (lastSyncedHoursRef.current !== schemaValue) {
        lastSyncedHoursRef.current = schemaValue;
        // Avoid shouldValidate here to prevent nested update loops; validation runs on submit.
        form.setValue("hours", schemaValue, { shouldValidate: false, shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonnelIds.length, dailyTotalHours]);

  // Handler for form validation failures (before handleDailySubmit runs)
  const handleDailyInvalid = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    toast({ 
      title: firstError?.message ?? "Please fix the form errors before submitting.", 
      variant: "destructive" 
    });
  };

  // Apply template hours to all selected personnel
  const applyTemplateToAll = () => {
    const newPersonnelHours: PersonnelHours = { ...personnelHours };
    selectedPersonnel.forEach(personnelId => {
      weekDays.forEach(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        newPersonnelHours[`${personnelId}_${dateKey}`] = templateHours[dateKey] || "";
      });
    });
    setPersonnelHours(newPersonnelHours);
  };

  // Update template hour (store raw string)
  const updateTemplateHour = (dateKey: string, value: string) => {
    setTemplateHours(prev => ({
      ...prev,
      [dateKey]: value,
    }));
  };

  // Update personnel hour (store raw string)
  const updatePersonnelHour = (personnelId: string, dateKey: string, value: string) => {
    setPersonnelHours(prev => ({
      ...prev,
      [`${personnelId}_${dateKey}`]: value,
    }));
  };

  const handleDailySubmit = async (values: z.infer<typeof dailyFormSchema>) => {
    try {
      const { project_id, entry_date, hours, description, billable, is_holiday, is_overhead, overhead_category } = values;
      
      // If editing an existing entry, use update instead of insert
      if (entry) {
        await updateTimeEntry.mutateAsync({
          id: entry.id,
          project_id,
          entry_date,
          hours,
          description: description || null,
          billable,
          is_holiday,
          is_overhead,
          overhead_category: is_overhead ? (overhead_category || 'other') : null,
        } as any);
        onOpenChange(false);
        form.reset();
        return;
      }
      
      // If personnel are selected, create entries for each using their individual hours
      if (selectedPersonnel.size > 0) {
        const entries: PersonnelTimeEntryInsert[] = Array.from(selectedPersonnel)
          .filter(personnelId => (dailyPersonnelHours[personnelId] || 0) > 0)
          .map(personnelId => ({
            project_id,
            entry_date,
            hours: dailyPersonnelHours[personnelId] || 0,
            personnel_id: personnelId,
            description: description || undefined,
            is_holiday,
          }));
        
        if (entries.length === 0) {
          toast({ title: "Enter hours for at least one person before saving.", variant: "destructive" });
          return;
        }
        
        await bulkAddPersonnelTimeEntries.mutateAsync(entries);
      } else {
        // No personnel selected, create single entry for current user
        await addTimeEntry.mutateAsync({
          project_id,
          entry_date,
          hours,
          description,
          billable,
          is_holiday,
        });
      }
      
      onOpenChange(false);
      form.reset();
      setSelectedPersonnelIds([]);
      setDailyPersonnelHours({});
    } catch (error: any) {
      console.error("Failed to save time entry:", error);
      toast({ title: error?.message ?? "Failed to save time entry", variant: "destructive" });
    }
  };

  // Update daily personnel hour
  const updateDailyPersonnelHour = (personnelId: string, value: number) => {
    setDailyPersonnelHours(prev => ({
      ...prev,
      [personnelId]: value,
    }));
  };

  // Apply same hours to all selected personnel in daily mode
  const applyHoursToAllDaily = (hours: number) => {
    const newHours: Record<string, number> = {};
    selectedPersonnel.forEach(personnelId => {
      newHours[personnelId] = hours;
    });
    setDailyPersonnelHours(newHours);
  };

  const handleWeeklySubmit = async () => {
    if (!weeklyProjectId) {
      return;
    }

    // If personnel are selected, use per-personnel hours
    if (selectedPersonnel.size > 0) {
      const entries: PersonnelTimeEntryInsert[] = [];
      
      selectedPersonnel.forEach(personnelId => {
        weekDays.forEach(day => {
          const dateKey = format(day, "yyyy-MM-dd");
          const hours = parseFloat(personnelHours[`${personnelId}_${dateKey}`]) || 0;
          if (hours > 0) {
            entries.push({
              project_id: weeklyProjectId,
              entry_date: dateKey,
              hours,
              personnel_id: personnelId,
              description: weeklyDescription || undefined,
              is_holiday: holidayDays[dateKey] || false,
            });
          }
        });
      });

      if (entries.length === 0) {
        return;
      }

      try {
        await bulkAddPersonnelTimeEntries.mutateAsync(entries);
        onOpenChange(false);
        setPersonnelHours({});
        setSelectedPersonnelIds([]);
        setHolidayDays({});
      } catch (error) {
        console.error("Failed to save weekly entries:", error);
      }
    } else {
      // No personnel selected, use single user weekly hours
      const daysWithHours = weekDays.filter(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        const hours = parseFloat(weeklyHours[dateKey]) || 0;
        return hours > 0;
      });

      if (daysWithHours.length === 0) {
        return;
      }

      const entries: TimeEntryInsert[] = daysWithHours.map(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        return {
          project_id: weeklyProjectId,
          entry_date: dateKey,
          hours: parseFloat(weeklyHours[dateKey]) || 0,
          description: weeklyDescription || undefined,
          billable: weeklyBillable,
          is_holiday: holidayDays[dateKey] || false,
        };
      });

      try {
        await bulkAddTimeEntries.mutateAsync(entries);
        onOpenChange(false);
        setWeeklyHours({});
        setHolidayDays({});
      } catch (error) {
        console.error("Failed to save weekly entries:", error);
      }
    }
  };

  const updateWeeklyHour = (date: string, value: string) => {
    setWeeklyHours(prev => ({
      ...prev,
      [date]: value,
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "max-h-[90vh] overflow-y-auto",
          entryType === "weekly" && !entry ? "sm:max-w-4xl" : "sm:max-w-[550px]"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {entryType === "weekly" && !entry ? (
                <>
                  <CalendarDays className="h-5 w-5" />
                  Weekly Time Entry
                </>
              ) : (
                entry ? "Edit Time Entry" : "Log Time"
              )}
            </DialogTitle>
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
              <form onSubmit={form.handleSubmit(handleDailySubmit, handleDailyInvalid)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Personnel Selection for Daily */}
                {!entry && currentProjectId && (
                  <PersonnelSelectionSection
                    assignedPersonnel={assignedPersonnelForSelection}
                    selectedPersonnel={selectedPersonnel}
                    togglePersonnel={togglePersonnel}
                    selectAllPersonnel={selectAllPersonnel}
                    clearPersonnelSelection={clearPersonnelSelection}
                    showProjectActions={!!currentProjectId}
                    onQuickAddOpen={() => setQuickAddOpen(true)}
                    onAssignExistingOpen={() => setAssignExistingOpen(true)}
                  />
                )}

                {/* Individual Hours per Personnel (when personnel selected) */}
                {!entry && selectedPersonnel.size > 0 && (
                  <DailyPersonnelHoursSection
                    selectedPersonnelList={selectedPersonnelListDaily}
                    dailyPersonnelHours={dailyPersonnelHours}
                    updateDailyPersonnelHour={updateDailyPersonnelHour}
                    applyHoursToAllDaily={applyHoursToAllDaily}
                    watchedIsHoliday={watchedIsHoliday}
                    holidayMultiplier={holidayMultiplier}
                    dailyTotalHours={dailyTotalHours}
                    estimatedDailyCost={estimatedDailyCost}
                    weeklyOvertimeThreshold={weeklyOvertimeThreshold}
                  />
                )}

                {/* Hours Field - always mounted to prevent RHF registration churn */}
                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem className={!entry && selectedPersonnel.size > 0 ? "hidden" : undefined}>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <TimeDecimalInput
                          value={field.value}
                          onValueChange={field.onChange}
                          showIcon
                          showPreview
                          placeholder="8:20 or 8.33"
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

                {/* Hours display with live cost preview - only show when no personnel selected */}
                {watchedHours > 0 && selectedPersonnel.size === 0 && (
                  <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Hours Entry
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Hours:</span>
                        <span className="font-medium">{watchedHours.toFixed(2)}h</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Overtime is calculated weekly when total exceeds {weeklyOvertimeThreshold}h
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
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

                  <FormField
                    control={form.control}
                    name="is_holiday"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-purple-500/5 border-purple-500/20">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-1">
                            <Gift className="h-4 w-4 text-purple-500" />
                            Holiday
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_overhead"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-orange-500/5 border-orange-500/20">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Overhead
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Overhead Category Selector */}
                {form.watch("is_overhead") && (
                  <FormField
                    control={form.control}
                    name="overhead_category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overhead Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OVERHEAD_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                    type="submit" 
                    className="flex-1" 
                    disabled={
                      addTimeEntry.isPending || 
                      bulkAddTimeEntries.isPending || 
                      bulkAddPersonnelTimeEntries.isPending ||
                      (selectedPersonnel.size > 0 && dailyTotalHours === 0)
                    }
                  >
                    {entry ? "Update" : "Add"} Entry
                    {selectedPersonnel.size > 0 && ` (${selectedPersonnel.size})`}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* Weekly Entry Form */}
          {entryType === "weekly" && !entry && (
            <div className="space-y-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label>Project *</Label>
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

              {/* Week Navigator */}
              <div className="flex justify-center">
                <WeekNavigator currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
              </div>

              {weeklyProjectId && (
                <WeeklyPersonnelGrid
                  weeklyProjectId={weeklyProjectId}
                  assignedPersonnel={assignedPersonnel.map(a => ({
                    personnel: a.personnel ? { ...a.personnel, photo_url: (a.personnel as any).photo_url } : null
                  }))}
                  selectedPersonnel={selectedPersonnel}
                  selectAllPersonnel={selectAllPersonnel}
                  clearPersonnelSelection={clearPersonnelSelection}
                  togglePersonnel={togglePersonnel}
                  setQuickAddOpen={setQuickAddOpen}
                  setAssignExistingOpen={setAssignExistingOpen}
                />
              )}

              {/* Quick Fill Template */}
              {selectedPersonnel.size > 0 && (
                <WeeklyQuickFillSection
                  selectedPersonnelSize={selectedPersonnel.size}
                  weekDays={weekDays.map(day => ({
                    date: day,
                    dayName: format(day, "EEE"),
                    dateKey: format(day, "yyyy-MM-dd"),
                  }))}
                  templateHours={Object.fromEntries(
                    Object.entries(templateHours).map(([k, v]) => [k, parseFloat(v) || 0])
                  )}
                  updateTemplateHour={(dateKey, value) => updateTemplateHour(dateKey, String(value))}
                  applyTemplateToAll={applyTemplateToAll}
                />
              )}

              {/* Per-Personnel Hours Table */}
              {selectedPersonnel.size > 0 && (
                <PersonnelHoursTable
                  selectedPersonnel={selectedPersonnel}
                  assignedPersonnel={assignedPersonnel.map(a => ({
                    personnel: a.personnel ? { ...a.personnel, photo_url: (a.personnel as any).photo_url } : null
                  }))}
                  weekDays={weekDays.map(day => ({
                    date: day,
                    dayName: format(day, "EEE"),
                    dateKey: format(day, "yyyy-MM-dd"),
                  }))}
                  personnelHours={Object.fromEntries(
                    Object.entries(personnelHours).map(([k, v]) => [k, parseFloat(v) || 0])
                  )}
                  updatePersonnelHour={(personnelId, dateKey, value) => updatePersonnelHour(personnelId, dateKey, String(value))}
                  getPersonnelTotals={(personnelId) => {
                    const totals = getPersonnelTotals(personnelId);
                    return { regular: Math.min(totals.total, 40), overtime: Math.max(0, totals.total - 40), total: totals.total };
                  }}
                  grandTotals={{ regular: Math.min(grandTotals.totalHours, 40), overtime: Math.max(0, grandTotals.totalHours - 40), total: grandTotals.totalHours }}
                />
              )}

              {/* Single user hours (when no personnel selected) */}
              {selectedPersonnel.size === 0 && weeklyProjectId && (
                <div className="space-y-3">
                  <Label>Hours per Day (for yourself)</Label>
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
              {selectedPersonnel.size === 0 && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Billable</Label>
                  <Switch checked={weeklyBillable} onCheckedChange={setWeeklyBillable} />
                </div>
              )}

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
                  disabled={
                    !weeklyProjectId || 
                    (selectedPersonnel.size > 0 ? grandTotals.totalHours === 0 : weeklyTotals.total === 0) || 
                    bulkAddTimeEntries.isPending || 
                    bulkAddPersonnelTimeEntries.isPending
                  }
                >
                  Save Week
                  {selectedPersonnel.size > 0 && ` (${selectedPersonnel.size} personnel)`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Personnel Dialog */}
      <QuickAddPersonnelDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        projectId={currentProjectId}
        projectName={currentProject?.name}
        onSuccess={() => refetchPersonnel()}
      />

      {/* Assign Existing Personnel Dialog */}
      <PersonnelAssignmentDialog
        open={assignExistingOpen}
        onOpenChange={setAssignExistingOpen}
        defaultProjectId={currentProjectId}
        onAssignmentChange={() => refetchPersonnel()}
      />
    </>
  );
}
