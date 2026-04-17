---
name: design
description: >
  Refine a spec into detailed architecture docs (docs/architecture/).
  Conversational Q&A fills gaps. Works for new projects and feature additions.
  Never modifies the original spec. Run before /plan.
argument-hint: "[path-to-spec-file]"
---

# Spec Designer — Specification Refiner & Architecture Documenter

Read a project specification, identify gaps through conversational questioning,
and generate a complete set of split architecture documentation ready for development.

**Supports two modes:**
- **New Project Mode:** Generate full architecture docs from a project spec
- **Feature Mode:** Extend existing architecture docs with new feature documentation

**Important:** This skill NEVER modifies the original specification file. It reads it
as the source of truth and produces refined, detailed documentation in `docs/architecture/`.

---

## INPUT

The user provides a path to a specification file or feature description via `$ARGUMENTS`.

**If `$ARGUMENTS` is empty:**
- Look for common spec file locations: `docs/specifications.md`, `docs/spec.md`, `SPEC.md`, `docs/requirements.md`
- If found, ask the user to confirm: "I found [path]. Use this as the base specification?"
- If not found, ask: "No specification file found. Would you like to:"
  - **A)** Provide the path to your spec file
  - **B)** Start from scratch (I'll guide you through creating the architecture docs)

**If the file does not exist:** Tell the user and ask for the correct path.

---

## MODE DETECTION

**Goal:** Determine whether this is a new project or a feature addition to an existing project.

### Detection Steps

1. Check if `docs/architecture/` already exists using Glob
2. Check if `tasks/` directory exists with prior epics
3. Check the codebase for existing source files beyond just docs

### Decision Logic

```
IF docs/architecture/ exists AND has files:
  → FEATURE MODE (extending an existing project)
ELSE:
  → NEW PROJECT MODE (generating from scratch)
```

### Feature Mode Activation

When in **Feature Mode**, present this to the user:

```
## Existing Project Detected

I found existing architecture documentation in docs/architecture/.
Existing docs: [list files found]

How would you like to proceed?

A) ADD FEATURE — Extend the architecture docs with a new feature
   (I'll read existing docs as context and only add/update what's needed)

B) FULL REFRESH — Regenerate all architecture docs from scratch
   (Existing docs will be backed up to docs/architecture/backup_YYYY-MM-DD/)

C) I'm working on a different project — treat this as new
```

If user selects **A (ADD FEATURE):**
1. Read ALL existing `docs/architecture/*.md` files to understand current architecture
2. Read the spec file provided in `$ARGUMENTS` (could be the original spec or a feature spec)
3. Ask the user: "What new feature or capability do you want to add?"
4. Proceed to Phase 1 with feature-scoped analysis (see FEATURE MODE sections below)

If user selects **B (FULL REFRESH):**
1. Back up existing docs: `mv docs/architecture docs/architecture/backup_YYYY-MM-DD`
2. Proceed as New Project Mode

If user selects **C:**
1. Proceed as New Project Mode

---

## PHASE 1: READ & ASSESS THE SPECIFICATION

**Goal:** Understand what the spec covers and identify what's missing or vague.

### 1.1 Read the Specification

Read the entire file using the Read tool. If the spec is in a non-English language,
process it in its original language but produce all output in English.

### 1.1b (Feature Mode) Read Existing Architecture Context

If in Feature Mode, BEFORE assessing coverage:
1. Read ALL files in `docs/architecture/` to understand the current state
2. Read existing source code structure using Glob to understand what's already built
3. Build a mental model of: what exists, what the new feature needs to integrate with

This context is critical — new feature docs must be consistent with existing architecture.

### 1.2 Assess Coverage

Score each architecture dimension on a 3-point scale:

| Dimension | Status | Notes |
|-----------|--------|-------|
| Project vision & goals | CLEAR / PARTIAL / MISSING | |
| Target users | CLEAR / PARTIAL / MISSING | |
| System architecture | CLEAR / PARTIAL / MISSING | |
| Folder structure | CLEAR / PARTIAL / MISSING | |
| Tech stack & versions | CLEAR / PARTIAL / MISSING | |
| Component breakdown | CLEAR / PARTIAL / MISSING | |
| Data flow | CLEAR / PARTIAL / MISSING | |
| API contracts | CLEAR / PARTIAL / MISSING | |
| Database schema | CLEAR / PARTIAL / MISSING | |
| Configuration | CLEAR / PARTIAL / MISSING | |
| Build & run instructions | CLEAR / PARTIAL / MISSING | |
| Non-functional requirements | CLEAR / PARTIAL / MISSING | |

### 1.3 Present Assessment

Show the user the coverage table:

```
## Specification Assessment

Your spec covers [X]/12 dimensions clearly.

| Dimension | Status |
|-----------|--------|
| ... | CLEAR |
| ... | PARTIAL - [what's vague] |
| ... | MISSING |

I'll ask you some questions to fill the gaps. This will take [N] rounds
of 2-3 questions each, focused on the PARTIAL and MISSING areas.

Ready to start? YES / SKIP (generate with what we have)
```

If the user says SKIP, jump directly to Phase 3 and generate docs using only
what's available in the spec (mark gaps with `[TO BE DEFINED]` placeholders).

---

## PHASE 2: CONVERSATIONAL REFINEMENT

**Goal:** Fill gaps and clarify ambiguities through adaptive questioning.

### Questioning Strategy

- Ask **2-3 questions per round** maximum
- Start with the highest-impact MISSING dimensions first
- For PARTIAL dimensions, ask targeted questions about the vague parts
- Adapt follow-up questions based on previous answers
- Use the user's previous answers to inform smarter questions

### (Feature Mode) Feature-Specific Questions

When in Feature Mode, replace the standard question flow with feature-scoped questions:

1. **Feature Scope & Integration**
   - "Describe the new feature in detail. What should it do?"
   - "Which existing components does this feature interact with?"
   - "Does this feature require new components, or does it extend existing ones?"

2. **Feature Architecture**
   - "Does this feature need new API endpoints, database tables, or config?"
   - "Are there new data flows or message types?"
   - "Any new dependencies or libraries needed?"

3. **Feature Boundaries**
   - "What's in scope for this feature vs. future work?"
   - "Any performance, security, or compatibility requirements specific to this feature?"
   - "Does this change affect the existing folder structure?"

After gathering feature answers, map the impact to specific architecture docs that
need to be updated (e.g., new endpoints → update api-contracts.md, new tables → update database-schema.md).

### Question Priority Order (New Project Mode)

1. **Architecture & Components** (if MISSING/PARTIAL)
   - "What's the high-level architecture? (monolith, microservices, client-server, etc.)"
   - "What are the main components/services and how do they communicate?"
   - "Do you already have an idea for the folder structure, or should I propose one based on the tech stack?"

2. **Tech Stack** (if MISSING/PARTIAL)
   - "What languages/frameworks are you using for each component?"
   - "Any specific versions or constraints?"
   - "What's the deployment target? (local, cloud, mobile, cross-platform)"

3. **Data Flow & APIs** (if MISSING/PARTIAL)
   - "How does data flow between components? (REST, WebSocket, gRPC, message queue, etc.)"
   - "What are the main API endpoints or message types?"
   - "What serialization format? (JSON, Protobuf, MessagePack, etc.)"

4. **Database & State** (if MISSING/PARTIAL)
   - "What database(s) are you using?"
   - "What are the main entities/tables?"
   - "Any caching layer or state management approach?"

5. **Configuration & Environment** (if MISSING/PARTIAL)
   - "What configuration does the app need? (env vars, config files, etc.)"
   - "Any platform-specific configuration? (macOS vs Windows, dev vs prod)"

6. **Build & Run** (if MISSING/PARTIAL)
   - "What are the prerequisites to build and run?"
   - "Any specific build steps or order of startup?"

7. **Non-Functional Requirements** (if MISSING/PARTIAL)
   - "Any performance targets? (latency, throughput)"
   - "Security considerations?"
   - "Platform/browser compatibility?"

### When Spec Already Covers a Dimension

For CLEAR dimensions, do NOT re-ask. Instead, briefly confirm:
"Your spec already defines [dimension] clearly. I'll use that as-is."

For PARTIAL dimensions, only ask about the missing parts:
"Your spec mentions [what's there] but doesn't cover [what's missing]. Can you clarify?"

### Research During Refinement

When the user mentions specific technologies, use context7 MCP or WebSearch to:
- Look up current best practices for project structure
- Verify standard folder conventions for the frameworks mentioned
- Check for recommended configuration patterns

This helps propose informed folder structures and architecture patterns.

### Refinement Loop

After each round of questions:
1. Summarize what was learned
2. Check if remaining gaps exist
3. If yes, ask the next round of questions
4. If all dimensions are CLEAR or user says "enough", move to Phase 3

Maximum **5 rounds** of questions. If gaps remain after 5 rounds, proceed to
generation and mark remaining gaps with `[TO BE DEFINED]`.

---

## PHASE 3: GENERATE ARCHITECTURE DOCUMENTATION

**Goal:** Create or update the split documentation files in `docs/architecture/`.

### 3.1 Confirm Before Writing

**(New Project Mode)** Present what will be generated:

```
## Architecture Docs to Generate

**Output:** docs/architecture/
**Files:** [list of files that will be created]

Note: Your original specification at [path] will NOT be modified.

Proceed? YES / NO / ADJUST
```

**(Feature Mode)** Present what will be updated:

```
## Architecture Docs to Update

**Feature:** [feature name/description]
**Output:** docs/architecture/

**Files to UPDATE** (new sections appended, existing sections preserved):
- [file.md]: Adding [what] section
- [file.md]: Extending [what] section

**Files to CREATE** (new, feature didn't exist before):
- [file.md]: [why needed]

**Files UNCHANGED** (not affected by this feature):
- [file.md]

Note: Existing content will be preserved. New feature sections will be
clearly marked with a "## [Feature Name]" header or appended to
the relevant existing sections.

Proceed? YES / NO / ADJUST
```

### 3.2 Create Directory

```bash
mkdir -p docs/architecture
```

### (Feature Mode) Update Strategy

When updating existing architecture docs, follow these rules:

1. **NEVER delete or overwrite existing content.** Only add or extend.
2. **For files that need new sections** (e.g., new component in components.md):
   - Read the existing file
   - Append the new section at the appropriate location
   - Use the Edit tool to insert content, not Write to overwrite
3. **For files that need extended sections** (e.g., new endpoint in api-contracts.md):
   - Read the existing file
   - Find the relevant section
   - Add the new content under the existing structure
4. **For the README.md index:**
   - If new files were created, add them to the index table
   - Add a "## Changelog" section at the bottom tracking what was added and when:
     ```
     ## Changelog
     - [date]: Added [feature name] — updated [list of files]
     ```
5. **Create a feature-specific file** when the feature is large enough:
   - `docs/architecture/features/YYYY-MM-DD_<feature-slug>.md`
   - This file describes the feature's architecture in full detail
   - Cross-reference it from the updated main docs

### 3.3 Generate README.md (Index)

**File:** `docs/architecture/README.md`

```markdown
# Architecture Documentation

> Auto-generated from [original spec path] on [date]
> Original specification is the source of truth and was not modified.

## Documents

| Document | Description |
|----------|-------------|
| [overview.md](overview.md) | Project vision, goals, and target users |
| [folder-structure.md](folder-structure.md) | Complete project directory tree |
| [tech-stack.md](tech-stack.md) | Languages, frameworks, and versions |
| [components.md](components.md) | Component descriptions and responsibilities |
| [data-flow.md](data-flow.md) | How data moves between components |
| [api-contracts.md](api-contracts.md) | API definitions (REST, WebSocket, gRPC, etc.) |
| [database-schema.md](database-schema.md) | Database tables, relations, and models |
| [configuration.md](configuration.md) | Config files, environment variables |
| [dev-guide.md](dev-guide.md) | Prerequisites, setup, build, and run instructions |

## Source
- **Original spec:** [path]
- **Generated:** [date]
- **Gaps remaining:** [count or "None"]
```

### 3.4 Generate overview.md

```markdown
# Project Overview

## Vision
[What the project does and the problem it solves - 1-2 paragraphs]

## Goals
- [Goal 1]
- [Goal 2]
- [Goal 3]

## Target Users
- [User type 1]: [what they do with the system]
- [User type 2]: [what they do with the system]

## Key Constraints
- [Constraint 1]
- [Constraint 2]

## Scope
### In Scope
- [Item]

### Out of Scope / Future
- [Item]
```

### 3.5 Generate folder-structure.md

```markdown
# Project Folder Structure

## Overview
[Brief explanation of how the project is organized]

## Directory Tree

[Complete ASCII tree with annotations]

Example:
project-name/
├── component-a/             # [Purpose of this component]
│   ├── src/
│   │   ├── main.ext         # [Entry point description]
│   │   ├── module1/         # [Module purpose]
│   │   └── module2/         # [Module purpose]
│   ├── tests/
│   └── config.ext
├── component-b/             # [Purpose]
│   └── ...
├── shared/                  # [Shared code/types/protos]
│   └── ...
├── docs/
├── scripts/
└── README.md

## Key Directories Explained

### component-a/
[2-3 sentences about what this contains and why]

### component-b/
[2-3 sentences]

## Conventions
- [Naming convention for files]
- [Where tests live relative to source]
- [Where configuration goes]
```

**Important:** If the original spec already defines a folder structure, use it as the
base and refine/expand it. If not, propose one based on the tech stack and industry
best practices (research via context7/WebSearch if needed).

### 3.6 Generate tech-stack.md

```markdown
# Tech Stack

## Overview

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| [Layer] | [Tech] | [Version] | [Why this choice] |
| ... | ... | ... | ... |

## [Component/Layer Name]

### Language & Runtime
- **Language:** [language] [version]
- **Runtime:** [runtime if applicable]

### Frameworks
- **[Framework]** [version]: [purpose]

### Build Tools
- **[Tool]** [version]: [purpose]

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| [lib] | [ver] | [purpose] |

## Shared / Cross-Cutting

### Communication
- **[Protocol]:** [where used, e.g., "between server and engine"]

### Serialization
- **[Format]:** [where used]

### Development Tools
- [Tool]: [purpose]
```

### 3.7 Generate components.md

```markdown
# System Components

## Architecture Diagram

[ASCII diagram showing all components and their connections]

## Components

### [Component 1 Name]
- **Type:** [service, library, app, engine, etc.]
- **Technology:** [language/framework]
- **Purpose:** [what it does - 1-2 sentences]
- **Responsibilities:**
  - [Responsibility 1]
  - [Responsibility 2]
- **Exposes:** [APIs, ports, interfaces]
- **Depends on:** [other components or external services]

### [Component 2 Name]
...

## Component Interaction Matrix

| From \ To | Component A | Component B | Component C |
|-----------|-------------|-------------|-------------|
| Component A | - | [protocol] | - |
| Component B | [protocol] | - | [protocol] |
| Component C | - | [protocol] | - |
```

### 3.8 Generate data-flow.md

```markdown
# Data Flow

## High-Level Flow

[ASCII diagram showing the main data flow through the system]

## Detailed Flows

### [Flow 1 Name] (e.g., "User sends command from mobile")
```
Step 1: [Actor] → [Action] → [Component]
Step 2: [Component] → [Transform/Process] → [Component]
Step 3: [Component] → [Action] → [Output/Result]
```
**Payload:** [What data is sent at each step]
**Latency target:** [if specified]

### [Flow 2 Name]
...

## Message Formats

### [Message Type 1]
```json
{
  "field": "type and description",
  "field": "type and description"
}
```

### [Message Type 2]
...

## State Management
[How state is managed across components - databases, caches, in-memory, etc.]
```

### 3.9 Generate api-contracts.md

```markdown
# API Contracts

## [API Layer 1] (e.g., WebSocket API)

### Connection
- **Protocol:** [WebSocket/REST/gRPC]
- **Port:** [port]
- **Serialization:** [JSON/Protobuf/MessagePack]

### Endpoints / Actions

#### [Action/Endpoint 1]
- **Direction:** [Client → Server / Server → Client / Bidirectional]
- **Description:** [What it does]
- **Request:**
```
[Request format/schema]
```
- **Response:**
```
[Response format/schema]
```

#### [Action/Endpoint 2]
...

## [API Layer 2] (e.g., gRPC Internal API)

### Service Definition
```protobuf
[Proto definition or equivalent contract]
```

### Methods

#### [Method 1]
- **Description:** [What it does]
- **Request:** [Message type and fields]
- **Response:** [Message type and fields]

## Error Handling
- [Error code/type]: [When it occurs, how to handle]
```

### 3.10 Generate database-schema.md

```markdown
# Database Schema

## Overview
- **Database:** [Engine, e.g., SQLite, PostgreSQL]
- **ORM/Driver:** [e.g., sqlx, Prisma, TypeORM]
- **Location:** [Where DB is stored/hosted]

## Entity Relationship Diagram

[ASCII diagram showing table relationships]

## Tables

### [Table 1 Name]
**Purpose:** [What this table stores]

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/INT | PK | [description] |
| name | TEXT | NOT NULL | [description] |
| ... | ... | ... | ... |

**Indexes:**
- [index description]

**Relations:**
- [FK relationship description]

### [Table 2 Name]
...

## Migrations
- **Strategy:** [How migrations are managed]
- **Location:** [Where migration files live]

## Seed Data
[If applicable, what initial data is needed]
```

### 3.11 Generate configuration.md

```markdown
# Configuration

## Configuration Files

### [Config File 1] (e.g., server/config.toml)
**Purpose:** [What this configures]
**Format:** [TOML/JSON/YAML/ENV]

```
[Full example configuration with comments explaining each field]
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| [field] | [type] | [default] | [description] |

### [Config File 2]
...

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| [VAR_NAME] | Yes/No | [default] | [description] |

## Platform-Specific Configuration

### [Platform 1] (e.g., macOS)
- [Specific config notes]

### [Platform 2] (e.g., Windows)
- [Specific config notes]

## Secrets Management
- [How secrets/credentials are handled]
- [What should NEVER be committed]
```

### 3.12 Generate dev-guide.md

```markdown
# Developer Guide

## Prerequisites

### Required Software
| Software | Version | Install Command |
|----------|---------|-----------------|
| [Software] | [version]+ | [install command] |

### Platform-Specific Prerequisites

#### [Platform 1]
```bash
[Installation commands]
```

#### [Platform 2]
```bash
[Installation commands]
```

## Setup

### 1. Clone the Repository
```bash
git clone [repo-url]
cd [project-name]
```

### 2. [Build/Install Step]
```bash
[commands]
```

### 3. [Next Step]
```bash
[commands]
```

## Running the Application

### Startup Order
[If order matters, explain why and list the order]

```bash
# Step 1: [description]
[command]

# Step 2: [description]
[command]
```

### Quick Start Script
```bash
[If applicable, a one-command start]
```

## Development Workflow

### Running Tests
```bash
[test commands per component]
```

### Debugging
- [How to enable debug mode]
- [Useful debug commands or tools]

### Code Style
- [Linting tools and commands]
- [Formatting tools and commands]

## Troubleshooting

### [Common Issue 1]
**Symptom:** [what you see]
**Fix:** [how to fix]

### [Common Issue 2]
...
```

---

## PHASE 4: SUMMARY

**(New Project Mode)** After all files are created, present:

```
## Architecture Documentation Generated

**Location:** docs/architecture/
**Files created:** [count]

| File | Status |
|------|--------|
| README.md | Created |
| overview.md | Created |
| folder-structure.md | Created |
| tech-stack.md | Created |
| components.md | Created |
| data-flow.md | Created |
| api-contracts.md | Created |
| database-schema.md | Created |
| configuration.md | Created |
| dev-guide.md | Created |

### Gaps Remaining
[List any dimensions marked as [TO BE DEFINED], or "None - all dimensions covered"]

### Next Steps
1. Review the generated docs in docs/architecture/
2. Fill in any [TO BE DEFINED] placeholders
3. Run `/plan` to generate epics and stories from this architecture
```

**(Feature Mode)** After updates are complete, present:

```
## Architecture Documentation Updated

**Feature:** [feature name]
**Location:** docs/architecture/

| File | Action |
|------|--------|
| components.md | UPDATED - added [component name] |
| api-contracts.md | UPDATED - added [N] new endpoints |
| database-schema.md | UPDATED - added [table name] |
| features/YYYY-MM-DD_feature.md | CREATED - full feature spec |
| README.md | UPDATED - changelog entry added |
| overview.md | UNCHANGED |
| ... | ... |

### Impact Summary
- New components: [count]
- New API endpoints: [count]
- New DB tables: [count]
- New config entries: [count]
- Affected existing components: [list]

### Next Steps
1. Review the updated docs in docs/architecture/
2. Run `/plan` to generate epics and stories for this feature
```

---

## CONDITIONAL FILE GENERATION

Not all files are relevant to every project. Skip files that don't apply:

- **database-schema.md** — Skip if the project has no database
- **api-contracts.md** — Skip if there are no APIs (e.g., a CLI tool)
- **configuration.md** — Skip if the project has no configuration files

When skipping a file, still list it in README.md with a note: "Not applicable for this project."

---

## IMPORTANT GUIDELINES

- **NEVER modify the original specification file.** It is read-only input.
- **Language:** All output in English, regardless of the spec's language.
- **No hardcoding:** Derive everything from the spec and user answers. This skill must work with any project.
- **Use context7/WebSearch** to research standard folder structures and best practices for the specific tech stack when proposing folder structures or configurations.
- **Be specific:** Don't write generic docs. Every file should contain real, project-specific content derived from the spec and user answers.
- **Mark gaps:** Use `[TO BE DEFINED]` for anything that couldn't be determined. Never invent information.
- **Scanning readability:** Use tables, code blocks, ASCII diagrams, and bullet points. Avoid walls of text.
- **File independence:** Each file should be self-contained and readable on its own, with cross-references to other files where relevant.
