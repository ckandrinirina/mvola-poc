---
name: plan
description: >
  Generate epics, stories, roadmap, and dependencies from a spec.
  Creates structured tasks/ folder. Works for new projects and feature additions.
argument-hint: "<path-to-spec-file>"
---

# Project Architect — Specification to Epic/Story Planner

Transform a project specification document into a fully structured implementation plan
with epics, stories, dependencies, and a recommended roadmap.

**Supports two modes:**
- **New Project Mode:** Generate a full project plan from a specification
- **Feature Mode:** Generate scoped epics/stories for a new feature, aware of existing architecture

## INPUT

The user provides a path to a specification file or feature description via `$ARGUMENTS`.

**If `$ARGUMENTS` is empty or the file does not exist:**
- Ask the user: "Please provide the path to your project specification file (e.g., `docs/specifications.md`)."
- Validate the file exists using Read before proceeding.
- If the file is empty or trivially short (< 50 words), warn the user and ask if they want to continue.

---

## MODE DETECTION

**Goal:** Determine whether this is a new project or a feature addition.

### Detection Steps

1. Check if `docs/architecture/` exists with architecture docs
2. Check if `tasks/` directory exists with prior generated plans
3. Check the codebase for existing source files

### Decision Logic

```
IF docs/architecture/ exists OR tasks/ has prior plans:
  → FEATURE MODE (adding to an existing project)
ELSE:
  → NEW PROJECT MODE (planning from scratch)
```

### Feature Mode Activation

When in Feature Mode, present this to the user:

```
## Existing Project Detected

I found existing context:
- Architecture docs: [docs/architecture/ files found]
- Prior plans: [tasks/ folders found]

How would you like to proceed?

A) ADD FEATURE — Plan epics/stories for a new feature
   (I'll read existing architecture and prior plans as context)

B) FULL PROJECT PLAN — Replan the entire project from scratch
   (New dated folder in tasks/, existing plans untouched)

C) CONTINUE EXISTING PLAN — Add more epics/stories to a prior plan
   (Select which tasks/ folder to extend)
```

**If A (ADD FEATURE):**
1. Read ALL `docs/architecture/*.md` files for architectural context
2. Read `$ARGUMENTS` spec/feature file
3. Scan existing `tasks/` folders to understand what's already planned (avoid duplicating stories)
4. Ask: "What new feature do you want to plan?" (if not clear from the file)
5. Proceed to Phase 1 with feature-scoped analysis

**If B (FULL PROJECT PLAN):**
1. Proceed as New Project Mode (new dated folder, no conflict)

**If C (CONTINUE EXISTING PLAN):**
1. List existing `tasks/*/` folders, ask user to pick one
2. Read that plan's existing epics and stories
3. Ask: "What additional scope do you want to add?"
4. Generate new epics/stories that continue the numbering from the existing plan
   (e.g., if the last epic was 04, new ones start at 05)
5. Write new files into the SAME folder structure
6. Update ROADMAP.md to include the new epics

---

## PHASE 1: DEEP ANALYSIS

**Goal:** Build a comprehensive mental model of the project before generating any output.

### 1.1 Read the Specification

Read the entire specification file provided in `$ARGUMENTS` using the Read tool.

### 1.1b (Feature/Continue Mode) Read Existing Context

If in Feature Mode or Continue Mode, BEFORE extracting dimensions:

1. **Read all architecture docs** in `docs/architecture/` — this gives you the
   current system architecture, components, tech stack, APIs, and folder structure.
2. **Scan existing plans** in `tasks/` — read ROADMAP.md and EPIC.md files to
   understand what's already planned and what numbering to continue from.
3. **Scan the actual codebase** — use Glob to check which planned components
   already exist as source files. This tells you what's built vs. what's only planned.

This context prevents:
- Duplicating stories that already exist in prior plans
- Planning work that's already implemented in the codebase
- Creating epics that conflict with the existing architecture
- Proposing folder structures that contradict what's already in place

### 1.2 Extract Core Dimensions

Analyze and extract the following from the spec. Use extended thinking (ultrathink) to reason through ambiguities.

```
PROJECT IDENTITY
- Project name (derive a slug: lowercase, hyphens, no spaces)
- One-line description
- Problem it solves
- Target users / audience

ARCHITECTURE
- System architecture (monolith, microservices, client-server, etc.)
- Major components / sub-systems
- Data flow between components
- External integrations / third-party services

TECH STACK
- Languages, frameworks, runtimes per component
- Build tools, package managers
- Databases, message queues, protocols
- Deployment targets (OS, cloud, mobile platforms)

FEATURES & REQUIREMENTS
- All functional requirements (explicit and implied)
- Non-functional requirements (performance, security, latency targets)
- User-facing features vs. infrastructure/plumbing
- API surface (REST, WebSocket, gRPC, etc.)

PHASES / ROADMAP (if specified)
- Any phased rollout mentioned in the spec
- MVP vs. future scope
- Priority indicators
```

### 1.3 Research Tech Stack (when beneficial)

If the spec references frameworks, libraries, or protocols that would benefit from
current documentation lookup, use context7 MCP or WebSearch to:
- Confirm current best practices for the tech stack
- Identify any version-specific considerations
- Understand standard project structures for the frameworks used

Only do this for unfamiliar or rapidly-evolving technologies. Do not research well-understood fundamentals.

### 1.4 Identify Dependencies & Complexity

Map out:
- Which components depend on which (build order)
- Shared artifacts (proto files, shared types, config schemas)
- Integration points that require multiple components working together
- High-risk / high-complexity areas

---

## PHASE 2: EPIC & STORY STRUCTURING

**Goal:** Organize the analysis into a clean epic/story hierarchy.

### 2.1 Define Epics

Group related functionality into epics. Each epic should:
- Represent a coherent, deliverable chunk of work
- Be numbered sequentially (01, 02, 03, ...)
- Have a short, descriptive slug (e.g., `foundation-server`, `midi-arranger`, `mobile-ui`)
- Map roughly to a milestone or phase

**(Feature Mode) Numbering:**
- When adding to an existing plan (Continue Mode), continue numbering from the last
  epic in the existing plan (e.g., if last epic was 04, start at 05).
- When creating a standalone feature plan (Add Feature Mode), start numbering at 01
  within the new dated folder. Prefix the folder slug with `feature-` to distinguish
  it from the full project plan (e.g., `tasks/2026-04-13_feature-realtime-chat/`).

**(Feature Mode) Cross-references:**
- When stories depend on components from the existing plan or codebase, reference
  them explicitly: "Depends on: existing server/src/ws/handlers.rs (already implemented)"
  or "Depends on: Epic 02 Story 03 from tasks/2026-04-01_project-name/"
- This ensures the feature plan is self-contained but traceable to the main project.

**Epic ordering principles:**
- Infrastructure and foundation epics come first
- Epics with no dependencies on other epics come before those that depend on them
- If the spec defines phases, respect that ordering
- Within a phase, order by: shared/core code first, then feature code, then integration

### 2.2 Define Stories Within Each Epic

Break each epic into implementation stories. Each story should:
- Be a single, implementable unit of work (completable in one focused session)
- Be numbered sequentially within its epic (01, 02, 03, ...)
- Have a short descriptive slug
- Not mix unrelated concerns

**Story sizing guidance:**
- **S (Small):** Single file change, straightforward, < 1 hour. Example: add a config file, create a type definition.
- **M (Medium):** 2-5 files, some logic, 1-4 hours. Example: implement a REST endpoint with validation.
- **L (Large):** 5-10 files, significant logic or integration, 4-8 hours. Example: build a WebSocket gateway with serialization.
- **XL (Extra Large):** 10+ files or high complexity, 1-2 days. Example: implement a real-time engine. Consider splitting XL stories.

### 2.3 Map Story Dependencies

For each story, identify:
- Which other stories must be completed first (blockers)
- Which stories can run in parallel
- Cross-epic dependencies

---

## PHASE 3: PRESENT PLAN FOR CONFIRMATION

**Goal:** Show the user the planned structure before writing any files.

Present a summary in this format:

```
## Project Plan: [Project Name]

### Epics ([count] total)

**Epic 01: [Name]** ([story count] stories)
  - 01: [Story title] (Size) [dependencies if any]
  - 02: [Story title] (Size)
  ...

**Epic 02: [Name]** ([story count] stories)
  - 01: [Story title] (Size) [blocked by Epic 01]
  ...

[... all epics ...]

### Suggested Implementation Order
1. [Epic/story] - [reason]
2. [Epic/story] - [reason]
...

### Output Location
tasks/YYYY-MM-DD_[project-slug]/

Proceed with generating the full plan? YES / NO / ADJUST
```

**Wait for explicit user confirmation before proceeding to Phase 4.**

If the user says ADJUST, ask what they want to change and loop back to Phase 2.

---

## PHASE 4: GENERATE OUTPUT FILES

**Goal:** Create the full folder structure with detailed content.

### 4.1 Create Directory Structure

**(New Project Mode)** Create the following structure:

```
tasks/
└── YYYY-MM-DD_<project-slug>/
    ├── PROJECT_OVERVIEW.md
    ├── epics/
    │   ├── 01_<epic-slug>/
    │   │   ├── EPIC.md
    │   │   └── stories/
    │   │       ├── 01_<story-slug>.md
    │   │       ├── 02_<story-slug>.md
    │   │       └── ...
    │   ├── 02_<epic-slug>/
    │   │   ├── EPIC.md
    │   │   └── stories/
    │   │       └── ...
    │   └── ...
    └── ROADMAP.md
```

**(Feature Mode — Add Feature)** Create a feature-specific folder:

```
tasks/
└── YYYY-MM-DD_feature-<feature-slug>/
    ├── FEATURE_OVERVIEW.md          # Instead of PROJECT_OVERVIEW.md
    ├── epics/
    │   ├── 01_<epic-slug>/
    │   │   ├── EPIC.md
    │   │   └── stories/
    │   │       └── ...
    │   └── ...
    └── ROADMAP.md
```

The FEATURE_OVERVIEW.md replaces PROJECT_OVERVIEW.md and includes:
- Feature description and motivation
- Which existing components are affected
- New components being introduced
- Integration points with the existing system

**(Feature Mode — Continue)** Add to the existing folder:

```
tasks/
└── YYYY-MM-DD_<existing-project-slug>/     # Same folder
    ├── PROJECT_OVERVIEW.md                  # Unchanged
    ├── epics/
    │   ├── ... (existing epics unchanged)
    │   ├── 05_<new-epic-slug>/              # Continues numbering
    │   │   ├── EPIC.md
    │   │   └── stories/
    │   │       └── ...
    │   └── ...
    └── ROADMAP.md                           # Updated with new epics
```

Use today's date for YYYY-MM-DD.

### 4.2 PROJECT_OVERVIEW.md Content

```markdown
# Project Overview: [Project Name]

## Vision
[One paragraph describing the project vision and what problem it solves]

## Architecture
[Architecture diagram using ASCII/text, derived from the spec]

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| ...   | ...       | ...     |

## Components
### [Component 1 Name]
- **Purpose:** [what it does]
- **Technology:** [stack]
- **Key responsibilities:** [list]

### [Component 2 Name]
...

## Key Design Decisions
- [Decision 1]: [rationale]
- [Decision 2]: [rationale]

## Non-Functional Requirements
- **Performance:** [targets]
- **Security:** [considerations]
- **Compatibility:** [platforms/OS]

## References
- Specification: [path to original spec file]
- Generated: [date]
```

### 4.3 EPIC.md Content (per epic)

```markdown
# Epic [NN]: [Epic Title]

## Description
[2-3 paragraphs describing the epic scope, what it delivers, and why it matters]

## Goals
- [Goal 1]
- [Goal 2]
- [Goal 3]

## Scope
### In Scope
- [Item]
- [Item]

### Out of Scope
- [Item]

## Dependencies
- **Depends on:** [List of prerequisite epics/stories, or "None"]
- **Blocks:** [List of epics/stories that depend on this]

## Stories
| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | [Title] | M | TODO |
| 02 | [Title] | L | TODO |
| ... | ... | ... | ... |

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Notes
[Any architectural decisions, patterns, or constraints specific to this epic]
```

### 4.4 Story File Content (per story)

```markdown
# Story [EE]-[SS]: [Story Title]

> **Epic:** [Epic Name]
> **Size:** [S/M/L/XL]
> **Status:** TODO

## Description
[Clear description of what this story implements and why]

## Acceptance Criteria
- [ ] [Criterion 1 - specific, testable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Criterion N]

## Technical Notes
[Implementation guidance, patterns to follow, algorithms to use,
 API contracts, data structures, etc.]

## Files to Create/Modify
| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | path/to/new/file.ext | [what it does] |
| MODIFY | path/to/existing.ext | [what changes] |

## Dependencies
- **Blocked by:** [Story IDs or "None"]
- **Blocks:** [Story IDs or "None"]

## Related
- **Epic:** [Epic slug]
- **Related stories:** [Story IDs if any]
- **Spec reference:** [Section of the spec this maps to]
```

### 4.5 ROADMAP.md Content

```markdown
# Implementation Roadmap: [Project Name]

## Dependency Graph

[ASCII diagram showing epic dependencies]

## Recommended Implementation Order

### Phase 1: [Phase Name]
**Goal:** [What this phase achieves]

1. **[Epic/Story ID]** - [Title] ([Size])
   - [Why this comes first]
2. **[Epic/Story ID]** - [Title] ([Size])
   - [Dependency or reason]
...

### Phase 2: [Phase Name]
...

## Parallelization Opportunities
- [Story A] and [Story B] can be developed simultaneously because [reason]
- [Epic X] backend work can overlap with [Epic Y] frontend work

## Critical Path
The longest sequential chain is:
[Story] -> [Story] -> [Story] -> ...

## Risk Areas
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk 1] | [High/Medium/Low] | [How to mitigate] |
| [Risk 2] | ... | ... |

## Milestones
| Milestone | Epics Included | Deliverable |
|-----------|---------------|-------------|
| [Name] | Epic 01, 02 | [What's usable] |
| [Name] | Epic 03 | [What's added] |
```

---

## PHASE 5: SUMMARY

**(New Project Mode)** After all files are created, present:

```
## Plan Generated Successfully

**Mode:** New Project
**Location:** tasks/YYYY-MM-DD_[project-slug]/
**Epics:** [count]
**Stories:** [total count]

### Quick Stats
- S stories: [count]
- M stories: [count]
- L stories: [count]
- XL stories: [count]

### Next Steps
1. Review the generated plan in tasks/
2. Adjust stories or sizing as needed
3. Use `/publish` to publish to GitHub Issues (optional)
4. Start implementation with the first story in the roadmap
```

**(Feature Mode — Add Feature)** After feature plan is created:

```
## Feature Plan Generated Successfully

**Mode:** Add Feature
**Feature:** [feature name]
**Location:** tasks/YYYY-MM-DD_feature-[feature-slug]/
**Epics:** [count]
**Stories:** [total count]

### Integration Points
- Existing components affected: [list]
- New components introduced: [list]
- Cross-references to main plan: [list of dependencies on existing stories/epics]

### Quick Stats
- S stories: [count]
- M stories: [count]
- L stories: [count]
- XL stories: [count]

### Next Steps
1. Review the feature plan in tasks/
2. Use `/publish tasks/YYYY-MM-DD_feature-[slug]` to publish to GitHub Issues
3. Start with the first story in the feature roadmap
```

**(Feature Mode — Continue)** After extending existing plan:

```
## Plan Extended Successfully

**Mode:** Continue Existing Plan
**Location:** tasks/[existing-folder]/
**New epics added:** [count] (numbered [NN] to [MM])
**New stories added:** [total count]
**Total plan now:** [total epics] epics, [total stories] stories

### What Was Added
- Epic [NN]: [Title] ([story count] stories)
- Epic [MM]: [Title] ([story count] stories)

### Next Steps
1. Review the new epics in tasks/[existing-folder]/epics/
2. ROADMAP.md has been updated with the new epics
3. Use `/publish` to publish new epics to GitHub Issues
```

---

## IMPORTANT GUIDELINES

- **Language:** All output must be in English, regardless of the specification language.
- **No hardcoding:** Never reference specific project names, technologies, or paths in the skill logic. Derive everything from the spec.
- **Thoroughness:** Every functional requirement in the spec should map to at least one story. If a requirement is vague, create a story for it with a note about needed clarification.
- **Scanning readability:** Use tables, bullet points, and headers. Avoid walls of text.
- **Conservative sizing:** When in doubt, size up. An L is better than a surprise XL.
- **Preserve spec language:** When the spec uses specific technical terms, preserve them in story titles and descriptions.
- **Date format:** Always use ISO 8601 (YYYY-MM-DD) for the folder name.
- **Reusability:** This skill must work with any project specification, not just the current project.
