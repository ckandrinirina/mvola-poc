---
name: explain
description: Use when the user wants to understand what was just implemented, learn the technologies involved, or know how to manually verify that something works. Triggers on "explain", "what was implemented", "how do I check", "I want to learn", "what is this", "how does this work".
user-invocable: true
---

# Explain — Implementation Details & Manual Verification

Produces two sections for the most recently implemented story or feature:
1. **Manual verification** — exact commands to confirm it works
2. **What was built** — learner-friendly explanation of every technology and pattern used

---

## How to Use

Invoke with `/explain` after a story completes, or any time the user asks to understand what was built.

Optional argument: a specific file, class, or concept to focus on.
- `/explain` → explains the last implemented story
- `/explain CMakeLists.txt` → explains just that file
- `/explain FetchContent` → explains just that CMake concept

---

## Output Format

### Section 1 — Manual Verification

List the exact shell commands the user can run right now to confirm everything works. Rules:
- One command per check, with a comment explaining what it verifies
- Show expected output (or "should show X") after each command
- Cover: file existence, build/compile, binary run, key integration points
- Keep it short — 3 to 6 checks maximum
- If no terminal check is possible (e.g. pure UI), describe what to look at instead

```
**1. Verify X exists:**
\`\`\`bash
ls path/to/file
# Should show: filename
\`\`\`

**2. Verify build succeeds:**
\`\`\`bash
cd component && build-command
# Should exit 0 with no errors
\`\`\`
```

### Section 2 — What Was Built (Learning Explanation)

Explain every file, technology, and pattern that was introduced. Rules:
- Assume the user is **new to this technology** — never assume prior knowledge
- Use analogies to things the user already knows (e.g. "like package.json", "like index.js")
- For each concept: what is it, why does it exist here, what problem does it solve
- For each file: what is its role, what key lines mean
- Use short code snippets to illustrate (annotated with comments)
- Group by logical theme (build system, framework, class design, etc.)
- End with: "What comes next" — what will be added in future stories

**Structure:**
```
### [Theme — e.g. "The Build System"]
[Plain-language explanation + analogy]
[Annotated code snippet if useful]

### [Theme — e.g. "The Class Stubs"]
...

### What comes next
[1–3 bullets on what future stories will add to what was built today]
```

---

## Reading Context

Before generating output, read:
1. **The most recently DONE story file** — for acceptance criteria and files touched
2. **The files themselves** (use Read on each created/modified file)
3. **git diff HEAD~1** — to see exactly what changed

If the user specifies a path or concept, focus on that instead.

---

## Tone

- Supportive and encouraging — the user is learning
- Concrete and specific — no vague statements like "this handles the logic"
- Short paragraphs — one idea per paragraph
- Prefer analogies over jargon. When jargon is unavoidable, define it immediately
