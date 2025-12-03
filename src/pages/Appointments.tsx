import { useState } from "react";
import { Plus, Filter, Calendar as CalendarIcon, List } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCard } from "@/components/roofing/appointments/AppointmentCard";
import { AppointmentForm } from "@/components/roofing/appointments/AppointmentForm";
import { AppointmentEmptyState } from "@/components/roofing/appointments/AppointmentEmptyState";
import { useAppointments, useDeleteAppointment } from "@/integrations/supabase/hooks/useAppointments";
import type { Appointment, AppointmentStatus } from "@/types/roofing";
import { format, isToday, isTomorrow, isThisWeek, isPast } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusOptions: { value: AppointmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Appointments() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");

  const { data: appointments, isLoading } = useAppointments();
  const deleteAppointment = useDeleteAppointment();

  const filteredAppointments = appointments?.filter((appointment) => {
    const matchesSearch = 
      appointment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const upcomingAppointments = filteredAppointments?.filter(
    (a) => !isPast(new Date(a.end_time)) && a.status !== "completed" && a.status !== "cancelled"
  );

  const todayAppointments = upcomingAppointments?.filter(
    (a) => isToday(new Date(a.start_time))
  );

  const tomorrowAppointments = upcomingAppointments?.filter(
    (a) => isTomorrow(new Date(a.start_time))
  );

  const thisWeekAppointments = upcomingAppointments?.filter(
    (a) => isThisWeek(new Date(a.start_time)) && !isToday(new Date(a.start_time)) && !isTomorrow(new Date(a.start_time))
  );

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteAppointment.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) setEditingAppointment(undefined);
  };

  const renderAppointmentSection = (title: string, items: Appointment[] | undefined) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-3">
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onEdit={handleEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <PageLayout
      title="Appointments"
      description="Manage your schedule and appointments"
      actions={
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search appointments..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppointmentStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="all">
              <List className="h-4 w-4 mr-2" />
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-6">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !upcomingAppointments?.length ? (
              <AppointmentEmptyState onAdd={() => setIsFormOpen(true)} />
            ) : (
              <>
                {renderAppointmentSection("Today", todayAppointments)}
                {renderAppointmentSection("Tomorrow", tomorrowAppointments)}
                {renderAppointmentSection("This Week", thisWeekAppointments)}
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !filteredAppointments?.length ? (
              <AppointmentEmptyState onAdd={() => setIsFormOpen(true)} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AppointmentForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        appointment={editingAppointment}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
