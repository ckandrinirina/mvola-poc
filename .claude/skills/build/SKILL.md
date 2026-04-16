---
name: build
description: >
  Implement a story using TDD (red-green-refactor) with SOLID principles.
  Auto-detects expert and guide skills. Runs QA validation with dev-QA loop.
  Tracks everything in the story file. Use after /plan to implement stories.
argument-hint: "[path-to-story.md]"
disable-model-invocation: true
---

# Implement Story — TDD Story Implementation Orchestrator

Implements a single story from `tasks/` using Test-Driven Development, SOLID principles,
and automated QA validation. Orchestrates the full cycle: plan → test → implement → refactor → QA → commit.

---

## INPUT

`$ARGUMENTS` is an optional path to a story markdown file.

**If `$ARGUMENTS` is provided:** Read and validate that story file.

**If `$ARGUMENTS` is empty:** Enter interactive story selection (see Phase 1).

---

## PHASE 1: STORY SELECTION

**Goal:** Identify which story to implement.

### 1.1 If Story Path Provided

1. Read the story file at `$ARGUMENTS` using the Read tool
2. Validate it has the expected format (title, description, acceptance criteria, status)
3. If the file doesn't exist or isn't a valid story, tell the user and stop

### 1.2 If No Story Path (Interactive)

1. Use Glob to find all story files: `tasks/*/epics/*/stories/*.md`
2. Read each story file's header to extract: title, status, size, dependencies
3. Filter to only `Status: TODO` stories
4. Check dependencies — remove stories whose "Blocked by" stories are not `DONE`
5. Sort remaining stories by:
   - Epic number (lower first)
   - Story number within epic (lower first)
   - Size (S before M before L before XL)
6. Present the list:

```
## Stories Ready for Implementation

| # | Story | Epic | Size | Dependencies |
|---|-------|------|------|-------------|
| 1 | [01-01] Setup server scaffold | Foundation | M | None |
| 2 | [01-02] gRPC service definition | Foundation | S | None |
| 3 | [02-01] Plugin scanner | VST/AU Hosting | L | Blocked by 01-01 (done) |

Which story to implement? (enter number or path)
```

If no stories are ready, tell the user: "No unblocked TODO stories found. Check `tasks/` or run `/plan` to generate stories."

### 1.3 Load Story Context

Once a story is selected:

1. Read the full story file
2. Extract all structured fields:
   - **Title** and **Description**
   - **Acceptance Criteria** (the checklist items)
   - **Technical Notes**
   - **Files to Create/Modify** (the action table)
   - **Dependencies** (blocked by / blocks)
   - **Epic** reference
   - **Size** (S/M/L/XL)
3. Read the parent `EPIC.md` for broader context
4. Read `ROADMAP.md` if it exists, to understand where this story fits

### 1.4 Detect Linked GitHub Issues

Check if this story has a corresponding GitHub Issue:

1. Search for story issues matching `[EE-SS]` in the title:
   ```bash
   gh issue list --label "story" --state open --json number,title
   ```
2. Search for the parent epic issue:
   ```bash
   gh issue list --label "epic" --state open --json number,title
   ```
3. If found, store the issue numbers for later use in `/ship`
4. Present: "Linked GitHub Issue: #[number] — [title]" (or "No linked issue found")

This context is used during implementation to reference the issue and during
`/ship` to auto-close or comment on the issue.

### 1.4 Update Story Status

Edit the story file to change status:
```
> **Status:** TODO
```
→
```
> **Status:** IN PROGRESS
```

---

## PHASE 2: SKILL DETECTION & CONTEXT LOADING

**Goal:** Automatically determine which expert and guide skills to invoke.

### 2.1 Read Project Architecture

Read ALL of these files from `docs/architecture/` (if they exist) — do not skip any:
- `tech-stack.md` — know what technologies are used
- `folder-structure.md` — know where to put files
- `components.md` — understand system components
- `api-contracts.md` — understand API interfaces
- `database-schema.md` — understand data models
- `dev-guide.md` — know how to build, run, test

Also check for `ROADMAP.md` at the project root.

### 2.2 Detect Required Expert Skills

Analyze the story's "Files to Create/Modify" and "Technical Notes" to determine which experts are needed:

```
DETECTION RULES:

Files in mobile/, app/, components/, screens/, ui/ → expert-frontend
Files in server/, api/, backend/, services/ → expert-backend
Files with .test., .spec., __tests__/ → expert-qa (always loaded anyway)
Files in docker/, .github/, ci/, deploy/ → expert-devops
Database migrations, .sql files, schema changes → expert-backend

ALSO CHECK Technical Notes for keywords:
"frontend", "UI", "component", "screen" → expert-frontend
"API", "endpoint", "server", "handler" → expert-backend
"deploy", "CI", "docker", "pipeline" → expert-devops
```

**expert-qa is ALWAYS loaded regardless of story type** — it reviews all implementation for test quality and edge cases. Do not skip it.

### 2.3 Detect Required Guide Skills

Based on file extensions in "Files to Create/Modify":

```
.rs → guide-rust
.cpp, .h, .hpp → guide-cpp (also check for guide-juce if JUCE is used)
.ts, .tsx → guide-typescript
.tsx + mobile/ → guide-react-native
.py → guide-python
.go → guide-go
.java, .kt → guide-java
.swift → guide-swift
+ any framework-specific guides (guide-axum, guide-juce, etc.)
```

### 2.4 Load Skills & Warn

**Step 1 — Filesystem check FIRST (mandatory):**
```bash
find .claude/skills -type f -name "*.md" | sort
```
This is the authoritative list of available skills. Never claim a skill is missing without running this first. Skills live in subdirectories (`experts/`, `guides/`) that are not surfaced by the Skill tool's system listing.

**Step 2 — Load each detected skill:**
- Try the `Skill` tool first (e.g., `Skill("experts/backend")`)
- If the Skill tool returns an error, fall back to `Read` on the SKILL.md file directly (e.g., `Read(".claude/skills/experts/backend/SKILL.md")`) and apply the guidance manually
- Always load `experts/qa/SKILL.md` unconditionally

**Step 3 — Warn about truly missing skills:**
If a skill was expected but does NOT appear in the filesystem check output:
```
Missing recommended skills:
- guide-rust (not found — run /team to create it)

Continue without these? YES / GENERATE FIRST
```
If GENERATE FIRST → tell user to run `/team` and come back

---

## PHASE 3: IMPLEMENTATION PLANNING

**Goal:** Create a detailed, SOLID-compliant implementation plan before writing any code.

### 3.1 Research (if needed)

If the story involves patterns or technologies that could benefit from current docs:
- Use context7 MCP to look up relevant framework documentation
- Use WebSearch for uncommon patterns referenced in technical notes
- Only research what's actually needed — don't research well-known basics

### 3.2 Clarify Ambiguities

Review the acceptance criteria. If any are vague or incomplete:
- Ask the user 1-2 targeted questions
- Do NOT ask about things already clear in the story or architecture docs

### 3.3 Design with SOLID

Plan the implementation applying each SOLID principle:

```
## SOLID Analysis for This Story

**S — Single Responsibility:**
- [Each new file/class and its ONE responsibility]

**O — Open/Closed:**
- [Existing code to extend via abstractions, NOT modify]
- [Extension points to create for future flexibility]

**L — Liskov Substitution:**
- [Any new types must be substitutable for their parent types]

**I — Interface Segregation:**
- [Keep interfaces focused — no methods the caller doesn't need]

**D — Dependency Inversion:**
- [High-level modules depend on abstractions, not concrete implementations]
- [Where to inject dependencies]
```

### 3.4 Create Subtasks

Break the work into ordered subtasks using TaskCreate:

```
Typical task breakdown:

1. "Write tests for [story title]"
   - activeForm: "Writing tests for [story title]"
   
2. "Implement [component/module A]"
   - activeForm: "Implementing [component A]"

3. "Implement [component/module B]" (if applicable)
   - activeForm: "Implementing [component B]"

4. "Refactor [story title] implementation"
   - activeForm: "Refactoring [story title]"

5. "QA validation for [story title]"
   - activeForm: "Running QA for [story title]"

6. "Complete [story title] — update docs and commit"
   - activeForm: "Completing [story title]"
```

Set dependencies: implementation blocked by tests, refactor blocked by implementation,
QA blocked by refactor, completion blocked by QA.

### 3.5 Update Story File

**Do this BEFORE writing any implementation code.** The story file is the source of truth — the plan must exist in it before work begins, not appended after the fact.

Append the implementation plan to the story file using Edit:

```markdown

---

## Implementation Plan

**Planned:** [date]
**Skills loaded:** [list of expert/guide skills detected]
**SOLID approach:** [1-line summary]

### Subtasks
1. [ ] Write tests ([count] tests planned)
2. [ ] Implement [component A]
3. [ ] Implement [component B]
4. [ ] Refactor for SOLID compliance
5. [ ] QA validation
6. [ ] Update docs and commit

### Design Notes
[Key design decisions, patterns chosen, abstractions planned]
```

### 3.6 Confirm Plan

Present the plan to the user:

```
## Implementation Plan for [Story Title]

**Tests to write:** [count] (from [count] acceptance criteria)
**Files to create:** [list]
**Files to modify:** [list]
**SOLID approach:** [summary]
**Estimated subtasks:** [count]

Proceed with TDD implementation? YES / ADJUST
```

Wait for user confirmation.

---

## PHASE 4: TDD — WRITE TESTS FIRST (RED PHASE)

**Goal:** Write failing tests that define the expected behavior before any implementation.

### 4.1 Start Test Task

Mark the test-writing task as `in_progress` using TaskUpdate.

### 4.2 Determine Test Structure

- Read existing test files in the project to understand conventions:
  - Test file naming (`.test.ts`, `_test.rs`, `test_*.py`, etc.)
  - Test file location (co-located, `__tests__/`, `tests/`, etc.)
  - Test framework (Jest, cargo test, pytest, Catch2, etc.)
  - Assertion style
  - Mock/stub patterns
- Follow the patterns from guide skills if loaded

### 4.3 Write Tests from Acceptance Criteria

For EACH acceptance criterion in the story, write at minimum one test:

```
Acceptance Criterion: "WebSocket server accepts connections on port 8765"
→ Test: test_server_accepts_websocket_connection_on_configured_port()

Acceptance Criterion: "Messages are serialized in MessagePack format"
→ Test: test_message_serialization_uses_messagepack()
→ Test: test_message_deserialization_handles_invalid_msgpack()
```

Also add tests for:
- **Edge cases** — empty input, boundary values, max limits
- **Error scenarios** — invalid input, connection failures, timeouts
- **Integration points** — if the story connects two components

### 4.4 Run Tests — Confirm RED

Run the test suite:
```bash
# Detect and run the appropriate test command
# (cargo test, npm test, pytest, etc.)
```

**Expected result: ALL new tests FAIL.**

If any new test passes without implementation → the test is likely wrong (testing
something that already exists or is trivially true). Review and fix.

Present:
```
## RED Phase Complete

**Tests written:** [count]
**All failing:** YES (expected)
**Test output:** [summary of failures]

Moving to GREEN phase — implementing to make tests pass.
```

Mark test task as `completed`.

---

## PHASE 5: IMPLEMENTATION (GREEN PHASE)

**Goal:** Write the minimum code necessary to make ALL tests pass.

### 5.1 Start Implementation Tasks

Mark the first implementation task as `in_progress`.

### 5.2 Implement

Follow this order:
1. Create new files listed in the story's "Files to Create/Modify"
2. Modify existing files as specified
3. After each significant change, run the tests
4. Stop as soon as all tests pass — don't over-engineer

**Implementation rules:**
- Follow SOLID principles from the Phase 3 plan
- Follow the loaded guide skills' best practices
- Follow the loaded expert skills' coding standards
- Reuse existing code — check `docs/architecture/` and scan existing files
- Write the simplest code that passes the tests
- Add inline comments only where logic isn't self-evident

### 5.3 Run Tests — Confirm GREEN

Run the full test suite:
```bash
# Run test command
```

**Expected result: ALL tests PASS.**

If tests still fail:
- Read the failure output
- Fix the implementation (not the tests, unless the test itself has a bug)
- Re-run until green

Present:
```
## GREEN Phase Complete

**Tests passing:** [X]/[X] (all green)
**Files created:** [list]
**Files modified:** [list]

Moving to REFACTOR phase.
```

Mark implementation task(s) as `completed`.

---

## PHASE 6: REFACTOR PHASE

**Goal:** Improve code quality without changing behavior. Tests must stay green.

### 6.1 SOLID Review

Review all new/modified code against SOLID:

```
## SOLID Compliance Check

S — Single Responsibility:
  [x] Each function does one thing
  [x] Each file/class has one reason to change
  [ ] ISSUE: [function X] handles both [A] and [B] → split

O — Open/Closed:
  [x] Extended via abstractions, not modification
  
L — Liskov Substitution:
  [x] Subtypes are substitutable

I — Interface Segregation:
  [x] No fat interfaces

D — Dependency Inversion:
  [x] Depends on abstractions
  [ ] ISSUE: [module X] directly instantiates [concrete Y] → inject
```

### 6.2 Apply Refactorings

For each issue found:
1. Apply the refactoring
2. Run tests → must still pass
3. If tests break → revert and reconsider

Common refactorings:
- Extract function/method for duplicated code
- Rename for clarity
- Introduce interface/trait for dependency inversion
- Split large functions by responsibility
- Move code to appropriate module per folder structure

### 6.3 Final Green Check

Run full test suite one more time:
```bash
# Run test command
```

Present:
```
## REFACTOR Phase Complete

**Refactorings applied:** [count]
**Tests still passing:** [X]/[X] (all green)

Moving to QA validation.
```

---

## PHASE 7: QA VALIDATION

**Goal:** Comprehensive quality check. The QA expert reviews the work — not a self-review.

### 7.0 Load QA Expert Skills (mandatory, do not skip)

Before doing any QA, load both QA skills by reading them directly:
```
Read(".claude/skills/experts/qa/SKILL.md")
Read(".claude/skills/experts/qa-project/SKILL.md")
```
Apply their standards throughout this entire phase. A self-review without loading these skills does NOT count as QA validation.

### 7.1 Start QA Task

Mark the QA task as `in_progress`.

### 7.2 Acceptance Criteria Verification

Go through EACH acceptance criterion from the story and verify:
- Is there a test covering it? (should be, from Phase 4)
- Does the implementation actually fulfill it?
- Mark each as PASS or FAIL with explanation

### 7.3 Run Full Test Suite

```bash
# Run all tests, not just the new ones
```

Check for regressions in existing tests.

### 7.4 Code Quality Checks

Run all applicable quality tools. Detect which are available and run them:

```bash
# TypeScript projects
npx tsc --noEmit        # Type checking
npx eslint .            # Linting
npx prettier --check .  # Formatting

# Rust projects
cargo clippy            # Linting
cargo fmt -- --check    # Formatting

# Python projects
mypy .                  # Type checking
ruff check .            # Linting
black --check .         # Formatting

# C++ / JUCE projects
cmake --build build -- -v 2>&1 | grep -iE "warning:|error:" | grep -v "_deps"
# clang-format --dry-run --Werror Source/*.cpp Source/*.h   (if .clang-format exists)
# Zero compiler warnings in project-owned files is the quality bar
```

### 7.5 Architecture Compliance

Check the implementation against `docs/architecture/`:
- Are new files in the correct directories per `folder-structure.md`?
- Do API shapes match `api-contracts.md`?
- Does the data flow follow `data-flow.md`?
- Are database changes consistent with `database-schema.md`?

### 7.6 Edge Case Analysis

Look for scenarios the tests might not cover:
- Null/undefined/empty inputs
- Concurrent access (if applicable)
- Resource cleanup (file handles, connections)
- Error propagation through the call chain

### 7.7 Present QA Report

```
## QA Report: [Story Title]

### Acceptance Criteria
- [x] Criterion 1 — PASS
- [x] Criterion 2 — PASS
- [ ] Criterion 3 — FAIL: [specific reason]

### Test Results
- Total tests: [X]
- Passing: [X]
- Failing: [X]
- New regressions: [X]

### Code Quality
- Type checking: PASS / FAIL
- Linting: PASS / FAIL ([count] warnings)
- Formatting: PASS / FAIL

### Architecture Compliance: PASS / FAIL
[Notes on any deviations]

### Edge Cases
- [Edge case 1]: COVERED / MISSING
- [Edge case 2]: COVERED / MISSING

### Issues Found
| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 1 | HIGH | [issue] | [file:line] |
| 2 | MEDIUM | [issue] | [file:line] |
| 3 | LOW | [issue] | [file:line] |

### Verdict: PASS / NEEDS FIXES
```

### 7.8 Handle Results

**If PASS (no issues):**
- Mark QA task as `completed`
- Proceed to Phase 8

**If NEEDS FIXES:**
- Present the issues clearly
- Track the QA iteration count (max 3)
- If iteration < 3:
  ```
  QA found [X] issues. Looping back to fix.
  Iteration: [N]/3
  ```
  - Fix each issue (write test for it if missing, then fix code)
  - Re-run Phase 6 (refactor)
  - Re-run Phase 7 (QA) with fresh check
- If iteration = 3:
  ```
  QA has run 3 times and issues remain:
  [list remaining issues]
  
  Please review and advise:
  A) FIX MANUALLY — I'll attempt specific fixes you suggest
  B) ACCEPT AS-IS — Proceed with known issues (I'll document them)
  C) ABORT — Stop implementation, revert to TODO status
  ```

---

## PHASE 8: COMPLETION

**Goal:** Finalize the story, update tracking, and optionally commit.

### 8.1 Update Story File — Status

Edit the story file to update status:
```
> **Status:** IN PROGRESS
```
→
```
> **Status:** DONE
```

### 8.2 Update Story File — Implementation Summary

Append to the story file:

```markdown

---

## Implementation Summary

**Completed:** [date]
**TDD Iterations:** [count] (red→green→refactor cycles)
**QA Iterations:** [count]
**Tests written:** [count]
**Files created:** [count]
**Files modified:** [count]

### What Was Implemented
- [Key implementation point 1]
- [Key implementation point 2]

### Files Touched
[Precise reference of every file and line changed — no descriptions, just locations]

```
CREATED  src/server/ws/handler.rs
CREATED  src/server/ws/mod.rs
MODIFIED src/server/main.rs:12,45-48,92
MODIFIED src/server/config.rs:8,23
CREATED  tests/ws_handler_test.rs
```

### SOLID Compliance
- [How SOLID was applied — 1 line per principle]

### Notes
[Any important notes for future developers]
```

### 8.3 Update Story Checklist in Story File

Mark all acceptance criteria as checked:
```
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3
```

### 8.4 Update Parent Epic

Read the parent EPIC.md and update the story's status in the stories table:
```
| 01 | [Title] | M | DONE |
```

### 8.5 Update Implementation Plan Subtasks

Mark all subtasks in the story's Implementation Plan section as done:
```
1. [x] Write tests (5 tests)
2. [x] Implement server handler
3. [x] Implement client serializer
4. [x] Refactor for SOLID compliance
5. [x] QA validation
6. [x] Update docs and commit
```

### 8.6 Mark All Claude Tasks Completed

Use TaskUpdate to mark all remaining tasks as `completed`.
Use TaskList to show final summary.

### 8.7 User Manual Testing — REQUIRED before marking story DONE

**Do NOT mark the story as DONE or update the EPIC until the user explicitly confirms PASS here.**
The story status must stay IN PROGRESS until manual verification is complete.

```
Story implementation complete!

Please manually test the feature:
- [Specific test scenario 1 from acceptance criteria]
- [Specific test scenario 2]
- [Edge case to try]

Result? PASS / ISSUES
```

**If ISSUES:** Ask what's wrong, loop back to Phase 5 for targeted fixes.

**If PASS:** Proceed to update story to DONE, update EPIC, then move to 8.8.

### 8.8 Ship (Commit + PR + Issue Updates)

**If PASS:**
```
Ready to ship! Options:

A) SHIP — Run /ship to commit, PR, and update GitHub Issues
B) SKIP — Don't commit yet (run /ship later manually)
```

If SHIP: Invoke the `/ship` skill with the story file path.
`/ship` handles: branch creation, staging, commit message, PR, and GitHub Issue updates
(closing story issue, updating epic checklist).

If SKIP: Remind the user they can run `/ship [story-path]` later.

---

## IMPORTANT GUIDELINES

### TDD is Non-Negotiable
- Tests are ALWAYS written before implementation code
- The Red→Green→Refactor cycle is followed strictly
- No implementation code without a failing test first
- Exception: trivial boilerplate (config files, type exports) that can't meaningfully fail

### SOLID is Enforced Twice
- **Phase 3 (Planning):** Design with SOLID in mind
- **Phase 6 (Refactor):** Verify SOLID compliance in the actual code

### QA Loop Has a Safety Valve
- Maximum 3 dev↔QA iterations
- After 3 iterations, escalate to user with options
- This prevents infinite loops on edge cases

### Story File is the Source of Truth
- All tracking happens IN the story file (status, plan, summary)
- The story file grows as implementation progresses
- After completion, the story file is a complete record of what was done

### Files Touched Must Be Precise
- The "Files Touched" section in the Implementation Summary must list every file
- For CREATED files: just the path (e.g., `CREATED src/ws/handler.rs`)
- For MODIFIED files: path + exact line numbers changed (e.g., `MODIFIED src/main.rs:12,45-48,92`)
- Use `git diff --stat` and `git diff` to collect the precise lines after implementation
- No descriptions — just file paths and line numbers for quick reference
- This enables future developers (and AI) to instantly locate what was changed

### Skill Loading is Automatic
- The orchestrator detects and loads relevant skills without user input
- If skills are missing, it warns but doesn't block
- Expert skills provide domain knowledge; guide skills provide language best practices

### Context7 Research is Targeted
- Only research during Phase 3 (planning)
- Only for unfamiliar patterns or technologies
- Don't research basics — trust loaded guide skills for conventions

### Language: English
- All output, comments, commit messages, and documentation in English
- Regardless of the spec or story language

### JUCE Test Runner Rules
When writing JUCE unit tests, always:
- Use `juce::ScopedJuceInitialiser_GUI juceInit;` as the first line of `main()` — JUCE docs recommend this for console-app test runners; it prevents CoreMidi/Singleton assertions caused by `AudioDeviceManager` needing a MessageManager
- Use ASCII-only strings in all `beginTest()`, `expect()`, and other JUCE String-constructing calls — `juce::String(const char*)` asserts that all bytes are ≤ 127; use `-` not `—`, `...` not `…`
- Use a single meaningful assertion instead of looping hundreds of `expect()` calls — e.g. find max amplitude rather than 512 individual sample checks

### Reusability
- This skill works with any project that has stories in the `tasks/` format
- No project-specific references — everything is derived from the story file and architecture docs
