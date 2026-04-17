---
name: publish
description: >
  Publish epics and stories from tasks/ to GitHub Issues with labels
  and cross-references. Creates epic and story issues linked together.
argument-hint: "[tasks-folder-path]"
disable-model-invocation: true
allowed-tools: Bash(gh *) Bash(sleep *)
---

# Publish Epics to GitHub Issues

Reads a generated tasks/ folder structure and creates corresponding GitHub Issues
with labels, hierarchy links, and full story detail.

## PREREQUISITES

- The `gh` CLI must be installed and authenticated (`gh auth status`)
- The current directory must be a git repository with a GitHub remote
- A tasks/ folder must exist with the structure created by `project-architect`

---

## INPUT

`$ARGUMENTS` should be the path to a specific tasks folder, e.g.:
`tasks/2026-04-13_my-project`

**If `$ARGUMENTS` is empty:**
1. Use Glob to find folders matching `tasks/*/PROJECT_OVERVIEW.md`
2. If exactly one exists, use it (confirm with user)
3. If multiple exist, list them and ask the user to choose
4. If none exist, tell the user to run `/plan` first

---

## PHASE 1: VALIDATE ENVIRONMENT

Run these checks before creating any issues:

```bash
# Check gh is authenticated
gh auth status

# Check we're in a git repo with a GitHub remote
gh repo view --json nameWithOwner -q .nameWithOwner
```

If either fails, stop and tell the user what to fix.

---

## PHASE 2: READ PLAN STRUCTURE

1. Read `PROJECT_OVERVIEW.md` to extract the project name
2. Use Glob to find all `epics/*/EPIC.md` files
3. For each epic, use Glob to find all `stories/*.md` files
4. Read each EPIC.md and story file to extract:
   - Titles, descriptions, acceptance criteria
   - Sizes, dependencies
   - Epic-to-story relationships

Build an in-memory map of the full plan structure.

---

## PHASE 3: CONFIRM WITH USER

Present a summary before creating issues:

```
## GitHub Issues to Create

**Repository:** [owner/repo]
**Project:** [name from PROJECT_OVERVIEW.md]

### Labels to Create
- `epic` (purple)
- `story` (blue)
- `size/S`, `size/M`, `size/L`, `size/XL` (sizing labels)

### Issues to Create
- [N] epic issues
- [M] story issues (linked to their parent epic)
- [total] issues total

Proceed? YES / NO / DRY-RUN
```

- **YES**: Create all issues
- **NO**: Abort
- **DRY-RUN**: Show exactly what would be created without creating anything

---

## PHASE 4: CREATE LABELS

Create labels if they don't already exist:

```bash
gh label create "epic" --color "6F42C1" --description "Epic-level issue" --force
gh label create "story" --color "0075CA" --description "Implementation story" --force
gh label create "size/S" --color "C2E0C6" --description "Small story" --force
gh label create "size/M" --color "BFDADC" --description "Medium story" --force
gh label create "size/L" --color "FEF2C0" --description "Large story" --force
gh label create "size/XL" --color "F9D0C4" --description "Extra large story" --force
```

---

## PHASE 5: CREATE EPIC ISSUES

For each epic (in order), create a GitHub issue using `gh issue create`.

**Issue format:**
- **Title:** `Epic [NN]: [Epic Title]`
- **Labels:** `epic`
- **Body:** Include description, goals, scope, stories checklist (with `#TBD` placeholders), acceptance criteria, technical notes

Use a HEREDOC to pass the body:
```bash
gh issue create \
  --title "Epic [NN]: [Epic Title]" \
  --label "epic" \
  --body "$(cat <<'BODY'
## Description
[From EPIC.md]

## Goals
[From EPIC.md]

## Stories
- [ ] #TBD - [Story 01 title]
- [ ] #TBD - [Story 02 title]

## Acceptance Criteria
[From EPIC.md]
BODY
)"
```

**Capture the issue number** from the output of each `gh issue create`.
Store the mapping: epic slug -> issue number.

Add `sleep 1` between each issue creation.

---

## PHASE 6: CREATE STORY ISSUES

For each story (in epic order, then story order), create a GitHub issue.

**Issue format:**
- **Title:** `[EE-SS] [Story Title]`
- **Labels:** `story`, `size/[S|M|L|XL]`
- **Body:** Include parent epic reference, description, acceptance criteria, technical notes, files to create/modify, dependencies, size

Use a HEREDOC to pass the body:
```bash
gh issue create \
  --title "[EE-SS] [Story Title]" \
  --label "story" \
  --label "size/M" \
  --body "$(cat <<'BODY'
## Parent Epic
Belongs to #[epic-issue-number] - [Epic Title]

## Description
[From story file]

## Acceptance Criteria
[From story file]

## Technical Notes
[From story file]

## Files to Create/Modify
[Table from story file]

## Dependencies
[From story file]

## Size: [S/M/L/XL]
BODY
)"
```

**Capture each story issue number.**

Add `sleep 1` between each issue creation.

---

## PHASE 7: UPDATE EPIC ISSUES WITH STORY LINKS

After all stories are created, update each epic issue body to replace the
`#TBD` placeholders with actual issue numbers:

```bash
gh issue edit [epic-issue-number] \
  --body "[updated body with real issue numbers in the Stories checklist]"
```

This creates a proper task-list in the epic issue:
```
## Stories
- [ ] #42 - Set up project scaffolding
- [ ] #43 - Implement WebSocket gateway
```

GitHub will automatically track completion percentage from these checklists.

---

## PHASE 8: SUMMARY

Present results:

```
## Published to GitHub Issues

**Repository:** [owner/repo]

### Epic Issues
- #[num] - Epic 01: [Title]
- #[num] - Epic 02: [Title]
...

### Story Issues
- #[num] - [01-01] [Title] (S) -> Epic #[num]
- #[num] - [01-02] [Title] (M) -> Epic #[num]
...

### Quick Links
- All issues: [repo URL]/issues
- Epics only: [repo URL]/issues?q=label:epic
- Stories only: [repo URL]/issues?q=label:story

**Total:** [N] epics + [M] stories = [total] issues created
```

---

## ERROR HANDLING

- If `gh issue create` fails for a single issue, report the error and continue with remaining issues. Present a list of failed issues at the end.
- Add `sleep 1` between all GitHub API calls to avoid rate limiting.
- If a label already exists with different settings, `--force` will update it.

## DUPLICATE DETECTION

Before creating issues, check if issues with similar titles already exist:
```bash
gh issue list --label "epic" --state all --json title,number
gh issue list --label "story" --state all --json title,number
```

If duplicates are found, warn the user and ask whether to:
- **SKIP** duplicates and only create new issues
- **PROCEED** and create all issues (may result in duplicates)
- **ABORT** and create nothing

## IMPORTANT GUIDELINES

- **Order matters:** Create all epics first, then all stories, so epic issue numbers are available for story cross-references.
- **Markdown fidelity:** Preserve all markdown formatting from the original files when creating issue bodies.
- **Reusability:** This skill works with any tasks/ folder generated by `project-architect`, regardless of project type.
- **Rate limiting:** Always pause between API calls. GitHub rate limits are strict on issue creation.
