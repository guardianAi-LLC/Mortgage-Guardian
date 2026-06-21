# Plaid SDK Compatibility & Submodule Update Plan

> **For Hermes:** Use subagent-driven-development to execute the plan task-by-task.

**Goal:** Verify that bumping the Plaid SDK to `^42.2.0` and resetting submodule commits does not break functionality, and document these changes in the PR description.

**Architecture:** The plan focuses on three key areas:
1. **Automated test run** – run the entire test suites in both the backend and frontend to detect regressions.
2. **Plaid SDK compatibility** – manually execute a subset of Plaid‑related unit tests and a manual integration check to ensure the new SDK handles the current initialization flow.
3. **Submodule hygiene** – safely reset submodule pointers to the intended commit and create a clear commit message.

**Tech Stack:** Node.js (npm), Plaid SDK v42.2.0, Git, Jest, Jest‑mock‑plaid (if used), Shell scripting.

---

### Task 1: Run the Full Test Suites

**Objective:** Confirm that the dependency bump has not caused any test failures.

**Files to modify:** None (only run existing test configs).

**Steps:**
1. **Navigate to backend**: `cd backend-express`
2. **Install dependencies**: `npm ci` (ensures lockfile is respected).
3. **Run tests**: `npm test` (or `npm run test:coverage` if coverage is part of CI).
4. **Capture output**: Ensure no test failures; note any failures for later investigation.
5. **Repeat for frontend**: `cd ../frontend`, run `npm ci && npm test`.
6. **Validation**: If all tests pass, record success. If any failures, create a detailed list and proceed to Task 2.

### Task 2: Verify Plaid SDK Compatibility

**Objective:** Ensure the current Plaid client code works against v42.2.0.

**Files to modify:** None (only run tests or manual code). We may create a temporary test file for a minimal sanity check.

**Steps:**
1. **Create a temporary test** (if one does not already exist):
   ```text
   // tests/plaid-sdk-compatibility.test.js
   const { PlaidService } = require('./services/plaidService');
   const service = new PlaidService();
   test('createLinkToken returns a link_token', async () => {
     // Use mock mode if credentials are not set
     const res = await service.createLinkToken({ userId: 'test-user' });
     expect(res).toHaveProperty('link_token');
   });
   ```
2. **Run the test**: `npx jest tests/plaid-sdk-compatibility.test.js`.
3. **Check for runtime errors**: Verify that the code path using `new Configuration()` and `new PlaidApi()` does not throw.
4. **Optional integration**: If the codebase contains mock‑plaid or similar, ensure that the mock service still behaves as expected.
5. **If failures happen**:
   - Inspect the change log of `plaid` around `42.2.0` for breaking changes.
   - Update any initialization code in `services/plaidService.js` where the `Configuration` may need additional options.
   - Re‑run tests.

### Task 3: Reset Submodule Commit Pointers

**Objective:** Ensure all submodules point to the intended commit, removing the 'dirty' state.

**Files to modify:** None – only run git commands.

**Steps:**
1. **List submodules**: `git submodule status` – note the current dirty stamps.
2. **Perform a clean reset**:
   ```bash
   git submodule sync
   git submodule update --init --recursive
   ```
3. **Verify integrity**: `git submodule status` again – all lines should match the committed SHA with no `-dirty` suffix.
4. **If any submodule remains dirty**:
   - Manually `cd` into that submodule's path, ensure it is on the intended commit (`git checkout <SHASH>`).
   - `git add <path>` to stage the updated pointer.
5. **Create a commit**:
   ```bash
   git add .gitmodules $(git ls-files -s | awk '{print $2}')    # track submodule pointers
   git commit -m "chore: reset submodule pointers after Plaid update"
   ```

### Task 4: Add PR Description Note

**Objective:** Summarize the changes in the PR body for reviewers.

**Files to modify:** None – just update PR description (outside the repo).

**Steps:**
1. **Draft note**:
   ```text
   **Submodule & Plaid SDK Update**
   - Updated Plaid SDK from `^41.3.0` to `^42.2.0`.
   - Reset submodule pointers to the intended commits (removed dirty states).
   - Ran full test suites in backend and frontend; all tests passed.
   - A temporary compatibility test ensures that the Plaid client initialization still works.
   ```
2. **Copy this into the PR description** (or add as a comment if the PR is already open).

---

### Verification Checklist

- [ ] All backend tests (`npm test` in `backend-express`) pass.
- [ ] All frontend tests (`npm test` in `frontend`) pass.
- [ ] Plaid compatibility test passes without runtime errors.
- [ ] Submodule status shows no dirty commits.
- [ ] PR description contains the note above.

### Risks & Open Questions

- **Plaid SDK breaking changes** – if tests fail, we need to inspect the changelog and update the `PlaidService` constructor.
- **Submodule side‑effects** – resetting pointers may affect other collaborators using different commits; confirm that the intended commit is the correct one.
- **CI environment** – ensure CI machines have `npm ci` configured and that environment variables for Plaid are supplied or mocked.

### Next Steps After Execution

Once the plan is executed:
1. Merge the PR if all checks pass.
2. Notify stakeholders that Plaid integration is updated and submodule state is cleaned.
3. Optionally, tag the commit with `pla‑sdk-42.2` for future reference.

---

**Plan saved.**
