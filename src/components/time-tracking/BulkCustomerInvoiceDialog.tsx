import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Receipt,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Building2,
  FolderOpen,
  ExternalLink,
  Calendar,
  Users,
} from "lucide-react";
import { format, nextFriday, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { formatCurrency, cn } from "@/lib/utils";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { useQueryClient } from "@tanstack/react-query";

type Step = "weeks" | "customers" | "review" | "results";

interface LineItemDescription {
  bracketId: string;
  weekKey: string;
  type: 'regular' | 'overtime';
  productName: string;
  description: string;
  selected: boolean;
  hours: number;
  rate: number;
  total: number;
}

interface PersonnelWeekBreakdown {
  personnelId: string;
  personnelName: string;
  hours: number;
  selected: boolean;
}

interface WeekGroup {
  weekKey: string;
  weekStart: Date;
  weekEnd: Date;
  label: string;
  entries: TimeEntryWithDetails[];
  totalHours: number;
  personnelBreakdown: PersonnelWeekBreakdown[];
  selected: boolean;
}

interface ProjectWeekGroup {
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  weeks: WeekGroup[];
  totalHours: number;
  expanded: boolean;
}

interface CustomerGroup {
  customerId: string;
  customerName: string;
  projects: { projectId: string; projectName: string; entries: TimeEntryWithDetails[]; totalHours: number }[];
  entries: TimeEntryWithDetails[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalBillable: number;
  lineItems: LineItemDescription[];
  selected: boolean;
  hasRateBracketIssues: boolean;
  personnelWithoutBrackets: { id: string; name: string }[];
  rateBrackets: Map<string, {
    bracketId: string;
    bracketName: string;
    billRate: number;
    overtimeMultiplier: number;
    personnelIds: Set<string>;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
  }>;
}

interface InvoiceResult {
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  success: boolean;
  error?: string;
  total: number;
  entriesLinked: number;
}

interface BulkCustomerInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntries: TimeEntryWithDetails[];
  onSuccess?: () => void;
}

export function BulkCustomerInvoiceDialog({
  open,
  onOpenChange,
  selectedEntries,
  onSuccess,
}: BulkCustomerInvoiceDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("weeks");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBrackets, setIsLoadingBrackets] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [projectWeekGroups, setProjectWeekGroups] = useState<ProjectWeekGroup[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [results, setResults] = useState<InvoiceResult[]>([]);

  const { data: companySettings } = useCompanySettings();
  const addInvoice = useAddInvoice();
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Filter out already invoiced entries and entries without customers
  const validEntries = useMemo(() => {
    return selectedEntries.filter(e => !e.invoice_id && e.projects?.customer_id);
  }, [selectedEntries]);

  const alreadyInvoicedCount = selectedEntries.filter(e => e.invoice_id).length;
  const noCustomerCount = selectedEntries.filter(e => !e.invoice_id && !e.projects?.customer_id).length;

  // Build project -> week groups for step 1
  useEffect(() => {
    if (!open || validEntries.length === 0) {
      setProjectWeekGroups([]);
      return;
    }

    const projectMap = new Map<string, ProjectWeekGroup>();

    validEntries.forEach(entry => {
      const projectId = entry.project_id;
      const projectName = entry.projects?.name || "Unknown Project";
      const customerId = entry.projects?.customer_id || "";
      const customerName = entry.projects?.customers?.name || "Unknown Customer";
      const entryDate = parseISO(entry.entry_date + 'T12:00:00');
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(entryDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectId,
          projectName,
          customerId,
          customerName,
          weeks: [],
          totalHours: 0,
          expanded: true,
        });
      }

      const project = projectMap.get(projectId)!;
      let weekGroup = project.weeks.find(w => w.weekKey === weekKey);

      if (!weekGroup) {
        weekGroup = {
          weekKey,
          weekStart,
          weekEnd,
          label: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`,
          entries: [],
          totalHours: 0,
          personnelBreakdown: [],
          selected: true,
        };
        project.weeks.push(weekGroup);
      }

      weekGroup.entries.push(entry);
      weekGroup.totalHours += Number(entry.hours);
      project.totalHours += Number(entry.hours);

      // Track personnel breakdown
      const personnelId = entry.personnel_id || entry.user_id || "unknown";
      const personnelName = entry.personnel 
        ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
        : (entry.profiles ? `${entry.profiles.first_name} ${entry.profiles.last_name}` : "Unknown");

      let personBreakdown = weekGroup.personnelBreakdown.find(p => p.personnelId === personnelId);
      if (!personBreakdown) {
        personBreakdown = { personnelId, personnelName, hours: 0, selected: true };
        weekGroup.personnelBreakdown.push(personBreakdown);
      }
      personBreakdown.hours += Number(entry.hours);
    });

    // Sort weeks chronologically within each project
    projectMap.forEach(project => {
      project.weeks.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
    });

    const groups = Array.from(projectMap.values()).sort((a, b) => 
      a.projectName.localeCompare(b.projectName)
    );
    setProjectWeekGroups(groups);
    // Auto-expand all projects initially
    setExpandedProjects(new Set(groups.map(g => g.projectId)));
  }, [open, validEntries]);

  // Get selected week entries based on week selections
  const selectedWeekEntries = useMemo(() => {
    const selectedEntryIds = new Set<string>();
    projectWeekGroups.forEach(project => {
      project.weeks.forEach(week => {
        if (week.selected) {
          // Build set of selected personnel IDs for this week
          const selectedPersonnelIds = new Set(
            week.personnelBreakdown
              .filter(p => p.selected)
              .map(p => p.personnelId)
          );
          
          // Only include entries for selected personnel
          week.entries.forEach(e => {
            const personnelId = e.personnel_id || e.user_id || "unknown";
            if (selectedPersonnelIds.has(personnelId)) {
              selectedEntryIds.add(e.id);
            }
          });
        }
      });
    });
    return validEntries.filter(e => selectedEntryIds.has(e.id));
  }, [projectWeekGroups, validEntries]);

  // Build customer groups with per-week overtime calculation
  const buildCustomerGroups = async () => {
    if (selectedWeekEntries.length === 0) {
      setCustomerGroups([]);
      return;
    }

    setIsLoadingBrackets(true);

    // Group entries by customer
    const customerMap = new Map<string, CustomerGroup>();

    selectedWeekEntries.forEach(entry => {
      const customerId = entry.projects?.customer_id!;
      const customerName = entry.projects?.customers?.name || "Unknown Customer";
      const projectId = entry.project_id;
      const projectName = entry.projects?.name || "Unknown Project";

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          projects: [],
          entries: [],
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalBillable: 0,
          lineItems: [],
          selected: true,
          hasRateBracketIssues: false,
          personnelWithoutBrackets: [],
          rateBrackets: new Map(),
        });
      }

      const customer = customerMap.get(customerId)!;
      customer.entries.push(entry);
      customer.totalHours += Number(entry.hours);

      let projectGroup = customer.projects.find(p => p.projectId === projectId);
      if (!projectGroup) {
        projectGroup = { projectId, projectName, entries: [], totalHours: 0 };
        customer.projects.push(projectGroup);
      }
      projectGroup.entries.push(entry);
      projectGroup.totalHours += Number(entry.hours);
    });

    // Fetch rate brackets
    const projectIds = [...new Set(selectedWeekEntries.map(e => e.project_id))];
    const personnelIds = [...new Set(selectedWeekEntries.map(e => e.personnel_id).filter(Boolean))] as string[];

    const { data: assignments } = await supabase
      .from('personnel_project_assignments')
      .select(`
        personnel_id,
        project_id,
        rate_bracket_id,
        project_rate_brackets:rate_bracket_id(
          id,
          name,
          bill_rate,
          overtime_multiplier,
          is_billable
        )
      `)
      .in('project_id', projectIds)
      .in('personnel_id', personnelIds)
      .eq('status', 'active');

    // Build bracket lookup, filtering out non-billable brackets
    const bracketLookup = new Map<string, { id: string; name: string; billRate: number; otMultiplier: number }>();
    assignments?.forEach(a => {
      const bracket = a.project_rate_brackets as any;
      // Skip non-billable brackets - they won't be included in invoices
      if (bracket && a.personnel_id && a.project_id && bracket.is_billable !== false) {
        bracketLookup.set(`${a.project_id}-${a.personnel_id}`, {
          id: bracket.id,
          name: bracket.name,
          billRate: bracket.bill_rate || 0,
          otMultiplier: bracket.overtime_multiplier || 1.5,
        });
      }
    });

    // Process each customer with PER-WEEK overtime calculation
    customerMap.forEach(customer => {
      // Group entries by week first
      const entriesByWeek = new Map<string, TimeEntryWithDetails[]>();
      customer.entries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date + 'T12:00:00');
        const weekKey = format(startOfWeek(entryDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
        if (!entriesByWeek.has(weekKey)) {
          entriesByWeek.set(weekKey, []);
        }
        entriesByWeek.get(weekKey)!.push(entry);
      });

      // Track personnel without brackets
      const personnelWithoutBracketsSet = new Map<string, string>();
      
      // Calculate per-week per-personnel hours and OT
      // Key: weekKey-bracketId, Value: { regular, overtime }
      const weekBracketTotals = new Map<string, {
        weekKey: string;
        bracketId: string;
        bracketName: string;
        billRate: number;
        otMultiplier: number;
        regularHours: number;
        overtimeHours: number;
      }>();

      entriesByWeek.forEach((weekEntries, weekKey) => {
        // Track hours per personnel for this week
        const personnelWeekHours = new Map<string, number>();
        const personnelBracket = new Map<string, { id: string; name: string; billRate: number; otMultiplier: number } | null>();

        weekEntries.forEach(entry => {
          if (entry.personnel_id) {
            const lookupKey = `${entry.project_id}-${entry.personnel_id}`;
            const bracket = bracketLookup.get(lookupKey);
            personnelBracket.set(entry.personnel_id, bracket || null);

            const currentHours = personnelWeekHours.get(entry.personnel_id) || 0;
            personnelWeekHours.set(entry.personnel_id, currentHours + Number(entry.hours));

            if (!bracket) {
              const name = entry.personnel 
                ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
                : "Unknown";
              personnelWithoutBracketsSet.set(entry.personnel_id, name);
            }
          }
        });

        // Calculate regular/overtime for each personnel THIS WEEK
        personnelWeekHours.forEach((totalHours, personnelId) => {
          const bracket = personnelBracket.get(personnelId);
          if (!bracket) return;

          const regularHours = Math.min(totalHours, weeklyOvertimeThreshold);
          const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);

          const key = `${weekKey}-${bracket.id}`;
          if (!weekBracketTotals.has(key)) {
            weekBracketTotals.set(key, {
              weekKey,
              bracketId: bracket.id,
              bracketName: bracket.name,
              billRate: bracket.billRate,
              otMultiplier: bracket.otMultiplier,
              regularHours: 0,
              overtimeHours: 0,
            });
          }

          const wbt = weekBracketTotals.get(key)!;
          wbt.regularHours += regularHours;
          wbt.overtimeHours += overtimeHours;
        });
      });

      customer.personnelWithoutBrackets = Array.from(personnelWithoutBracketsSet.entries())
        .map(([id, name]) => ({ id, name }));
      customer.hasRateBracketIssues = customer.personnelWithoutBrackets.length > 0;

      // Generate line items per week per bracket
      const lineItems: LineItemDescription[] = [];
      let totalBillable = 0;
      let totalRegular = 0;
      let totalOvertime = 0;

      // Sort by week, then bracket
      const sortedWeekBrackets = Array.from(weekBracketTotals.values())
        .sort((a, b) => a.weekKey.localeCompare(b.weekKey) || a.bracketName.localeCompare(b.bracketName));

      sortedWeekBrackets.forEach(wbt => {
        const weekStart = parseISO(wbt.weekKey + 'T12:00:00');
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekLabel = `Week of ${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

        if (wbt.regularHours > 0) {
          const total = wbt.regularHours * wbt.billRate;
          lineItems.push({
            bracketId: wbt.bracketId,
            weekKey: wbt.weekKey,
            type: 'regular',
            productName: `${wbt.bracketName} - Regular Time`,
            description: `${wbt.bracketName} - Regular Time, ${weekLabel}\n${wbt.regularHours.toFixed(1)} hours @ $${wbt.billRate.toFixed(2)}/hr`,
            selected: true,
            hours: wbt.regularHours,
            rate: wbt.billRate,
            total,
          });
          totalBillable += total;
          totalRegular += wbt.regularHours;
        }

        if (wbt.overtimeHours > 0) {
          const otRate = wbt.billRate * wbt.otMultiplier;
          const total = wbt.overtimeHours * otRate;
          lineItems.push({
            bracketId: wbt.bracketId,
            weekKey: wbt.weekKey,
            type: 'overtime',
            productName: `${wbt.bracketName} - Overtime`,
            description: `${wbt.bracketName} - Overtime, ${weekLabel}\n${wbt.overtimeHours.toFixed(1)} hours @ $${otRate.toFixed(2)}/hr (${wbt.otMultiplier}x rate)`,
            selected: true,
            hours: wbt.overtimeHours,
            rate: otRate,
            total,
          });
          totalBillable += total;
          totalOvertime += wbt.overtimeHours;
        }
      });

      customer.lineItems = lineItems;
      customer.totalBillable = totalBillable;
      customer.regularHours = totalRegular;
      customer.overtimeHours = totalOvertime;

      // Also store aggregated bracket totals for entry linking
      const bracketTotals = new Map<string, {
        bracketId: string;
        bracketName: string;
        billRate: number;
        overtimeMultiplier: number;
        personnelIds: Set<string>;
        totalHours: number;
        regularHours: number;
        overtimeHours: number;
      }>();

      weekBracketTotals.forEach(wbt => {
        if (!bracketTotals.has(wbt.bracketId)) {
          bracketTotals.set(wbt.bracketId, {
            bracketId: wbt.bracketId,
            bracketName: wbt.bracketName,
            billRate: wbt.billRate,
            overtimeMultiplier: wbt.otMultiplier,
            personnelIds: new Set(),
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
          });
        }
        const bt = bracketTotals.get(wbt.bracketId)!;
        bt.regularHours += wbt.regularHours;
        bt.overtimeHours += wbt.overtimeHours;
        bt.totalHours += wbt.regularHours + wbt.overtimeHours;
      });

      // Add personnel IDs to bracket totals
      customer.entries.forEach(entry => {
        if (entry.personnel_id) {
          const lookupKey = `${entry.project_id}-${entry.personnel_id}`;
          const bracket = bracketLookup.get(lookupKey);
          if (bracket && bracketTotals.has(bracket.id)) {
            bracketTotals.get(bracket.id)!.personnelIds.add(entry.personnel_id);
          }
        }
      });

      customer.rateBrackets = bracketTotals;

      if (lineItems.length === 0) {
        customer.selected = false;
      }
    });

    setCustomerGroups(Array.from(customerMap.values()).sort((a, b) => 
      a.customerName.localeCompare(b.customerName)
    ));
    setIsLoadingBrackets(false);
  };

  // Rebuild customer groups when moving from weeks to customers step
  useEffect(() => {
    if (step === "customers") {
      buildCustomerGroups();
    }
  }, [step]);

  const toggleWeekSelection = (projectId: string, weekKey: string) => {
    setProjectWeekGroups(prev => prev.map(project => {
      if (project.projectId !== projectId) return project;
      return {
        ...project,
        weeks: project.weeks.map(week => {
          if (week.weekKey !== weekKey) return week;
          const newSelected = !week.selected;
          return {
            ...week,
            selected: newSelected,
            // Also update all personnel selection
            personnelBreakdown: week.personnelBreakdown.map(p => ({
              ...p,
              selected: newSelected,
            })),
          };
        }),
      };
    }));
  };

  const togglePersonnelSelection = (projectId: string, weekKey: string, personnelId: string) => {
    setProjectWeekGroups(prev => prev.map(project => {
      if (project.projectId !== projectId) return project;
      return {
        ...project,
        weeks: project.weeks.map(week => {
          if (week.weekKey !== weekKey) return week;
          const newPersonnelBreakdown = week.personnelBreakdown.map(person => {
            if (person.personnelId !== personnelId) return person;
            return { ...person, selected: !person.selected };
          });
          // Check if any personnel are selected to determine week selection
          const anySelected = newPersonnelBreakdown.some(p => p.selected);
          return {
            ...week,
            selected: anySelected,
            personnelBreakdown: newPersonnelBreakdown,
          };
        }),
      };
    }));
  };

  const isWeekIndeterminate = (week: ProjectWeekGroup['weeks'][0]) => {
    const selectedCount = week.personnelBreakdown.filter(p => p.selected).length;
    return selectedCount > 0 && selectedCount < week.personnelBreakdown.length;
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleWeekExpanded = (key: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCustomerSelection = (customerId: string) => {
    setCustomerGroups(prev => prev.map(c => 
      c.customerId === customerId ? { ...c, selected: !c.selected } : c
    ));
  };

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const updateLineItemDescription = (customerId: string, bracketId: string, weekKey: string, type: 'regular' | 'overtime', newDescription: string) => {
    setCustomerGroups(prev => prev.map(c => {
      if (c.customerId !== customerId) return c;
      return {
        ...c,
        lineItems: c.lineItems.map(li => 
          li.bracketId === bracketId && li.weekKey === weekKey && li.type === type 
            ? { ...li, description: newDescription }
            : li
        ),
      };
    }));
  };

  const toggleLineItem = (customerId: string, bracketId: string, weekKey: string, type: 'regular' | 'overtime') => {
    setCustomerGroups(prev => prev.map(c => {
      if (c.customerId !== customerId) return c;
      const newLineItems = c.lineItems.map(li => 
        li.bracketId === bracketId && li.weekKey === weekKey && li.type === type 
          ? { ...li, selected: !li.selected }
          : li
      );
      const newTotal = newLineItems.filter(li => li.selected).reduce((sum, li) => sum + li.total, 0);
      return { ...c, lineItems: newLineItems, totalBillable: newTotal };
    }));
  };

  const selectedCustomers = customerGroups.filter(c => c.selected && c.lineItems.some(li => li.selected));

  // Count selected weeks
  const selectedWeeksCount = useMemo(() => {
    let count = 0;
    projectWeekGroups.forEach(p => {
      p.weeks.forEach(w => {
        if (w.selected) count++;
      });
    });
    return count;
  }, [projectWeekGroups]);

  const selectedWeeksLabels = useMemo(() => {
    const weeks: { start: Date; end: Date }[] = [];
    projectWeekGroups.forEach(p => {
      p.weeks.forEach(w => {
        if (w.selected && !weeks.some(x => format(x.start, "yyyy-MM-dd") === w.weekKey)) {
          weeks.push({ start: w.weekStart, end: w.weekEnd });
        }
      });
    });
    weeks.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    if (weeks.length === 0) return "";
    if (weeks.length === 1) {
      return `Week of ${format(weeks[0].start, "MMM d")} – ${format(weeks[0].end, "MMM d, yyyy")}`;
    }
    if (weeks.length === 2) {
      return `Weeks of ${format(weeks[0].start, "MMM d")}-${format(weeks[0].end, "d")} & ${format(weeks[1].start, "MMM d")} – ${format(weeks[1].end, "MMM d, yyyy")}`;
    }
    return `${format(weeks[0].start, "MMM d, yyyy")} – ${format(weeks[weeks.length - 1].end, "MMM d, yyyy")} (${weeks.length} weeks)`;
  }, [projectWeekGroups]);

  const totals = useMemo(() => {
    let totalHours = 0;
    let totalBillable = 0;
    let customerCount = 0;

    selectedCustomers.forEach(c => {
      const selectedItems = c.lineItems.filter(li => li.selected);
      totalHours += selectedItems.reduce((sum, li) => sum + li.hours, 0);
      totalBillable += selectedItems.reduce((sum, li) => sum + li.total, 0);
      customerCount++;
    });

    return { totalHours, totalBillable, customerCount };
  }, [selectedCustomers]);

  const handleCreateInvoices = async () => {
    setIsSubmitting(true);
    const invoiceResults: InvoiceResult[] = [];

    for (const customer of selectedCustomers) {
      const selectedItems = customer.lineItems.filter(li => li.selected);
      if (selectedItems.length === 0) continue;

      try {
        const { number: invoiceNumber } = await getNextInvoiceNumber();

        const subtotal = selectedItems.reduce((sum, li) => sum + li.total, 0);
        const lineItems = selectedItems.map(item => ({
          id: '',
          invoice_id: '',
          product_name: item.productName,
          description: item.description,
          quantity: item.hours,
          unit_price: item.rate,
          markup: 0,
          total: item.total,
        }));

        const firstProject = customer.projects[0];

        const result = await addInvoice.mutateAsync({
          number: invoiceNumber,
          customer_id: customer.customerId,
          customer_name: customer.customerName,
          project_id: firstProject?.projectId,
          project_name: customer.projects.map(p => p.projectName).join(", "),
          due_date: dueDate,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "draft",
          notes: invoiceNotes || null,
          line_items: lineItems,
        });

        // Get entry IDs from selected brackets and weeks
        const selectedWeekBracketKeys = new Set(
          selectedItems.map(li => `${li.weekKey}-${li.bracketId}`)
        );
        
        const entryIdsToUpdate = customer.entries
          .filter(e => {
            if (!e.personnel_id) return false;
            const entryDate = parseISO(e.entry_date + 'T12:00:00');
            const weekKey = format(startOfWeek(entryDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
            
            // Check if this entry's week+bracket was selected
            const bracket = Array.from(customer.rateBrackets.values())
              .find(b => b.personnelIds.has(e.personnel_id!));
            if (!bracket) return false;
            
            return selectedWeekBracketKeys.has(`${weekKey}-${bracket.bracketId}`);
          })
          .map(e => e.id);

        if (result?.id && entryIdsToUpdate.length > 0) {
          await supabase
            .from('time_entries')
            .update({ 
              invoice_id: result.id, 
              invoiced_at: new Date().toISOString() 
            })
            .in('id', entryIdsToUpdate);
        }

        invoiceResults.push({
          customerId: customer.customerId,
          customerName: customer.customerName,
          invoiceId: result?.id,
          invoiceNumber: result?.number || invoiceNumber,
          success: true,
          total: subtotal,
          entriesLinked: entryIdsToUpdate.length,
        });
      } catch (error: any) {
        invoiceResults.push({
          customerId: customer.customerId,
          customerName: customer.customerName,
          success: false,
          error: error.message || "Failed to create invoice",
          total: 0,
          entriesLinked: 0,
        });
      }
    }

    setResults(invoiceResults);
    setStep("results");
    setIsSubmitting(false);
    
    queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const handleClose = () => {
    setStep("weeks");
    setResults([]);
    setInvoiceNotes("");
    setExpandedProjects(new Set());
    setExpandedWeeks(new Set());
    setExpandedCustomers(new Set());
    onOpenChange(false);
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  const successCount = results.filter(r => r.success).length;
  const totalCreated = results.reduce((sum, r) => r.success ? sum + r.total : sum, 0);
  const totalEntriesLinked = results.reduce((sum, r) => sum + r.entriesLinked, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {step === "weeks" && "Select Weeks to Invoice"}
            {step === "customers" && "Select Customers"}
            {step === "review" && "Review Invoices"}
            {step === "results" && "Invoices Created"}
          </DialogTitle>
          <DialogDescription>
            {step === "weeks" && `${validEntries.length} entries across ${projectWeekGroups.length} projects`}
            {step === "customers" && `${selectedWeeksLabels}`}
            {step === "review" && `Review and confirm ${selectedCustomers.length} invoices`}
            {step === "results" && `${successCount} of ${results.length} invoices created successfully`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* STEP 1: Weeks Selection */}
          {step === "weeks" && (
            <div className="space-y-4">
              {(alreadyInvoicedCount > 0 || noCustomerCount > 0) && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    {alreadyInvoicedCount > 0 && (
                      <p>{alreadyInvoicedCount} entries already invoiced (will be skipped)</p>
                    )}
                    {noCustomerCount > 0 && (
                      <p>{noCustomerCount} entries have no customer assigned (will be skipped)</p>
                    )}
                  </div>
                </div>
              )}

              <ScrollArea className="h-[400px] rounded-lg border">
                {projectWeekGroups.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    No valid entries to invoice
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {projectWeekGroups.map(project => (
                      <div key={project.projectId} className="rounded-lg border p-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left w-full"
                          onClick={() => toggleProjectExpanded(project.projectId)}
                        >
                          {expandedProjects.has(project.projectId) ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium truncate flex-1">{project.projectName}</span>
                          <Badge variant="secondary" className="text-xs ml-2">
                            {project.weeks.length} week{project.weeks.length !== 1 ? 's' : ''}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {project.totalHours.toFixed(1)}h
                          </span>
                        </button>

                        {expandedProjects.has(project.projectId) && (
                          <div className="mt-3 ml-6 space-y-2">
                            {project.weeks.map(week => {
                              const weekExpandKey = `${project.projectId}-${week.weekKey}`;
                              return (
                                <div
                                  key={week.weekKey}
                                  className={cn(
                                    "rounded-lg border p-3 transition-colors",
                                    week.selected && "border-primary/50 bg-primary/5"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={week.selected && week.personnelBreakdown.every(p => p.selected)}
                                      onCheckedChange={() => toggleWeekSelection(project.projectId, week.weekKey)}
                                      className={isWeekIndeterminate(week) ? "data-[state=unchecked]:bg-primary/30" : ""}
                                    />
                                    <button
                                      type="button"
                                      className="flex items-center gap-2 flex-1 text-left"
                                      onClick={() => toggleWeekExpanded(weekExpandKey)}
                                    >
                                      {expandedWeeks.has(weekExpandKey) ? (
                                        <ChevronDown className="h-4 w-4 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0" />
                                      )}
                                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-sm font-medium">{week.label}</span>
                                    </button>
                                    <span className="text-sm text-muted-foreground">
                                      {week.personnelBreakdown.filter(p => p.selected).reduce((sum, p) => sum + p.hours, 0).toFixed(1)}h
                                    </span>
                                  </div>

                                  {expandedWeeks.has(weekExpandKey) && (
                                    <div className="mt-2 ml-8 space-y-1">
                                      {week.personnelBreakdown.map(person => (
                                        <div 
                                          key={person.personnelId} 
                                          className={cn(
                                            "flex items-center gap-2 text-sm p-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                                            !person.selected && "opacity-50"
                                          )}
                                          onClick={() => togglePersonnelSelection(project.projectId, week.weekKey, person.personnelId)}
                                        >
                                          <Checkbox
                                            checked={person.selected}
                                            onCheckedChange={() => togglePersonnelSelection(project.projectId, week.weekKey, person.personnelId)}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <Users className="h-3 w-3 text-muted-foreground" />
                                          <span className={cn(!person.selected && "line-through")}>{person.personnelName}</span>
                                          <span className="ml-auto text-muted-foreground">{person.hours.toFixed(1)}h</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedWeeksCount} week{selectedWeeksCount !== 1 ? 's' : ''} selected
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedWeekEntries.length} entries
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Customers */}
          {step === "customers" && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedWeeksLabels}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <ScrollArea className="h-[300px] rounded-lg border">
                {isLoadingBrackets ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading rate brackets...</span>
                  </div>
                ) : customerGroups.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    No valid entries to invoice
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {customerGroups.map(customer => (
                      <div
                        key={customer.customerId}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          customer.hasRateBracketIssues && "border-amber-500/50 bg-amber-500/5",
                          !customer.hasRateBracketIssues && customer.selected && "border-primary/50 bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={customer.selected}
                            onCheckedChange={() => toggleCustomerSelection(customer.customerId)}
                            disabled={customer.lineItems.length === 0}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left w-full"
                              onClick={() => toggleCustomerExpanded(customer.customerId)}
                            >
                              {expandedCustomers.has(customer.customerId) ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              <Building2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium truncate">{customer.customerName}</span>
                            </button>
                            <div className="flex items-center gap-4 mt-1 ml-8 text-sm text-muted-foreground">
                              <span>{customer.totalHours.toFixed(1)}h</span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(customer.totalBillable)}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {customer.projects.length} project{customer.projects.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            {customer.hasRateBracketIssues && (
                              <div className="flex items-center gap-1 mt-1 ml-8 text-xs text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>
                                  Missing rate brackets: {customer.personnelWithoutBrackets.map(p => p.name).join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {expandedCustomers.has(customer.customerId) && (
                          <div className="mt-3 ml-8 space-y-2">
                            {customer.projects.map(project => (
                              <div key={project.projectId} className="flex items-center gap-2 text-sm">
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <span>{project.projectName}</span>
                                <span className="text-muted-foreground">({project.totalHours.toFixed(1)}h)</span>
                              </div>
                            ))}
                            {customer.lineItems.length > 0 && (
                              <div className="mt-2 pt-2 border-t space-y-1">
                                {customer.lineItems.filter(li => li.selected).slice(0, 4).map(li => (
                                  <div key={`${li.bracketId}-${li.weekKey}-${li.type}`} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground truncate">{li.productName}</span>
                                    <span className="font-medium">{formatCurrency(li.total)}</span>
                                  </div>
                                ))}
                                {customer.lineItems.filter(li => li.selected).length > 4 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{customer.lineItems.filter(li => li.selected).length - 4} more line items
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  {totals.customerCount} customer{totals.customerCount !== 1 ? 's' : ''} • {totals.totalHours.toFixed(1)} hours
                </span>
                <span className="font-semibold">{formatCurrency(totals.totalBillable)}</span>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === "review" && (
            <ScrollArea className="h-[450px]">
              <div className="space-y-4 p-1">
                {selectedCustomers.map(customer => (
                  <div key={customer.customerId} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{customer.customerName}</span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(customer.lineItems.filter(li => li.selected).reduce((sum, li) => sum + li.total, 0))}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {customer.lineItems.map(li => (
                        <div
                          key={`${li.bracketId}-${li.weekKey}-${li.type}`}
                          className={cn(
                            "p-3 rounded-lg border transition-colors",
                            li.selected ? "bg-background" : "bg-muted/30 opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={li.selected}
                                onCheckedChange={() => toggleLineItem(customer.customerId, li.bracketId, li.weekKey, li.type)}
                              />
                              <span className="font-medium text-sm">{li.productName}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(li.total)}</span>
                          </div>
                          <Textarea
                            value={li.description}
                            onChange={(e) => updateLineItemDescription(customer.customerId, li.bracketId, li.weekKey, li.type, e.target.value)}
                            className="text-sm min-h-[60px]"
                            disabled={!li.selected}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Notes Section */}
                <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                  <Label htmlFor="invoice-notes" className="text-sm font-medium">Notes / Memo</Label>
                  <Textarea
                    id="invoice-notes"
                    placeholder="Add notes that will appear on the invoice and sync to QuickBooks..."
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This note will appear on all invoices created in this batch
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* STEP 4: Results */}
          {step === "results" && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 p-1">
                {results.map(result => (
                  <div
                    key={result.customerId}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border",
                      result.success ? "bg-green-500/5 border-green-500/30" : "bg-destructive/5 border-destructive/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <div className="font-medium">{result.customerName}</div>
                        {result.success ? (
                          <div className="text-sm text-muted-foreground">
                            {result.invoiceNumber} • {result.entriesLinked} entries linked
                          </div>
                        ) : (
                          <div className="text-sm text-destructive">{result.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {result.success && (
                        <>
                          <span className="font-medium">{formatCurrency(result.total)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/invoices/${result.invoiceId}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {step === "weeks" && (
            <>
              <div className="flex-1 text-sm text-muted-foreground">
                Select weeks to include in invoices
              </div>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={() => setStep("customers")}
                disabled={selectedWeeksCount === 0}
              >
                Next: Customers
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "customers" && (
            <>
              <div className="flex-1 text-sm text-muted-foreground">
                {totals.customerCount} invoice{totals.customerCount !== 1 ? 's' : ''} will be created
              </div>
              <Button variant="outline" onClick={() => setStep("weeks")}>
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={() => setStep("review")}
                disabled={selectedCustomers.length === 0}
              >
                Next: Review
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("customers")}>
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleCreateInvoices}
                disabled={isSubmitting || selectedCustomers.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Create {selectedCustomers.length} Invoice{selectedCustomers.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </>
          )}

          {step === "results" && (
            <>
              <div className="flex-1 text-sm">
                <span className="font-medium">{successCount} invoice{successCount !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground"> created • </span>
                <span className="font-medium">{formatCurrency(totalCreated)}</span>
                <span className="text-muted-foreground"> total • </span>
                <span className="font-medium">{totalEntriesLinked} entries</span>
                <span className="text-muted-foreground"> linked</span>
              </div>
              <Button onClick={handleDone}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
