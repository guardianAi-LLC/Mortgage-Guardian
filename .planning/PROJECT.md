# Mortgage Guardian 2.0

## What This Is

Mortgage Guardian 2.0 is a multi-platform mortgage servicing audit platform — iOS app, Next.js web dashboard, and Express backend — that uses AI-powered document analysis (Claude AI) to detect errors in mortgage loan servicing, cross-references with bank data via Plaid, and generates RESPA-compliant dispute letters. Features forensic document analysis with federal + 50-state compliance engines, litigation-grade reporting, 6 analytics visualizations, real-time pipeline notifications, and production deployments on Vercel (web) with Sentry monitoring.

## Core Value

The platform must reliably and securely analyze mortgage documents to detect servicing errors with high confidence, cross-verify against actual bank transaction data, and protect sensitive financial information throughout the process.

## Requirements

### Validated

<!-- Shipped functionality confirmed working -->

- ✓ Claude AI document analysis integration — Document error detection with confidence scoring — existing
- ✓ Plaid banking integration — Bank account verification and transaction data retrieval — existing
- ✓ Document upload and storage — MinIO (local) and Supabase Storage (production) — existing
- ✓ Express REST API with versioned endpoints — `/v1/` API structure with route handlers — existing
- ✓ Next.js frontend — React 19 with Clerk authentication and Tailwind CSS — existing
- ✓ Supabase PostgreSQL database — With migrations for schema management — existing
- ✓ Redis caching and rate limiting — Rate limiter (100 req/15min) and caching infrastructure — existing
- ✓ Multi-platform architecture — Decoupled Express backend + Next.js frontend + iOS app — existing
- ✓ Security headers and CORS — Helmet.js and configurable CORS middleware — existing
- ✓ Document processing pipeline — Upload, OCR/text extraction, AI analysis workflow — existing
- ✓ JWT authentication enforcement — Dual-provider auth (Clerk JWKS + Supabase fallback) on all `/v1/` routes — v2.0, v6.0
- ✓ Critical path test coverage — 1,610+ backend tests, 76 Playwright E2E tests — v2.0, v5.0, v7.0
- ✓ Input validation framework — Joi schemas at all 13 API boundaries — v2.0
- ✓ File upload security — Magic number validation, filename sanitization, size limits — v2.0
- ✓ Service layer refactoring — Domain-focused modules — v2.0
- ✓ Structured logging — Winston with child logger pattern — v2.0
- ✓ Forensic document analysis — Intake pipeline, per-user encrypted storage, cross-document analysis — v3.0
- ✓ Federal + 50-state compliance engine — RESPA, TILA, ECOA, HMDA, all states — v3.0
- ✓ Consolidated reporting — Litigation-grade findings, RESPA dispute letters (NOE/QWR) — v3.0
- ✓ Bug fix & stability — OCR accuracy gating, compliance rule precision, scoring calibration — v4.0
- ✓ Database migration framework — Supabase CLI, baseline verified (9 tables, 29 RLS policies) — v5.0
- ✓ CI/CD pipelines — GitHub Actions for backend + frontend — v5.0
- ✓ 97% test coverage — 1,610+ tests, 85% branch coverage — v5.0
- ✓ Docker containerization — Multi-stage builds, compose, non-root user — v5.0
- ✓ Monitoring & observability — Health probes, metrics, Sentry error tracking — v5.0
- ✓ Security audit — OWASP Top 10 pass, dependency audit, Helmet hardening — v5.0
- ✓ Operations runbooks — Incident response, monitoring, troubleshooting guides — v5.0
- ✓ iOS app completion — AWS removal, Clerk auth, document pipeline, Plaid, letter generation, TestFlight prep — v6.0
- ✓ Web dashboard document management — Paginated list, search/filter, batch operations, detail view — v7.0
- ✓ Analytics dashboard — 6 Recharts visualizations, portfolio stats — v7.0
- ✓ Web Plaid bank integration — react-plaid-link, transaction display, cross-reference verification — v7.0
- ✓ Real-time pipeline notifications — Sonner toasts, smart polling, processing badge — v7.0
- ✓ Global search — Cmd+K shortcut, cross-entity search, keyboard navigation — v7.0
- ✓ WCAG 2.1 AA accessibility — Skip navigation, ARIA live regions, responsive layouts — v7.0
- ✓ Dark/light theme — next-themes with CSS variables — v7.0
- ✓ E2E test suite — 76 Playwright tests across 10 spec files — v7.0
- ✓ Production deployment — Vercel (frontend-guardianai-llc.vercel.app), SEO, Sentry source maps — v7.0

### Active

<!-- Next milestone scope -->

(None yet — plan next milestone)

### Out of Scope

<!-- Explicit boundaries -->

- Server-side pagination — Client-side filtering with 500-doc limit works for current scale
- Plaid access token server-side storage — Currently localStorage, acceptable for MVP
- Mobile-native web app (PWA) — Web dashboard is responsive but not a PWA
- Offline mode — Real-time backend connectivity is core assumption
- Video chat / real-time collaboration — Out of scope for audit platform

## Context

**Current State (post v7.0 Web Dashboard):**
- 1,610+ backend tests (97% statement coverage, 85% branches), 76 Playwright E2E tests
- 1,653,542 LOC total codebase (Swift + TypeScript + JavaScript)
- Three platforms: iOS app (TestFlight-ready), Next.js web dashboard (Vercel), Express backend
- Dual-provider auth: Clerk JWKS + Supabase fallback
- Forensic analysis: document intake, classification, cross-document analysis, federal + 50-state compliance
- Web dashboard: document management, analytics (6 charts), Plaid bank linking, global search, dark/light theme
- Production: Vercel (frontend-guardianai-llc.vercel.app), Sentry monitoring, SEO optimized

**Technical Environment:**
- Node.js 20+ backend with Express 4.22.1
- Next.js 15 with React 19, Tailwind CSS v4, Clerk auth
- Supabase PostgreSQL (SSR integration), Redis for caching
- Anthropic Claude AI (SDK v0.78) and Plaid (v41) integrations
- Vercel (frontend), Railway-ready (backend)
- Jest 29.x (backend), Playwright (frontend E2E)
- iOS: Swift/SwiftUI, deployment target 17.6

**Accepted Technical Debt:**
- Express 5.x deferred (0 vulns on 4.22.1, breaking changes not justified)
- file-type v16.x (ESM-only from v17+, CJS project constraint)
- Malware scanning stub only (scanFileContent() placeholder)
- --legacy-peer-deps for React 19 (react-plaid-link, @clerk/testing)
- Client-side document filtering with 500-doc limit (server-side pagination needed at scale)
- Plaid access tokens in localStorage (should migrate to server-side secure storage)

## Constraints

- **No breaking changes**: Existing iOS app and frontend must continue working during incremental rollout
- **Full flexibility otherwise**: No timeline pressure, tech stack locked, or deployment constraints

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| JWT authentication for all /v1/ routes | Supabase Auth already integrated, standard bearer token pattern | ✓ Good — dual-provider (Clerk+Supabase) |
| Jest as test framework | Industry standard, excellent TypeScript support | ✓ Good — 1,610+ tests |
| Joi for input validation | Declarative schema approach | ✓ Good — 13 schemas |
| Winston structured logging | Production-grade, serverless-compatible | ✓ Good |
| Service refactoring by domain | Focused domain modules | ✓ Good |
| Express 5.x deferred | 0 vulnerabilities on 4.22.1 | ⚠️ Revisit when Express 5 stabilizes |
| file-type v16 kept | ESM-only from v17+, CJS project | ⚠️ Revisit if project migrates to ESM |
| Malware scanning deferred | Serverless incompatible with ClamAV | ⚠️ Revisit at scale |
| Clerk JWKS + Supabase dual auth | iOS uses Clerk, web can use either | ✓ Good — seamless cross-platform |
| Next.js API rewrites for Express proxy | Avoids separate CORS domain | ✓ Good — clean frontend/backend separation |
| Client-side filtering (500-doc limit) | Simpler implementation for MVP scale | ⚠️ Revisit at scale |
| react-plaid-link with localStorage tokens | Quick integration, React 19 compat with --legacy-peer-deps | ⚠️ Migrate to server-side storage |
| sonner for toast notifications | Lightweight, dark theme support | ✓ Good |
| next-themes for dark/light toggle | CSS variables approach, clean implementation | ✓ Good |
| Playwright for E2E (not Cypress) | Better Next.js integration, @clerk/testing support | ✓ Good — 76 tests |
| Supabase SSR integration | Server-side auth for Vercel deployment | ✓ Good |
| Dynamic imports for Recharts/Plaid | Bundle size optimization | ✓ Good |
| Vercel for frontend deployment | Optimal Next.js hosting | ✓ Good — frontend-guardianai-llc.vercel.app |

---
*Last updated: 2026-04-20 after v7.0 milestone*
