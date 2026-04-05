---
name: edit-all
description: Full editorial pass on a blog post, running all edit skills in order
  from content down to grammar. Only invoke when explicitly requested via
  /edit-all. Do NOT trigger automatically. Works on .md, .mdx, and .txt files.
argument-hint: [--multi] <file>
---

# Edit All: $ARGUMENTS

Complete editorial workflow. Runs all edit skills from highest-level (content) down to lowest-level (grammar), with iterative rounds on the substantive passes.

## Usage

```
/edit-all <file>           # Claude-only editorial pass
/edit-all --multi <file>   # Also get external suggestions at each stage
```

## Workflow

The `--multi` flag, if present, is passed through to each sub-skill that supports it.

```
┌─────────────────────────────────────────┐
│         ROUND 1: SUBSTANCE              │
│                                         │
│  1. /edit-content    (content + facts)   │
│  2. /edit-rephrasing (restructure)       │
│  3. /edit-phrasing   (polish)            │
│                                         │
│  → Ask: "Another round, or move on?"    │
│  → If another round, repeat 1-3         │
│                                         │
├─────────────────────────────────────────┤
│         FINAL PASS                      │
│                                         │
│  4. /edit-basic      (grammar/spelling)  │
│                                         │
└─────────────────────────────────────────┘
```

## Instructions

### Step 1: Content review

Invoke `/edit-content` (pass `--multi` if present in $ARGUMENTS). Follow its full workflow: present suggestions, wait for approval, apply approved changes.

### Step 2: Rephrasing

After content changes are applied, invoke `/edit-rephrasing` (pass `--multi` if applicable). Present, approve, apply.

### Step 3: Phrasing

After rephrasing changes are applied, invoke `/edit-phrasing` (pass `--multi` if applicable). Present, approve, apply.

### Step 4: Check for another round

Ask the user:

> "That's one round of content, rephrasing, and phrasing edits. Want to do another round, or move on to the final grammar/spelling pass?"

If the user wants another round, go back to Step 1. Re-read the file fresh each time since it has changed.

If the user wants to move on, proceed to Step 5.

### Step 5: Grammar and spelling

Invoke `/edit-basic`. This is the final pass. Present, approve, apply.

### Step 6: Done

Confirm the editorial pass is finished.

**Critical rules:**

- **Always re-read the file** before each skill invocation. The file changes between steps.
- **Each skill follows its own workflow.** Do not merge or skip steps within a sub-skill. Each one presents suggestions and waits for approval independently.
- **Do not apply changes from a later skill to fix issues from an earlier one.** If a content change creates a grammar issue, the grammar pass will catch it.
- **Grammar/spelling is always last.** It runs once, after all substantive editing is done. No point fixing commas in sentences that might get rewritten.

## Examples

### Example: Full edit of a blog post

```
/edit-all --multi src/data/blog/2026/my-post.md
```

1. Runs `/edit-content --multi` — finds 3 content gaps, user approves 2
2. Runs `/edit-rephrasing --multi` — finds 2 clunky sentences, user approves both
3. Runs `/edit-phrasing --multi` — finds 4 tweaks, user approves 3
4. Asks: "Another round?" — user says "one more"
5. Runs `/edit-content --multi` again — finds 1 minor issue, user approves
6. Runs `/edit-rephrasing --multi` — nothing to flag
7. Runs `/edit-phrasing --multi` — finds 1 tweak, user approves
8. Asks: "Another round?" — user says "move on"
9. Runs `/edit-basic` — fixes 2 typos, 1 comma
10. Done.

## Troubleshooting

### Skills overlap or contradict

**Cause:** A later skill suggests reverting a change from an earlier skill.
**Solution:** Trust the pipeline order. Content decisions take priority over phrasing preferences. If a rephrasing change creates a phrasing issue, the phrasing pass will smooth it out.

### Too many rounds

**Cause:** Diminishing returns after 2-3 rounds.
**Solution:** If a round produces very few suggestions (0-2), recommend moving to the final pass. Say so explicitly: "This round only found minor issues. I'd recommend moving to the grammar pass."

### User wants to skip a step

**Solution:** Skip it. The pipeline is a recommendation, not a requirement. If the user says "skip rephrasing", go straight to phrasing.
