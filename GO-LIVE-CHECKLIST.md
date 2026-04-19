# Go-Live Checklist

Production launch checklist for Mortgage Guardian 2.0 Web Dashboard.

## Pre-Launch

- [ ] All E2E tests pass (Phase 49 Playwright suite)
- [ ] Frontend builds without errors (`cd frontend && npm run build`)
- [ ] Backend builds without errors (`cd backend-express && npm start`)
- [ ] Environment variables configured (Clerk, Supabase, Plaid, Anthropic)
- [ ] Sentry DSN configured (optional -- enables error tracking)
- [ ] CORS origins updated for production domain
- [ ] Clerk production keys (not development keys -- `pk_live_`/`sk_live_` prefix)
- [ ] Supabase RLS policies verified (9 tables, 29 policies)
- [ ] SSL/TLS active on all endpoints

## Deployment

- [ ] Backend deployed (Railway or Vercel)
- [ ] Frontend deployed (Vercel)
- [ ] API proxy verified (frontend rewrites route to backend)
- [ ] Health endpoints responding (`/health/live`, `/health/ready`)
- [ ] Database migrations applied (Supabase baseline + any pending)

## Post-Launch

- [ ] Sign in works end-to-end (Clerk auth flow)
- [ ] Document upload and analysis works
- [ ] Case creation and management works
- [ ] Analytics dashboard loads with charts
- [ ] Plaid bank linking works (if enabled)
- [ ] Error tracking captures test error (verify in Sentry dashboard)
- [ ] Performance: pages load in under 3 seconds

## Rollback Plan

If critical issues are found post-launch:

1. **Vercel frontend**: Promote previous deployment to production via Vercel dashboard (Deployments > three-dot menu > Promote to Production)
2. **Backend**: Redeploy previous successful deployment from Railway/Vercel dashboard
3. **Database**: Supabase point-in-time recovery if schema changes caused issues

Full rollback procedures documented in [DEPLOY.md](./DEPLOY.md#rollback-procedures).
