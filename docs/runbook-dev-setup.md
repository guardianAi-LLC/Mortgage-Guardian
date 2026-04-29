# Developer Setup Runbook

**Goal:** Clone the repo and reach the S01–S04 demo state (authenticated iOS app + mortgage audit pipeline) in under 15 minutes.

---

## Time Estimate

| Phase | Estimated Time |
|-------|---------------|
| Clone + env setup | ~2 min |
| `npm install` + backend start | ~1–2 min |
| `xcodebuild` (first run — SPM + full compile) | ~4–6 min |
| Human iOS tap-through | ~3–5 min |
| **Total** | **~10–15 min** |

The xcodebuild step dominates. SPM package resolution + full iOS compile on a cold DerivedData cache takes 4–6 minutes. Subsequent builds (incremental) are much faster.

---

## Prerequisites

- **macOS** with **Xcode 26.4.x** installed (26.4.1 recommended)
  - Verify: `xcode-select -p` should point to a valid Xcode.app
  - Command-line tools: `xcode-select --install` (if not already installed)
- **Node.js ≥ 20**: `node -v` should print `v20.x.x` or higher
- **Git**: `git --version`

---

## Step 1 — Clone the repository

```bash
git clone <repo-url> Mortgage-Guardian-2.0-Clean
cd Mortgage-Guardian-2.0-Clean
```

---

## Step 2 — Configure backend secrets

Copy the environment template:

```bash
cp backend-express/.env.example backend-express/.env
```

Then fill in the secrets. See `ENV-GUIDE.md` for where to obtain each key.

### Required secrets

| Variable | Source | Notes |
|----------|--------|-------|
| `SUPABASE_URL` | [Supabase Dashboard](https://app.supabase.com) → Project Settings → API | Starts with `https://` |
| `SUPABASE_ANON_KEY` | Same page, "anon public" key | |
| `SUPABASE_SERVICE_KEY` | Same page, "service_role" key | Keep secret — bypasses RLS |
| `DOCUMENT_ENCRYPTION_KEY` | Generate locally | 64 hex chars: `openssl rand -hex 32` |
| `PLAID_CLIENT_ID` | [Plaid Dashboard](https://dashboard.plaid.com/team/keys) | |
| `PLAID_SECRET` | Same page | Use sandbox secret for dev |
| `PLAID_ENV` | Set to `sandbox` | Use `sandbox` for all local development |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Starts with `sk-ant-` |

**Already set in `.env.example` — no change needed:**
- `CLERK_ISSUER_URL=https://fond-mako-71.clerk.accounts.dev` — already correct
- `NODE_ENV=development`, `PORT=3000` — already correct

### In an AI-agent session

If you are running inside an AI coding agent (pi, Claude Code, etc.), use `secure_env_collect` instead of manually editing `.env`. This avoids exposing secret values in shell history or tool output:

```
# In an agent prompt:
"Please collect the backend secrets using secure_env_collect"
```

The agent will prompt you for each value through a masked input UI and write them directly to `backend-express/.env`.

### iOS publishable key — no action needed

The Clerk publishable key (`pk_test_Zm9uZC1tYWtvLTcxLmNsZXJrLmFjY291bnRzLmRldiQ`) is **hardcoded** in `MortgageGuardian/MortgageGuardianApp.swift`. No iOS-side secret setup is required.

---

## Step 3 — Install backend dependencies

```bash
cd backend-express && npm install
cd ..
```

---

## Step 4 — Run the health check

```bash
make doctor
```

Expected output: **all green, exit code 0**. This verifies:
- Node ≥ 20 is installed
- All required backend env vars are set and have valid formats
- Plaid credentials are present and non-placeholder
- Clerk JWKS endpoint is reachable (HTTP 200)
- CoreSimulator daemon is healthy (not stale/wedged)

**If `make doctor` exits non-zero:** Read the FAIL lines — each one names the specific problem and tells you what to fix. Common issues:

| Error | Fix |
|-------|-----|
| SUPABASE_URL not set | Fill `backend-express/.env` — Step 2 |
| DOCUMENT_ENCRYPTION_KEY invalid | Run `openssl rand -hex 32` and paste the result |
| Plaid vars missing/placeholder | Fill from Plaid Dashboard — Step 2 |
| Clerk JWKS unreachable | Check internet connection; verify `CLERK_ISSUER_URL` in `.env` |
| CoreSimulator FAIL (simctl timeout) | See `docs/runbook-simulator-reset.md` |

---

## Step 5 — Start the backend

```bash
cd backend-express && npm run dev
```

Look for this line in the output:

```
Express server running on port 3000
```

Leave this terminal running. Open a new terminal tab for the next steps.

---

## Step 6 — Verify the backend (new terminal)

From the repo root:

```bash
bash backend-express/scripts/smoke-auth.sh
```

Expected: all checks PASS, exit 0. This verifies the auth middleware, JWT validation against the Clerk JWKS endpoint, and basic routing.

```bash
bash backend-express/scripts/smoke-audit.sh
```

Expected: audit pipeline round-trip completes (requires `PLAID_CLIENT_ID` and `PLAID_SECRET` to be set; skips Plaid cross-reference if `HAS_REAL_PLAID` is not set).

---

## Step 7 — Build and install the iOS app

### 7a. Boot a simulator (if none is booted)

```bash
# Check if anything is booted
xcrun simctl list devices | grep Booted

# If nothing is booted, boot the target device
xcrun simctl boot "iPhone 17 Pro"
```

### 7b. Build

```bash
xcodebuild \
  -project MortgageGuardian.xcodeproj \
  -scheme MortgageGuardian \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build
```

This is the slow step (~4–6 min on first run). Watch for `** BUILD SUCCEEDED **` at the end.

### 7c. Install

```bash
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/MortgageGuardian-*/Build/Products/Debug-iphonesimulator/MortgageGuardian.app
```

### 7d. Launch

```bash
xcrun simctl launch booted com.nickgarrison.mortgageguardian
```

The app should appear in the simulator. If the launch hangs for more than 2 minutes → see `docs/runbook-simulator-reset.md`.

---

## Step 8 — iOS tap-through (human-required)

The iOS simulator tap-through cannot be automated (see MEM007/MEM011 — `xcrun simctl` has no `tap`/`type` subcommands; Simulator AppleScript requires macOS Accessibility permission not available to agent terminals).

**Follow the numbered 5-minute tap-through in:**
```
.gsd/milestones/M001/slices/S04/manual-verification.md  →  Section B
```

That section walks through:
1. Sign up / sign in with Clerk authentication
2. Connect a bank account via Plaid Link (sandbox)
3. Upload a mortgage statement (use `backend-express/tests/fixtures/statement.txt` or any PDF)
4. Verify the audit findings screen shows detected anomalies with bank evidence

**Demo state reached** when you can see audit results rendered in the iOS app with Plaid cross-reference evidence.

---

## Troubleshooting

### `make doctor` fails

Read the specific FAIL message — each check prints what is wrong and what to do. If CoreSimulator is flagged, follow `docs/runbook-simulator-reset.md`.

### `npm install` fails

```bash
node -v   # must be ≥20
npm -v    # must be ≥8
```

If Node is too old: install/switch via `nvm install 22 && nvm use 22`.

### Backend won't start (`EADDRINUSE` on port 3000)

```bash
lsof -i :3000 -t | xargs kill -9 2>/dev/null; true
```

### `xcodebuild` fails

- **SPM resolution error:** Check internet connectivity; SPM downloads packages from GitHub.
- **Missing SDK:** `xcode-select -p` must point to Xcode.app (not just command-line tools).
- **Code signing:** The `Debug` configuration uses automatic signing; Xcode's "Trust" dialog may appear on first run.

### Launch hangs or exits with Mach error -308

Follow `docs/runbook-simulator-reset.md` — CoreSimulator daemon is wedged and needs a SIGKILL + respawn cycle.

### Plaid Link does not appear / shows error

Verify `PLAID_ENV=sandbox` in `backend-express/.env`. In sandbox mode, use [Plaid's test credentials](https://plaid.com/docs/sandbox/test-credentials/): username `user_good`, password `pass_good`, institution any.

---

## Related

- `ENV-GUIDE.md` — complete environment variable reference with field descriptions
- `docs/runbook-simulator-reset.md` — CoreSimulator wedge recovery (< 5 min)
- `.gsd/milestones/M001/slices/S04/manual-verification.md` — iOS tap-through procedure (Section B)
- `make doctor` — run this before every build session to catch problems early
- `RUNBOOK.md` — production incident response (separate from this dev setup guide)
