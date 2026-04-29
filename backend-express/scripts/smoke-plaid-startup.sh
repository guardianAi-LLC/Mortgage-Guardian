#!/usr/bin/env bash
# smoke-plaid-startup.sh — S03/T01 autonomous proof that the backend uses
# the real Plaid SDK, not MockPlaidService.
#
# Starts `npm run dev`, waits up to 15s for /health=200, then asserts:
#   1. The startup log contains "Using real Plaid API"
#   2. The startup log does NOT contain "Using mock Plaid service"
#
# Cleanup follows MEM017/MEM022: `set -m` so the backgrounded subshell is its
# own pgroup leader, then `kill -- -PID` cascades to nodemon/node grandchildren,
# with `lsof :3000 | xargs kill` as a belt-and-suspenders pass.
#
# Exits 0 only if both assertions hold and /health=200. The plaidService.js:30/43
# log lines are the verification surface — drift here means a future agent has
# silently fallen back to mocks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="/tmp/s03-plaid-startup.log"
HEALTH_URL="http://localhost:3000/health"
READY_TIMEOUT_SECONDS=15

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill -TERM -- "-${BACKEND_PID}" 2>/dev/null || kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
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

echo "==> Plaid startup smoke starting"
echo "    backend dir: ${BACKEND_DIR}"
echo "    log file:    ${LOG_FILE}"

# Refuse to start if :3000 is already taken — otherwise we'd be reading some
# other process's log and the assertion would be meaningless.
if lsof -i :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "ERROR: port 3000 already in use. Run: lsof -i :3000 then kill <pid>." >&2
  exit 1
fi

echo "==> Starting backend (npm run dev) → ${LOG_FILE}"
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
echo "    backend ready (/health=200)"

# --- Assertions --------------------------------------------------------------

fails=0

if grep -q 'Using real Plaid API' "${LOG_FILE}"; then
  echo "  [PASS] startup log contains 'Using real Plaid API'"
else
  echo "  [FAIL] startup log MISSING 'Using real Plaid API' (PLAID_CLIENT_ID/PLAID_SECRET likely absent)"
  fails=$((fails+1))
fi

if grep -q 'Using mock Plaid service' "${LOG_FILE}"; then
  echo "  [FAIL] startup log contains 'Using mock Plaid service' — backend silently fell back to mocks"
  fails=$((fails+1))
else
  echo "  [PASS] startup log does NOT contain 'Using mock Plaid service'"
fi

# Bonus: surface the relevant log line for the human reading the script output.
echo
echo "==> Plaid log lines from ${LOG_FILE}:"
grep -E 'Plaid' "${LOG_FILE}" | head -10 || true

echo
if [[ "${fails}" -eq 0 ]]; then
  echo "==> SUCCESS: backend started with real Plaid SDK"
  exit 0
fi
echo "==> FAILURE: ${fails} assertion(s) failed"
exit 1
