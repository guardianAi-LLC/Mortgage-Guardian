#!/usr/bin/env bash
# scripts/doctor.sh — Mortgage Guardian dev-environment health check
#
# Checks five mandatory conditions (contribute to exit code) and two WARN-only
# conditions (informational only). Runs ALL checks even when one fails, then
# prints a final summary.
#
# Exit codes:
#   0 — all FAIL-tier checks passed
#   N — N FAIL-tier check(s) failed
#
# Override examples for synthetic injection testing:
#   PLAID_CLIENT_ID=placeholder make doctor   # inject bad Plaid creds
#   CLERK_ISSUER_URL=https://bad.example.com make doctor

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────────
pass()  { printf "${GREEN}  [PASS]${NC} %s\n" "$*"; }
fail()  { printf "${RED}  [FAIL]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}  [WARN]${NC} %s\n" "$*"; }
header(){ printf "\n${YELLOW}▶ %s${NC}\n" "$*"; }

# Accumulate FAIL-tier failures; WARN tier never modifies this counter.
fails=0

# ── Locate backend .env ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/backend-express/.env"

# Helper: read a KEY=value pair from the .env file without sourcing it.
# Returns the raw value (may be empty). Does NOT execute shell expressions.
read_env() {
  local key="$1"
  if [[ -f "${ENV_FILE}" ]]; then
    grep "^${key}=" "${ENV_FILE}" | head -1 | cut -d= -f2-
  fi
}

# Helper: get effective value — env var takes precedence over .env file.
get_val() {
  local key="$1"
  # Use indirect expansion for env var lookup
  local envval="${!key:-}"
  if [[ -n "${envval}" ]]; then
    echo "${envval}"
  else
    read_env "${key}"
  fi
}

# ── Header ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Mortgage Guardian — Doctor Health Check           ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ── Check 1: Node version ≥ 20 ───────────────────────────────────────────────
header "Check 1/5 — Node.js version ≥ 20"
if command -v node >/dev/null 2>&1; then
  NODE_VER_RAW="$(node -v)"
  NODE_MAJOR="${NODE_VER_RAW#v}"
  NODE_MAJOR="${NODE_MAJOR%%.*}"
  if [[ "${NODE_MAJOR}" -ge 20 ]]; then
    pass "Node ${NODE_VER_RAW} (major=${NODE_MAJOR})"
  else
    fail "Node ${NODE_VER_RAW} — need ≥ v20. Install via: nvm install 20 && nvm use 20"
    fails=$((fails + 1))
  fi
else
  fail "node not found in PATH — install from https://nodejs.org or via nvm"
  fails=$((fails + 1))
fi

# ── Check 2: Required backend env vars ───────────────────────────────────────
header "Check 2/5 — Required backend env vars (backend-express/.env)"
if [[ ! -f "${ENV_FILE}" ]]; then
  fail ".env file not found at ${ENV_FILE}"
  fail "  → cp backend-express/.env.example backend-express/.env then fill in real values"
  fail "  → See: docs/runbook-dev-setup.md"
  fails=$((fails + 1))
else
  # SUPABASE_URL — must start with https://
  # Uses get_val() so env-var override works for synthetic injection testing:
  #   SUPABASE_URL=not-a-valid-url make doctor
  SUPABASE_URL_VAL="$(get_val SUPABASE_URL)"
  if [[ "${SUPABASE_URL_VAL}" == https://* ]]; then
    pass "SUPABASE_URL starts with https://"
  else
    fail "SUPABASE_URL is missing or does not start with https:// (got: '${SUPABASE_URL_VAL:-<empty>}')"
    fail "  → See: .env.example and docs/runbook-dev-setup.md"
    fails=$((fails + 1))
  fi

  # SUPABASE_ANON_KEY — must be non-empty
  SUPABASE_ANON_KEY_VAL="$(get_val SUPABASE_ANON_KEY)"
  if [[ -n "${SUPABASE_ANON_KEY_VAL}" ]]; then
    pass "SUPABASE_ANON_KEY is set"
  else
    fail "SUPABASE_ANON_KEY is empty"
    fail "  → See: .env.example and docs/runbook-dev-setup.md"
    fails=$((fails + 1))
  fi

  # SUPABASE_SERVICE_KEY — must be non-empty
  SUPABASE_SERVICE_KEY_VAL="$(get_val SUPABASE_SERVICE_KEY)"
  if [[ -n "${SUPABASE_SERVICE_KEY_VAL}" ]]; then
    pass "SUPABASE_SERVICE_KEY is set"
  else
    fail "SUPABASE_SERVICE_KEY is empty"
    fail "  → See: .env.example and docs/runbook-dev-setup.md"
    fails=$((fails + 1))
  fi

  # DOCUMENT_ENCRYPTION_KEY — must be exactly 64 hex chars
  # Uses get_val() so env-var override works for synthetic injection testing:
  #   DOCUMENT_ENCRYPTION_KEY=tooshort make doctor
  ENCRYPTION_KEY_VAL="$(get_val DOCUMENT_ENCRYPTION_KEY)"
  if [[ "${ENCRYPTION_KEY_VAL}" =~ ^[0-9a-fA-F]{64}$ ]]; then
    pass "DOCUMENT_ENCRYPTION_KEY is a valid 64-char hex string"
  else
    if [[ -z "${ENCRYPTION_KEY_VAL}" ]]; then
      fail "DOCUMENT_ENCRYPTION_KEY is empty — generate with: openssl rand -hex 32"
    else
      fail "DOCUMENT_ENCRYPTION_KEY is not a valid 64-char hex string (length: ${#ENCRYPTION_KEY_VAL})"
      fail "  → Generate with: openssl rand -hex 32"
    fi
    fail "  → See: .env.example and docs/runbook-dev-setup.md"
    fails=$((fails + 1))
  fi
fi

# ── Check 3: Plaid env vars ───────────────────────────────────────────────────
header "Check 3/5 — Plaid env vars (non-empty, non-placeholder)"
PLAID_CLIENT_ID_VAL="$(get_val PLAID_CLIENT_ID)"
PLAID_SECRET_VAL="$(get_val PLAID_SECRET)"
PLAID_ENV_VAL="$(get_val PLAID_ENV)"

plaid_ok=1

if [[ -z "${PLAID_CLIENT_ID_VAL}" ]]; then
  fail "PLAID_CLIENT_ID is empty"
  plaid_ok=0
elif [[ "${PLAID_CLIENT_ID_VAL}" =~ ^your[-_]plaid ]]; then
  fail "PLAID_CLIENT_ID looks like a placeholder: '${PLAID_CLIENT_ID_VAL}'"
  plaid_ok=0
else
  pass "PLAID_CLIENT_ID is set and non-placeholder"
fi

if [[ -z "${PLAID_SECRET_VAL}" ]]; then
  fail "PLAID_SECRET is empty"
  plaid_ok=0
elif [[ "${PLAID_SECRET_VAL}" =~ ^your[-_]plaid ]]; then
  fail "PLAID_SECRET looks like a placeholder: '${PLAID_SECRET_VAL}'"
  plaid_ok=0
else
  pass "PLAID_SECRET is set and non-placeholder"
fi

if [[ "${PLAID_ENV_VAL}" =~ ^(sandbox|development|production)$ ]]; then
  pass "PLAID_ENV=${PLAID_ENV_VAL}"
else
  fail "PLAID_ENV must be sandbox|development|production (got: '${PLAID_ENV_VAL:-<empty>}')"
  plaid_ok=0
fi

if [[ "${plaid_ok}" -eq 0 ]]; then
  fails=$((fails + 1))
  printf "  ${RED}→${NC} Get Plaid credentials from: https://dashboard.plaid.com/team/keys\n"
  printf "  ${RED}→${NC} See: docs/runbook-dev-setup.md\n"
fi

# ── Check 4: Clerk JWKS endpoint reachable ────────────────────────────────────
header "Check 4/5 — Clerk JWKS endpoint reachable"
CLERK_DEFAULT="https://fond-mako-71.clerk.accounts.dev"
CLERK_URL="${CLERK_ISSUER_URL:-${CLERK_DEFAULT}}"
JWKS_URL="${CLERK_URL}/.well-known/jwks.json"

if command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl --max-time 5 --silent --output /dev/null --write-out '%{http_code}' "${JWKS_URL}" 2>/dev/null; true)"
  if [[ "${HTTP_CODE}" == "200" ]]; then
    pass "Clerk JWKS reachable: ${JWKS_URL} → ${HTTP_CODE}"
  else
    fail "Clerk JWKS returned HTTP ${HTTP_CODE} for ${JWKS_URL}"
    fail "  → Check CLERK_ISSUER_URL in backend-express/.env"
    fail "  → Default: ${CLERK_DEFAULT}"
    fails=$((fails + 1))
  fi
else
  fail "curl not found — cannot check Clerk JWKS endpoint"
  fails=$((fails + 1))
fi

# ── Check 5: CoreSimulator daemon + simctl responsiveness ────────────────────
header "Check 5/5 — CoreSimulator daemon + simctl responsiveness"

# Get CoreSimulatorService PID via launchctl
CSS_LINE="$(launchctl list 2>/dev/null | grep CoreSimulatorService | head -1 || true)"
CSS_PID=""
if [[ -n "${CSS_LINE}" ]]; then
  CSS_PID="$(echo "${CSS_LINE}" | awk '{print $1}')"
  # launchctl list shows "-" for the PID when service is registered but not running
  if [[ "${CSS_PID}" == "-" ]]; then
    CSS_PID=""
  fi
fi

if [[ -z "${CSS_PID}" ]]; then
  warn "CoreSimulatorService has no PID (daemon will auto-start on demand — OK)"
else
  # Compute daemon age using macOS date parsing
  LSTART="$(ps -p "${CSS_PID}" -o lstart= 2>/dev/null | xargs || true)"
  if [[ -n "${LSTART}" ]]; then
    START_TS="$(date -j -f "%a %b %d %T %Y" "${LSTART}" "+%s" 2>/dev/null || true)"
    NOW_TS="$(date +%s)"
    if [[ -n "${START_TS}" && -n "${NOW_TS}" ]]; then
      AGE_SECS=$(( NOW_TS - START_TS ))
      AGE_HOURS=$(( AGE_SECS / 3600 ))
      if [[ "${AGE_HOURS}" -ge 72 ]]; then
        fail "CoreSimulatorService PID ${CSS_PID} is ${AGE_HOURS}h old (≥72h) — restart recommended"
        fail "  → See: docs/runbook-simulator-reset.md"
        fails=$((fails + 1))
      elif [[ "${AGE_HOURS}" -ge 48 ]]; then
        warn "CoreSimulatorService PID ${CSS_PID} is ${AGE_HOURS}h old (≥48h) — consider restarting soon"
        warn "  → See: docs/runbook-simulator-reset.md"
      else
        pass "CoreSimulatorService PID ${CSS_PID} is ${AGE_HOURS}h old (healthy)"
      fi
    else
      warn "Could not parse CoreSimulatorService start time from: '${LSTART}'"
    fi
  else
    warn "Could not determine CoreSimulatorService start time (ps returned empty)"
  fi
fi

# Check simctl responsiveness via node (macOS has no `timeout` command)
if command -v node >/dev/null 2>&1 && command -v xcrun >/dev/null 2>&1; then
  SIMCTL_RESULT="$(node -e "
const {spawnSync} = require('child_process');
const r = spawnSync('xcrun', ['simctl', 'list', 'runtimes'], {timeout: 10000});
if (r.status === null) { console.log('TIMEOUT'); process.exit(1); }
process.exit(0);
" 2>/dev/null && echo "OK" || echo "TIMEOUT")"

  if [[ "${SIMCTL_RESULT}" == "OK" ]]; then
    pass "xcrun simctl list runtimes responded within 10s"
  else
    fail "xcrun simctl list runtimes timed out or failed — CoreSimulator wedge suspected"
    fail "  → See: docs/runbook-simulator-reset.md for the 5-minute recovery procedure"
    fails=$((fails + 1))
  fi
elif ! command -v xcrun >/dev/null 2>&1; then
  warn "xcrun not found — Xcode not installed or xcode-select not configured"
  warn "  → Install Xcode from the App Store, then: sudo xcode-select --switch /Applications/Xcode.app"
else
  warn "node not found — skipping simctl responsiveness check"
fi

# ── Check 6 (WARN only): Backend reachability ───────────────────────────────
header "Check 6 — Backend reachability (WARN only — not required to be running)"
if command -v curl >/dev/null 2>&1; then
  BACKEND_CODE="$(curl --max-time 3 --silent --output /dev/null --write-out '%{http_code}' http://localhost:3000/health 2>/dev/null; true)"
  if [[ "${BACKEND_CODE}" == "200" ]]; then
    pass "backend running on :3000 (GET /health → 200)"
  else
    warn "backend is not running — start with: cd backend-express && npm run dev"
  fi
fi

# ── Bonus WARNs ──────────────────────────────────────────────────────────────
header "Bonus checks (WARN only)"

# Duplicate iOS runtimes
if command -v xcrun >/dev/null 2>&1; then
  DUP_COUNT="$(xcrun simctl list runtimes 2>/dev/null | grep -c 'iOS 26' || true)"
  if [[ "${DUP_COUNT}" -ge 2 ]]; then
    warn "Found ${DUP_COUNT} iOS 26 runtimes — duplicates waste disk space"
    warn "  → xcrun simctl runtime list   # identify duplicates"
    warn "  → xcrun simctl runtime delete <uuid>   # remove old copy"
  else
    pass "No duplicate iOS runtimes detected (count: ${DUP_COUNT})"
  fi

  # Xcode availability
  if xcode-select -p >/dev/null 2>&1; then
    XCODE_PATH="$(xcode-select -p 2>/dev/null)"
    pass "Xcode developer tools at: ${XCODE_PATH}"
  else
    warn "xcode-select -p failed — Xcode Command Line Tools may not be installed"
    warn "  → xcode-select --install"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
if [[ "${fails}" -eq 0 ]]; then
  printf "${GREEN}  ALL CHECKS PASSED${NC}\n"
  echo "══════════════════════════════════════════════════════════════"
  exit 0
else
  printf "${RED}  ${fails} check(s) FAILED${NC}\n"
  echo "══════════════════════════════════════════════════════════════"
  exit "${fails}"
fi
