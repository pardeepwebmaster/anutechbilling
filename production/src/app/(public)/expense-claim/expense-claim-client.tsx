"use client";

/**
 * ExpenseClaimClient — the public expense-claim form (rendered by /expense-claim).
 *
 * Employee picks their name, enters their attendance PIN, and logs what they
 * spent (amount, category, purpose, date, optional receipt photo). POSTs to
 * /api/public/expense-claim which verifies the PIN + advance server-side and
 * files a PENDING claim for the owner to approve. No login.
 */
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EXPENSE_CATEGORIES } from "@/lib/queries/expenses";

function todayISO(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const schema = z.object({
  employeeId: z.string().min(1, "Pick your name"),
  pin:        z.string().regex(/^\d{4,6}$/, "Enter your 4–6 digit PIN"),
  amount:     z.coerce.number().int("Whole rupees only").positive("Enter an amount"),
  category:   z.string().min(1, "Choose a category"),
  purpose:    z.string().max(200).optional().or(z.literal("")),
  spentOn:    z.string().min(1, "Pick a date"),
});
type FormData = z.infer<typeof schema>;

export function ExpenseClaimClient({
  tid, sig, brandName, employees,
}: {
  tid: string;
  sig: string;
  brandName: string;
  employees: Array<{ id: string; name: string }>;
}) {
  const [done, setDone]       = React.useState(false);
  const [serverError, setErr] = React.useState<string | null>(null);
  const [photo, setPhoto]     = React.useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { spentOn: todayISO(), category: "" },
  });

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setPhoto(null); return; }
    if (file.size > 4_000_000) { setErr("Receipt photo is too large (max 4 MB)."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const onSubmit = async (data: FormData) => {
    setErr(null);
    try {
      const res = await fetch("/api/public/expense-claim", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tid, sig, ...data, purpose: data.purpose || null, photo }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Something went wrong. Please try again."); return; }
      setDone(true);
      reset();
      setPhoto(null);
    } catch {
      setErr("Network error. Please check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-paper-2">
      <div className="mx-auto max-w-lg px-4 py-8 md:py-12">
        {/* Brand header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper font-serif text-lg">
            {brandName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-serif text-base leading-none text-ink">{brandName}</div>
            <div className="mt-1 text-[10px] text-ink-3">Expense claim</div>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-sm md:p-8">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-soft">
                <Icon name="check" size={28} className="text-emerald" />
              </div>
              <h1 className="font-serif text-2xl text-ink">Sent for approval</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
                Your expense has been submitted to {brandName}. It will be adjusted against your
                advance once the office approves it.
              </p>
              <Button variant="outline" className="mt-5" onClick={() => setDone(false)}>
                Submit another
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Expense advance</p>
                <h1 className="mt-1 font-serif text-2xl leading-tight text-ink">Log an expense</h1>
                <p className="mt-1 text-sm text-ink-3">
                  Enter what you spent from your advance. The office will review and approve it.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField label="Your name" required htmlFor="employeeId">
                  <select
                    id="employeeId"
                    defaultValue=""
                    {...register("employeeId")}
                    className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
                  >
                    <option value="" disabled>Select your name</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  {errors.employeeId && <p className="mt-1 text-xs text-rose">{errors.employeeId.message}</p>}
                </FormField>

                <FormField label="Your PIN" required htmlFor="pin">
                  <Input id="pin" type="password" inputMode="numeric" autoComplete="off"
                    placeholder="4–6 digit attendance PIN" error={errors.pin?.message} {...register("pin")} />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Amount spent (₹)" required htmlFor="amount">
                    <Input id="amount" type="number" min={1} inputMode="numeric"
                      placeholder="e.g. 1200" error={errors.amount?.message} {...register("amount")} />
                  </FormField>
                  <FormField label="Date" required htmlFor="spentOn">
                    <Input id="spentOn" type="date" error={errors.spentOn?.message} {...register("spentOn")} />
                  </FormField>
                </div>

                <FormField label="Category" required htmlFor="category">
                  <select
                    id="category"
                    defaultValue=""
                    {...register("category")}
                    className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
                  >
                    <option value="" disabled>Select category</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-1 text-xs text-rose">{errors.category.message}</p>}
                </FormField>

                <FormField label="What was it for? (optional)" htmlFor="purpose">
                  <Input id="purpose" placeholder="e.g. Client visit auto fare" {...register("purpose")} />
                </FormField>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Receipt photo (optional)</label>
                  <input
                    type="file" accept="image/*" capture="environment" onChange={onPhoto}
                    className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:text-ink hover:file:bg-hairline"
                  />
                  {photo && <p className="mt-1 text-xs text-emerald">Receipt attached ✓</p>}
                </div>

                {serverError && (
                  <div className="rounded-md border border-rose/40 bg-rose-soft px-3 py-2 text-sm text-rose">
                    {serverError}
                  </div>
                )}

                <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
                  Submit for approval
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-3">
          Your submission is reviewed by the office before it is recorded.
        </p>
      </div>
    </div>
  );
}
