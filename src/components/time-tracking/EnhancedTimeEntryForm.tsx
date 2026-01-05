import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, AlertCircle, Calendar, CalendarDays, Users, UserPlus, UserCheck, Gift, AlertTriangle } from "lucide-react";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
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
  TimeEntry,
  TimeEntryInsert,
  PersonnelTimeEntryInsert,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { format, addDays, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

const dailyFormSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  entry_date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.01, "Hours must be greater than 0").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
  is_holiday: z.boolean().default(false),
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
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [assignExistingOpen, setAssignExistingOpen] = useState(false);
  
  // New states for per-personnel hours and template
  const [personnelHours, setPersonnelHours] = useState<PersonnelHours>({});
  const [templateHours, setTemplateHours] = useState<WeeklyHours>({});
  // Holiday tracking for weekly mode
  const [holidayDays, setHolidayDays] = useState<HolidayDays>({});

  const { data: projects = [] } = useAssignedProjects();
  const { data: companySettings } = useCompanySettings();
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

  // Personnel selection functions
  const selectAllPersonnel = () => {
    const allIds = assignedPersonnel
      .filter(a => a.personnel)
      .map(a => a.personnel!.id);
    setSelectedPersonnel(new Set(allIds));
  };

  const clearPersonnelSelection = () => {
    setSelectedPersonnel(new Set());
  };

  const togglePersonnel = (personnelId: string) => {
    const newSet = new Set(selectedPersonnel);
    if (newSet.has(personnelId)) {
      newSet.delete(personnelId);
    } else {
      newSet.add(personnelId);
    }
    setSelectedPersonnel(newSet);
  };

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

  // Calculate per-personnel totals
  const getPersonnelTotals = (personnelId: string) => {
    let total = 0;
    const person = assignedPersonnel.find(a => a.personnel?.id === personnelId)?.personnel;
    const hourlyRate = person?.hourly_rate || 0;
    
    weekDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      const hours = parseFloat(personnelHours[`${personnelId}_${dateKey}`]) || 0;
      total += hours;
    });
    
    return { total, cost: total * hourlyRate };
  };

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
      setSelectedPersonnel(new Set());
      setPersonnelHours({});
      setTemplateHours({});
      setHolidayDays({});
    }
  }, [open, entry]);

  // Clear personnel selection when project changes
  useEffect(() => {
    setSelectedPersonnel(new Set());
    setPersonnelHours({});
  }, [currentProjectId]);

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
      const { project_id, entry_date, hours, description, billable, is_holiday } = values;
      
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
        });
        onOpenChange(false);
        form.reset();
        return;
      }
      
      // If personnel are selected, create entries for each using personnel hook
      if (selectedPersonnel.size > 0) {
        const entries: PersonnelTimeEntryInsert[] = Array.from(selectedPersonnel).map(personnelId => ({
          project_id,
          entry_date,
          hours,
          personnel_id: personnelId,
          description: description || undefined,
          is_holiday,
        }));
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
      setSelectedPersonnel(new Set());
    } catch (error) {
      console.error("Failed to save time entry:", error);
    }
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
        setSelectedPersonnel(new Set());
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

  // Personnel Selection UI Component for Daily Mode
  const PersonnelSelectionSection = () => {
    if (!currentProjectId) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Personnel (Optional)
          </Label>
          {assignedPersonnel.length > 0 && (
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={selectAllPersonnel}
                className="h-7 px-2 text-xs"
              >
                Select All
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={clearPersonnelSelection}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {assignedPersonnel.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
            {assignedPersonnel.map((assignment) => {
              const person = assignment.personnel;
              if (!person) return null;
              const isSelected = selectedPersonnel.has(person.id);
              return (
                <div
                  key={person.id}
                  onClick={() => togglePersonnel(person.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border",
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <PersonnelAvatar
                      photoUrl={(person as any).photo_url}
                      firstName={person.first_name}
                      lastName={person.last_name}
                      size="xs"
                    />
                    <span className="text-sm">{person.first_name} {person.last_name}</span>
                  </div>
                  {person.hourly_rate && (
                    <span className="text-xs text-muted-foreground">
                      ${person.hourly_rate}/hr
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-3 text-sm text-muted-foreground border rounded-lg">
            No personnel assigned to this project
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            className="text-xs"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Add New
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAssignExistingOpen(true)}
            className="text-xs"
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Assign Existing
          </Button>
        </div>

        {selectedPersonnel.size === 0 && (
          <p className="text-xs text-muted-foreground">
            Leave empty to log time for yourself
          </p>
        )}
      </div>
    );
  };

  // Weekly Personnel Grid Selection
  const WeeklyPersonnelGrid = () => {
    if (!weeklyProjectId) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Personnel *
          </Label>
          {assignedPersonnel.length > 0 && (
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={selectAllPersonnel}
                className="h-7 px-2 text-xs"
              >
                Select All
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={clearPersonnelSelection}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {assignedPersonnel.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1 border rounded-lg">
            {assignedPersonnel.map((assignment) => {
              const person = assignment.personnel;
              if (!person) return null;
              const isSelected = selectedPersonnel.has(person.id);
              return (
                <div
                  key={person.id}
                  onClick={() => togglePersonnel(person.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border",
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <span className="text-sm truncate">{person.first_name} {person.last_name}</span>
                  </div>
                  {person.hourly_rate && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ${person.hourly_rate}/hr
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-3 text-sm text-muted-foreground border rounded-lg">
            No personnel assigned to this project
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            className="text-xs"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Add New
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAssignExistingOpen(true)}
            className="text-xs"
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Assign Existing
          </Button>
        </div>
      </div>
    );
  };

  // Quick Fill Template Section
  const QuickFillSection = () => {
    if (selectedPersonnel.size === 0) return null;

    return (
      <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Quick Fill - Set Same Hours for All Selected Personnel</Label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyTemplateToAll}
            className="h-7 text-xs"
          >
            Apply to All
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weekDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            return (
              <div key={dateKey} className="flex flex-col items-center gap-1 min-w-[60px]">
                <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  placeholder="0"
                  value={templateHours[dateKey] || ""}
                  onChange={(e) => updateTemplateHour(dateKey, e.target.value)}
                  className="w-14 h-8 text-center text-sm"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Per-Personnel Hours Table
  const PersonnelHoursTable = () => {
    if (selectedPersonnel.size === 0) return null;

    const selectedPersonnelList = assignedPersonnel.filter(
      a => a.personnel && selectedPersonnel.has(a.personnel.id)
    );

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 bg-muted/50 min-w-[140px]">Personnel</TableHead>
                {weekDays.map((day) => (
                  <TableHead key={format(day, "yyyy-MM-dd")} className="text-center min-w-[70px]">
                    <div className="flex flex-col">
                      <span className="text-xs">{format(day, "EEE")}</span>
                      <span className="text-xs text-muted-foreground">{format(day, "M/d")}</span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-[70px]">Total</TableHead>
                <TableHead className="text-right min-w-[80px]">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPersonnelList.map((assignment) => {
                const person = assignment.personnel!;
                const { total, cost } = getPersonnelTotals(person.id);
                return (
                  <TableRow key={person.id}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {person.first_name} {person.last_name}
                    </TableCell>
                    {weekDays.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      return (
                        <TableCell key={dateKey} className="p-1">
                          <Input
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            placeholder="0"
                            value={personnelHours[`${person.id}_${dateKey}`] || ""}
                            onChange={(e) => updatePersonnelHour(person.id, dateKey, e.target.value)}
                            className="w-14 h-8 text-center text-sm"
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-medium">
                      {total.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      ${cost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell className="sticky left-0 bg-muted/30">Total</TableCell>
                {weekDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  let dayTotal = 0;
                  selectedPersonnel.forEach(personnelId => {
                    dayTotal += parseFloat(personnelHours[`${personnelId}_${dateKey}`]) || 0;
                  });
                  return (
                    <TableCell key={dateKey} className="text-center text-sm">
                      {dayTotal > 0 ? `${dayTotal.toFixed(1)}` : "-"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  {grandTotals.totalHours.toFixed(1)}h
                </TableCell>
                <TableCell className="text-right text-primary">
                  ${grandTotals.totalCost.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
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
              <form onSubmit={form.handleSubmit(handleDailySubmit)} className="space-y-4">
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
                {!entry && <PersonnelSelectionSection />}

                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
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

                {/* Hours display - no overtime preview (OT calculated weekly at 40h threshold) */}
                {watchedHours > 0 && (
                  <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Hours Entry
                    </div>
                    <div className="text-sm">
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

                <div className="grid grid-cols-2 gap-3">
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
                </div>

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
                    disabled={addTimeEntry.isPending || bulkAddTimeEntries.isPending || bulkAddPersonnelTimeEntries.isPending}
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

              {/* Personnel Selection Grid */}
              <WeeklyPersonnelGrid />

              {/* Quick Fill Template */}
              <QuickFillSection />

              {/* Per-Personnel Hours Table */}
              <PersonnelHoursTable />

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
