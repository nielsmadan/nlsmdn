---
name: edit-rephrasing
description: Aggressively rephrase clunky sentences in blog posts and text.
  Restructures, splits, merges, and reorders sentences that are fundamentally
  awkward. Only invoke when explicitly requested via /edit-rephrasing. Do NOT
  trigger automatically. Works on .md, .mdx, and .txt files.
argument-hint: [--multi] <file>
---

# Edit Rephrasing: $ARGUMENTS

Rewrite clunky sentences from scratch while preserving tone and content.

## Usage

```
/edit-rephrasing <file>           # Claude-only rephrasing pass
/edit-rephrasing --multi <file>   # Also get suggestions from Gemini and Codex
```

## Instructions

### Step 1: Read the file

Read the entire file. Identify:
- **Tone** — casual, formal, technical, humorous, etc.
- **Voice** — sentence length patterns, vocabulary level, use of fragments, colloquialisms
- **Audience** — who is this written for?

### Step 2: Find clunky sentences

Go paragraph by paragraph. Flag sentences that have structural problems:

- **Run-on sentences** — too many clauses chained together without proper breaks
- **Tangled syntax** — the reader has to re-read to understand the structure
- **Awkward clause ordering** — the punchline or key point is buried
- **Choppy sequences** — multiple short sentences that should be merged for flow
- **Front-loaded qualifiers** — too many conditions before the main point lands

**What to leave alone:**
- Sentences that are merely long but clear — length is not a problem if the reader doesn't stumble
- Intentional style choices (fragments, colloquialisms, rhetorical questions)
- Sentences that could be slightly improved — this skill is for sentences that need a full rewrite, not a tweak

**Critical rules:**

- **Preserve tone and voice.** The rewrite must sound like the same author. Match vocabulary, formality level, and humor.
- **Preserve content.** Every point in the original must appear in the rewrite. Do not add, remove, or editorialize.
- **Preserve intentional style.** Sentence fragments, slang, informal grammar are deliberate.
- **Do not touch code blocks, frontmatter, or HTML/script tags.**
- **Never add em dashes (—).** Use commas, periods, or semicolons instead.
- **Do not add contractions.** If the author wrote "we are" or "do not", leave it. Only contract if the uncontracted form sounds stilted and surrounding text uses contractions heavily.
- **Be selective.** A good run produces 2-5 rewrites, not 15. Only flag sentences where restructuring meaningfully helps.

### Step 2.5: External suggestions (--multi only)

If `--multi` flag is present in $ARGUMENTS, also get external rephrasing suggestions:

Use the **Skill tool** to invoke `second-opinion --quick` with this prompt:

```
Read-only consultation. Do not modify any files.

I'm editing a blog post and looking for sentences that are structurally clunky and need a complete rewrite (not just a word swap). The tone is casual/conversational — preserve it.

Here is the current text:
{paste the full prose content, excluding frontmatter and code blocks}

For each clunky sentence:
1. Quote the original
2. Provide a complete rewrite
3. One sentence explaining what was structurally wrong

Only flag sentences that genuinely need restructuring. Skip anything that reads fine. 200 words or less.
```

### Step 3: Present changes

Present each change as:

> **Original:** "the original sentence"
> **Rewrite:** "the completely rephrased version"
> **Problem:** what made the original clunky (e.g., "run-on with 4 chained clauses", "key point buried after 3 qualifiers")

Group by paragraph/section. If `--multi` was used, include external suggestions in a separate section.

Ask the user to approve before applying edits.

### Step 4: Apply approved changes

Apply only the changes the user approves. Use the Edit tool for each change.

## Examples

### Example 1: Run-on sentence

**Original:** "Alas, it was a short-lived affair as I soon ended up in some kind of configuration hell with Warp constantly upgrading to newer versions, adding more configuration options, messing up what was previously configured, sloppily pushing their AI features all over the place until eventually I ended up in a state, where some legit commands would produce errors in Warp while working just fine in other terminals."
**Rewrite:** "Alas, it was a short-lived affair. I soon ended up in configuration hell: Warp constantly upgrading, adding options, messing up what was previously configured, sloppily pushing AI features everywhere. Eventually some legit commands would error out in Warp while working fine in other terminals."
**Problem:** 60+ word run-on with no natural break points. Split into three sentences.

### Example 2: Leaving a long-but-clear sentence alone

Text: "I was seduced by the idea that you could just tell Warp what command you wanted, and it would give it to you right there in the terminal, no copy and paste needed."

Action: Leave it. It's long but reads smoothly with natural rhythm.

## Troubleshooting

### Over-rewriting: Changed the voice

**Cause:** Rewrites sound too polished or formal compared to the original.
**Solution:** Read the rewrite aloud. Does it sound like the same person? If not, dial back. Match the vocabulary and sentence patterns of surrounding text.

### User rejects most suggestions

**Cause:** Flagging sentences that aren't actually clunky, just imperfect.
**Solution:** Raise the bar. Only flag sentences where a reader would genuinely stumble or need to re-read. If you have more than 5 suggestions for a typical blog post, you're being too aggressive.

### Overlap with edit-phrasing

**Cause:** Suggesting minor word swaps instead of structural rewrites.
**Solution:** If the fix is swapping a word or trimming a phrase, that's edit-phrasing territory. This skill is for sentences where the structure itself is the problem.
