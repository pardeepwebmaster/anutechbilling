/**
 * AddTaskDialog — reusable "Add follow-up" form.
 *
 * Triggered from anywhere a task can be created — lead drawer,
 * customer detail, subscription card, /tasks page header.
 * Caller passes which entity the task should link to via the
 * `linkTo` prop; only ONE of the four IDs should be set.
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateTask } from "@/lib/queries/tasks";
import type { TaskKind } from "@/lib/supabase/database.types";

const KINDS: { value: TaskKind; label: string; icon: string }[] = [
  { value: "call",     label: "Call",        icon: "📞" },
  { value: "email",    label: "Email",       icon: "✉️" },
  { value: "meeting",  label: "Meeting",     icon: "📅" },
  { value: "followup", label: "Follow-up",   icon: "🔁" },
  { value: "custom",   label: "Custom task", icon: "📋" },
];

// Pre-baked "due in X" quick-pick options. User can still pick custom.
const QUICK_DUE: { label: string; addMinutes: number }[] = [
  { label: "In 1 hour",    addMinutes: 60 },
  { label: "Today 5 PM",   addMinutes: -1 }, // sentinel — computed below
  { label: "Tomorrow 10 AM", addMinutes: -2 },
  { label: "In 3 days",    addMinutes: 60 * 24 * 3 },
  { label: "Next Monday 10 AM", addMinutes: -3 },
];

function computeQuickDue(addMinutes: number): Date {
  const now = new Date();
  if (addMinutes >= 0) return new Date(now.getTime() + addMinutes * 60_000);
  // Sentinels
  if (addMinutes === -1) {
    // Today 5pm IST → use a date with hours=17 in IST
    const t = new Date(now);
    t.setHours(17, 0, 0, 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1); // already past, push to tomorrow
    return t;
  }
  if (addMinutes === -2) {
    // Tomorrow 10am
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(10, 0, 0, 0);
    return t;
  }
  if (addMinutes === -3) {
    // Next Monday 10am
    const t = new Date(now);
    const daysUntilMon = (8 - t.getDay()) % 7 || 7;
    t.setDate(t.getDate() + daysUntilMon);
    t.setHours(10, 0, 0, 0);
    return t;
  }
  return now;
}

function toLocalInputValue(d: Date): string {
  // Format Date → "YYYY-MM-DDTHH:mm" (browser-local) for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const schema = z.object({
  title:  z.string().min(2, "What's the task?").max(120),
  kind:   z.enum(["call", "email", "meeting", "followup", "custom"]),
  due_at: z.string().min(1, "When is it due?"),
  notes:  z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

export interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Friendly label shown in the header — e.g. customer name, lead company. */
  linkLabel?: string;
  /** Exactly one of these should be set; otherwise the task is unlinked (rare). */
  linkTo:
    | { lead_id: string }
    | { quote_id: string }
    | { customer_id: string }
    | { subscription_id: string }
    | null;
}

export function AddTaskDialog({ open, onOpenChange, linkLabel, linkTo }: AddTaskDialogProps) {
  const createTask = useCreateTask();

  // Default due: in 1 hour. Computed once per mount — defaultValues is read
  // by useForm on first call, so recomputing on `open` toggle has no effect.
  const defaultDue = React.useMemo(() => toLocalInputValue(computeQuickDue(60)), []);

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", kind: "followup", due_at: defaultDue, notes: "" },
  });

  React.useEffect(() => {
    if (open) reset({ title: "", kind: "followup", due_at: defaultDue, notes: "" });
  }, [open, defaultDue, reset]);

  const watchedKind = watch("kind");

  const onSubmit = async (data: FormData) => {
    // Local datetime → ISO UTC
    const dueISO = new Date(data.due_at).toISOString();

    const linkPatch =
      linkTo && "lead_id"         in linkTo ? { lead_id:         linkTo.lead_id }
    : linkTo && "quote_id"        in linkTo ? { quote_id:        linkTo.quote_id }
    : linkTo && "customer_id"     in linkTo ? { customer_id:     linkTo.customer_id }
    : linkTo && "subscription_id" in linkTo ? { subscription_id: linkTo.subscription_id }
    : {};

    await createTask.mutateAsync({
      title:  data.title.trim(),
      kind:   data.kind,
      due_at: dueISO,
      notes:  data.notes?.trim() || null,
      ...linkPatch,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] md:max-w-[480px] p-0 flex flex-col overflow-x-hidden"
      >
        <SheetHeader>
          <SheetTitle>Add follow-up task</SheetTitle>
          <SheetDescription>
            {linkLabel
              ? <>Schedule a reminder linked to <b>{linkLabel}</b>. You&apos;ll see it on the dashboard, the bell, and the Tasks page when due.</>
              : <>Schedule a reminder. You&apos;ll see it on the dashboard, the bell, and the Tasks page when due.</>}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 min-w-0 w-full"
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <FormField label="What's the task?" required htmlFor="title">
            <Input
              id="title"
              placeholder={
                watchedKind === "call"    ? "Call Rohit about renewal" :
                watchedKind === "email"   ? "Send Sharma the migration plan" :
                watchedKind === "meeting" ? "Demo with TechBrand 11 AM" :
                "Follow up on quote"
              }
              error={errors.title?.message}
              {...register("title")}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type" htmlFor="kind">
              <Select
                value={watchedKind}
                onValueChange={(v) => setValue("kind", v as TaskKind, { shouldValidate: true })}
              >
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      <span className="mr-1.5">{k.icon}</span> {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...register("kind")} />
            </FormField>

            <FormField label="Due" required htmlFor="due_at">
              <Input
                id="due_at"
                type="datetime-local"
                error={errors.due_at?.message}
                {...register("due_at")}
              />
            </FormField>
          </div>

          {/* Quick-pick due chips */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DUE.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() =>
                  setValue("due_at", toLocalInputValue(computeQuickDue(q.addMinutes)), {
                    shouldValidate: true,
                  })
                }
                className="text-[11px] px-2 py-1 rounded-full border border-hairline text-ink-2 hover:bg-paper-2 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          <FormField label="Notes (optional)" htmlFor="notes">
            <Textarea
              id="notes"
              placeholder="Any context for future-you. What to say, what to bring up, what was discussed."
              rows={3}
              {...register("notes")}
            />
          </FormField>

          </div>  {/* close scrollable form body */}

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon="check"
              loading={isSubmitting || createTask.isPending}
            >
              Schedule
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
