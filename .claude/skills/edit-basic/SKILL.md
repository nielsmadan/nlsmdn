---
name: edit-basic
description: Fix spelling, punctuation, and grammar in a blog post or text file.
  Only invoke when explicitly requested via /edit-basic. Do NOT trigger
  automatically. Works on .md, .mdx, and .txt files.
---

# Edit Basic

Light copy-editing. Preserves the author's voice completely.

## Instructions

### Step 1: Read the file

Always read the file fresh — the user may have made changes since the last invocation. Do not rely on any previously read version.

Read the entire file. Identify the language and tone — casual, formal, technical, etc.

### Step 2: Fix spelling, punctuation, and grammar

Make minimal corrections:

- Fix typos and misspellings
- Fix punctuation errors (missing periods, commas, apostrophes)
- Fix grammar errors (subject-verb agreement, tense consistency, etc.)
- Capitalize product names correctly (e.g., "claude" -> "Claude", "github" -> "GitHub")
- Fix hyphenation of compound adjectives before nouns (e.g., "low cost model" -> "low-cost model")

**Critical rules:**

- **Never rewrite or rephrase.** Only fix errors. The author's wording is intentional.
- **Preserve intentional informality.** Casual/conversational tone is a style choice, not an error. Sentence fragments, colloquialisms, and informal constructions like "So what do?", "yea?", "gotta", "gonna" are deliberate voice — leave them alone.
- **When in doubt, don't change it.** If something could be either a style choice or an error, assume it's a style choice.
- **Stay as close to the original as possible.** If fixing grammar, use the minimum edit that corrects the issue.
- **Do not add comments, docstrings, or annotations** to the file.

### Step 3: Present changes

After editing, present a summary of all changes made, grouped by:

- **Spelling/typos** — list each fix
- **Punctuation** — list each fix
- **Grammar** — list each fix with brief rationale
- **Capitalization** — list each fix

## Examples

### Example 1: Blog post edit

User says: "edit my blog post" or "/edit-basic src/data/blog/my-post.md"

Actions:
1. Read the file
2. Fix "recieved" -> "received", "it's" -> "its" (possessive), missing period
3. Present: "Fixed 2 spelling errors, 1 punctuation fix, 1 grammar fix."

### Example 2: Informal writing with intentional fragments

Text contains: "So what do? Ask Claude of course."

Action: Leave it alone. This is intentional conversational style, not a grammar error.

## Troubleshooting

### Over-editing: Changed the author's voice

**Cause:** Treating informal style as errors.
**Solution:** Re-read the tone. If the text is conversational throughout, fragments and colloquialisms are intentional. Revert any phrasing changes.

### Changed meaning while fixing grammar

**Cause:** Rewrote too aggressively.
**Solution:** Use the minimum edit. "Him and me went" -> "He and I went", not a full sentence rewrite.
