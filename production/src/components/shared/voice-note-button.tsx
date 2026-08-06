/**
 * VoiceNoteButton — Phase 0 voice agent. One click sends a Hindi TTS reminder to
 * a customer as a WhatsApp voice note (via /api/voice/whatsapp-note). Confirms
 * first (it sends a real message). Degrades with a clear toast when TTS or the
 * WhatsApp Business API isn't configured yet.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/providers/confirm-provider";

interface Props {
  customerId: string;
  purpose?: "reminder" | "renewal";
  label?: string;
  customerName?: string;
  size?: "sm" | "md";
  variant?: "outline" | "ghost" | "primary";
}

export function VoiceNoteButton({
  customerId, purpose = "reminder", label = "🔊 Voice note", customerName, size = "sm", variant = "ghost",
}: Props) {
  const [sending, setSending] = React.useState(false);
  const confirm = useConfirm();

  async function send() {
    if (!(await confirm({
      title: `Send a Hindi voice-note ${purpose} to ${customerName ?? "this customer"} on WhatsApp?`,
      confirmLabel: "Send",
      icon: "whatsapp",
    }))) return;
    setSending(true);
    try {
      const res = await fetch("/api/voice/whatsapp-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't send the voice note."); return; }
      toast.success("Voice note sent on WhatsApp ✓");
    } catch {
      toast.error("Couldn't reach the voice service.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Button size={size} variant={variant} loading={sending} onClick={send}>{label}</Button>
  );
}
