/**
 * Database types — hand-maintained to match supabase/migrations/0001_init.sql.
 *
 * In production, regenerate with:
 *   npx supabase gen types typescript --project-id YOUR_REF > src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================================================
// Standalone row interfaces (avoid circular references)
// ============================================================
type TenantRow = {
  id: string;
  name: string;
  gstin: string | null;
  state: string | null;
  state_code: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}
type TenantInsert = {
  id?: string;
  name: string;
  gstin?: string | null;
  state?: string | null;
  state_code?: string | null;
  address?: string | null;
  email: string;
  phone?: string | null;
  grace_period_days?: number;
  created_at?: string;
  updated_at?: string;
}
type TenantUpdate = Partial<TenantInsert>;

type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  initials: string | null;
  role: "owner" | "sales" | "accountant" | "support";
  color: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}
type UserInsert = {
  id: string;
  tenant_id: string;
  email: string;
  full_name?: string | null;
  initials?: string | null;
  role?: "owner" | "sales" | "accountant" | "support";
  color?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  created_at?: string;
}
type UserUpdate = Partial<UserInsert>;

type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  domain: string | null;
  gstin: string | null;
  state: string | null;
  state_code: string | null;
  health: number;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  account_manager_id: string | null;
  since: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
type CustomerInsert = {
  id?: string;
  tenant_id: string;
  name: string;
  domain?: string | null;
  gstin?: string | null;
  state?: string | null;
  state_code?: string | null;
  health?: number;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  account_manager_id?: string | null;
  since?: string;
  notes?: string | null;
}
type CustomerUpdate = Partial<CustomerInsert>;

/**
 * Per-commitment pricing for an item. Only 2 underlying prices — annual commit
 * has the SAME ₹/seat/month rate regardless of billing frequency (monthly invoice
 * vs single yearly invoice). The form shows 3 rows but row 2 (annual monthly bill)
 * and row 3 (annual yearly bill) bind to the same `annual` value.
 *
 *  - monthly — no commitment, monthly bill (highest rate, max flexibility)
 *  - annual  — 1-yr commit, ₹/seat/month (billed monthly OR yearly = same total)
 */
export type ItemPriceTier = "monthly" | "annual";
export type ItemPrices = Partial<Record<ItemPriceTier, { msrp: number; wholesale: number }>>;

type ItemRow = {
  id: string;
  tenant_id: string;
  name: string;
  vendor: "google" | "microsoft" | "zoho" | "other";
  /** "main" = core plan offered standalone · "addon" = upsell paired with a main plan */
  kind: "main" | "addon";
  hsn: string | null;
  /** Default price (typically annual_upfront — kept as the headline number) */
  msrp: number;
  wholesale: number;
  /** Per-commitment pricing matrix */
  prices: ItemPrices;
  margin_pct: number;
  is_active: boolean;
  created_at: string;
}
type ItemInsert = {
  id: string;
  tenant_id: string;
  name: string;
  vendor: "google" | "microsoft" | "zoho" | "other";
  kind?: "main" | "addon";
  hsn?: string | null;
  msrp: number;
  wholesale: number;
  prices?: ItemPrices;
  is_active?: boolean;
}
type ItemUpdate = Partial<ItemInsert>;

type LeadRow = {
  id: string;
  tenant_id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string | null;
  seats: number | null;
  value: number | null;
  stage: "new" | "contact" | "demo" | "trial" | "quote" | "won" | "lost";
  owner_id: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
type LeadInsert = {
  id: string;
  tenant_id: string;
  company: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  plan?: string | null;
  seats?: number | null;
  value?: number | null;
  stage?: "new" | "contact" | "demo" | "trial" | "quote" | "won" | "lost";
  owner_id?: string | null;
  source?: string | null;
  notes?: string | null;
}
type LeadUpdate = Partial<LeadInsert>;

/**
 * A commitment + billing-cycle choice on a quote line item. Default = "annual_yearly"
 * (1-yr commit, single yearly invoice). Storage is always annual ₹/seat — billing
 * cycle just controls how invoices get sliced through the year.
 *  - monthly             — flex, no commit, monthly bill
 *  - annual_monthly      — 1-yr commit, monthly bill   (12 invoices/yr)
 *  - annual_quarterly    — 1-yr commit, quarterly bill ( 4 invoices/yr)
 *  - annual_half_yearly  — 1-yr commit, half-yearly    ( 2 invoices/yr)
 *  - annual_yearly       — 1-yr commit, yearly bill    ( 1 invoice/yr)
 */
export type LineCommitment =
  | "monthly"
  | "annual_monthly"
  | "annual_quarterly"
  | "annual_half_yearly"
  | "annual_yearly";

export type QuoteLineItem = {
  id: string;        // local UUID for React keys
  item_id?: string;  // FK to items table (optional — only if from catalog)
  name: string;
  description?: string;
  qty: number;
  rate: number;          // ₹ per seat — annual amount regardless of billing frequency
  cost: number;          // ₹ per seat — annual wholesale (for margin calc)
  commitment?: LineCommitment;  // billing/commitment tier (default "annual_yearly")
};

type QuoteRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string;
  lead_id: string | null;
  plan: string | null;
  seats: number | null;
  amount: number | null;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
  owner_id: string | null;
  created_date: string;
  expires_date: string | null;
  pdf_url: string | null;
  line_items: QuoteLineItem[];
  subtotal: number;
  total_cost: number;
  discount_pct: number;
  tax_rate: number;
  notes: string | null;
  payment_status: "none" | "awaiting" | "partial" | "received" | "invoiced";
  payment_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_received_at: string | null;
  payment_notes: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}
type QuoteInsert = {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name: string;
  lead_id?: string | null;
  plan?: string | null;
  seats?: number | null;
  amount?: number | null;
  status?: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
  owner_id?: string | null;
  created_date?: string;
  expires_date?: string | null;
  pdf_url?: string | null;
  line_items?: QuoteLineItem[];
  subtotal?: number;
  total_cost?: number;
  discount_pct?: number;
  tax_rate?: number;
  notes?: string | null;
  payment_status?: "none" | "awaiting" | "partial" | "received" | "invoiced";
  payment_amount?: number | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_received_at?: string | null;
  payment_notes?: string | null;
  invoice_id?: string | null;
}
type QuoteUpdate = Partial<QuoteInsert>;

/**
 * Single entry in the adjusted_advances jsonb array on an invoice.
 * Snapshot of a Receipt Voucher payment that was applied against this invoice
 * at issue time. Frozen — never edited; later refunds become credit notes.
 */
export type InvoiceAdvanceAdjustment = {
  payment_id:  string;         // uuid of payments row
  voucher_no:  string | null;  // RV-2025-26-NNNN (null for legacy un-numbered)
  amount:      number;         // ₹ (paise once #103 lands)
  received_at: string;         // ISO timestamp
  method:      "upi" | "razorpay" | "bank_transfer" | "cheque" | "cash" | "other";
};

type InvoiceRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string;
  amount: number;                          // Gross invoice total (full quote amount)
  status: "draft" | "pending" | "paid" | "overdue" | "void";
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  overdue_days: number;
  razorpay_id: string | null;
  gst_irn: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // Advance adjustment (CGST Section 31 + Rule 53) — populated at invoice issue time
  adjusted_advances: InvoiceAdvanceAdjustment[];
  net_payable:       number | null;        // amount - sum(adjusted_advances.amount), floor 0
  first_advance_at:  string | null;        // Drives 30-day GST clock (Sec 13(2))
  quote_id:          string | null;        // FK to source quote
}
type InvoiceInsert = {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name: string;
  amount: number;
  status?: "draft" | "pending" | "paid" | "overdue" | "void";
  invoice_date?: string;
  due_date?: string | null;
  paid_date?: string | null;
  overdue_days?: number;
  razorpay_id?: string | null;
  gst_irn?: string | null;
  pdf_url?: string | null;
  adjusted_advances?: InvoiceAdvanceAdjustment[];
  net_payable?:      number | null;
  first_advance_at?: string | null;
  quote_id?:         string | null;
}
type InvoiceUpdate = Partial<InvoiceInsert>;

export type RenewalState =
  | "pending"
  | "notice_sent"
  | "reminder_1"
  | "reminder_2"
  | "reminder_3"
  | "reminder_4"
  | "final_sent"
  | "grace_period"
  | "renewed"
  | "suspended";

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string;
  domain: string | null;
  plan: string;
  vendor: "google" | "microsoft" | "zoho" | "other";
  seats: number;
  used: number;
  mrr: number;
  start_date: string | null;
  renewal_date: string | null;
  status: "active" | "paused" | "expired" | "cancelled";
  is_urgent: boolean;
  /** ₹ amount still owed by customer (0 = fully paid). Service can be active with outstanding > 0. */
  outstanding_amount: number;
  /** Set when subscription is written off (uncollectable bad debt) */
  write_off_reason: string | null;
  written_off_at:   string | null;
  /** Last time operator sent a payment reminder */
  last_reminder_at: string | null;
  /** Renewal cadence position. Updated by /api/cron/renewals daily. */
  renewal_state:    RenewalState;
  /** How many cadence emails have fired against this subscription. */
  reminder_count:   number;
  /** Most recent cadence email timestamp (v2 column from migration 0008). */
  last_reminder_sent_at_v2: string | null;
  /** Auto-generated renewal quote (created at T-15). */
  renewal_quote_id: string | null;
  /** When the auto-suspend trigger fired. NULL = never auto-suspended. */
  suspended_at:     string | null;
  created_at: string;
  updated_at: string;
}
type SubscriptionInsert = {
  id?: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name: string;
  domain?: string | null;
  plan: string;
  vendor: "google" | "microsoft" | "zoho" | "other";
  seats: number;
  used?: number;
  mrr: number;
  start_date?: string | null;
  renewal_date?: string | null;
  status?: "active" | "paused" | "expired" | "cancelled";
  is_urgent?: boolean;
  outstanding_amount?: number;
  write_off_reason?: string | null;
  written_off_at?:   string | null;
  last_reminder_at?: string | null;
  renewal_state?:    RenewalState;
  reminder_count?:   number;
  last_reminder_sent_at_v2?: string | null;
  renewal_quote_id?: string | null;
  suspended_at?:     string | null;
}
type SubscriptionUpdate = Partial<SubscriptionInsert>;

// ============================================================
// Payments — multiple per quote (partial / installments / refunds)
// ============================================================
export type PaymentMethod = "upi" | "razorpay" | "bank_transfer" | "cheque" | "cash" | "other";

type PaymentRow = {
  id:                 string;
  tenant_id:          string;
  quote_id:           string;
  customer_id:        string | null;
  amount:             number;
  method:             PaymentMethod;
  reference:          string | null;
  notes:              string | null;
  status:             "received" | "refunded";
  received_at:        string;
  refunded_at:        string | null;
  refund_reason:      string | null;
  recorded_by:        string | null;
  receipt_voucher_no: string | null;
  created_at:         string;
}
type PaymentInsert = {
  id?:           string;
  tenant_id:     string;
  quote_id:      string;
  customer_id?:  string | null;
  amount:        number;
  method:        PaymentMethod;
  reference?:    string | null;
  notes?:        string | null;
  status?:       "received" | "refunded";
  received_at?:  string;
  refunded_at?:  string | null;
  refund_reason?: string | null;
  recorded_by?:  string | null;
  receipt_voucher_no?: string | null;
}
type PaymentUpdate = Partial<PaymentInsert>;

// ============================================================
// Tasks — follow-up to-dos for sales reps (per migration 0007)
// ============================================================
export type TaskStatus = "pending" | "done" | "snoozed" | "cancelled";
export type TaskKind   = "call" | "email" | "meeting" | "followup" | "custom";

type TaskRow = {
  id:                       string;
  tenant_id:                string;
  owner_id:                 string | null;
  title:                    string;
  notes:                    string | null;
  kind:                     TaskKind;
  due_at:                   string;
  reminder_minutes_before:  number;
  status:                   TaskStatus;
  lead_id:                  string | null;
  quote_id:                 string | null;
  customer_id:              string | null;
  subscription_id:          string | null;
  created_at:               string;
  completed_at:             string | null;
  completed_by:             string | null;
  snooze_count:             number;
};
type TaskInsert = {
  id?:                       string;
  tenant_id:                 string;
  owner_id?:                 string | null;
  title:                     string;
  notes?:                    string | null;
  kind?:                     TaskKind;
  due_at:                    string;
  reminder_minutes_before?:  number;
  status?:                   TaskStatus;
  lead_id?:                  string | null;
  quote_id?:                 string | null;
  customer_id?:              string | null;
  subscription_id?:          string | null;
  completed_at?:             string | null;
  completed_by?:             string | null;
  snooze_count?:             number;
};
type TaskUpdate = Partial<TaskInsert>;

// ============================================================
// Renewal email log (migration 0008) — audit of every renewal cadence email
// ============================================================
type RenewalEmailLogRow = {
  id:              string;
  tenant_id:       string;
  subscription_id: string;
  cadence_step:    RenewalState;
  recipient_email: string;
  subject:         string | null;
  status:          "sent" | "stubbed" | "failed" | "skipped";
  provider_id:     string | null;
  error_message:   string | null;
  sent_at:         string;
};
type RenewalEmailLogInsert = {
  id?:              string;
  tenant_id:        string;
  subscription_id:  string;
  cadence_step:     RenewalState;
  recipient_email:  string;
  subject?:         string | null;
  status:           "sent" | "stubbed" | "failed" | "skipped";
  provider_id?:     string | null;
  error_message?:   string | null;
  sent_at?:         string;
};
type RenewalEmailLogUpdate = Partial<RenewalEmailLogInsert>;

// ============================================================
// Database type (the shape supabase-js expects)
// ============================================================
export type Database = {
  public: {
    Tables: {
      tenants:       { Row: TenantRow;       Insert: TenantInsert;       Update: TenantUpdate;       Relationships: [] };
      users:         { Row: UserRow;         Insert: UserInsert;         Update: UserUpdate;         Relationships: [] };
      customers:     { Row: CustomerRow;     Insert: CustomerInsert;     Update: CustomerUpdate;     Relationships: [] };
      items:         { Row: ItemRow;         Insert: ItemInsert;         Update: ItemUpdate;         Relationships: [] };
      leads:         { Row: LeadRow;         Insert: LeadInsert;         Update: LeadUpdate;         Relationships: [] };
      quotes:        { Row: QuoteRow;        Insert: QuoteInsert;        Update: QuoteUpdate;        Relationships: [] };
      invoices:      { Row: InvoiceRow;      Insert: InvoiceInsert;      Update: InvoiceUpdate;      Relationships: [] };
      subscriptions: { Row: SubscriptionRow; Insert: SubscriptionInsert; Update: SubscriptionUpdate; Relationships: [] };
      payments:           { Row: PaymentRow;           Insert: PaymentInsert;           Update: PaymentUpdate;           Relationships: [] };
      tasks:              { Row: TaskRow;              Insert: TaskInsert;              Update: TaskUpdate;              Relationships: [] };
      renewal_email_log:  { Row: RenewalEmailLogRow;   Insert: RenewalEmailLogInsert;   Update: RenewalEmailLogUpdate;   Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: {
      /**
       * Returns the Indian fiscal year label (e.g. 'FY2627') for a given date.
       * FY runs Apr 1 – Mar 31; date defaults to current_date.
       */
      indian_fiscal_year: {
        Args: { p_date?: string };
        Returns: string;
      };
      /**
       * Atomically issues the next sequential document number for the given doc_type.
       * Format: PREFIX-YYYY-YY-NNNN (e.g., 'INV-2025-26-0001'). GST-compliant.
       *
       * @example
       *   const { data: invoiceId } = await supabase.rpc('next_document_number',
       *     { p_doc_type: 'invoice' });
       */
      next_document_number: {
        Args: {
          p_doc_type:
            | "invoice"
            | "receipt_voucher"
            | "refund_voucher"
            | "credit_note"
            | "debit_note"
            | "quote";
          p_tenant_id?: string;
        };
        Returns: string;
      };
      /**
       * Owner-only escape hatch — sets a sequence's last_number directly.
       * Used during tenant onboarding when migrating from an existing
       * accounting system that already has issued document numbers.
       */
      set_document_series_start: {
        Args: {
          p_doc_type: string;
          p_fiscal_year: string;
          p_start_number: number;
          p_prefix?: string | null;
        };
        Returns: null;
      };
      /**
       * Aggregates all 'received' payments for a quote into a snapshot used
       * when generating an invoice. Returns advances jsonb + total + earliest
       * received_at — all the data needed to populate invoices.adjusted_advances,
       * net_payable, and first_advance_at columns.
       */
      compute_advance_adjustment: {
        Args: { p_quote_id: string };
        Returns: {
          advances:   InvoiceAdvanceAdjustment[];
          total_paid: number;
          first_at:   string | null;
        }[];
      };
      /**
       * Atomically records a payment against a quote. Runs as one transaction:
       * issues Receipt Voucher (if pre-invoice), inserts payment ledger row,
       * converts prospect→customer + promotes lead on first payment, creates
       * annual subscription, updates outstanding, marks invoice paid when
       * net_payable is covered. Either all writes commit or none do.
       *
       * @example
       *   const { data, error } = await supabase.rpc('record_payment', {
       *     p_quote_id: 'Q-2025-26-0042',
       *     p_amount:    50000,
       *     p_method:    'upi',
       *     p_reference: 'UPI/123456789',
       *     p_notes:     'Half payment',
       *   });
       */
      record_payment: {
        Args: {
          p_quote_id:  string;
          p_amount:    number;
          p_method:    "upi" | "razorpay" | "bank_transfer" | "cheque" | "cash" | "other";
          p_reference: string;
          p_notes?:    string | null;
        };
        Returns: {
          payment_id:           string;
          receipt_voucher_no:   string | null;
          customer_id:          string | null;
          total_received:       number;
          expected:             number;
          outstanding:          number;
          is_first_payment:     boolean;
          is_fully_paid:        boolean;
          converted_now:        boolean;
          subscription_created: boolean;
          invoice_paid:         boolean;
          has_existing_invoice: boolean;
        };
      };
    };
    Enums: {
      user_role: "owner" | "sales" | "accountant" | "support";
      vendor: "google" | "microsoft" | "zoho" | "other";
      lead_stage: "new" | "contact" | "demo" | "trial" | "quote" | "won" | "lost";
      quote_status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
      invoice_status: "draft" | "pending" | "paid" | "overdue" | "void";
      sub_status: "active" | "paused" | "expired" | "cancelled";
      payment_status: "none" | "awaiting" | "partial" | "received" | "invoiced";
      task_status: TaskStatus;
      task_kind:   TaskKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

// ============================================================
// Public type aliases
// ============================================================
export type Tenant       = TenantRow;
export type DBUser       = UserRow;
export type Customer     = CustomerRow;
export type Item         = ItemRow;
export type Lead         = LeadRow;
export type Quote        = QuoteRow;
export type Invoice      = InvoiceRow;
export type Subscription = SubscriptionRow;
export type Payment      = PaymentRow;
export type Task         = TaskRow;
