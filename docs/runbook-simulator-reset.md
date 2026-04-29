# CoreSimulator Wedge Recovery Runbook

**Time to resolution: < 5 minutes**  
**Trigger:** iOS app launch hangs or exits with Mach error -308 (`ipc/mig server died`)

---

## Failure Signature

This runbook addresses the exact failure pattern encountered during M001 development:

| Phase | Result |
|-------|--------|
| xcodebuild | SUCCESS |
| `xcrun simctl install` | SUCCESS |
| `xcrun simctl launch` | **Hangs ~7 minutes, then exits with Mach error -308** |

Additional symptoms:
- `xcrun simctl list devices` may also hang (unresponsive for >10 seconds)
- `make doctor` exits non-zero — Check 5 reports simctl timeout
- `launchctl list | grep CoreSimulatorService` shows a PID that has been running for 48–72+ hours

**Root cause:** `com.apple.CoreSimulator.CoreSimulatorService` accumulates stale IPC state after extended uptime. The daemon continues responding to `launchctl list` but stops accepting Mach IPC calls from `simctl`. A fresh respawn clears the state.

---

## Quick Detection

```bash
# Step 1: Check if the daemon is running and its PID
launchctl list | grep CoreSimulatorService
# Expected output: PID   0   com.apple.CoreSimulator.CoreSimulatorService

# Step 2: Check daemon age (macOS)
cs_pid=$(launchctl list | grep CoreSimulatorService | awk '{print $1}')
ps -p "$cs_pid" -o pid,lstart= 2>/dev/null
# The lstart= column shows when the process started

# Step 3: Run the health check (fastest signal)
make doctor
# FAIL on Check 5 (CoreSimulator) = wedge suspected
```

**`make doctor` is the authoritative signal.** It checks daemon age (WARN ≥48h, FAIL ≥72h) and verifies `xcrun simctl list runtimes` responds within 10 seconds.

---

## Recovery Procedure

### Step 1 — Get the daemon PID (confirm it is running)

```bash
launchctl list | grep CoreSimulatorService
# Output: 1777   0   com.apple.CoreSimulator.CoreSimulatorService
#          ^PID  ^ExitCode  ^Label
```

If no output: the daemon is not running — skip to Step 3 (launchd will auto-start it on next `simctl` call).

### Step 2 — Kill the wedged daemon

`launchd` respawns the daemon automatically after a SIGKILL:

```bash
launchctl kill SIGKILL system/com.apple.CoreSimulator.CoreSimulatorService
```

> **Note:** `launchctl stop` will not work — the service is configured to restart. Use SIGKILL via `launchctl kill` to force launchd to respawn a fresh copy.

### Step 3 — Wait for respawn and verify new PID

```bash
sleep 3
launchctl list | grep CoreSimulatorService
# The PID should be different from the one you killed
```

If the PID is unchanged after 5 seconds, repeat the `launchctl kill` command.

### Step 4 — Verify simctl is responsive

```bash
xcrun simctl list runtimes
# Should return immediately (< 2 seconds) with a list of installed runtimes
```

If this hangs, repeat Steps 2–3.

### Step 5 — If the simulator device itself is in a bad state

```bash
# Shut down all simulators cleanly
xcrun simctl shutdown all

# Re-boot the target device (use your UDID or device name)
xcrun simctl boot "iPhone 17 Pro"

# Confirm booted state
xcrun simctl list devices | grep Booted
```

### Step 6 — Re-run the build/install/launch sequence

```bash
# Build
xcodebuild \
  -project MortgageGuardian.xcodeproj \
  -scheme MortgageGuardian \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build

# Install (glob expands to the correct .app path)
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/MortgageGuardian-*/Build/Products/Debug-iphonesimulator/MortgageGuardian.app

# Launch
xcrun simctl launch booted com.nickgarrison.mortgageguardian
```

### Step 7 — Confirm `make doctor` exits 0

```bash
make doctor
# → ALL CHECKS PASSED (exit 0)
```

---

## Synthetic Wedge for Testing

Use this sequence to validate that `make doctor` correctly detects a wedge:

```bash
# 1. Kill the daemon (creates wedge condition during respawn window)
launchctl kill SIGKILL system/com.apple.CoreSimulator.CoreSimulatorService

# 2. Immediately attempt a simctl call — it will fail or hang
xcrun simctl launch booted com.nickgarrison.mortgageguardian
# Expected: hangs briefly or exits with error

# 3. Run make doctor while the daemon is in a degraded state
make doctor
# Expected: exits non-zero — Check 5 reports simctl timeout or WARN on daemon age

# 4. Wait for the daemon to fully respawn
sleep 5

# 5. Confirm recovery
xcrun simctl list runtimes   # should return immediately
make doctor                  # should exit 0
```

---

## Removing Duplicate iOS Runtime (Reduces Wedge Recurrence)

Two iOS 26.4 runtimes are installed on the development machine:
- `23E244` — iOS 26.4 (older build, the one causing duplicate-runtime warnings)
- `23E254a` — iOS 26.4.1 (newer/correct build, the one simulators actually boot)

Having duplicate runtimes increases the likelihood of IPC confusion during daemon respawns. Removing the older one is recommended:

**Preferred method — Simulator.app GUI (safer than CLI):**
1. Open **Simulator.app** → Menu bar: **Window → Platforms & Simulators**
2. Click **iOS** in the left sidebar
3. Find the older runtime entry (build number `23E244`)
4. Select it and click the **–** (minus) button to remove

**Why not CLI?** `xcrun simctl runtime delete` can leave orphaned device records. The Simulator.app GUI handles cleanup atomically.

After removal, `make doctor` will no longer warn about duplicate iOS 26.4 runtimes.

---

## Quick-Reference Card

| Symptom | Action |
|---------|--------|
| Launch hangs >2 minutes | Run `make doctor`; if Check 5 fails → Step 2 |
| `simctl list devices` hangs | SIGKILL daemon → Step 2 |
| `make doctor` WARN on daemon age | Monitor; restart if it hits ≥72h |
| `make doctor` FAIL on simctl timeout | SIGKILL daemon → wait 5s → re-check |
| Mach error -308 at launch | SIGKILL daemon + `xcrun simctl shutdown all` → Steps 2–6 |

---

## Related

- `make doctor` — automated detection; run before every build session
- `docs/runbook-dev-setup.md` — full clean-clone setup guide
- `ENV-GUIDE.md` — environment variable reference
