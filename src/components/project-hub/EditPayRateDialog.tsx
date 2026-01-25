import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import {
  useUpdatePersonnelPayRate,
  RATE_CHANGE_REASONS,
} from "@/integrations/supabase/hooks/usePersonnelRateHistory";

const formSchema = z.object({
  payRate: z.coerce
    .number()
    .min(0, "Pay rate must be 0 or greater")
    .max(1000, "Pay rate seems too high"),
  changeReason: z.string().optional(),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditPayRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  personnelId: string;
  assignmentId: string;
  personnelName: string;
  currentRate: number | null;
}

export function EditPayRateDialog({
  open,
  onOpenChange,
  projectId,
  personnelId,
  assignmentId,
  personnelName,
  currentRate,
}: EditPayRateDialogProps) {
  const updateRate = useUpdatePersonnelPayRate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payRate: currentRate ?? 0,
      changeReason: "",
      notes: "",
    },
  });

  // Reset form when dialog opens with new values
  useState(() => {
    if (open) {
      form.reset({
        payRate: currentRate ?? 0,
        changeReason: "",
        notes: "",
      });
    }
  });

  const onSubmit = async (values: FormValues) => {
    await updateRate.mutateAsync({
      projectId,
      personnelId,
      assignmentId,
      newRate: values.payRate,
      changeReason: values.changeReason,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Pay Rate</DialogTitle>
          <DialogDescription>
            Update the pay rate for <strong>{personnelName}</strong> on this
            project. This change will apply going forward only.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Rate ($/hr)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        {...field}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        /hr
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="changeReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Change (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RATE_CHANGE_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this rate change..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateRate.isPending}>
                {updateRate.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Rate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
