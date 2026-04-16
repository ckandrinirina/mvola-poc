---
name: track
description: >
  Show project progress dashboard. Tracks story status, suggests next
  story to implement, displays epic completion percentages.
argument-hint: "[status|next|progress]"
---

# Story Tracker — Project Progress Dashboard

Scans all stories in `tasks/` and presents a live view of project progress,
story statuses, and recommendations for what to implement next.

---

## INPUT

`$ARGUMENTS` determines the command:

| Command | What It Does |
|---------|-------------|
| (empty) or `status` | Full status dashboard with all stories |
| `next` | Suggest the next story ready for implementation |
| `progress` | Epic completion percentages and overall progress |

---

## PHASE 1: SCAN STORIES

**This phase runs for ALL commands.**

### 1.1 Find All Task Plans

Use Glob to find all task plan folders: `tasks/*/PROJECT_OVERVIEW.md` and `tasks/*/FEATURE_OVERVIEW.md`

If no task plans found:
```
No task plans found in tasks/. 
Run /plan to generate epics and stories first.
```
→ STOP

### 1.2 Find All Stories

For each task plan folder, use Glob to find:
- All epic files: `tasks/*/epics/*/EPIC.md`
- All story files: `tasks/*/epics/*/stories/*.md`

### 1.3 Parse Each Story

Read each story file and extract:
- **Story ID:** from filename and path (e.g., `01-03`)
- **Title:** from the `# Story` header
- **Epic:** from the `> **Epic:**` field
- **Size:** from the `> **Size:**` field
- **Status:** from the `> **Status:**` field (TODO / IN PROGRESS / DONE)
- **Blocked by:** from the `## Dependencies` section
- **Blocks:** from the `## Dependencies` section

### 1.4 Parse Each Epic

Read each EPIC.md and extract:
- **Epic ID:** from the `# Epic [NN]` header
- **Title:** from the header
- **Story count:** from the stories table
- **Completed stories:** count of DONE stories

### 1.5 Build Dependency Graph

For each story with dependencies:
- Check if blocking stories are DONE
- Mark as `ready` (all blockers done) or `blocked` (some blockers not done)

---

## COMMAND: status (default)

Present the full dashboard:

```
## Project Progress: [project name from PROJECT_OVERVIEW.md]

**Plan:** [tasks folder name]
**Total:** [X] epics, [Y] stories
**Progress:** [done]/[total] stories ([percentage]%)

[============================-----------] 72%

### Epic 01: [Title] ([done]/[total])
[==========----------] 50%
  [x] 01-01: [Title] (S) — DONE
  [x] 01-02: [Title] (M) — DONE
  [>] 01-03: [Title] (L) — IN PROGRESS
  [ ] 01-04: [Title] (M) — TODO (ready)
  [~] 01-05: [Title] (S) — TODO (blocked by 01-03)

### Epic 02: [Title] ([done]/[total])
[--------------------] 0%
  [~] 02-01: [Title] (L) — TODO (blocked by 01-02)
  [ ] 02-02: [Title] (M) — TODO (ready — 01-02 is done)
  ...

[... continue for all epics ...]

### Summary
- DONE: [count] stories
- IN PROGRESS: [count] stories
- TODO (ready): [count] stories
- TODO (blocked): [count] stories

### Quick Actions
- Next story: /build [path to next recommended story]
- Full progress: /track progress
```

**Status icons:**
- `[x]` = DONE
- `[>]` = IN PROGRESS
- `[ ]` = TODO (ready — all dependencies met)
- `[~]` = TODO (blocked — waiting on other stories)

---

## COMMAND: next

Find and suggest the next best story to implement.

### Selection Algorithm

1. Filter to `Status: TODO` stories only
2. Remove blocked stories (dependencies not DONE)
3. From remaining, prioritize by:
   a. **Epic order** — lower epic number first (foundation before features)
   b. **Story order** — lower story number within epic first
   c. **Size** — smaller stories first for quick wins (S > M > L > XL)
   d. **Unblocking potential** — prefer stories that unblock the most other stories

### Present Recommendation

```
## Next Story to Implement

**Recommended:** [Story ID] — [Title]
**Epic:** [Epic title]
**Size:** [S/M/L/XL]
**Why this one:** [reason — e.g., "First unblocked story in Epic 01, unblocks 3 other stories"]

### Acceptance Criteria Preview
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Files to Touch
- [file list from story]

**Implement now?**
Run: /build [full path to story file]

### Also Ready ([count] more)
- [Story ID]: [Title] (Size)
- [Story ID]: [Title] (Size)
- ...
```

If no stories are ready:
```
## No Stories Ready

All remaining TODO stories are blocked by incomplete dependencies.

### Blocking Chain
- [Story X] (IN PROGRESS) blocks: [Story Y], [Story Z]
- [Story A] (TODO) blocks: [Story B], [Story C]

Complete the IN PROGRESS stories first, then more will unblock.
```

---

## COMMAND: progress

Show high-level epic completion with metrics.

```
## Project Progress Report

**Project:** [name]
**Generated:** [date of plan]
**As of:** [today]

### Overall
[================================--------] 80%
[done]/[total] stories complete

### By Size
| Size | Done | Total | Remaining |
|------|------|-------|-----------|
| S | [X] | [Y] | [Z] |
| M | [X] | [Y] | [Z] |
| L | [X] | [Y] | [Z] |
| XL | [X] | [Y] | [Z] |

### By Epic
| Epic | Title | Done | Total | Progress |
|------|-------|------|-------|----------|
| 01 | [Title] | [X] | [Y] | [========--] 80% |
| 02 | [Title] | [X] | [Y] | [====------] 40% |
| 03 | [Title] | [X] | [Y] | [----------] 0% |

### Velocity (if enough data)
- Stories completed: [count]
- Average per day: [estimate based on DONE dates in Implementation Summary]

### Bottlenecks
- [Blocked story count] stories waiting on dependencies
- Biggest blocker: [Story X] — blocks [N] other stories

### Milestone Tracker (from ROADMAP.md)
| Milestone | Status | Epics |
|-----------|--------|-------|
| [Name] | [X]/[Y] epics done | Epic 01, 02 |
| [Name] | [X]/[Y] epics done | Epic 03 |
```

---

## MULTIPLE TASK PLANS

If multiple task plan folders exist in `tasks/` (e.g., full project + feature plans):
- Show each plan separately
- Prefix with the plan folder name
- Feature plans show as: `[Feature] YYYY-MM-DD_feature-xxx`

```
## Project Plans Found

1. tasks/2026-04-13_ck-synth/ (main project — 4 epics, 18 stories)
2. tasks/2026-04-20_feature-midi-record/ (feature — 2 epics, 7 stories)

Showing status for: ALL (use /track status tasks/2026-04-13_ck-synth to filter)
```

---

## IMPORTANT GUIDELINES

- **Read-only:** This skill only reads story/epic files. It never modifies them.
- **Live data:** Always read files fresh. Never cache or assume state.
- **Graceful handling:** If a story file is malformed, skip it with a warning rather than failing.
- **Reusable:** Works with any project using the `tasks/` folder structure from `project-architect`.
- **Language:** All output in English.
