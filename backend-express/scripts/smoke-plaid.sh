#!/usr/bin/env bash
# smoke-plaid.sh — S03/T04 autonomous proof of the full Plaid sandbox round-trip.
#
# Starts `npm run dev`, waits for /health=200, runs the supertest-based round-trip
# test (plaid-sandbox-roundtrip.test.js), and tears down on exit. Together with
# T01's smoke-plaid-startup.sh (which proves the backend boots with real Plaid
# creds), this is the cheapest "did we break Plaid?" answer.
#
# Cleanup follows MEM017/MEM022: `set -m` so the backgrounded subshell is its
# own pgroup leader, then `kill -- -PID` cascades to nodemon/node grandchildren,
# with `lsof :3000 | xargs kill` as belt-and-suspenders.
#
# Exits 0 only if /health=200 was reached AND the integration test passed.
# The integration test itself is the contract verifier — see
# backend-express/__tests__/integration/plaid-sandbox-roundtrip.test.js.
#
# Note: the integration test ALSO works without a running backend (supertest
# spins up its own express app instance). This wrapper additionally proves the
# server starts, binds :3000, and serves /health, providing belt-and-suspenders
# coverage of the runtime path that the unit-style test doesn't exercise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="/tmp/s03-backend.log"
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

echo "==> Plaid round-trip smoke starting"
echo "    backend dir: ${BACKEND_DIR}"
echo "    log file:    ${LOG_FILE}"

# Refuse to start if :3000 is already taken.
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

# --- Run the round-trip integration test ------------------------------------

echo "==> Running plaid-sandbox-roundtrip.test.js"
echo
test_status=0
( cd "${BACKEND_DIR}" && npx jest --testPathPattern=plaid-sandbox-roundtrip --runInBand ) || test_status=$?

echo
if [[ "${test_status}" -eq 0 ]]; then
  echo "==> SUCCESS: round-trip test passed"
  exit 0
fi
echo "==> FAILURE: round-trip test exited with status ${test_status}"
exit "${test_status}"
