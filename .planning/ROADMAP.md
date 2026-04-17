# Roadmap: Mortgage Guardian 2.0

## Overview

Mortgage Guardian 2.0 roadmap tracking milestones from MVP hardening through forensic document analysis and lending law compliance.

## Milestones

- ✅ [v2.0 Production Hardening](milestones/v2.0-ROADMAP.md) (Phases 1-9, 32 plans) — SHIPPED 2026-02-26
- ✅ [v3.0 Forensic Analysis Engine](milestones/v3.0-ROADMAP.md) (Phases 10-17, 42 plans) — SHIPPED 2026-03-15
- ✅ [v4.0 Bug Fix & Stability Sprint](milestones/v4.0-ROADMAP.md) (Phases 18-21, 20 plans) — SHIPPED 2026-03-30
- ✅ **v5.0 Production Readiness** (Phases 22-31, 24 plans) — SHIPPED 2026-04-07
- ✅ **v6.0 iOS App Completion** (Phases 32-40, ~35 plans) — SHIPPED 2026-04-12
- 🚧 **v7.0 Web Dashboard** — Phases 41-50 (in progress)

## Completed Milestones

<details>
<summary>v2.0 Production Hardening (Phases 1-9) — SHIPPED 2026-02-26</summary>

Transform the MVP from a working prototype into a production-ready system through comprehensive security hardening, test coverage, and maintainability improvements.

- [x] **Phase 1: Foundation & Testing Infrastructure** — 3/3 plans — 2026-02-20
- [x] **Phase 2: Authentication Layer** — 3/3 plans — 2026-02-20
- [x] **Phase 3: Input Validation Framework** — 5/5 plans — 2026-02-21
- [x] **Phase 4: Document Upload Security** — 4/4 plans — 2026-02-22
- [x] **Phase 5: Core Service Tests** — 5/5 plans — 2026-02-25
- [x] **Phase 6: Document Processing Tests** — 2/2 plans — 2026-02-25
- [x] **Phase 7: Service Refactoring** — 2/2 plans — 2026-02-25
- [x] **Phase 8: Structured Logging** — 4/4 plans — 2026-02-25
- [x] **Phase 9: Dependency Security** — 4/4 plans — 2026-02-25

**Key results:** 488 tests, 0 vulnerabilities, JWT auth on all routes, Joi validation on all endpoints, Winston logging, modular services.

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

<details>
<summary>v3.0 Forensic Analysis Engine (Phases 10-17) — SHIPPED 2026-03-15</summary>

Transform Mortgage Guardian from a production-hardened MVP into a litigation-grade forensic document analysis platform that processes mortgage files the way a large law firm would — intake, organize, analyze individually, cross-reference, and check against all applicable federal and state lending laws.

- [x] **Phase 10: Document Intake & Classification Pipeline** — 5/5 plans — 2026-02-27
- [x] **Phase 11: Isolated Secure Document Storage** — 5/5 plans — 2026-02-27
- [x] **Phase 12: Individual Document Analysis Engine** — 3/3 plans — 2026-02-28
- [x] **Phase 13: Cross-Document Forensic Analysis** — 6/6 plans — 2026-03-09
- [x] **Phase 14: Federal Lending Law Compliance Engine** — 6/6 plans — 2026-03-09
- [x] **Phase 15: State Lending Law Compliance Engine** — 8/8 plans — 2026-03-09
- [x] **Phase 16: Consolidated Findings & Reporting** — 6/6 plans — 2026-03-14
- [x] **Phase 17: Integration Testing & Pipeline Hardening** — 4/4 plans — 2026-03-15

**Key results:** Forensic document intake pipeline, per-user encrypted storage, individual + cross-document AI analysis, federal + 50-state compliance engine, consolidated reporting with RESPA dispute letters, end-to-end pipeline testing.

Full details: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)

</details>

<details>
<summary>v4.0 Bug Fix & Stability Sprint (Phases 18-21) — SHIPPED 2026-03-30</summary>

Comprehensive bug fixing across backend, frontend, and analysis pipeline to improve reliability, accuracy, and usability. Bug fixes only — no new features.

- [x] **Phase 18: Backend API Stability** — 7/7 plans — 2026-03-18
- [x] **Phase 19: Frontend UI & State Repairs** — 3/3 plans — 2026-03-18
- [x] **Phase 20: Pipeline Accuracy** — 5/5 plans — 2026-03-18
- [x] **Phase 21: Report Generation & Integration Fixes** — 5/5 plans — 2026-03-30

**Key results:** 1,275 tests across 48 suites (zero failures), OCR accuracy gating, compliance rule precision, scoring calibration, report pipeline integrity, dual-format dispute letter support, stale test fix.

</details>

<details>
<summary>v5.0 Production Readiness (Phases 22-31) — SHIPPED 2026-04-07</summary>

Get Mortgage Guardian 2.0 production-ready with codified database migrations, CI/CD automation, test coverage hardening, monitoring, security audit, and a validated deployment pipeline.

- [x] **Phase 22: Database Migration Framework** — 3/3 plans — 2026-04-02
- [x] **Phase 23: CI/CD Pipeline** — 3/3 plans — 2026-04-02
- [x] **Phase 24: Test Coverage Hardening** — 5/5 plans — 2026-04-03
- [x] **Phase 25: Environment & Secrets Management** — 2/2 plans — 2026-04-03
- [x] **Phase 26: Container & Deploy Infrastructure** — 2/2 plans — 2026-04-03
- [x] **Phase 27: Monitoring & Observability** — 2/2 plans — 2026-04-04
- [x] **Phase 28: Performance & Load Testing** — 3/3 plans — 2026-04-04
- [x] **Phase 29: Security Audit & Compliance Review** — 3/3 plans — 2026-04-06
- [x] **Phase 30: Production Deployment Dry Run** — 2/2 plans — 2026-04-07
- [x] **Phase 31: Operations Runbooks** — 2/2 plans — 2026-04-07

**Key results:** Database migration framework (Supabase CLI, baseline verified), CI/CD pipelines (backend + frontend workflows), test coverage hardening (97% statements, 85% branches, 1610+ tests), environment validation (4-tier env classification), Docker containerization (multi-stage builds, compose), monitoring (health probes, metrics, Sentry), load testing (autocannon baselines), security audit (OWASP Top 10 pass, dependency cleanup), deployment validation (scripts, rollback docs), operations runbooks (incident response, monitoring, troubleshooting).

Full details: Phases 22-31 plans in `.planning/phases/`

</details>

### v5.0 Production Readiness — SHIPPED 2026-04-07

#### Phase 22: Database Migration Framework

**Goal**: Codify Supabase schema into version-controlled migration scripts with up/down support
**Depends on**: v4.0 milestone complete
**Research**: Unlikely (Supabase patterns established in codebase)
**Plans**: 3

Plans:
- [x] 22-01: Supabase CLI Setup & Schema Capture (verify CLI setup, dump remote schema) — 2026-04-01
- [x] 22-02: Migration Organization & Rollback (baseline migration, rollback, archive old migrations) — 2026-04-01
- [x] 22-03: Completeness Verification (cross-reference code, verify clean reset) — 2026-04-02

#### Phase 23: CI/CD Pipeline

**Goal**: GitHub Actions workflows for automated testing, linting, building, and deployment
**Depends on**: Phase 22
**Research**: Level 1 — Quick verification (GitHub Actions for Node.js/Next.js is well-known)
**Plans**: 3

Plans:
- [x] 23-01: Backend CI Workflow (archive aspirational workflow, ESLint config, backend-ci.yml) — 2026-04-02
- [x] 23-02: Frontend CI Workflow (frontend-ci.yml with build + lint) — 2026-04-02
- [x] 23-03: PR Quality Gates & iOS Cleanup (branch protection docs, iOS CI fix, verify on GitHub) — 2026-04-02

#### Phase 24: Test Coverage Hardening

**Goal**: Close branch coverage gap to 90% target across all critical paths
**Depends on**: Phase 23
**Research**: Unlikely (internal testing patterns established in v2.0-v4.0)
**Plans**: 5

Plans:
- [x] 24-01: Plaid Routes Coverage (plaid-routes.test.js — 9.8% → 99.1%) — 2026-04-02
- [x] 24-02: Claude & Documents Routes Coverage (claude.js 58% → 100%, documents.js 60% → 98%) — 2026-04-02
- [x] 24-03: Compliance Services Coverage (complianceAnalysisService 63% → 99.5%, complianceRuleEngine branches 66% → 85%) — 2026-04-03
- [x] 24-04: Pipeline & Cross-Reference Coverage (documentPipelineService 85% → 90%, plaidCrossReferenceService branches 63% → 80%) — 2026-04-03
- [x] 24-05: Remaining Gaps & Global Verification (logger, financialSecurity, verify 90% global target) — 2026-04-03

#### Phase 25: Environment & Secrets Management

**Goal**: Production environment validation, secrets rotation strategy, and secure configuration management
**Depends on**: Phase 24
**Research**: Likely (secrets management tooling, rotation strategies)
**Research topics**: Secrets management approaches for Railway/Vercel, env validation libraries, rotation patterns
**Plans**: 2

Plans:
- [x] 25-01: Env Validation & Config Management (envValidator.js, .env.example files, server.js integration) — 2026-04-03
- [x] 25-02: Frontend Env Validation & Documentation (frontend env.ts, ENV-GUIDE.md) — 2026-04-03

#### Phase 26: Container & Deploy Infrastructure

**Goal**: Production Docker configurations, deployment scripts, and infrastructure automation
**Depends on**: Phase 25
**Research**: Likely (Docker production optimization, hosting platform specifics)
**Research topics**: Docker multi-stage builds for Node.js, Railway/Vercel production configs, container security scanning
**Plans**: 2

Plans:
- [x] 26-01: Production Dockerfiles (backend + frontend multi-stage builds, .dockerignore, non-root user) — 2026-04-03
- [x] 26-02: Docker Compose & Deployment Guide (local dev docker-compose, DEPLOY.md) — 2026-04-03

#### Phase 27: Monitoring & Observability

**Goal**: Enhanced health probes (live/ready), request metrics, and Sentry error tracking for backend and frontend
**Depends on**: Phase 26
**Research**: Level 0 — established Node.js/Express patterns, no new architectural decisions
**Plans**: 2

Plans:
- [x] 27-01: Enhanced Health Checks & Request Metrics (liveness/readiness probes, response time percentiles, /metrics endpoint) — 2026-04-03
- [x] 27-02: Sentry Error Tracking Integration (backend @sentry/node, frontend @sentry/nextjs, global error boundary) — 2026-04-04

#### Phase 28: Performance & Load Testing

**Goal**: Benchmarks, load tests, and bottleneck optimization to meet performance targets
**Depends on**: Phase 27
**Research**: Likely (load testing tools, benchmarking approaches)
**Research topics**: Artillery/k6 for API load testing, performance profiling Node.js, response time baseline establishment
**Plans**: 3

Plans:
- [x] 28-01: Load Testing Tooling & Health Baselines (autocannon, CLI runner, health suite) — 2026-04-04
- [x] 28-02: API & Stress Load Test Suites (unauthenticated baselines, stress ramp-up, JSON baselines) — 2026-04-04
- [x] 28-03: Memory Profiling & Performance Baseline (memory suite, /metrics memory data, PERFORMANCE-BASELINE.md) — 2026-04-04

#### Phase 29: Security Audit & Compliance Review

**Goal**: Final OWASP top-10 review, dependency audit, and security compliance verification
**Depends on**: Phase 28
**Research**: Unlikely (OWASP patterns established, security hardening done in v2.0)
**Plans**: 3

Plans:
- [x] 29-01: Dependency Cleanup & File Restoration (restore 14 corrupted files, fix 7 npm audit vulns, downgrade file-type to CJS v16) — 2026-04-06
- [x] 29-02: OWASP Code Audit & Vulnerability Fixes (404 route enumeration fix, /api-docs production restriction, OWASP Top 10 systematic audit — all categories pass) — 2026-04-06
- [x] 29-03: Security Hardening & Audit Documentation (Helmet defaults verified, CORS docs, SECURITY-AUDIT.md created) — 2026-04-06

#### Phase 30: Production Deployment Dry Run

**Goal**: Deploy to staging environment, run end-to-end smoke tests, validate full pipeline
**Depends on**: Phase 29
**Research**: Unlikely (internal deployment steps, existing infrastructure)
**Plans**: 2

Plans:
- [x] 30-01: Docker Build Validation & Deployment Tooling (build images, validation script, rollback docs) — 2026-04-06
- [x] 30-02: Local Deployment Validation & CI Verification (run validation, verify CI pipelines) — 2026-04-07

#### Phase 31: Operations Runbooks

**Goal**: Incident response procedures, deployment guides, and troubleshooting documentation
**Depends on**: Phase 30
**Research**: Unlikely (internal documentation)
**Plans**: 2

Plans:
- [x] 31-01: Incident Response Runbook & Monitoring Guide (RUNBOOK.md, MONITORING.md) — 2026-04-07
- [x] 31-02: Troubleshooting Guide & v5.0 Milestone Closure (TROUBLESHOOTING.md, README index, close v5.0) — 2026-04-07

---

### v6.0 iOS App Completion — SHIPPED 2026-04-12

**Milestone Goal:** Transform the iOS app from a sophisticated prototype with 60+ TODOs into an App Store-ready product backed by the Express API — single backend for web + mobile.

**Constraints:**
- iOS app must point at Express backend (not AWS Lambda)
- App Store ready at end of milestone — TestFlight submission at minimum
- Deployment target: iOS 17.6
- Must maintain existing test suite (26+ test files)
- Clerk authentication must work with Express backend JWT tokens
- 123 existing Swift files — build on existing architecture, don't rewrite

#### Phase 32: Express Backend API Client Migration

**Goal**: Rewrite APIClient.swift and remove AWS Lambda dependency — all iOS API calls point at Express backend
**Depends on**: v5.0 milestone complete
**Research**: Unlikely (internal patterns, rewriting existing Swift networking code)
**Plans**: 4

Plans:
- [x] 32-01: Backend URL Configuration & APIClient Consolidation (APIConfiguration.swift, rewrite APIClient with retry logic) — 2026-04-07
- [x] 32-02: Express-Compatible API Methods (APIClient+Documents.swift, APIClient+Plaid.swift with typed methods) — 2026-04-07
- [x] 32-03: Consumer Migration (DocumentManager, DocumentAnalysisService, EnhancedPlaidService → APIClient) — 2026-04-07
- [x] 32-04: AWS Cleanup & Build Verification (delete AWSBackendClient, purge AWS refs, Xcode build) — 2026-04-07

#### Phase 33: Authentication Flow Completion

**Goal**: Wire Clerk iOS SDK authentication through Express backend JWT auth — login → token → authenticated API calls
**Depends on**: Phase 32
**Research**: Level 1 — Clerk JWKS pattern confirmed, jwks-rsa library identified
**Plans**: 3

Plans:
- [x] 33-01: Clerk JWT Verification in Express Middleware (dual-provider auth: Clerk JWKS + Supabase fallback, tests) — 2026-04-07
- [x] 33-02: iOS Token Lifecycle & Session Persistence (AuthManager refresh, periodic refresh, 401 handling, app launch flow) — 2026-04-07
- [x] 33-03: LoginView Polish & Build Verification (error messages, sign-up flow, build check) — 2026-04-07

#### Phase 34: Document Upload & Processing Pipeline

**Goal**: Complete document capture → upload → OCR → AI analysis flow using Express endpoints
**Depends on**: Phase 33
**Research**: Unlikely (existing Express endpoints, internal wiring)
**Plans**: 5

Plans:
- [x] 34-01: Capture-to-Upload Pipeline (wire DocumentCaptureViewModel → APIClient upload → trigger backend pipeline) — 2026-04-07
- [x] 34-02: Backend Document List Sync (fetch documents from Express on DocumentsView appear, model bridging) — 2026-04-07
- [x] 34-03: Pipeline Status Polling & Progress UI (periodic status polling, progress indicators) — 2026-04-07
- [x] 34-04: Analysis Trigger & Results Display (wire analyze button, show findings from backend) — 2026-04-08
- [x] 34-04: Analysis Trigger & Results Display (wire analyze button, show findings from backend) — 2026-04-08
- [x] 34-05: Delete Sync & Error Handling (backend delete, consistent error UX, retry) — 2026-04-07

#### Phase 35: Analysis & Findings UI Completion

**Goal**: Fill in stubbed analysis features — date range picker, PDF/image export, chart export, evidence viewer
**Depends on**: Phase 34
**Research**: Unlikely (internal SwiftUI patterns)
**Plans**: TBD

Plans:
- [x] 35-01: Share/Export Utility & Date Range Picker (ShareUtility helper, DateRangePicker component, AuditReportView custom date range) — 2026-04-08
- [x] 35-02: Chart Export — PDF, Images, CSV (exportAsPDF, exportAsImages, exportData in ChartExportView) — 2026-04-08
- [x] 35-03: Evidence Viewer Data Wiring (SupportingDocument model, PDFKit viewer, share/export/print actions) — 2026-04-08

#### Phase 36: Plaid Bank Integration Rewiring

**Goal**: Connect iOS Plaid Link SDK to Express Plaid endpoints for bank account verification
**Depends on**: Phase 33
**Research**: Likely (Plaid Link iOS SDK → Express endpoint integration)
**Research topics**: Plaid Link iOS SDK current API, token exchange flow via Express, webhook handling
**Plans**: TBD

Plans:
- [x] 36-01: PlaidLinkService rewiring (raw URLRequest → APIClient+Plaid typed methods, deletePlaidItem) — 2026-04-08
- [x] 36-02: EnhancedPlaidService rewrite (5 nonexistent endpoints → typed APIClient calls, UNUserNotificationCenter) — 2026-04-08
- [x] 36-03: PlaidSecurityExtensions placeholders completed, build verification, Phase 36 complete — 2026-04-08

#### Phase 37: Letter Generation & Export Features

**Goal**: Complete dispute letter generation, PDF export, bulk letters, and sharing functionality
**Depends on**: Phase 35
**Research**: Unlikely (existing backend letter generation service, internal patterns)
**Plans**: TBD

Plans:
- [x] 37-01: APIClient+Reports & wire IssueLetterGeneratorView to backend — 2026-04-09
- [x] 37-02: Fix PDFGenerator bug & add PDF export for letters — 2026-04-09
- [x] 37-03: Bulk letter series generation & build verification — 2026-04-09

#### Phase 38: Settings, Account Management & Persistence

**Goal**: Complete all settings TODOs — Plaid connection, document retention, passcode, delete account, help/about, AppState persistence
**Depends on**: Phase 36
**Research**: Unlikely (internal patterns, standard iOS settings)
**Plans**: TBD

Plans:
- [x] 38-01: Plaid Connection & Mortgage Account Management (wire RealPlaidConnectionView, MortgageAccountManagementView) — 2026-04-09
- [x] 38-02: Document Retention, Data Export & Account Deletion (retention picker, JSON export, delete confirmation) — 2026-04-09
- [x] 38-03: Help/FAQ, Support Actions & App Info (HelpFAQView, StoreKit, About URLs) — 2026-04-09
- [x] 38-04: AppState Persistence & Passcode Change (DataManager wiring, iOS Settings redirect) — 2026-04-09

#### Phase 39: UI/UX Polish & App Store Assets

**Goal**: Visual refinement, navigation fixes, error/loading/empty states, app icons, screenshots, App Store metadata, accessibility
**Depends on**: Phase 38
**Research**: Likely (App Store requirements, accessibility standards)
**Research topics**: Current App Store metadata requirements, iOS accessibility audit checklist, screenshot specifications
**Plans**: TBD

Plans:
- [x] 39-01: Project Cleanup & Build Consistency (remove duplicates, fix deployment target) — 2026-04-09
- [x] 39-02: TODO Resolution & Action Wiring (DashboardView, AnalysisView, IssueDetailView) — 2026-04-09
- [x] 39-03: Accessibility Labels (112 labels across 20 files) — 2026-04-09
- [x] 39-04: Error/Loading State Polish (error display, service stubs, calculator saving) — 2026-04-09
- [x] 39-05: App Store Metadata & Visual Polish (metadata doc, consistency audit) — 2026-04-09

#### Phase 40: End-to-End Testing & TestFlight Prep

**Goal**: Full flow testing (upload → analyze → report → letter), iOS test suite completion, TestFlight build and submission
**Depends on**: Phase 39
**Research**: Likely (TestFlight submission process, CI for iOS builds)
**Research topics**: TestFlight submission requirements, Xcode Cloud or GitHub Actions for iOS CI, App Store review guidelines
**Plans**: TBD

Plans:
- [x] 40-01: Test Suite Verification & Fixes (test target registration, 47 Swift file build fixes, main target compiles) — 2026-04-11
- [x] 40-02: E2E Flow Tests & CI Enablement -- 2026-04-11
- [x] 40-03: TestFlight Archive & Submission Prep (archive verified, forgot password, checklist) — 2026-04-12

---

### 🚧 v7.0 Web Dashboard (In Progress)

**Milestone Goal:** Complete the Next.js web dashboard as the browser counterpart to the iOS app — wire existing UI components to the Express backend, add analytics visualizations, Plaid bank linking, and deploy to production.

**Constraints:**
- Frontend already has working pages: dashboard, cases, documents, analysis, reports, letters
- API client (`lib/api.ts`) and React Query hooks (`lib/hooks.ts`) already implemented
- Clerk auth already integrated
- Must work against same Express backend as iOS app
- Recharts already imported but unused — wire up for analytics
- Next.js 16 + React 19 + Tailwind v4 stack

#### Phase 41: API Proxy & End-to-End Wiring

**Goal**: Wire Next.js frontend to Express backend — API proxy routes, CORS configuration, verify all existing hooks work end-to-end with real data
**Depends on**: v6.0 milestone complete
**Research**: Likely (Next.js 16 rewrites/middleware proxy patterns)
**Research topics**: Next.js 16 API route proxying, middleware-based auth forwarding, Clerk JWT in server components
**Plans**: 1/1 complete

Plans:
- [x] 41-01: API proxy config, auth token fix, response mapping — COMPLETE 2026-04-13

#### Phase 42: Document Library & Management

**Goal**: Standalone documents page with pagination, search/filter by type and status, batch operations (delete, re-analyze), document detail view
**Depends on**: Phase 41
**Research**: Unlikely (internal patterns, existing document components)
**Plans**: TBD

Plans:
- [x] 42-01: Document list page with table, status badges, loading skeletons — COMPLETE 2026-04-12
- [x] 42-02: Document search, filter, and sort — COMPLETE 2026-04-12
- [x] 42-03: Batch selection and operations (delete, re-analyze) — COMPLETE 2026-04-12
- [x] 42-04: Document detail view with info, pipeline status, analysis results — COMPLETE 2026-04-12
- [x] 42-05: UX polish — loading/empty/error states, human verification — COMPLETE 2026-04-13

#### Phase 43: Analytics Dashboard & Visualizations

**Goal**: Recharts integration — case trend charts, risk distribution, finding severity breakdown, portfolio-level stats, confidence score histograms
**Depends on**: Phase 41
**Research**: Unlikely (Recharts already in dependencies, standard chart patterns)
**Plans**: 4

Plans:
- [x] 43-01: Analytics page scaffold, useAnalytics hook, nav link — COMPLETE 2026-04-13
- [x] 43-02: Case status pie chart, risk distribution bar chart, case trend line chart — COMPLETE 2026-04-13
- [x] 43-03: Finding severity bar chart, category breakdown, confidence histogram — COMPLETE 2026-04-14
- [x] 43-04: Portfolio stat cards, layout polish, human verification — COMPLETE 2026-04-14

#### Phase 44: Plaid Bank Integration UI

**Goal**: Bank account linking flow (Plaid Link web SDK), transaction display, cross-reference verification results, account management
**Depends on**: Phase 41
**Research**: Likely (Plaid Link web SDK, react-plaid-link integration)
**Research topics**: react-plaid-link current API, Link token flow in Next.js, transaction display patterns
**Plans**: 4

Plans:
- [x] 44-01: Plaid API methods, react-plaid-link install, usePlaidLink hook, PlaidLinkButton component — COMPLETE 2026-04-14
- [x] 44-02: Bank accounts page with linked accounts list, link/unlink, expandable detail cards — COMPLETE 2026-04-14
- [x] 44-03: Transaction list with date/amount filters, mortgage highlighting, cross-reference verification — COMPLETE 2026-04-14
- [x] 44-04: UX polish, responsive layout, accessibility, human verification — COMPLETE 2026-04-14

#### Phase 45: Real-Time Pipeline & Notifications

**Goal**: Live document processing status updates (polling or SSE), toast notifications for pipeline completion, auto-refresh on analysis ready
**Depends on**: Phase 42
**Research**: Likely (SSE vs polling trade-offs in Next.js, toast notification libraries)
**Research topics**: Server-Sent Events in Express + Next.js, sonner/react-hot-toast integration
**Plans**: 3

Plans:
- [x] 45-01: Toast infrastructure (sonner) + smart document list polling — COMPLETE 2026-04-14
- [x] 45-02: Pipeline status toast notifications on document state transitions — COMPLETE 2026-04-14
- [x] 45-03: Sidebar processing badge, query auto-invalidation, end-to-end verification — COMPLETE 2026-04-14

#### Phase 46: Advanced Search & Filtering

**Goal**: Global search across cases and documents, case status filters, date range filters, finding severity filters, saved filter presets
**Depends on**: Phase 42
**Research**: Unlikely (internal patterns, standard search/filter UI)
**Plans**: TBD

Plans:
- [x] 46-01: GlobalSearch component with Cmd+K, results dropdown, dashboard header — COMPLETE 2026-04-15
- [x] 46-02: Case filters (status, date range, sort) on dashboard page — COMPLETE 2026-04-15
- [x] 46-03: Enhanced document filters (date range, severity) + human verification — COMPLETE 2026-04-15

#### Phase 47: Settings, Profile & Account Management

**Goal**: User profile page, notification preferences, data export (cases/documents/reports), account deletion, API key management
**Depends on**: Phase 41
**Research**: Unlikely (Clerk user management, internal patterns)
**Plans**: TBD

Plans:
- [x] 47-01: Settings page with Clerk profile, notification toggles, toast gating — COMPLETE 2026-04-15
- [x] 47-02: Data export JSON download + account deletion with type-to-confirm — COMPLETE 2026-04-15
- [x] 47-03: Polish, accessibility, human verification — COMPLETE 2026-04-16

#### Phase 48: Responsive Polish & Accessibility

**Goal**: Mobile-first responsive refinement, WCAG 2.1 AA compliance, keyboard navigation, screen reader support, dark/light theme toggle
**Depends on**: Phase 47
**Research**: Unlikely (established accessibility patterns, existing dark theme)
**Plans**: TBD

Plans:
- [x] 48-01: Foundational accessibility — skip-to-content, aria-current, icon badges — COMPLETE 2026-04-16
- [x] 48-02: Responsive tables — overflow-x-auto, column visibility, keyboard nav — COMPLETE 2026-04-16
- [x] 48-03: Responsive page headers, filter bars, global search, dashboard pagination — COMPLETE 2026-04-16
- [x] 48-04: Dark/light theme toggle with next-themes, CSS variables, semantic colors — COMPLETE 2026-04-16
- [x] 48-05: ARIA live regions, form validation accessibility, final verification — COMPLETE 2026-04-17

#### Phase 49: E2E Testing & Quality Assurance

**Goal**: Playwright E2E tests for all critical flows, error boundary coverage, loading/empty state verification, cross-browser testing
**Depends on**: Phase 48
**Research**: Likely (Playwright setup with Clerk auth, Next.js testing patterns)
**Research topics**: Playwright with Clerk test tokens, Next.js E2E testing best practices
**Plans**: 5

Plans:
- [x] 49-01: Playwright setup, Clerk test auth, CI config — COMPLETE 2026-04-17
- [x] 49-02: Auth + Dashboard + Navigation E2E tests — COMPLETE 2026-04-17
- [ ] 49-03: Case CRUD + Document management E2E tests
- [ ] 49-04: Analytics + Bank accounts + Settings E2E tests
- [ ] 49-05: Search + Theme + Error states + Cross-browser verification

#### Phase 50: Production Build & Deployment

**Goal**: Vercel production deployment, SEO optimization, performance tuning (Core Web Vitals), monitoring verification, go-live checklist
**Depends on**: Phase 49
**Research**: Likely (Vercel deployment config for Next.js 16, SEO for SPA-like dashboard)
**Research topics**: Vercel project configuration, Next.js 16 production optimizations, Sentry source maps on Vercel
**Plans**: TBD

Plans:
- [ ] 50-01: TBD

---

### v4.0 Bug Fix & Stability Sprint — SHIPPED 2026-03-30

**Milestone Goal:** Comprehensive bug fixing across backend, frontend, and analysis pipeline to improve reliability, accuracy, and usability. Bug fixes only — no new features.

#### Phase 18: Backend API Stability

**Goal**: Debug and fix Express API endpoint failures, optimize slow responses, fix connection drops, timeouts, and resource exhaustion issues
**Depends on**: v3.0 milestone complete
**Research**: Unlikely (internal patterns, existing Express/Node stack)
**Plans**: 7

Plans:
- [x] 18-01: Server Lifecycle & Process Stability (graceful shutdown, uncaught exception handlers)
- [x] 18-02: CORS & Webhook Security (CORS credentials fix, webhook signature enforcement)
- [x] 18-03: Webhook Handler Bug Fixes (transaction .success field bug, handler return values)
- [x] 18-04: Document Route Security & Correctness (user ID isolation fix, HTTP status codes)
- [x] 18-05: Memory Leak Prevention (pipeline state cleanup, mock Map cleanup)
- [x] 18-06: Startup Validation & Config (env var validation, Vercel handler fix)
- [x] 18-07: Request Tracing (request ID middleware, logger propagation)

#### Phase 19: Frontend UI & State Repairs

**Goal**: Fix broken Next.js build, environment security vulnerabilities, layout/visual bugs, and replace boilerplate scaffolding with proper Mortgage Guardian branding
**Depends on**: Phase 18
**Research**: Unlikely (internal patterns, existing Next.js/React stack)
**Plans**: 3

Plans:
- [x] 19-01: Fix Build Failure & Dependencies (lodash.curry/PostCSS crash)
- [x] 19-02: Environment Security & Configuration (secrets removal, API rewrites)
- [x] 19-03: Layout, Metadata & Page Fixes (branding, CSS, boilerplate replacement)

#### Phase 20: Pipeline Accuracy

**Goal**: Tune document classification accuracy, fix OCR text extraction failures, refine federal and state compliance rules to reduce false positive violation flagging and incorrect statutory citations
**Depends on**: Phase 19
**Research**: Likely (OCR accuracy benchmarking, compliance rule false positive analysis, classification threshold tuning)
**Research topics**: OCR accuracy metrics and tuning approaches, compliance rule precision/recall analysis, document classification confidence thresholds
**Plans**: 5

Plans:
- [x] 20-01: OCR Text Extraction Fixes (threshold + dynamic confidence scoring)
- [x] 20-02: Classification Confidence Gating (threshold filter + hint handling)
- [x] 20-03: Compliance Rule Matching Precision (word boundaries + field patterns)
- [x] 20-04: Scoring & Deduplication Fixes (dedup preservation + penalty calibration)
- [x] 20-05: Risk Threshold Calibration (thresholds + classification→scoring pipeline)

#### Phase 21: Report Generation & Integration Fixes

**Goal**: Fix incorrect report aggregation, missing findings, formatting issues in consolidated reports, and cross-system verification to ensure end-to-end data integrity
**Depends on**: Phase 20
**Research**: Unlikely (internal aggregation patterns, existing report pipeline)
**Plans**: 5

Plans:
- [x] 21-01: Confidence Score Schema & Classification Pipeline (null layer fix + classificationConfidence wiring)
- [x] 21-02: Dispute Letter Schema & Field Alignment (content/recipientInfo schema fix + dual-format field reads)
- [x] 21-03: Report Assembly Finding Preservation (anomaly details in documentAnalysis + count consistency check)
- [x] 21-04: End-to-End Integrity Tests (report pipeline tests + letter-from-stored-report tests)
- [x] 21-05: Milestone Verification & Completion (full test suite + v4.0 milestone closure)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Testing Infrastructure | v2.0 | 3/3 | Complete | 2026-02-20 |
| 2. Authentication Layer | v2.0 | 3/3 | Complete | 2026-02-20 |
| 3. Input Validation Framework | v2.0 | 5/5 | Complete | 2026-02-21 |
| 4. Document Upload Security | v2.0 | 4/4 | Complete | 2026-02-22 |
| 5. Core Service Tests | v2.0 | 5/5 | Complete | 2026-02-25 |
| 6. Document Processing Tests | v2.0 | 2/2 | Complete | 2026-02-25 |
| 7. Service Refactoring | v2.0 | 2/2 | Complete | 2026-02-25 |
| 8. Structured Logging | v2.0 | 4/4 | Complete | 2026-02-25 |
| 9. Dependency Security | v2.0 | 4/4 | Complete | 2026-02-25 |
| 10. Document Intake & Classification Pipeline | v3.0 | 5/5 | Complete | 2026-02-27 |
| 11. Isolated Secure Document Storage | v3.0 | 5/5 | Complete | 2026-02-27 |
| 12. Individual Document Analysis Engine | v3.0 | 3/3 | Complete | 2026-02-28 |
| 13. Cross-Document Forensic Analysis | v3.0 | 6/6 | Complete | 2026-03-09 |
| 14. Federal Lending Law Compliance Engine | v3.0 | 6/6 | Complete | 2026-03-09 |
| 15. State Lending Law Compliance Engine | v3.0 | 8/8 | Complete | 2026-03-09 |
| 16. Consolidated Findings & Reporting | v3.0 | 6/6 | Complete | 2026-03-14 |
| 17. Integration Testing & Pipeline Hardening | v3.0 | 4/4 | Complete | 2026-03-15 |
| 18. Backend API Stability | v4.0 | 7/7 | Complete | 2026-03-18 |
| 19. Frontend UI & State Repairs | v4.0 | 3/3 | Complete | 2026-03-18 |
| 20. Pipeline Accuracy | v4.0 | 5/5 | Complete | 2026-03-18 |
| 21. Report Generation & Integration Fixes | v4.0 | 5/5 | Complete | 2026-03-30 |
| 22. Database Migration Framework | v5.0 | 3/3 | Complete | 2026-04-02 |
| 23. CI/CD Pipeline | v5.0 | 3/3 | Complete | 2026-04-02 |
| 24. Test Coverage Hardening | v5.0 | 5/5 | Complete | 2026-04-03 |
| 25. Environment & Secrets Management | v5.0 | 2/2 | Complete | 2026-04-03 |
| 26. Container & Deploy Infrastructure | v5.0 | 2/2 | Complete | 2026-04-03 |
| 27. Monitoring & Observability | v5.0 | 2/2 | Complete | 2026-04-04 |
| 28. Performance & Load Testing | v5.0 | 3/3 | Complete | 2026-04-04 |
| 29. Security Audit & Compliance Review | v5.0 | 3/3 | Complete | 2026-04-06 |
| 30. Production Deployment Dry Run | v5.0 | 2/2 | Complete | 2026-04-07 |
| 31. Operations Runbooks | v5.0 | 2/2 | Complete | 2026-04-07 |

| 32. Express Backend API Client Migration | v6.0 | 4/4 | Complete | 2026-04-07 |
| 33. Authentication Flow Completion | v6.0 | 3/3 | Complete | 2026-04-07 |
| 34. Document Upload & Processing Pipeline | v6.0 | 5/5 | Complete | 2026-04-08 |
| 35. Analysis & Findings UI Completion | v6.0 | 3/3 | Complete | 2026-04-08 |
| 36. Plaid Bank Integration Rewiring | v6.0 | 3/3 | Complete | 2026-04-08 |
| 37. Letter Generation & Export Features | v6.0 | 3/3 | Complete | 2026-04-09 |
| 38. Settings, Account Management & Persistence | v6.0 | 4/4 | Complete | 2026-04-09 |
| 39. UI/UX Polish & App Store Assets | v6.0 | 5/5 | Complete | 2026-04-09 |
| 40. End-to-End Testing & TestFlight Prep | v6.0 | 3/3 | Complete | 2026-04-12 |
| 41. API Proxy & End-to-End Wiring | v7.0 | 1/1 | Complete | 2026-04-13 |
| 42. Document Library & Management | v7.0 | 5/5 | Complete | 2026-04-13 |
| 43. Analytics Dashboard & Visualizations | v7.0 | 4/4 | Complete | 2026-04-14 |
| 44. Plaid Bank Integration UI | v7.0 | 4/4 | Complete | 2026-04-14 |
| 45. Real-Time Pipeline & Notifications | v7.0 | 3/3 | Complete | 2026-04-14 |
| 46. Advanced Search & Filtering | v7.0 | 3/3 | Complete | 2026-04-15 |
| 47. Settings, Profile & Account Management | v7.0 | 3/3 | Complete | 2026-04-16 |
| 48. Responsive Polish & Accessibility | v7.0 | 5/5 | Complete | 2026-04-17 |
| 49. E2E Testing & Quality Assurance | v7.0 | 1/5 | In progress | - |
| 50. Production Build & Deployment | v7.0 | 0/? | Not started | - |

**Total Plans:** 32 plans across 9 phases (v2.0) — ALL COMPLETE | 42 plans across 8 phases (v3.0) — ALL COMPLETE | 20 plans across 4 phases (v4.0) — ALL COMPLETE | 24 plans across 10 phases (v5.0) — ALL COMPLETE | ~35 plans across 9 phases (v6.0) — ALL COMPLETE | v7.0 in progress (10 phases)
