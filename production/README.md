# ResellerOS — Production

The complete operating system for Indian cloud resellers.

**Status:** Week 1 — Foundation. Component library + design system + scaffolding done. Auth + DB + screens coming.

---

## 🚀 Quick start (operator setup)

### One-time setup (~10 minutes)

```bash
# 1. Make sure Node.js 20+ is installed
node --version    # should be v20.x or higher
# If not: download from https://nodejs.org/ (LTS version)

# 2. Navigate to the production folder
cd production/

# 3. Install dependencies (first time only, ~3-5 min)
npm install

# 4. Create your local environment file
cp .env.example .env.local
# Open .env.local in any text editor and fill in real values
# For Week 1, only NEXT_PUBLIC_APP_URL is required (others come later)
```

### Daily workflow

```bash
# Start the dev server (auto-reloads on changes)
npm run dev
# → opens http://localhost:3000
# → component showcase at http://localhost:3000/dev/components
```

That's it. Make changes to files in `src/`, save, browser auto-refreshes.

### Before pushing code

```bash
npm run lint        # check code style
npm run typecheck   # check TypeScript types
npm run test        # run unit tests
# All three pass? Commit + push.
```

---

## 📂 What's in this folder

```
production/
├── CLAUDE.md             # Project memory for Claude Code (READ THIS)
├── README.md             # You are here
├── package.json          # Dependencies
├── tailwind.config.ts    # Design tokens
├── next.config.mjs       # Next.js config
├── tsconfig.json         # TypeScript strict config
├── components.json       # shadcn/ui config
├── .env.example          # Environment template (copy to .env.local)
├── src/
│   ├── app/              # Next.js pages (App Router)
│   │   ├── globals.css   # Design tokens (HSL CSS variables)
│   │   ├── layout.tsx    # Root layout (fonts, metadata)
│   │   ├── page.tsx      # Landing page
│   │   └── dev/
│   │       └── components/page.tsx  # Visual showcase
│   ├── components/
│   │   └── ui/           # Production components (Button, Card, Badge, Icon)
│   └── lib/
│       ├── utils.ts      # cn(), rupee(), formatDate, etc.
│       └── types.ts      # Shared TypeScript types
└── public/               # Static assets (images, icons)
```

---

## ✅ What's already built (Week 1, Day 1)

| Component | Status | File |
|---|---|---|
| **Project scaffolding** | ✅ | `package.json`, configs |
| **Design tokens** | ✅ | `src/app/globals.css` |
| **Tailwind config** | ✅ | `tailwind.config.ts` |
| **Type system** | ✅ | `tsconfig.json` (strict) |
| **Utility library** | ✅ | `src/lib/utils.ts` |
| **Type definitions** | ✅ | `src/lib/types.ts` |
| **Button** | ✅ | `src/components/ui/button.tsx` |
| **Card** | ✅ | `src/components/ui/card.tsx` |
| **Badge** | ✅ | `src/components/ui/badge.tsx` |
| **Icon** | ✅ | `src/components/ui/icon.tsx` |
| **Showcase page** | ✅ | `/dev/components` |

---

## 📅 What's coming (Week 1, rest of week)

| Component | Status |
|---|---|
| Skeleton (loading placeholder) | Pending |
| EmptyState | Pending |
| GeminiCard (AI suggestion) | Pending |
| ActivityTimeline | Pending |
| Input, Select, Textarea | Pending |
| KPI tile | Pending |
| Avatar | Pending |
| Tabs | Pending |
| Toast (sonner integration) | Pending |
| CommandPalette (cmdk) | Pending |
| NotificationPanel | Pending |

---

## 🔧 Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Server components, fast, Vercel-native |
| Language | TypeScript strict | Type safety, no `any` |
| Styling | Tailwind CSS | Fast iteration, consistent design |
| Components | shadcn/ui base + custom | Accessible, copy-paste ownership |
| Database | Supabase (Postgres) | Multi-tenant with RLS, realtime |
| Auth | Supabase Auth | Email + Google OAuth |
| State (server) | TanStack Query v5 | Caching, optimistic updates |
| State (forms) | React Hook Form + Zod | Type-safe forms |
| Charts | Recharts | Production-grade charting |
| Animation | Framer Motion | Micro-interactions |
| i18n | next-intl | Hindi + English support |
| Email | Resend | Transactional emails |
| Payments | Razorpay | India payment gateway |
| Hosting | Vercel | Auto preview deploys |
| Monitoring | Sentry + Plausible | Errors + analytics |
| Testing | Vitest + Playwright | Unit + E2E |

---

## 🧠 Working with Claude Code

This project is designed for AI-assisted development. Claude Code reads `CLAUDE.md` automatically and follows conventions.

### Recommended workflow

1. **Open Claude Code** in this directory (`production/`)
2. **Give a specific task**: *"Port the Lead Pipeline screen from `../prototype/screens/leads.jsx` to `src/app/(app)/leads/page.tsx`. Use Supabase + TanStack Query."*
3. **Claude generates code** following all conventions
4. **You test locally**: `npm run dev`
5. **You commit + push**: Vercel auto-deploys preview
6. **Repeat**

### Tips for best Claude Code results

- **Be specific**: "Port screen X" → better than "do some frontend work"
- **Reference prototype**: Claude reads `../prototype/` for UX reference
- **Show, don't tell**: Paste error messages, screenshots, file paths
- **Iterate small**: One component or page at a time, not 10
- **Always review**: AI generates drafts; you own the merge button
- **Update CLAUDE.md**: When a new convention emerges, add it

---

## 🆘 Troubleshooting

| Problem | Solution |
|---|---|
| `npm install` fails | Make sure Node.js 20+, try `npm cache clean --force` then retry |
| `Cannot find module '@/...'` | Restart TS server in VS Code: Cmd+Shift+P → "Restart TS Server" |
| Tailwind classes not working | Restart dev server (`Ctrl+C` then `npm run dev`) |
| Dark mode looks broken | We haven't built dark theme polish yet — coming in Phase 4 |
| Type errors | Run `npm run typecheck` — fix all errors before committing |

---

## 📚 Learn the stack (recommended reading)

If new to any of these (~half a day each):
- [Next.js App Router docs](https://nextjs.org/docs/app)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase docs](https://supabase.com/docs)

---

## 📞 Project contacts

| Question | Owner |
|---|---|
| Architecture / security | Tech Lead (P1) |
| Backend integrations | P3 |
| Tests / deployment | P4 |
| Product / business | Pardeep |
| AI usage best practices | `CLAUDE.md` in this folder |

---

## 📜 License

Proprietary. © 2026 Excel Technologies Pvt Ltd. All rights reserved.
