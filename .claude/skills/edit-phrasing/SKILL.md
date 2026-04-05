---
name: edit-phrasing
description: Improve phrasing and readability of blog posts and text while
  preserving tone, voice, and content. Only invoke when explicitly requested
  via /edit-phrasing. Do NOT trigger automatically. Works on .md, .mdx,
  and .txt files.
argument-hint: [--multi] <file>
---

# Edit Phrasing: $ARGUMENTS

Improve phrasing and readability while preserving the author's tone and content.

## Usage

```
/edit-phrasing <file>           # Claude-only phrasing pass
/edit-phrasing --multi <file>   # Also get suggestions from Gemini and Codex
```

## Instructions

### Step 1: Read the file

Always read the file fresh — the user may have made changes since the last invocation. Do not rely on any previously read version.

Read the entire file. Identify:
- **Tone** — casual, formal, technical, humorous, etc.
- **Voice** — sentence length patterns, vocabulary level, use of fragments, colloquialisms
- **Audience** — who is this written for?

### Step 2: Improve phrasing

Go paragraph by paragraph. For each, consider:

- **Clarity** — is the meaning immediately clear? Can a sentence be untangled without changing what it says?
- **Flow** — do sentences connect smoothly? Are transitions natural?
- **Conciseness** — can wordiness be trimmed without losing meaning or voice? Actively cut filler words and phrases that add no meaning: "actually", "really", "basically", "just", "quite", "as well", "in order to" (→ "to"), "the fact that", "it is worth noting that", "at this point in time" (→ "now"), "a number of" (→ "several"/"many"), "in terms of", "due to the fact that" (→ "because"), "whether or not" (→ "whether").
- **Rhythm** — is there variety in sentence length? Does it read well aloud?
- **Word choice** — is there a more precise or vivid word that fits the tone?
- **Word echoes** — is the same word repeated in close proximity where a pronoun, synonym, or article would read more naturally? (e.g., "that boost... that firehose" → "that boost... the firehose")

**Critical rules:**

- **Preserve tone and voice.** If the writing is casual, keep it casual. Do not formalize.
- **Preserve content.** Do not add new ideas, remove points, or change the meaning.
- **Preserve intentional style.** Sentence fragments, slang, informal grammar ("So what do?", "yea?") are deliberate — improve around them, not through them.
- **Make the minimum effective change.** If a paragraph reads well, leave it alone. Not everything needs polishing.
- **Do not touch code blocks, frontmatter, or HTML/script tags.**
- **Never add em dashes (—).** Do not introduce em dashes into the text, even to break up long sentences. Use commas, periods, or semicolons instead.
- **Do not add contractions.** If the author wrote "we are" or "do not", leave it. Only contract if the uncontracted form sounds stilted in context and the surrounding text already uses contractions heavily. When in doubt, leave it as-is.

### Step 2.5: External suggestions (--multi only)

If `--multi` flag is present in $ARGUMENTS, also get external phrasing suggestions:

Use the **Skill tool** to invoke `second-opinion --quick` with this prompt:

```
Read-only editing consultation. Do not modify any files.

I'm editing a blog post for phrasing and readability. The tone is casual/conversational — preserve it.

Here is the current text:
{paste the full prose content, excluding frontmatter and code blocks}

Suggest specific phrasing improvements. For each suggestion:
1. Quote the original sentence
2. Provide the improved version
3. Brief rationale (1 sentence)

Only suggest changes where readability meaningfully improves. Do not formalize the tone. 200 words or less.
```

### Step 3: Present changes

Present each change as:

> **Original:** "the original sentence or phrase"
> **Revised:** "the improved version"
> **Why:** brief rationale

Group by paragraph/section. If `--multi` was used, include external suggestions in a separate section.

Ask the user to approve before applying edits.

### Step 4: Apply approved changes

Apply only the changes the user approves. Use the Edit tool for each change.

## Examples

### Example 1: Tightening wordy prose

**Original:** "After messing with it for a while I figured this was too much time to spend trying to get basic terminal functions to work"
**Revised:** "After a while I figured this was too much time to spend getting basic terminal functions to work"
**Why:** Removed redundant "messing with it" and "trying to" without changing meaning or tone.

### Example 2: Leaving good informal writing alone

Text: "So what do? Ask Claude about it of course."

Action: Leave it. The fragment is punchy and fits the voice.

## Troubleshooting

### Over-polishing: Lost the casual voice

**Cause:** Made sentences too clean or formal.
**Solution:** Re-read the original tone. If the result sounds like a different author, revert. Casual writing should stay casual.

### User rejects most suggestions

**Cause:** Suggestions are too aggressive or don't match the author's intent.
**Solution:** Focus on the weakest sentences only. Fewer, higher-impact suggestions are better than many small ones.

### External agents suggest formalizing the tone

**Cause:** AI models default toward formal writing.
**Solution:** Discard any external suggestion that changes the tone. Only keep suggestions that improve clarity or flow within the existing voice.
