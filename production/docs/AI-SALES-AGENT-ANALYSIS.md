# AI Sales-Agent Concepts — Fit Analysis for ResellerOS

_Analysis date: 29 Jul 2026. Verified against the codebase (3 exploration passes over `production/src`)._

## Why this doc exists
A PRD was shared for an **autonomous AI sales/lead agent** (Clay / Lockene style):
website → ICP generation, lead enrichment + scoring, smart multi-step cadence, autonomous
execution with LLM function-calling, on a Python / FastAPI / LangChain / CrewAI stack.

The question was **not** "build this separate product" — it was: _does this improve ResellerOS,
from a results (revenue / conversion) point of view, and what should we adopt?_

---

## Verdict: not now — it won't move the numbers at current scale

ResellerOS today has a handful of active deals. AI lead-scoring and sales "agents" only start
paying off at **100+ leads**, where a human can't eyeball priority. At the current pipeline size
this is **premature** — it would add surface area without adding revenue.

The two real results levers are elsewhere:

1. **Finish the money-spine so customers can actually pay** — Razorpay live payments + GST
   e-invoice (IRP). These are the P0 launch blockers. This is the single biggest lever.
2. **Chase the inbound leads already sitting in the pipeline.** (Improved on 29 Jul 2026 by adding
   the full quote-action-bar — Record payment / Mark accepted / Mark rejected — directly into the
   lead drawer for "Quote Sent" deals.)

The PRD's **outbound cold-prospecting motion isn't even how this business gets leads** — leads
arrive via enquiry forms, WhatsApp, and referrals (inbound). Cold-emailing scraped LinkedIn/email
lists is low-ROI and risky in India (poor data quality, DLT/spam rules, deliverability).

**The one AI piece worth doing at any scale — and it is ~80% already built:** surface a
"next best action + 1-tap AI follow-up draft" on the leads list / Kanban. It reuses
`components/shared/ai-draft-button.tsx` and the `NextBestActionCard` in
`components/features/customers/customer-insights.tsx`. Small effort, useful even with today's
pipeline. Everything heavier is deferred.

---

## What ResellerOS ALREADY has (do NOT rebuild)
- **Kanban deal pipeline**, drag-drop stages `quote → demo → trial → won` — `app/(app)/leads/page.tsx`
- **Real WhatsApp** (Meta Cloud API), **email** (Resend), **bulk campaigns** — `lib/whatsapp`, `lib/email`, `campaigns`
- **Inbound email → lead** with Gemini triage/extract — `api/webhooks/inbound-email/route.ts`
- **Gemini drafting**: follow-ups, campaign copy, bill-OCR vision — `api/ai/*`, `lib/ai/gemini.ts` (`resolveGeminiConfig`), `tenant_secrets`
- **Timed cadence engine (renewals only)** + daily cron — `lib/renewals/cadence.ts`, `api/cron/renewals`
- **Activity log** (`lib/queries/lead-activities`), **dup-detect + merge**, **tasks/follow-ups**, `GeminiCard` UI shell
- **Rule-based lead heat** (`lib/leads/heat.ts`) + `leads.priority` + `leads.follow_up_date`

## The 4 PRD modules → native mapping (for later)
| PRD module | In ResellerOS today | Recommendation |
|---|---|---|
| 1. Website → ICP profiling | Absent | **Adopt (light):** per-lead enrichment from domain + GSTIN → Gemini business summary + suggested product/seats; a per-tenant ICP definition to feed scoring. |
| 2. Lead enrichment + scoring | Rule-based `heat.ts` only; no persisted score | **Adopt:** persist `ai_score` + `icp_fit` on `leads`; deterministic signals (deal value, stage, engagement recency) + light Gemini; surface on the Kanban. |
| 3. Smart cadence / sequences | Only renewal cadence; lead follow-ups are manual one-offs (`tasks`) | **Adopt — biggest differentiator:** generalize the renewal engine into a lead-nurture sequence engine (`sequences` + `sequence_steps` + `lead_enrollments` + cron). |
| 4. Autonomous execution / function-calling | Absent (all AI assistive, human-in-loop) | **Adapt, don't adopt fully:** "supervised autonomy" — AI proposes + drafts the next touch, human approves 1-tap. Money-writes / outbound-sends NEVER auto. |

## If/when we build (impact vs effort order)
- **Phase A — Lead scoring + ICP enrichment.** Cheap, compounding, reuses existing plumbing. High daily value once lead volume grows.
- **Phase B — Lead cadence / sequence engine.** The real differentiation. New schema + cron modeled on `api/cron/renewals`; each step **drafts + queues for approval**, not auto-send. Med–high effort.
- **Phase C — Supervised-autonomy copilot.** Guardrailed Gemini function-calling limited to safe tools; every outbound/money action requires confirm. Only after A/B prove out.

## Explicitly advised AGAINST (for now)
- Full autonomous send / auto money-writes — violates the money-correctness compass.
- Rebuilding in Python / FastAPI / LangChain / CrewAI — fragments a working Next.js + Supabase + Gemini stack for no payoff.
- Cold-outbound scraping of LinkedIn/emails as a priority — low ROI + India deliverability/DLT risk.

## Guardrails for any future AI work here
Ship behind the existing **Gemini-or-stub `mode`** pattern; any money-touching path gets a
rolled-back RPC test; `npm run typecheck` clean; verify on `localhost:3000` before deploy; new
tables get `tenant_id` + RLS + deny-by-default RPC grants via a numbered migration in
`supabase/migrations/`.
