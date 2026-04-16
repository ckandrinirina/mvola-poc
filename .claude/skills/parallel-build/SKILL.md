---
name: parallel-build
description: >
  Implement multiple ready stories in parallel using git worktrees and sub-agents.
  Discovers all stories with dependencies met, lets you pick which to run,
  dispatches parallel sub-agents each invoking /build, then runs QA and conflict analysis.
argument-hint: "[story-ids...]  # optional: pre-select stories e.g. 02-05 03-01"
user-invocable: true
---

# Parallel Build — Multi-Story Parallel Implementation

Implements multiple stories simultaneously using git worktrees + parallel sub-agents.
Each sub-agent invokes `/build` on its story in isolation. Ends with QA validation
and conflict analysis before any merge.

---

## INPUT

`$ARGUMENTS` is an optional space-separated list of story IDs (e.g. `02-05 03-01`).

- **If provided:** skip Phase 2 selection, go directly to Phase 3 with those stories.
- **If empty:** run the interactive selection flow (Phase 2).

---

## PHASE 1: DISCOVERY

**Goal:** Find all stories that are ready to implement right now.

### 1.1 Parse Story Files

Use Glob to find all story files:
```
tasks/*/epics/*/stories/*.md
```

For each file, extract using Read:
- `Status:` field (look for `**Status:** TODO / DONE / IN PROGRESS / SKIP`)
- `Size:` field (look for `**Size:** S / M / L / XL`)
- `Blocked by:` field in the Dependencies section
- Story ID from filename: `NN_story-name.md` → ID is `EPIC_NN-STORY_NN` derived from the folder path
- Epic name from parent folder name (e.g. `02_juce-engine` → `02 · JUCE Engine`)

**Story ID convention:** epic folder `02_juce-engine`, story file `05_mixer.md` → ID `02-05`

### 1.2 Resolve Dependency Graph

Build a map of story ID → `{ status, size, epic, blockedBy: [] }`.

A story is **ready** if:
- `Status` is `TODO`
- Every story ID listed in `Blocked by:` has `Status: DONE`
- (Stories with empty `Blocked by:` are always ready if TODO)

### 1.3 Handle Empty Result

If no ready stories are found: tell the user which stories are TODO but still blocked,
and which of their blocking deps are not yet DONE. Stop.

---

## PHASE 2: INTERACTIVE SELECTION

**Goal:** Show ready stories and let the user pick which ones to implement.

Skip this phase if story IDs were passed as `$ARGUMENTS`.

### 2.1 Display Table

Print a formatted table:

```
Ready stories (N available):

 #  Story  Epic                        Size  Deps met
─────────────────────────────────────────────────────
 1  02-05  02 · JUCE Engine            M     02-01 ✓  02-02 ✓
 2  02-06  02 · JUCE Engine            L     02-03 ✓  02-04 ✓
 3  03-01  03 · Rust Server            S     01-01 ✓
 4  03-02  03 · Rust Server            M     01-01 ✓
 5  04-01  04 · Mobile                 S     (no deps)
...

Pick stories to implement (e.g. "1 3 4" or "all"):
```

### 2.2 Wait for Input

Use AskUserQuestion to wait for the user's selection.

Parse their response:
- `"all"` → select every story in the table
- `"1 3 4"` → select stories at positions 1, 3, 4
- `"02-05 03-01"` → match by story ID directly

If input is invalid or empty, ask again once. If still invalid, stop.

---

## PHASE 3: PARALLEL EXECUTION

**Goal:** Create worktrees and dispatch all sub-agents in one parallel batch.

### 3.1 Model Selection

For each selected story, determine the model based on `Size:`:

| Size | Model |
|------|-------|
| S    | `claude-sonnet-4-6` |
| M    | `claude-sonnet-4-6` |
| L    | `claude-opus-4-6` |
| XL   | `claude-opus-4-6` |

### 3.2 Announce Launch

Print a summary before dispatching:

```
Launching N agents in parallel:

  Story 02-05  (M)  →  claude-sonnet-4-6  →  branch story/02-05
  Story 02-06  (L)  →  claude-opus-4-6    →  branch story/02-06
  Story 03-01  (S)  →  claude-sonnet-4-6  →  branch story/03-01

Starting now...
```

### 3.3 Dispatch All Agents — SINGLE MESSAGE, TRULY PARALLEL

**CRITICAL:** You MUST dispatch ALL sub-agents in a single response message (multiple
Agent tool calls in one turn). Do NOT dispatch them sequentially.

For each selected story, dispatch one Agent call with:

```
subagent_type: general-purpose
model: [determined in 3.1]
isolation: worktree
description: "Implement story XX-YY: [story title]"
prompt: |
  You are implementing story XX-YY of the ck-synth project.

  Story file: [full path to story markdown file]
  Branch: story/XX-YY

  Your task:
  1. Read the story file at the path above
  2. Invoke the /build skill using the Skill tool:
     Skill({ skill: "build", args: "[full path to story markdown file]" })
  3. Follow the /build skill completely — it handles TDD, SOLID principles, QA, and commit

  Important:
  - Work only on files relevant to this story
  - Do not modify story files in tasks/ (the /build skill updates those)
  - If /build completes successfully, your job is done
  - If /build fails or encounters a blocker, report the error clearly in your final response
```

### 3.4 Collect Results

After all agents complete, collect each agent's result:
- Note which stories **succeeded** vs **failed**
- For failed stories, capture the error message

Print a status summary:
```
Agent results:
  02-05  →  ✓ completed
  02-06  →  ✗ failed: [brief error]
  03-01  →  ✓ completed
```

---

## PHASE 4: CONFLICT ANALYSIS

**Goal:** Detect file-level conflicts between completed story branches before any merge.

Only analyse branches for **successfully completed** stories.

### 4.1 Get Branch Names

For each successful story, the worktree branch is `story/XX-YY`.
Use Bash to confirm:
```bash
git branch --list "story/*"
```

### 4.2 Dry-Run Merge Each Branch

For each successful story branch, attempt a dry-run merge onto main/current branch:

```bash
git checkout main
git merge --no-commit --no-ff story/XX-YY 2>&1
git merge --abort 2>/dev/null || true
```

Record which files would have conflicts (look for `CONFLICT` lines in output).

### 4.3 Cross-Branch Conflict Detection

Also detect when two story branches both modify the same file (even if each merges
cleanly onto main — they may conflict with each other):

```bash
git diff --name-only main...story/XX-YY
```

Run this for each branch and collect modified file sets.
Any file appearing in 2+ branches is a potential conflict.

### 4.4 Report

Print the conflict report:

```
Conflict Analysis:
─────────────────────────────────────────────────────
  02-05  →  no conflicts with main
  03-01  →  no conflicts with main
  
  Cross-branch file overlaps:
    server/src/lib.rs   →  modified by 02-05 AND 03-01  ⚠️

  Suggested merge order (safest first):
    1. story/03-01
    2. story/02-05   (may need rebase after 03-01 merges)
─────────────────────────────────────────────────────
```

If no conflicts at all: print "No conflicts detected — all branches merge cleanly."

---

## PHASE 5: QA & TESTING

**Goal:** Validate builds, tests, and lint for each completed story's worktree.

Run QA per story based on which epic/component the story belongs to.
Use the worktree path returned by each agent's result.

### Engine stories (epic 02):
```bash
cd [worktree-path]/engine
cmake --build build --config Release 2>&1
# Check: binary exists at engine/build/Release/pc-arrangeur-engine
```

### Server stories (epics 03, 09):
```bash
cd [worktree-path]/server
cargo test 2>&1
cargo clippy -- -D warnings 2>&1
cargo fmt --check 2>&1
```

### Desktop stories (epic 10, 11, 12, 13):
```bash
cd [worktree-path]/desktop/src-tauri
cargo test 2>&1
cargo clippy -- -D warnings 2>&1
```

### Mobile stories (epic 04):
```bash
cd [worktree-path]/mobile
pnpm run typescript 2>&1
npx eslint . 2>&1
```

### QA Report

Print per story:
```
QA Report:
─────────────────────────────────────────────────────
  02-05  →  ✓ build passed   ✓ tests passed   ✓ lint clean
  03-01  →  ✓ cargo test     ✗ clippy: 2 warnings treated as errors
             BLOCKED from merge — worktree kept for fix
─────────────────────────────────────────────────────
```

Mark stories with QA failures as **BLOCKED from merge**.

---

## PHASE 6: CLEANUP PROMPT

**Goal:** Ask the user what to do next.

Print a final summary:
```
Summary:
  ✓ Ready to merge:   story/02-05  (QA passed, no conflicts)
  ⚠ Review needed:   story/03-01  (QA failed: clippy errors)
  ✗ Build failed:    story/02-06  (agent error during /build)

What would you like to do?
  [1] Merge ready branches now (conflict-free order)
  [2] Review worktrees first, merge manually
  [3] Re-run /build on failing stories
```

Use AskUserQuestion to wait for the user's choice.

**If user picks 1:** merge QA-passing, conflict-free branches in suggested order:
```bash
git checkout main
git merge --no-ff story/XX-YY -m "feat: implement story XX-YY"
```

**If user picks 2:** print worktree paths and stop. Worktrees stay intact.

**If user picks 3:** re-run Phase 3 only for failed/blocked stories (dispatch new agents).

---

## RULES

- **Never merge** a story branch without QA passing first
- **Never delete** a worktree automatically — always leave that to the user
- **Never modify** story files in `tasks/` directly — `/build` handles that
- **Always dispatch all agents in one message** — not sequentially
- **If only 1 story is selected:** the full flow still runs (worktree + QA + conflict check),
  it just skips cross-branch analysis
