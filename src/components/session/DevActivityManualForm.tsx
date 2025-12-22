import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useDevActivities, DevActivity } from "@/hooks/useDevActivities";
import { ACTIVITY_TYPES } from "./devActivityUtils";

const formSchema = z.object({
  activity_type: z.string().min(1, "Required"),
  title: z.string().min(1, "Required").max(100, "Max 100 characters"),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(1, "Duration is required (minimum 1 minute)"),
  activity_date: z.string().min(1, "Required"),
  project_name: z.string().optional(),
  technologies: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface DevActivityManualFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editActivity?: DevActivity | null;
  onComplete?: () => void;
}

export function DevActivityManualForm({
  open,
  onOpenChange,
  editActivity,
  onComplete,
}: DevActivityManualFormProps) {
  const { createActivity, updateActivity, projectNames } = useDevActivities();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editActivity
      ? {
          activity_type: editActivity.activity_type,
          title: editActivity.title,
          description: editActivity.description || "",
          duration_minutes: editActivity.duration_minutes || 30,
          activity_date: editActivity.activity_date,
          project_name: editActivity.project_name || "",
          technologies: editActivity.technologies?.join(", ") || "",
          tags: editActivity.tags?.join(", ") || "",
        }
      : {
          activity_type: "feature_development",
          title: "",
          description: "",
          duration_minutes: 30,
          activity_date: format(new Date(), "yyyy-MM-dd"),
          project_name: "",
          technologies: "",
          tags: "",
        },
  });

  const onSubmit = async (values: FormValues) => {
    const input = {
      activity_type: values.activity_type,
      title: values.title,
      description: values.description || undefined,
      duration_minutes: values.duration_minutes,
      activity_date: values.activity_date,
      project_name: values.project_name || undefined,
      technologies: values.technologies
        ? values.technologies.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      tags: values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      extraction_confidence: "high", // Manual entries are high confidence
    };

    if (editActivity) {
      await updateActivity.mutateAsync({ id: editActivity.id, ...input });
    } else {
      await createActivity.mutateAsync(input);
    }

    form.reset();
    onOpenChange(false);
    onComplete?.();
  };

  const isSubmitting = createActivity.isPending || updateActivity.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editActivity ? "Edit Activity" : "Add Development Activity"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the work" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed notes about the work..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 60" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activity_date"
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

            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Project or client name"
                      list="project-names"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="project-names">
                    {projectNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technologies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technologies (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="React, TypeScript, Supabase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="urgent, client-facing, refactor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {editActivity ? "Update" : "Save"} Activity
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
