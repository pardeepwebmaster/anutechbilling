"use client";

/**
 * /portal/login — magic link sign-in for customers.
 *
 * No password. Customer enters email → Supabase sends a magic link →
 * customer clicks → callback page exchanges code + links to customer record.
 *
 * Friendlier than passwords because:
 *   - Customers rarely use the portal (monthly / quarterly)
 *   - They never remember passwords for low-frequency apps
 *   - Magic link doubles as email-verification
 */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FormField } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Valid email required"),
});
type FormData = z.infer<typeof schema>;

function PortalLoginInner() {
  const params = useSearchParams();
  const error  = params.get("error");
  const sent   = params.get("sent");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email }: FormData) {
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/portal/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (err) {
      toast.error(err.message);
      return;
    }
    // Redirect to "sent" state — same page, just shows the confirmation.
    window.location.href = `/portal/login?sent=1&email=${encodeURIComponent(email)}`;
  }

  if (sent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-soft grid place-items-center">
            <Icon name="mail" size={26} className="text-emerald" />
          </div>
          <h1 className="font-serif text-2xl mb-2">Check your email</h1>
          <p className="text-sm text-ink-3 mb-6 leading-relaxed">
            We&apos;ve sent a sign-in link to <b className="text-ink">{params.get("email")}</b>.
            Click it to access your portal. Link valid for 1 hour.
          </p>
          <p className="text-[11px] text-ink-3 leading-relaxed">
            Not seeing the email? Check your spam folder, or
            {" "}<a href="/portal/login" className="text-amber-ink underline">try a different email</a>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl mb-2">Customer sign-in</h1>
          <p className="text-sm text-ink-3">Access your orders, invoices and subscription</p>
        </div>

        {error === "no_customer" && (
          <div className="mb-4 p-3 bg-rose-soft border border-rose/30 rounded-md text-xs text-rose">
            We couldn&apos;t find a customer account with that email. Please use the
            same email address you provided when ordering. If you&apos;re sure it&apos;s
            right, WhatsApp Pardeep on +91 99999 30300.
          </div>
        )}
        {error === "auth_failed" && (
          <div className="mb-4 p-3 bg-rose-soft border border-rose/30 rounded-md text-xs text-rose">
            The sign-in link expired or was invalid. Please request a new one below.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Your work email" required htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@yourcompany.in"
              error={errors.email?.message}
              {...register("email")}
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center"
            loading={isSubmitting}
          >
            <Icon name="mail" size={14} className="mr-1.5" />
            Email me a sign-in link
          </Button>

          <p className="text-[11px] text-ink-3 text-center leading-relaxed">
            No passwords. We email you a one-time secure link that signs you in.
          </p>
        </form>

        <div className="mt-6 pt-5 border-t border-hairline text-center text-xs text-ink-3">
          Need help? WhatsApp Pardeep on <b className="text-ink">+91 99999 30300</b>
        </div>
      </Card>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <React.Suspense fallback={null}>
      <PortalLoginInner />
    </React.Suspense>
  );
}
