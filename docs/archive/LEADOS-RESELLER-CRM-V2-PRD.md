# LeadOS V2 — Google Workspace Reseller CRM (Complete PRD)

> **Version:** 2.0
> **Date:** 2026-05-19
> **Target user:** Google Workspace Authorized Reseller (India)
> **Stack:** Next.js 16 + Firestore + Firebase App Hosting
> **Replaces:** `LEADOS-FIREBASE-REBUILD-GUIDE.md` (V1)

---

## 0. What's New in V2 (vs V1)

V1 ek generic lead capture tool tha. V2 **end-to-end reseller business platform** hai.

| Area | V1 | V2 |
|---|---|---|
| Scope | Lead capture only | Lead → Quote → Subscription → Renewal → Invoice (full lifecycle) |
| Auth | None (`if false` rules) | Firebase Auth + RBAC (Admin/Sales/Support) |
| Customers | Missing | First-class entity with domain, GSTIN, contacts |
| Subscriptions | Missing | SKU-based, seats, billing cycle, renewal date |
| Renewals | Missing | T-90/60/30/7 day auto-alerts |
| Quotations | Missing | GST-compliant PDF generation |
| Invoicing | Missing | Recurring invoices + overdue tracking |
| Activities | Single notes field | Timeline (calls, emails, meetings, tasks) |
| Email | Mock UI | Real Gmail API integration |
| Reports | 4 number cards | MRR/ARR, churn, renewal rate, sales leaderboard |
| Search | Client-side filter | Algolia/Typesense indexed |
| File storage | None | Firebase Storage (POs, agreements, KYC) |
| MCP integration | None | Connects to existing `gw-pro` MCP |

---

## 1. Product Vision

**LeadOS V2 ek single pane of glass hai jisme reseller apna poora business chala sakta hai:**

```
Prospect ko discover karo (Vibe Prospecting MCP)
        ↓
Lead capture + qualify
        ↓
Demo + Trial (GW Reseller API se auto-provision)
        ↓
Quote bhejo (GST-compliant PDF)
        ↓
Closed-Won → Customer + Subscription auto-create
        ↓
Provision in Google Partner Portal
        ↓
Invoice generate + payment track (Razorpay)
        ↓
Renewal alerts T-90/60/30 din pehle
        ↓
Upsell / Add-ons / Retention
```

**Success metric:** Reseller V2 use karke `gw-pro`, manual spreadsheet, Gmail, aur Razorpay dashboard alag-alag kholna band kar de.

---

## 2. User Personas

| Persona | Permissions | Key screens |
|---|---|---|
| **Admin (Owner)** | Full access, billing, user management | All + Reports + Settings |
| **Sales Rep** | Apne owned leads, quotes; read-only customers | Leads, Quotes, Calendar |
| **Support/Ops** | Customers, subscriptions, invoices (no quote pricing edit) | Customers, Subscriptions, Invoices |
| **Finance** | Invoices, payments, reports | Invoices, Reports |

RBAC via custom claims on Firebase Auth user.

---

## 3. Final Tech Stack (V2)

| Layer | Tech | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | SSR + API routes |
| UI | React 19, Vanilla CSS | Glassmorphism (V1 se carry) |
| Drag-Drop | `@dnd-kit/*` | Kanban |
| **Auth** | **Firebase Auth + Custom Claims** | RBAC |
| Database | Cloud Firestore | All collections |
| Server SDK | `firebase-admin` | API routes |
| **Functions** | **Firebase Cloud Functions (2nd gen)** | Scheduled jobs (renewal alerts, invoice generation) |
| **Storage** | **Firebase Storage** | PO/agreement PDFs, KYC docs |
| **Search** | **Algolia** (or Typesense self-hosted) | Full-text search |
| **PDF** | **`@react-pdf/renderer`** | Quotation + invoice PDFs |
| **Payments** | **Razorpay** | Online payment + recurring |
| **Email** | **Gmail API** (existing MCP) | Real send + sync |
| **Calendar** | **Google Calendar API** | Two-way sync |
| **Workspace Reseller API** | Google APIs | Trial provision, license mgmt |
| Hosting | Firebase App Hosting | SSR + API |
| Source Control | GitHub | Auto-deploy |

---

## 4. Prerequisites

V1 prerequisites + ye extra:

| Cheez | Kyu chahiye |
|---|---|
| **Google Workspace Reseller account** | Already aapke paas hai |
| **GCP project linked to Reseller API access** | Trial provisioning ke liye |
| **Razorpay merchant account** | Online payments |
| **Algolia account** (free tier OK) | Full-text search |
| **WhatsApp Business API** (optional) | Indian B2B follow-ups |
| **Domain for email sender** | Transactional emails (renewal reminders) |

---

## 5. Data Model (Firestore Schema)

### 5.1 Collections Overview

```
firestore/
├── users/{uid}                    # Team members (Admin/Sales/Support/Finance)
├── leads/{leadId}                 # Prospects
├── customers/{customerId}         # Closed-won → upgraded to customer
├── subscriptions/{subId}          # Active GW subscriptions
├── quotations/{quoteId}           # Sent quotes
├── invoices/{invoiceId}           # Recurring + one-time invoices
├── payments/{paymentId}           # Razorpay transactions
├── activities/{activityId}        # Timeline: calls/emails/meetings
├── tasks/{taskId}                 # Follow-ups, action items
├── products/{productId}           # SKU catalog (GW plans + add-ons)
├── settings/global                # Company info, GSTIN, sender email
└── audit_logs/{logId}             # Who changed what, when
```

### 5.2 Detailed Schemas

#### `users/{uid}`
```ts
{
  uid: string;                    // Firebase Auth UID
  email: string;
  name: string;
  role: 'admin' | 'sales' | 'support' | 'finance';
  phone: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Timestamp;
}
```

#### `leads/{leadId}`
```ts
{
  id: string;
  // Contact
  name: string;
  company: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  designation?: string;            // CEO, IT Head, etc.

  // Qualification
  source: 'website' | 'referral' | 'cold_call' | 'social' | 'event' | 'inbound';
  utmSource?: string;
  utmCampaign?: string;
  status: 'new' | 'contacted' | 'demo_scheduled' | 'demo_done'
        | 'trial_active' | 'quote_sent' | 'negotiation'
        | 'closed_won' | 'closed_lost';
  lostReason?: string;             // If closed_lost

  // GW-specific
  currentEmailProvider?: 'gsuite' | 'o365' | 'zoho' | 'rediff' | 'other' | 'none';
  estimatedSeats?: number;
  preferredPlan?: 'starter' | 'standard' | 'plus' | 'enterprise';
  trialDomain?: string;            // If trial provisioned
  trialStartedAt?: Timestamp;
  trialExpiresAt?: Timestamp;

  // Value
  dealValue: number;               // Annual deal value INR
  probability: number;             // 0-100

  // Assignment
  ownerId: string;                 // Sales rep UID
  ownerName: string;               // Denormalized

  // Display
  initials: string;
  color: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp;
  convertedCustomerId?: string;    // FK to customers if closed_won
}
```

#### `customers/{customerId}`
```ts
{
  id: string;
  // Business identity
  legalName: string;               // As per GSTIN
  displayName: string;
  primaryDomain: string;           // acme.com
  additionalDomains?: string[];

  // Compliance (India)
  gstin?: string;                  // 22AAAAA0000A1Z5
  pan?: string;
  stateCode: string;               // For IGST/CGST/SGST decision
  isMSME?: boolean;

  // Addresses
  billingAddress: Address;
  shippingAddress?: Address;       // If different

  // Contacts (3 roles)
  primaryContact: Contact;         // Decision maker
  billingContact: Contact;
  technicalContact: Contact;

  // GW account
  gwCustomerId?: string;           // Google's customer ID (C03az79cb)
  gwAdminEmail: string;
  isResoldByUs: boolean;

  // Lifecycle
  onboardingStatus: 'pending' | 'dns_pending' | 'provisioning' | 'active' | 'churned';
  onboardingChecklist: {
    mxRecords: boolean;
    spfRecord: boolean;
    dkim: boolean;
    dmarc: boolean;
    domainVerified: boolean;
    adminTrainingDone: boolean;
    migrationDone?: boolean;       // If migrated from O365/Zoho
  };

  // Health
  healthScore?: number;            // 0-100, computed
  accountManagerId: string;        // Sales rep UID

  // Audit
  convertedFromLeadId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  churnedAt?: Timestamp;
  churnReason?: string;
}

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  stateCode: string;               // GST state code (07 = Delhi, 27 = MH, etc.)
  pincode: string;
  country: string;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  designation?: string;
}
```

#### `subscriptions/{subId}`
```ts
{
  id: string;
  customerId: string;
  customerName: string;            // Denormalized

  // SKU
  productId: string;               // FK to products
  productName: string;             // "Business Standard"
  sku: 'starter' | 'standard' | 'plus' | 'enterprise' | 'voice' | 'appsheet' | 'cloud_identity_premium';

  // Licensing
  seats: number;
  pricePerSeat: number;            // INR/month
  billingCycle: 'monthly' | 'annual' | 'flex';
  commitmentTerm: number;          // months

  // Dates
  startDate: Timestamp;
  endDate: Timestamp;              // Renewal date
  autoRenew: boolean;

  // Status
  status: 'active' | 'suspended' | 'cancelled' | 'expired';

  // Financial
  mrr: number;                     // Monthly recurring revenue
  arr: number;                     // Annualized
  commissionPercent: number;       // Reseller margin %
  netRevenue: number;              // After Google's cut

  // Linkage
  quoteId?: string;                // Origin quote
  gwSubscriptionId?: string;       // Google's internal ID

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt?: Timestamp;
}
```

#### `quotations/{quoteId}`
```ts
{
  id: string;                      // Q-2026-0042 (sequential)
  quoteNumber: string;             // Display

  // Buyer
  leadId?: string;                 // If from lead
  customerId?: string;             // If existing customer (renewal/upsell)
  buyerName: string;
  buyerEmail: string;
  buyerGSTIN?: string;

  // Line items
  lineItems: QuoteLineItem[];

  // Totals (calculated)
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;                    // 9% (intra-state)
  sgst: number;                    // 9% (intra-state)
  igst: number;                    // 18% (inter-state)
  total: number;

  // Validity
  issuedDate: Timestamp;
  validUntil: Timestamp;           // Usually +30 days
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

  // Files
  pdfUrl?: string;                 // Firebase Storage URL

  // Ownership
  createdBy: string;               // UID
  createdAt: Timestamp;
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
}

interface QuoteLineItem {
  productId: string;
  description: string;             // "Google Workspace Business Standard - Annual"
  sku: string;
  hsnCode: string;                 // 998313
  seats: number;
  pricePerSeat: number;
  durationMonths: number;
  amount: number;                  // seats × price × duration
  discountPercent: number;
}
```

#### `invoices/{invoiceId}`
```ts
{
  id: string;
  invoiceNumber: string;           // INV-2026-0001

  customerId: string;
  subscriptionId?: string;         // If recurring

  // Same line items structure as quote
  lineItems: QuoteLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;

  // Dates
  issueDate: Timestamp;
  dueDate: Timestamp;
  paidDate?: Timestamp;

  // Status
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  amountPaid: number;
  amountDue: number;

  // Payment
  paymentMode?: 'razorpay' | 'neft' | 'upi' | 'cheque' | 'cash';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  // Files
  pdfUrl?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `activities/{activityId}` — Timeline
```ts
{
  id: string;
  // Entity link (polymorphic)
  entityType: 'lead' | 'customer' | 'subscription';
  entityId: string;

  // What happened
  type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'status_change' | 'system';
  title: string;
  description?: string;

  // Outcome
  outcome?: 'positive' | 'neutral' | 'negative' | 'no_response';
  nextAction?: string;
  nextActionDate?: Timestamp;

  // Email-specific
  emailMessageId?: string;         // Gmail thread ID
  emailDirection?: 'inbound' | 'outbound';

  // Ownership
  createdBy: string;
  createdAt: Timestamp;
}
```

#### `products/{productId}` — SKU Catalog
```ts
{
  id: string;
  sku: 'starter' | 'standard' | 'plus' | 'enterprise' | 'voice' | 'appsheet' | 'cloud_identity_premium';
  name: string;
  description: string;
  category: 'workspace' | 'voice' | 'security' | 'addon';

  // Pricing (INR per user per month)
  pricing: {
    monthly: number;
    annual: number;                // Discounted
    flex: number;
  };

  // Reseller economics
  defaultCommissionPercent: number;

  // Display
  features: string[];
  hsnCode: string;
  isActive: boolean;
}
```

Seed data example:
```ts
[
  { sku: 'starter', name: 'Business Starter', pricing: { monthly: 165, annual: 136 }, ...},
  { sku: 'standard', name: 'Business Standard', pricing: { monthly: 880, annual: 736 }, ...},
  { sku: 'plus', name: 'Business Plus', pricing: { monthly: 1650, annual: 1380 }, ...},
  { sku: 'enterprise', name: 'Enterprise', pricing: { monthly: 0, annual: 0 }, ...}, // Custom
]
```

#### `tasks/{taskId}`
```ts
{
  id: string;
  entityType: 'lead' | 'customer';
  entityId: string;
  title: string;
  dueDate: Timestamp;
  assignedTo: string;              // UID
  status: 'pending' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

#### `audit_logs/{logId}`
```ts
{
  id: string;
  userId: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  changes?: Record<string, { from: any; to: any }>;
  timestamp: Timestamp;
  ip?: string;
}
```

---

## 6. Module Breakdown

### 6.1 Authentication & RBAC (P0)

**Flow:**
1. Admin invites team member via email (Firebase Auth `createUser`)
2. Custom claim set on user: `{ role: 'sales' }`
3. Client checks `auth.currentUser.getIdTokenResult()` for role
4. Server validates JWT on every API call

**Middleware** (`src/lib/auth.ts`):
```ts
import { adminAuth } from './firebase-admin';
import { NextRequest } from 'next/server';

export async function requireAuth(req: NextRequest, allowedRoles?: string[]) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  const decoded = await adminAuth.verifyIdToken(token);
  if (allowedRoles && !allowedRoles.includes(decoded.role as string)) {
    throw new Error('Forbidden');
  }
  return decoded;
}
```

**Every API route** wraps with this:
```ts
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req, ['admin', 'sales']);
    // ... business logic, use user.uid for ownerId
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
```

### 6.2 Leads Module (Updated from V1)

Changes from V1:
- Status enum expanded (10 stages)
- Owner assignment (sales rep)
- Sales rep apne leads only dekhe (Firestore query with `where('ownerId', '==', uid)`)
- "Closed Won" pe modal pop kare: "Convert to Customer?" → creates `customers/` record

**Kanban stages (V2):**
```
New | Contacted | Demo Scheduled | Demo Done | Trial Active
   | Quote Sent | Negotiation | Closed Won | Closed Lost
```

(9 columns — UI me horizontal scroll OK)

### 6.3 Customers Module (NEW)

**Route:** `/customers`

**List view:** Searchable table with columns:
- Customer name | Domain | Plan | Seats | MRR | Renewal date | Health | Owner

**Detail view (`/customers/[id]`):** Tabs:
1. **Overview** — basics, contacts, addresses
2. **Subscriptions** — active + history
3. **Quotes & Invoices**
4. **Activities** — timeline
5. **Files** — agreements, POs (Firebase Storage)
6. **Onboarding** — checklist with toggles

### 6.4 Subscriptions Module (NEW)

**Route:** `/subscriptions`

Filters: Status (active/expired), SKU, Renewal in (30/60/90 days)

**Bulk actions:**
- Send renewal reminder email
- Generate renewal quote
- Mark for follow-up

### 6.5 Renewals Module (NEW) — **Priority Feature**

**Route:** `/renewals`

3 buckets:
- **🔴 Urgent (T-30)** — call/email immediately
- **🟡 Upcoming (T-31 to T-60)**
- **🟢 Future (T-61 to T-90)**

**Scheduled Cloud Function** runs daily at 9 AM IST:
```ts
// functions/src/renewals.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const checkRenewals = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const now = new Date();
    const thresholds = [90, 60, 30, 7];

    for (const days of thresholds) {
      const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const subs = await adminDb.collection('subscriptions')
        .where('status', '==', 'active')
        .where('endDate', '>=', target)
        .where('endDate', '<', new Date(target.getTime() + 24 * 60 * 60 * 1000))
        .get();

      for (const sub of subs.docs) {
        await sendRenewalEmail(sub.data(), days);
        await createTask(sub.data(), days);
      }
    }
  }
);
```

### 6.6 Quotations Module (NEW)

**Route:** `/quotes`

**Quote builder UI:**
- Customer/Lead select (autocomplete)
- Add line items from product catalog
- Auto-calculate GST based on customer state
- Discount field
- Preview PDF → Send via email

**PDF generation** with `@react-pdf/renderer` — template includes:
- Reseller letterhead
- GSTIN, PAN
- Itemized table with HSN codes
- CGST+SGST OR IGST breakdown
- "Valid until" date
- T&Cs

**API:**
```
POST   /api/quotes              Create draft
PUT    /api/quotes/:id          Update
POST   /api/quotes/:id/send     Generate PDF + email
POST   /api/quotes/:id/accept   Mark accepted → trigger convert-to-subscription
```

### 6.7 Invoicing Module (NEW)

**Route:** `/invoices`

**Auto-generation:**
- Quote accepted → Invoice generated automatically
- Subscription billing cycle hit → recurring invoice via Cloud Function

**Razorpay integration:**
- Invoice me "Pay Now" link → Razorpay Payment Page
- Webhook updates invoice `status: 'paid'`

**Overdue Cloud Function** runs daily:
```ts
// Mark unpaid invoices past dueDate as 'overdue'
// Send reminder email at T+1, T+7, T+15, T+30
```

### 6.8 Activities Timeline (NEW)

Replace V1's single `notes` field with append-only activity log.

**Lead/Customer detail page me right sidebar:**
```
[Today]
  📞 Call with Rajesh — Discussed pricing, asked for demo
     Next action: Schedule demo Tue 3 PM
  📧 Email sent: "Re: GW pricing query"

[Yesterday]
  🤝 Meeting: Onboarding kickoff (2hr)
  📝 Note: Decision maker is CTO, not CEO

[2026-05-15]
  🔄 Status changed: New → Contacted
```

### 6.9 Gmail Integration (NEW — Real)

Replace mock email center with real Gmail API.

**Flow:**
1. Sales rep connects their Gmail (OAuth)
2. Compose in CRM → sends via Gmail API on their behalf
3. Inbox polled every 5 min — replies auto-linked to lead/customer by email match
4. Email opens/clicks tracked via pixel + redirect

**Aapke environment me Gmail MCP already hai** (`mcp__claude_ai_gmail__*`) — production me direct Gmail API use karenge.

### 6.10 Reports & Analytics (NEW)

**Route:** `/reports`

**Dashboard cards (replace V1's 4 cards):**

| Metric | Calculation |
|---|---|
| **MRR** | Σ subscription.mrr where status=active |
| **ARR** | MRR × 12 |
| **Net New MRR (this month)** | New subs MRR - Churned MRR |
| **Churn Rate (monthly)** | Churned MRR / MRR start of month |
| **Renewal Rate** | Renewed subs / Subs due in period |
| **Pipeline Value** | Σ lead.dealValue × (lead.probability/100) where status ≠ closed |
| **Sales Funnel** | Conversion % at each stage |
| **Conversion Time** | Avg days: lead created → closed_won |

**Charts:**
- MRR trend (12 months)
- Lead source breakdown (pie)
- Sales rep leaderboard (table)
- Subscriptions by SKU (bar)

### 6.11 Settings (Multi-user)

Move from `localStorage` to Firestore `settings/global`:

```ts
{
  company: {
    legalName: string;
    gstin: string;
    pan: string;
    address: Address;
    logo: string;                  // Storage URL
  };
  invoicing: {
    sequencePrefix: string;        // "INV-2026-"
    currentSequence: number;
    paymentTerms: number;          // Days
    bankDetails: { ... };
  };
  email: {
    senderName: string;
    senderEmail: string;
    signatureHtml: string;
  };
  integrations: {
    razorpayKeyId: string;
    razorpayKeySecret: string;     // Encrypted
    algoliaAppId: string;
    gwResellerCustomerId: string;
  };
}
```

Per-user prefs in `users/{uid}/preferences`.

---

## 7. Folder Structure (V2)

```
leados-crm/
├── .env.local
├── apphosting.yaml
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── functions/                          # Cloud Functions
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── renewals.ts                 # Daily renewal alerts
│       ├── invoicing.ts                # Recurring invoice generation
│       ├── overdue.ts                  # Overdue reminders
│       ├── razorpay-webhook.ts
│       └── gmail-sync.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── forgot/page.tsx
│   │   ├── (app)/                      # Auth-required group
│   │   │   ├── layout.tsx              # Sidebar + auth guard
│   │   │   ├── page.tsx                # Dashboard (was Kanban)
│   │   │   ├── leads/page.tsx          # Kanban
│   │   │   ├── leads/[id]/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── customers/[id]/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── renewals/page.tsx
│   │   │   ├── quotes/page.tsx
│   │   │   ├── quotes/[id]/page.tsx
│   │   │   ├── invoices/page.tsx
│   │   │   ├── invoices/[id]/page.tsx
│   │   │   ├── activities/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── settings/team/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── session/route.ts    # Set session cookie
│   │       ├── leads/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   └── [id]/convert/route.ts  # → customer
│   │       ├── customers/route.ts
│   │       ├── subscriptions/route.ts
│   │       ├── quotes/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   ├── [id]/send/route.ts  # PDF + email
│   │       │   └── [id]/pdf/route.ts   # Download PDF
│   │       ├── invoices/route.ts
│   │       ├── activities/route.ts
│   │       ├── reports/
│   │       │   ├── mrr/route.ts
│   │       │   └── funnel/route.ts
│   │       ├── gmail/
│   │       │   ├── send/route.ts
│   │       │   └── sync/route.ts
│   │       └── razorpay/
│   │           ├── create-order/route.ts
│   │           └── webhook/route.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── leads/LeadKanban.tsx
│   │   ├── leads/LeadCard.tsx
│   │   ├── leads/LeadModal.tsx
│   │   ├── customers/CustomerForm.tsx
│   │   ├── quotes/QuoteBuilder.tsx
│   │   ├── quotes/QuotePDF.tsx         # react-pdf component
│   │   ├── invoices/InvoicePDF.tsx
│   │   ├── activities/ActivityTimeline.tsx
│   │   └── shared/Toast.tsx
│   ├── lib/
│   │   ├── firebase-client.ts
│   │   ├── firebase-admin.ts
│   │   ├── auth.ts                     # requireAuth middleware
│   │   ├── gst.ts                      # GST calculation utils
│   │   ├── pdf.ts                      # PDF helpers
│   │   ├── gmail.ts                    # Gmail API client
│   │   ├── razorpay.ts
│   │   ├── algolia.ts
│   │   ├── audit.ts                    # Audit log writer
│   │   └── types.ts
│   └── hooks/
│       ├── useAuth.ts
│       ├── useLeads.ts
│       └── useRealtimeCollection.ts
└── public/
```

---

## 8. Firestore Security Rules (V2 — Auth-based)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }
    function role() {
      return request.auth.token.role;
    }
    function isAdmin() { return role() == 'admin'; }
    function isSales() { return role() == 'sales'; }
    function isSupport() { return role() == 'support'; }
    function isFinance() { return role() == 'finance'; }

    // Users: only admin can manage; everyone reads self
    match /users/{uid} {
      allow read: if isAuthenticated() && (request.auth.uid == uid || isAdmin());
      allow write: if isAdmin();
    }

    // Leads: sales sees own, admin sees all
    match /leads/{leadId} {
      allow read: if isAuthenticated() && (
        isAdmin() || isSupport() ||
        (isSales() && resource.data.ownerId == request.auth.uid)
      );
      allow create: if isAuthenticated() && (isAdmin() || isSales());
      allow update, delete: if isAuthenticated() && (
        isAdmin() ||
        (isSales() && resource.data.ownerId == request.auth.uid)
      );
    }

    // Customers: read for all authenticated; write for admin/support
    match /customers/{customerId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isSupport();
    }

    // Subscriptions: read all; write admin/support
    match /subscriptions/{subId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isSupport();
    }

    // Quotes: sales can create own; finance/admin all
    match /quotations/{quoteId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin() || isSales();
      allow update: if isAdmin() ||
        (isSales() && resource.data.createdBy == request.auth.uid);
    }

    // Invoices: admin + finance only
    match /invoices/{invoiceId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isFinance();
    }

    // Activities: anyone authenticated can read/write own
    match /activities/{activityId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAdmin() ||
        resource.data.createdBy == request.auth.uid;
    }

    // Products (SKU catalog): read all, write admin
    match /products/{productId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Settings: admin only
    match /settings/{doc} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Audit logs: admin read-only; system writes via Admin SDK
    match /audit_logs/{logId} {
      allow read: if isAdmin();
      allow write: if false;  // Only Admin SDK
    }
  }
}
```

---

## 9. Key Implementation Code

### 9.1 GST Calculation Utility (`src/lib/gst.ts`)

```ts
interface GSTResult {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function calculateGST(
  amount: number,
  buyerStateCode: string,
  sellerStateCode: string,
  taxRate: number = 18
): GSTResult {
  const taxableAmount = amount;
  const totalTax = (amount * taxRate) / 100;

  if (buyerStateCode === sellerStateCode) {
    // Intra-state: CGST + SGST
    return {
      taxableAmount,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      igst: 0,
      total: amount + totalTax,
    };
  } else {
    // Inter-state: IGST
    return {
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      total: amount + totalTax,
    };
  }
}

export function validateGSTIN(gstin: string): boolean {
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin);
}

export function getStateCodeFromGSTIN(gstin: string): string {
  return gstin.substring(0, 2);
}
```

### 9.2 Lead → Customer Conversion API (`src/app/api/leads/[id]/convert/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { writeAuditLog } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req, ['admin', 'sales']);
    const body = await req.json();

    const leadRef = adminDb.collection('leads').doc(params.id);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const lead = leadSnap.data()!;

    // Build customer record
    const customer = {
      legalName: body.legalName || lead.company,
      displayName: lead.company,
      primaryDomain: body.primaryDomain,
      gstin: body.gstin,
      pan: body.pan,
      stateCode: body.stateCode,
      billingAddress: body.billingAddress,
      primaryContact: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        designation: lead.designation || '',
      },
      billingContact: body.billingContact || {
        name: lead.name, email: lead.email, phone: lead.phone,
      },
      technicalContact: body.technicalContact || {
        name: lead.name, email: lead.email, phone: lead.phone,
      },
      gwAdminEmail: body.gwAdminEmail,
      isResoldByUs: true,
      onboardingStatus: 'pending',
      onboardingChecklist: {
        mxRecords: false, spfRecord: false, dkim: false,
        dmarc: false, domainVerified: false, adminTrainingDone: false,
      },
      accountManagerId: lead.ownerId,
      convertedFromLeadId: params.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Transaction: create customer + update lead
    const result = await adminDb.runTransaction(async (tx) => {
      const customerRef = adminDb.collection('customers').doc();
      tx.set(customerRef, customer);
      tx.update(leadRef, {
        status: 'closed_won',
        closedAt: FieldValue.serverTimestamp(),
        convertedCustomerId: customerRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return customerRef.id;
    });

    await writeAuditLog(user, 'create', 'customer', result, { fromLead: params.id });

    return NextResponse.json({ customerId: result });
  } catch (e: any) {
    console.error('Convert error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

### 9.3 Renewal Check Cloud Function (`functions/src/renewals.ts`)

```ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from './admin';
import { sendRenewalEmail } from './mailer';

const THRESHOLDS = [90, 60, 30, 7]; // days before expiry

export const checkRenewals = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'Asia/Kolkata',
    memory: '256MiB',
  },
  async () => {
    const now = new Date();

    for (const days of THRESHOLDS) {
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      target.setHours(0, 0, 0, 0);
      const targetEnd = new Date(target);
      targetEnd.setHours(23, 59, 59, 999);

      const subs = await adminDb
        .collection('subscriptions')
        .where('status', '==', 'active')
        .where('endDate', '>=', target)
        .where('endDate', '<=', targetEnd)
        .get();

      console.log(`T-${days} day: ${subs.size} subscriptions`);

      for (const doc of subs.docs) {
        const sub = doc.data();
        const customer = await adminDb
          .collection('customers').doc(sub.customerId).get();

        await sendRenewalEmail({
          to: customer.data()?.primaryContact.email,
          customerName: customer.data()?.displayName,
          subscriptionName: sub.productName,
          seats: sub.seats,
          endDate: sub.endDate.toDate(),
          daysRemaining: days,
        });

        // Create follow-up task
        await adminDb.collection('tasks').add({
          entityType: 'customer',
          entityId: sub.customerId,
          title: `Renewal due in ${days} days: ${sub.productName}`,
          dueDate: sub.endDate,
          assignedTo: customer.data()?.accountManagerId,
          status: 'pending',
          priority: days <= 7 ? 'urgent' : days <= 30 ? 'high' : 'medium',
          createdAt: new Date(),
        });
      }
    }
  }
);
```

### 9.4 Quotation PDF Component (`src/components/quotes/QuotePDF.tsx`)

```tsx
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Quote, Settings } from '@/lib/types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  logo: { width: 80, height: 80 },
  title: { fontSize: 24, color: '#8b5cf6', fontWeight: 700 },
  section: { marginBottom: 15 },
  row: { flexDirection: 'row' },
  table: { marginTop: 10 },
  th: { backgroundColor: '#f3f4f6', padding: 8, fontWeight: 700, fontSize: 9 },
  td: { padding: 8, borderBottom: '1pt solid #e5e7eb', fontSize: 9 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 4 },
});

export function QuotePDF({ quote, settings }: { quote: Quote; settings: Settings }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {settings.company.logo && <Image src={settings.company.logo} style={styles.logo} />}
            <Text>{settings.company.legalName}</Text>
            <Text>GSTIN: {settings.company.gstin}</Text>
            <Text>PAN: {settings.company.pan}</Text>
          </View>
          <View>
            <Text style={styles.title}>QUOTATION</Text>
            <Text>#{quote.quoteNumber}</Text>
            <Text>Date: {quote.issuedDate.toLocaleDateString('en-IN')}</Text>
            <Text>Valid Until: {quote.validUntil.toLocaleDateString('en-IN')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Bill To:</Text>
          <Text>{quote.buyerName}</Text>
          <Text>{quote.buyerEmail}</Text>
          {quote.buyerGSTIN && <Text>GSTIN: {quote.buyerGSTIN}</Text>}
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.th]}>
            <Text style={{ flex: 3 }}>Description</Text>
            <Text style={{ flex: 1 }}>HSN</Text>
            <Text style={{ flex: 1 }}>Qty</Text>
            <Text style={{ flex: 1 }}>Rate</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Amount</Text>
          </View>
          {quote.lineItems.map((item, i) => (
            <View key={i} style={[styles.row, styles.td]}>
              <Text style={{ flex: 3 }}>{item.description}</Text>
              <Text style={{ flex: 1 }}>{item.hsnCode}</Text>
              <Text style={{ flex: 1 }}>{item.seats}</Text>
              <Text style={{ flex: 1 }}>₹{item.pricePerSeat}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <View style={styles.totalRow}>
            <Text style={{ width: 100 }}>Subtotal:</Text>
            <Text style={{ width: 100, textAlign: 'right' }}>₹{quote.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          {quote.igst > 0 ? (
            <View style={styles.totalRow}>
              <Text style={{ width: 100 }}>IGST (18%):</Text>
              <Text style={{ width: 100, textAlign: 'right' }}>₹{quote.igst.toLocaleString('en-IN')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={{ width: 100 }}>CGST (9%):</Text>
                <Text style={{ width: 100, textAlign: 'right' }}>₹{quote.cgst.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={{ width: 100 }}>SGST (9%):</Text>
                <Text style={{ width: 100, textAlign: 'right' }}>₹{quote.sgst.toLocaleString('en-IN')}</Text>
              </View>
            </>
          )}
          <View style={[styles.totalRow, { borderTop: '1pt solid #000', marginTop: 4, paddingTop: 4 }]}>
            <Text style={{ width: 100, fontWeight: 700 }}>Total:</Text>
            <Text style={{ width: 100, textAlign: 'right', fontWeight: 700 }}>₹{quote.total.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={{ marginTop: 30, fontSize: 8, color: '#666' }}>
          <Text>Terms & Conditions:</Text>
          <Text>1. This quotation is valid for 30 days from the date of issue.</Text>
          <Text>2. Payment terms: {settings.invoicing.paymentTerms} days from invoice date.</Text>
          <Text>3. Subscription will be provisioned within 24 hours of payment confirmation.</Text>
        </View>
      </Page>
    </Document>
  );
}
```

### 9.5 MCP Integration with `gw-pro` (`src/lib/gw-pro.ts`)

```ts
// Sync subscription data from gw-pro MCP into LeadOS Firestore
// Run via Cloud Function or manual trigger

export async function syncFromGwPro() {
  // 1. Pull subscriptions from gw-pro
  const subs = await mcpClient.call('gw-pro', 'list_subscriptions', {});

  // 2. Pull customers
  const customers = await mcpClient.call('gw-pro', 'list_customers', {});

  // 3. Upsert into Firestore
  const batch = adminDb.batch();
  for (const sub of subs) {
    const ref = adminDb.collection('subscriptions').doc(sub.id);
    batch.set(ref, { ...sub, syncedAt: new Date() }, { merge: true });
  }
  for (const cust of customers) {
    const ref = adminDb.collection('customers').doc(cust.id);
    batch.set(ref, { ...cust, syncedAt: new Date() }, { merge: true });
  }
  await batch.commit();

  return { subscriptions: subs.length, customers: customers.length };
}
```

---

## 10. Firestore Composite Indexes (`firestore.indexes.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "leads",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "subscriptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "endDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "activities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityType", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 11. Environment Variables (V2 — Extended)

```env
# === Firebase (from V1) ===
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."

# === Razorpay ===
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# === Algolia ===
ALGOLIA_APP_ID=...
ALGOLIA_ADMIN_API_KEY=...
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=...

# === Google APIs ===
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-app.web.app/api/auth/google/callback
GW_RESELLER_CUSTOMER_ID=...        # Aapka reseller account ID

# === Email ===
SENDGRID_API_KEY=...               # OR use Gmail API for sender
EMAIL_FROM_NAME="LeadOS"
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# === WhatsApp (optional) ===
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_ID=...

# === App ===
NEXT_PUBLIC_APP_URL=https://yourapp.web.app
NEXT_PUBLIC_TIMEZONE=Asia/Kolkata
```

**Production:** All secrets in **Firebase Secret Manager**, not `apphosting.yaml` plain values.

```bash
firebase apphosting:secrets:set RAZORPAY_KEY_SECRET
firebase apphosting:secrets:grantaccess RAZORPAY_KEY_SECRET
```

---

## 12. Phased Implementation Roadmap

### Phase A — Foundation (Week 1-2) — **P0**
- [ ] Firebase project + Blaze plan
- [ ] Firebase Auth + Custom Claims (admin/sales/support/finance)
- [ ] User invite flow + login screen
- [ ] Updated Firestore Security Rules (auth-based)
- [ ] V1 Leads module + new 10 statuses + owner field
- [ ] Activity timeline (replaces notes field)
- [ ] Audit log

### Phase B — Reseller Core (Week 3-4) — **P0**
- [ ] Customers collection + CRUD
- [ ] Lead → Customer conversion flow
- [ ] Subscriptions collection + CRUD
- [ ] Products (SKU catalog) seed data
- [ ] GST calculation utility
- [ ] Onboarding checklist UI

### Phase C — Sales Operations (Week 5-6) — **P1**
- [ ] Quotation builder + line items
- [ ] Quote PDF generation
- [ ] Send quote via email
- [ ] Renewals dashboard
- [ ] Renewal alerts Cloud Function (T-90/60/30/7)
- [ ] Tasks/follow-ups module

### Phase D — Finance (Week 7-8) — **P1**
- [ ] Invoice generation (from accepted quote)
- [ ] Recurring invoice Cloud Function
- [ ] Razorpay integration (payment link + webhook)
- [ ] Overdue invoice tracking
- [ ] Invoice PDF

### Phase E — Integrations (Week 9-10) — **P2**
- [ ] Real Gmail integration (send + sync)
- [ ] Google Calendar two-way sync
- [ ] `gw-pro` MCP sync
- [ ] Algolia search index
- [ ] Firebase Storage for files

### Phase F — Analytics & Polish (Week 11-12) — **P2**
- [ ] Reports dashboard (MRR, ARR, churn, funnel)
- [ ] Sales rep leaderboard
- [ ] Bulk import CSV
- [ ] WhatsApp notification (optional)
- [ ] Customer health score

### Phase G — Optional Enhancements — **P3**
- [ ] Google Workspace Reseller API direct provisioning
- [ ] Trial auto-creation
- [ ] Customer portal (self-service)
- [ ] Mobile responsive polish
- [ ] PWA support

---

## 13. Migration Path from V1

If V1 already deployed:

1. **Backup** existing Firestore: `gcloud firestore export gs://...`
2. **Run migration script** to transform V1 leads:
   - Add `ownerId` (default = first admin)
   - Map old statuses to new enum
   - Initialize empty `activities/` for each lead from old `notes`
3. **Enable Auth** + create initial admin user
4. **Update security rules** (atomic switch)
5. **Deploy V2 code**

```ts
// scripts/migrate-v1-to-v2.ts
async function migrate() {
  const leads = await adminDb.collection('leads').get();
  const admin = await adminDb.collection('users')
    .where('role', '==', 'admin').limit(1).get();
  const adminId = admin.docs[0].id;

  for (const doc of leads.docs) {
    const data = doc.data();
    await doc.ref.update({
      ownerId: data.ownerId || adminId,
      ownerName: data.ownerName || 'Admin',
      // Status migration map
      status: mapOldStatus(data.status),
    });

    // Migrate notes → activity
    if (data.notes) {
      await adminDb.collection('activities').add({
        entityType: 'lead',
        entityId: doc.id,
        type: 'note',
        title: 'Imported note',
        description: data.notes,
        createdBy: adminId,
        createdAt: data.createdAt,
      });
    }
  }
}

function mapOldStatus(old: string) {
  return ({
    new: 'new',
    contacted: 'contacted',
    qualified: 'demo_done',     // approximation
    closed: 'closed_won',
  })[old] || 'new';
}
```

---

## 14. Cost Estimate (per month, INR)

| Service | Free Tier | Expected @ 100 customers | Cost |
|---|---|---|---|
| Firestore reads | 50k/day | 200k | ₹0 (within tier) |
| Firestore writes | 20k/day | 50k | ₹50 |
| Cloud Functions invocations | 2M/month | 50k | ₹0 |
| Cloud Functions compute | 400k GB-sec | 100k | ₹0 |
| App Hosting (Cloud Run) | Some quota | 1 instance always | ₹500 |
| Firebase Storage | 5 GB | 2 GB | ₹0 |
| Firebase Auth | Unlimited | — | ₹0 |
| Algolia | 10k records, 10k searches | 5k records, 30k searches | ₹0 free tier OR $50/mo paid |
| Razorpay | — | 2% per transaction | Pass-through |
| **Estimated total** | | | **₹500-1000/month** |

---

## 15. Troubleshooting (V2 additions)

| Issue | Fix |
|---|---|
| `Auth/custom-claim not propagating` | Force token refresh: `auth.currentUser?.getIdToken(true)` |
| GST showing wrong (IGST when CGST expected) | Check `buyerStateCode` populated in customer record |
| Renewal cron not firing | Check Cloud Scheduler in GCP Console, verify timezone |
| PDF generation slow | Use Cloud Function with 1GB memory; cache template |
| Algolia out of sync | Add Firestore extension `Index Firestore with Algolia` |
| Razorpay webhook 401 | Verify signature with `RAZORPAY_WEBHOOK_SECRET` |

---

## 16. Open Decisions (Aapse confirm chahiye)

Before starting Phase A, in points pe clarity chahiye:

1. **Pricing source of truth** — `gw-pro` me already products/pricing hai ya LeadOS me alag rakhenge?
2. **Single tenant ya multi-tenant** — sirf aapki agency use karegi ya aap apne resellers ko sell karoge?
3. **Razorpay ya alternative** — Stripe (international), Cashfree, PayU?
4. **Invoice numbering** — financial year wise reset (`INV-FY26-0001`) ya calendar year?
5. **Trial provisioning** — manual Google Admin se ya Reseller API se automatic?
6. **WhatsApp** — Phase F me build karein ya skip?
7. **Existing customer base** — kahan hai aaj (spreadsheet/Zoho/`gw-pro` me)? Migration kaha se?

---

## 17. Future Enhancements (Out of V2 Scope)

- **AI-powered lead scoring** — Vibe Prospecting MCP + Claude API
- **Auto-draft email replies** using Gmail context
- **Voice call logging** via Exotel/Knowlarity integration
- **Customer success automation** — health score → playbook triggers
- **Partner portal for sub-resellers** (if you white-label)
- **Native iOS/Android app**
- **Slack/Teams notifications**

---

## 18. Glossary

| Term | Meaning |
|---|---|
| MRR | Monthly Recurring Revenue — Σ active subscription monthly value |
| ARR | Annual Recurring Revenue — MRR × 12 |
| Churn | Customer cancellation rate |
| SKU | Stock Keeping Unit — product variant (Starter/Standard/Plus) |
| HSN | Harmonized System of Nomenclature — GST product code |
| GSTIN | GST Identification Number (15-char) |
| Reseller margin | Commission % paid by Google to authorized reseller |
| Trial | Free GW provisioning to prospect (typically 14 days) |
| POC | Proof of Concept (extended trial with specific use case) |
| MDF | Marketing Development Fund (from Google to reseller) |

---

**End of PRD V2**

Yeh document `LEADOS-FIREBASE-REBUILD-GUIDE.md` (V1) ko replace karta hai. Original V1 guide ko reference ke liye archive me rakh sakte ho, lekin implementation V2 PRD se hi follow karna chahiye.
