---
name: fix
description: >
  Bug fix workflow tied to a story. Identifies the buggy story, asks about
  the bug, calls QA to reproduce and diagnose, updates the story with bug
  details, then applies a minimal TDD fix with QA validation loop.
  Use when a completed story has a bug or regression.
argument-hint: "[path-to-story.md]"
disable-model-invocation: true
---

# Fix — Story-Linked Bug Fix Orchestrator

Diagnose and fix a bug tied to an existing story. Follows a structured workflow:
identify story → describe bug → QA reproduces → plan minimal fix → TDD fix → QA validates → update story.

---

## INPUT

`$ARGUMENTS` is an optional path to the story file where the bug was found.

**If `$ARGUMENTS` is provided:** Read that story file as context.

**If `$ARGUMENTS` is empty:** Enter interactive story selection (see Phase 1).

---

## PHASE 1: STORY SELECTION

**Goal:** Identify which story the bug belongs to.

### 1.1 If Story Path Provided

1. Read the story file at `$ARGUMENTS`
2. Validate it exists and has the expected format
3. Confirm with user: "Bug is in story [EE-SS]: [Title]. Correct?"

### 1.2 If No Story Path (Interactive)

1. Use Glob to find all story files: `tasks/*/epics/*/stories/*.md`
2. Read each story's header to extract: title, status, epic
3. Filter to stories with `Status: DONE` or `Status: IN PROGRESS` (bugs happen in implemented stories)
4. Present the list:

```
## Select the Story with the Bug

| # | Story | Epic | Status |
|---|-------|------|--------|
| 1 | [01-01] Setup server scaffold | Foundation | DONE |
| 2 | [01-02] gRPC service definition | Foundation | DONE |
| 3 | [01-03] WebSocket gateway | Foundation | IN PROGRESS |

Which story has the bug? (enter number, path, or NONE if not story-related)
```

**If NONE:** Ask the user to describe the bug and which component it affects.
Try to map it to a story by matching file paths and components. If no match,
create a standalone bug report without story linkage and proceed to Phase 2.

### 1.3 Load Story Context

Once a story is selected:

1. Read the full story file — including any Implementation Summary from `/build`
2. Extract: acceptance criteria, files created/modified, technical notes
3. Read the parent EPIC.md for broader context
4. Read relevant `docs/architecture/` files for the affected component

This context helps understand what the code is SUPPOSED to do vs. what it's doing.

---

## PHASE 2: BUG DESCRIPTION

**Goal:** Get a clear description of the bug from the user.

### 2.1 Ask About the Bug

```
## Describe the Bug

Story: [EE-SS] [Title]

1. What is the expected behavior?
2. What is the actual behavior?
3. Steps to reproduce (if known)?
4. Any error messages or logs?
5. When did it start? (always broken, or regression?)
```

### 2.2 Gather Additional Context

Based on the user's answer, ask targeted follow-ups (1-2 max):
- "Does this happen every time or intermittently?"
- "Which specific input or action triggers it?"
- "Did this work before a recent change?"

---

## PHASE 3: SKILL DETECTION & CONTEXT LOADING

**Goal:** Load the right expert and guide skills for the affected code.

### 3.1 Detect from Story Files

Use the story's "Files to Create/Modify" to determine which skills to load.
Same detection logic as `/build`:

```
Files in mobile/, app/, components/ → expert-frontend
Files in server/, api/, backend/ → expert-backend
File extensions → matching guide skills (.rs → guide-rust, etc.)
```

### 3.2 Always Load QA

The QA expert (`expert-qa`) is always loaded for bug fix workflows.
The code analyst (`expert-analyst`) is also loaded — useful for root cause analysis.

### 3.3 Load Skills

Check `.claude/skills/experts/` and `.claude/skills/guides/` for detected skills.
Load what's available, warn about missing ones.

---

## PHASE 4: QA REPRODUCTION & DIAGNOSIS

**Goal:** QA expert reproduces the bug and confirms the diagnosis before any fix.

### 4.1 Locate the Buggy Code

Using the bug description and story context:
1. Identify the likely source files using Grep and the story's file list
2. Read the relevant source code
3. Read existing tests for those files
4. Trace the execution path that triggers the bug

### 4.2 Reproduce the Bug

Attempt to reproduce the bug:

1. **Check existing tests** — does any test cover this scenario?
   - If yes and it passes → test is wrong or insufficient
   - If yes and it fails → confirms the bug, good
   - If no test covers this → gap identified

2. **Write a reproduction test** — a test that FAILS because of the bug:
   ```
   Test: "should [expected behavior] when [trigger condition]"
   → Currently FAILS with: [actual behavior]
   ```

3. **Run the reproduction test** — confirm it fails:
   ```bash
   # Run the specific test
   ```

### 4.3 Root Cause Analysis

Analyze the code to identify the root cause:

```
## Bug Diagnosis

**Symptom:** [what the user sees]
**Reproduction:** [test that fails]
**Root cause:** [what's actually wrong in the code]
**Location:** [file:line]
**Why it happened:** [logic error / missing check / wrong assumption / etc.]
**Impact scope:** [what else might be affected]
```

### 4.4 Check for Related Issues

- Grep the codebase for similar patterns that might have the same bug
- Check if the root cause affects other acceptance criteria
- List any related bugs found:
  ```
  Related issues found:
  - [file:line]: Same pattern, potentially same bug
  - [file:line]: Similar but not identical
  ```

### 4.5 Present Diagnosis to User

```
## Bug Diagnosis Report

**Story:** [EE-SS] [Title]
**Bug:** [1-line summary]
**Root cause:** [explanation]
**Location:** [file:line]
**Reproduction test:** Written and FAILING (confirms the bug)

### Related Issues
- [count] similar patterns found in codebase

### Affected Acceptance Criteria
- [ ] [Criterion X] — BROKEN by this bug
- [x] [Criterion Y] — Still working

Confirm diagnosis and proceed to fix? YES / INVESTIGATE MORE
```

**If INVESTIGATE MORE:** Ask what aspect to investigate further, run more analysis.

---

## PHASE 5: FIX PLANNING

**Goal:** Plan the minimal fix before changing any code.

### 5.1 Design Minimal Fix

The fix should be the **smallest possible change** that resolves the bug:
- DO NOT refactor surrounding code
- DO NOT add features
- DO NOT "improve" unrelated code
- Fix ONLY the root cause

```
## Fix Plan

**Strategy:** [what to change and why]
**Files to modify:** [list — should be minimal]
**SOLID check:** [does the fix maintain SOLID compliance?]
**Risk:** [what could this fix break?]
```

### 5.2 Create Subtasks

```
1. "Write regression test for [bug description]"
2. "Apply minimal fix in [file]"
3. "QA validation of fix"
4. "Update story and commit"
```

### 5.3 Update Story File

Append bug report to the story file:

```markdown

---

## Bug Report: [date]

**Reported:** [date]
**Status:** FIXING

### Description
- **Expected:** [expected behavior]
- **Actual:** [actual behavior]
- **Steps to reproduce:** [steps]

### Diagnosis
- **Root cause:** [explanation]
- **Location:** [file:line]
- **Reproduction test:** [test name]
- **Related issues:** [count]

### Fix Plan
- **Strategy:** [minimal fix description]
- **Files to modify:** [list]
```

### 5.4 Confirm Fix Plan

```
## Proposed Fix

**Root cause:** [1-line]
**Fix:** [1-line description of the change]
**Files to touch:** [count]
**Risk assessment:** [LOW / MEDIUM / HIGH]

Proceed with fix? YES / ADJUST / ABORT
```

Wait for user confirmation.

---

## PHASE 6: TDD FIX (RED → GREEN)

**Goal:** Fix the bug using TDD — the reproduction test should go from red to green.

### 6.1 Verify RED

Confirm the reproduction test from Phase 4 still fails:
```bash
# Run the reproduction test
```
Expected: FAIL (the bug is still there).

Also write any additional regression tests identified during diagnosis:
- Tests for related patterns found in Phase 4.4
- Tests for edge cases near the root cause

### 6.2 Apply Minimal Fix

1. Apply the fix as planned in Phase 5
2. Change ONLY what's necessary — minimal diff
3. Follow SOLID principles (don't violate SRP by cramming logic)
4. Follow loaded guide skill best practices

### 6.3 Verify GREEN

Run the reproduction test + all related tests:
```bash
# Run tests
```

Expected: ALL tests PASS (including the previously-failing reproduction test).

Present:
```
## Fix Applied

**Reproduction test:** NOW PASSING
**All tests:** [X]/[X] passing
**Files changed:** [count]
**Lines changed:** [count]

Moving to QA validation.
```

---

## PHASE 7: QA VALIDATION

**Goal:** QA expert verifies the fix is complete and nothing else broke.

### 7.1 Run Full Test Suite

```bash
# Run ALL tests, not just the fix-related ones
```

Check for regressions.

### 7.2 Verify Acceptance Criteria

Re-check ALL acceptance criteria from the original story — not just the broken ones:
- The bug fix might have side effects on criteria that were previously passing

### 7.3 Code Quality Checks

Run linting, type checking, formatting — same as `/build` Phase 7.4.

### 7.4 Verify Minimalism

Check that the fix is truly minimal:
- No unrelated changes
- No unnecessary refactoring
- No added features
- Diff should be small and focused

### 7.5 Present QA Report

```
## QA Report: Bug Fix for [Story Title]

### Bug Fix Verification
- [x] Reproduction test passes
- [x] Root cause addressed
- [x] Related patterns checked

### Regression Check
- All tests: [X]/[X] passing
- New regressions: [count]

### Acceptance Criteria (full re-check)
- [x] Criterion 1 — PASS
- [x] Criterion 2 — PASS (was broken, now fixed)
- [x] Criterion 3 — PASS

### Code Quality
- Type checking: PASS / FAIL
- Linting: PASS / FAIL
- Formatting: PASS / FAIL

### Fix Minimalism: PASS / FAIL
[Notes on any unnecessary changes]

### Verdict: PASS / NEEDS FIXES
```

### 7.6 Handle Results

**If PASS:** Proceed to Phase 8.

**If NEEDS FIXES:**
- Track iteration count (max 3)
- Loop back to Phase 6 for targeted fixes
- After 3 iterations, escalate to user:
  ```
  Fix has been attempted 3 times. Remaining issues:
  [list]
  
  Options:
  A) MANUAL FIX — I'll try specific fixes you suggest
  B) ACCEPT — Proceed with known limitations
  C) REVERT — Undo all changes, keep the bug documented
  ```

---

## PHASE 8: COMPLETION

**Goal:** Update story, commit the fix.

### 8.1 Update Story File — Bug Report Status

Update the bug report section appended in Phase 5:

```markdown
### Resolution
- **Fixed:** [date]
- **Fix:** [1-line description]
- **Regression tests added:** [count]
- **QA iterations:** [count]
- **Status:** FIXED

### Files Touched
[Precise reference of every file and line changed — no descriptions, just locations]

```
MODIFIED src/server/ws/handler.rs:34,67-69
CREATED  tests/ws_handler_regression_test.rs
```
```

### 8.2 Update Story Status

If the story was `DONE`, it stays `DONE` (bug was fixed, story is still complete).
If the story was `IN PROGRESS`, it stays `IN PROGRESS`.

### 8.3 Update Parent Epic

No change needed in EPIC.md unless the story status changed.

### 8.4 Mark All Tasks Completed

Use TaskUpdate to mark all fix-related tasks as `completed`.

### 8.5 User Manual Testing

```
Bug fix complete!

Please verify:
1. The original bug is fixed: [reproduction steps]
2. The feature still works as expected: [acceptance criteria summary]
3. No new issues introduced

Result? PASS / STILL BROKEN / NEW ISSUE
```

- **PASS** → proceed to commit
- **STILL BROKEN** → loop back to Phase 4 (re-diagnose)
- **NEW ISSUE** → document as a new bug, decide whether to fix now or separately

### 8.6 Ship (Commit + PR + Issue Updates)

```
Ready to ship the fix! Options:

A) SHIP — Run /ship to commit, PR, and update GitHub Issues
B) SKIP — Don't commit yet (run /ship later manually)
```

If SHIP: Invoke the `/ship` skill with the story file path.
`/ship` handles: branch creation (`fix/` prefix), staging, commit message,
PR, and GitHub Issue updates.

If SKIP: Remind the user they can run `/ship [story-path]` later.

---

## IMPORTANT GUIDELINES

### Minimal Fix Only
- Fix the bug, nothing else. No refactoring, no improvements, no features.
- The diff should be as small as possible while correctly fixing the root cause.
- If you find other issues during diagnosis, document them but don't fix them.

### Reproduce Before Fixing
- NEVER attempt a fix without a failing reproduction test first.
- If you can't reproduce the bug, investigate more before guessing at a fix.
- The reproduction test is proof the bug exists and proof it's fixed.

### QA Loop Has a Safety Valve
- Maximum 3 fix↔QA iterations
- After 3 iterations, escalate to user with options including revert

### Story File Tracks Everything
- The bug report is appended to the original story file
- This creates a complete history: original implementation + bug reports + fixes
- Future developers can see what went wrong and why

### Files Touched Must Be Precise
- The "Files Touched" section in the Resolution must list every file changed
- For CREATED files: just the path (e.g., `CREATED tests/regression_test.rs`)
- For MODIFIED files: path + exact line numbers (e.g., `MODIFIED src/handler.rs:34,67-69`)
- Use `git diff --stat` and `git diff` to collect precise lines after the fix
- No descriptions — just paths and line numbers for quick reference

### Related Bugs
- If diagnosis reveals bugs in OTHER stories, document them but don't fix them
- Tell the user: "Found related bugs in [stories]. Run `/fix` on those separately."

### Skill Loading is Automatic
- Same detection logic as `/build` — auto-loads experts and guides
- QA and analyst experts are ALWAYS loaded for bug fixes

### Language: English
- All output in English regardless of spec/story language

### Reusability
- Works with any project using the `tasks/` story format
- No project-specific references
