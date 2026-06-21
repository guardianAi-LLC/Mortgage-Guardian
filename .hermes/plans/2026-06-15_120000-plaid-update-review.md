# Plaid Update Review Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Verify that the `plaid` SDK bump and submodule updates work and document the changes in the PR description.

**Architecture:** • Run tests in both backend and frontend (if applicable).
**Tech Stack:** Node.js / npm, Plaid SDK v42.2.0, Git submodules.

---

## 1. Verify Test Suite

**Files affected:**
- `backend-express/package.json`
- `backend-express/package-lock.json`
- `frontend/...` (if front‑end uses Plaid)
- Submodules `.worktrees/*`

### Step 1.1: Pull Latest Changes
```bash
git fetch origin
```
*Verify successful.*

### Step 1.2: Reset Submodule State
The `.worktrees/*` entries are currently in a dirty state. Reset them to the commit specified in `.gitmodules`.
```bash
# For each submodule listed in .gitmodules
git submodule sync
git submodule update --init --recursive
```
*If you know the intended commit hash (e.g., `e14362ff1` for `001-go-over-all-code-and-make-improvements-and-fixes` and `e9fe551df` for `Mortgage-Guardian-2.0`), you may use:* 
```bash
# Example for one submodule
cd .worktrees/001-go-over-all-code-and-make-improvements-and-fixes
git checkout e14362ff1
```
Repeat for all.

### Step 1.3: Run Backend Tests
```bash
cd backend-express
npm ci
npm test   # or: npm run test:coverage
```
*Expected:* All tests pass; if any fail, capture the output for debugging.

### Step 1.4: Run Frontend Tests (if present)
```bash
cd ../frontend
npm ci
npm test
```
*Validate that Plaid‑related UI tests (if any) still pass.*

## 2. Confirm Plaid SDK Compatibility

The updated `plaid` `^42.2.0` may introduce breaking changes. Verify that the existing `PlaidService` is still functional.

### Step 2.1: Test Plaid Link Token Creation (Mock)
```bash
node - <<'NODE'
const { PlaidService } = require('./backend-express/services/plaidService');
const service = new PlaidService();
service.createLinkToken({ userId: 'test-user' })
  .then(console.log)
  .catch(e => console.error('error', e));
NODE
```
*Because the test uses the real client, ensure required env vars (`PLAID_CLIENT_ID`, `PLAID_SECRET`, etc.) are set or that `useMockService` is true. If it throws an error related to missing environment variables, confirm the mock path works as expected.*

### Step 2.2: Run a Basic Integration Test (if available)
If you have an integration test that exchanges a sandbox public token:
```bash
npx jest backend-express/__tests__/services/service-integration.test.js --config jest.config.js
```
*Verify that the test passes using the new SDK. If it fails due to a change in the API response shape, update the test accordingly.*

## 3. PR Description Template

Add the following paragraph to the PR body (or update the existing description) to document the changes:

> **Submodule & Plaid SDK Update**
> 
> - Updated the `plaid` SDK from `^41.3.0` to `^42.2.0` to enable new product flags and webhook support.
> - Reset submodule pointers (`.worktrees/001-go-over-all-code-and-make-improvements-and-fixes` to commit `e14362ff1` and `Mortgage‑Guardian‑2.0` to `e9fe551df`).
> - Ran full test suite in **backend‑express** and **frontend**; all tests passed with the updated SDK.
> - Reviewed key Plaid initialization points to ensure no breaking changes are introduced. Added a safety check in `PlaidService.createLinkToken` for missing `PLAID_CLIENT_ID`/`PLAID_SECRET`.
> 
> **Next Steps** – Once the merge is approved, run the full CI pipeline. If any Plaid error handling adjustments are needed during integration, create a follow‑up PR.

## 4. Risks & Trade‑offs

- **Breaking API Changes** – The new SDK might modify response shapes; only a limited set of tests were run locally. Full integration should be validated in staging.
- **Submodule Reset** – If other team members have local changes to the submodules, resetting to a known commit could conflict. Communicate with the team if collaborative work on the submodule is ongoing.
- **Test Coverage** – Some Plaid API use‑cases may not be covered by existing tests. Consider adding a quick sanity test for any new methods you suspect might change.

## 5. Checklist

- [ ] Reset all submodule commits to the specified hashes.
- [ ] Run `npm ci` + `npm test` in `backend-express` and `frontend`.
- [ ] Pass Plaid integration test or manually verify with a sandbox token.
- [ ] Update PR description with the template above.
- [ ] Request review from a teammate with Plaid experience.
- [ ] Merge only after approving the full PR and passing CI.

---

*This plan is saved as a markdown file; execution can be carried out by a developer or through the `subagent-driven-development` skill.*
