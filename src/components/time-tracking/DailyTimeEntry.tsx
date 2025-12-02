import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TimeEntryForm } from "./TimeEntryForm";
import { TimeEntryCard } from "./TimeEntryCard";
import { TimeEntryEmptyState } from "./TimeEntryEmptyState";
import {
  TimeEntry,
  useTimeEntriesByDate,
  useDeleteTimeEntry,
  useAssignedProjects,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { format } from "date-fns";

interface DailyTimeEntryProps {
  selectedDate: Date;
}

export function DailyTimeEntry({ selectedDate }: DailyTimeEntryProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const dateString = format(selectedDate, "yyyy-MM-dd");
  const { data: entries = [], isLoading } = useTimeEntriesByDate(dateString);
  const { data: projects = [] } = useAssignedProjects();
  const deleteTimeEntry = useDeleteTimeEntry();

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this time entry?")) {
      await deleteTimeEntry.mutateAsync(id);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <TimeEntryEmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <TimeEntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <TimeEntryForm
        open={formOpen}
        onOpenChange={handleFormClose}
        entry={editingEntry}
        defaultDate={dateString}
      />
    </div>
  );
}
