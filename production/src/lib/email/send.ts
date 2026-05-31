/**
 * Email send abstraction.
 *
 * Used by the renewal cron (and future flows like quote-send,
 * invoice-send). Has two modes:
 *
 *   1. Stub mode (when RESEND_API_KEY is absent / blank):
 *      - Does NOT hit any external API.
 *      - Returns { status: "stubbed", providerId: null }.
 *      - Callers should still record the attempt in their audit log
 *        (renewal_email_log) so we know cadence logic ran even without
 *        delivery.
 *
 *   2. Real mode (when RESEND_API_KEY is set):
 *      - POSTs to api.resend.com/emails.
 *      - Returns the Resend message ID as providerId on success.
 *
 * No code change is needed to flip from stub → real; just set the env
 * variable. This is the seam we'll integrate against once you sign up
 * at resend.com and add RESEND_API_KEY=re_... to .env.local.
 *
 * Server-only — never import from client code. Resend keys are secret.
 */

export interface EmailAttachment {
  /** Filename as it should appear in the recipient's inbox. */
  filename: string;
  /** Raw bytes — base64-encoded for transport to Resend. */
  content:  Buffer | Uint8Array | string;
  /** MIME — defaults to application/pdf when omitted. */
  contentType?: string;
}

export interface EmailMessage {
  /** Single recipient for now. Cc / Bcc come when needed. */
  to:          string;
  subject:     string;
  /** Plain-text fallback. Required. */
  text:        string;
  /** HTML version. Optional — falls back to text/plain only if absent. */
  html?:       string;
  /** Per-message "From" header. Defaults to a Resend-onboarding sandbox
   *  address when not provided, but real production sends should pass the
   *  reseller's verified domain (e.g. billing@anutech.in). */
  from?:       string;
  replyTo?:    string;
  attachments?: EmailAttachment[];
}

export type EmailSendStatus = "sent" | "stubbed" | "failed";

export interface EmailSendResult {
  status:       EmailSendStatus;
  providerId:   string | null;
  errorMessage: string | null;
}

/**
 * Send an email. Safe to call without RESEND_API_KEY — falls back to stub
 * mode so callers don't need to branch.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromDefault = process.env.RESEND_FROM_DEFAULT?.trim() || "onboarding@resend.dev";
  // INTERIM (until the tenant's sending domain is verified on Resend): when set,
  // RESEND_FROM_OVERRIDE forces the From on EVERY email, ignoring the caller's
  // `from` (which is the tenant's own @-domain and 403s on Resend until verified).
  // Set it to e.g. "Excel Technologies <onboarding@resend.dev>" to unblock sends
  // today; UNSET it the moment the real domain is verified to revert to per-tenant
  // From. Reply-To stays the tenant's address, so customer replies still route right.
  const fromOverride = process.env.RESEND_FROM_OVERRIDE?.trim();

  // ── Stub mode ─────────────────────────────────────────────────────
  if (!apiKey) {
    // Log to server console for debugging visibility. In prod with no key,
    // the renewal cron still runs all logic — just doesn't push the message
    // out the door. Status='stubbed' is recorded by the caller in
    // renewal_email_log so the audit chain stays intact.
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        `[email/send] STUB MODE — RESEND_API_KEY not set. Would have sent:\n` +
        `  to:      ${msg.to}\n` +
        `  subject: ${msg.subject}\n` +
        `  attachments: ${msg.attachments?.map((a) => a.filename).join(", ") ?? "(none)"}`
      );
    }
    return { status: "stubbed", providerId: null, errorMessage: null };
  }

  // ── Real mode (Resend) ────────────────────────────────────────────
  try {
    // Normalize attachments — Resend wants base64.
    const attachments = msg.attachments?.map((a) => ({
      filename: a.filename,
      content:
        typeof a.content === "string"
          ? a.content
          : Buffer.from(a.content).toString("base64"),
      // Resend infers content-type from filename, but we can hint:
      content_type: a.contentType,
    }));

    const body = {
      from:     fromOverride || msg.from || fromDefault,
      to:       [msg.to],
      subject:  msg.subject,
      text:     msg.text,
      html:     msg.html,
      reply_to: msg.replyTo,
      attachments,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<no body>");
      return {
        status:       "failed",
        providerId:   null,
        errorMessage: `Resend ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const json = await res.json() as { id?: string };
    return {
      status:       "sent",
      providerId:   json.id ?? null,
      errorMessage: null,
    };
  } catch (err) {
    return {
      status:       "failed",
      providerId:   null,
      errorMessage: (err as Error).message,
    };
  }
}

/** True if Resend is configured and real sends will happen. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
