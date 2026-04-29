#!/usr/bin/env bash
# smoke-auth.sh — S02 autonomous proof of backend auth wiring.
#
# Starts the Express backend, waits for /health, then runs three checks:
#   1. GET /health                         → expects 200 (sanity)
#   2. GET /v1/cases (no auth header)      → expects 401 (auth middleware engages)
#   3. GET /v1/cases (bogus Bearer)        → expects 401 (JWT verification rejects)
#
# Exits 0 only if all three match. Cleans up the backend process on EXIT.
# This script is the autonomous portion of the S02 round-trip proof — the
# signed-in tap-through itself remains a documented BLOCKED step (see
# manual-verification.md, MEM007/MEM011).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="/tmp/s02-smoke-backend.log"
HEALTH_URL="http://localhost:3000/health"
CASES_URL="http://localhost:3000/v1/cases"
READY_TIMEOUT_SECONDS=15

cleanup() {
  # `npm run dev` spawns nodemon, which spawns `node server.js`. SIGTERM to npm
  # does NOT cascade, so killing only ${BACKEND_PID} leaves the grandchild
  # listening on :3000 and breaks subsequent runs (and the human-handoff
  # bg_shell backend in S02). Kill the whole process group instead.
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill -TERM -- "-${BACKEND_PID}" 2>/dev/null || kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
    # Belt + suspenders: anything still bound to :3000 that we own gets killed.
    local stray
    stray=$(lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "${stray}" ]]; then
      kill ${stray} 2>/dev/null || true
      sleep 0.5
      kill -9 ${stray} 2>/dev/null || true
    fi
  fi
}
trap cleanup EXIT INT TERM

echo "==> Smoke test starting"
echo "    backend dir: ${BACKEND_DIR}"
echo "    log file:    ${LOG_FILE}"

# Fail fast if port 3000 is already occupied — otherwise we'd be testing
# against whatever else is bound there.
if lsof -i :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "ERROR: port 3000 already in use. Run: lsof -i :3000 then kill <pid>." >&2
  exit 1
fi

echo "==> Starting backend (npm run dev) → ${LOG_FILE}"
# Enable job control so the backgrounded subshell becomes its own process-group
# leader — that's what makes `kill -- -PID` cascade to the nodemon/node
# grandchildren during cleanup.
set -m
( cd "${BACKEND_DIR}" && npm run dev ) > "${LOG_FILE}" 2>&1 &
BACKEND_PID=$!
set +m
echo "    backend PID: ${BACKEND_PID}"

echo "==> Waiting up to ${READY_TIMEOUT_SECONDS}s for ${HEALTH_URL}"
ready=0
for _ in $(seq 1 $((READY_TIMEOUT_SECONDS * 2))); do
  if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo "ERROR: backend exited before becoming ready. Tail of ${LOG_FILE}:" >&2
    tail -n 40 "${LOG_FILE}" >&2 || true
    exit 1
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}" || true)
  if [[ "${code}" == "200" ]]; then
    ready=1
    break
  fi
  sleep 0.5
done
if [[ "${ready}" -ne 1 ]]; then
  echo "ERROR: backend did not become ready within ${READY_TIMEOUT_SECONDS}s" >&2
  tail -n 40 "${LOG_FILE}" >&2 || true
  exit 1
fi
echo "    backend ready"

# --- Run the three checks ---------------------------------------------------

run_check() {
  local label="$1" expected="$2"; shift 2
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' "$@" || true)
  if [[ "${actual}" == "${expected}" ]]; then
    printf '  [PASS] %-40s expected=%s actual=%s\n' "${label}" "${expected}" "${actual}"
    return 0
  fi
  printf '  [FAIL] %-40s expected=%s actual=%s\n' "${label}" "${expected}" "${actual}"
  return 1
}

echo "==> Running checks"
fails=0
run_check "GET /health (public)"           "200" "${HEALTH_URL}" || fails=$((fails+1))
run_check "GET /v1/cases (no auth header)" "401" "${CASES_URL}"  || fails=$((fails+1))
run_check "GET /v1/cases (bogus Bearer)"   "401" -H 'Authorization: Bearer notarealjwt' "${CASES_URL}" || fails=$((fails+1))

echo
echo "==> Environment"
( cd "${BACKEND_DIR}" && node -e 'console.log("    CLERK_ISSUER_URL =", process.env.CLERK_ISSUER_URL || "(default) https://fond-mako-71.clerk.accounts.dev")' )

echo
if [[ "${fails}" -eq 0 ]]; then
  echo "==> SUCCESS: all 3 checks passed"
  exit 0
fi
echo "==> FAILURE: ${fails} check(s) failed"
exit 1
