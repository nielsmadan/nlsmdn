---
name: edit-content
description: Review blog post content for gaps, leaps of logic, missing context,
  irrelevant tangents, factual accuracy, and opportunities to add useful
  information. Only invoke when explicitly requested via /edit-content. Do NOT
  trigger automatically. Works on .md, .mdx, and .txt files.
argument-hint: [--multi] <file>
---

# Edit Content: $ARGUMENTS

Review content substance: what to add, what to cut, and where the logic doesn't flow.

## Usage

```
/edit-content <file>           # Claude-only content review
/edit-content --multi <file>   # Also get suggestions from Gemini and Codex
```

## Instructions

### Step 1: Read the file

Always read the file fresh — the user may have made changes since the last invocation. Do not rely on any previously read version.

Read the entire file. Identify:
- **Topic** — what is this post about?
- **Audience** — who is this written for? What do they already know?
- **Goal** — is it teaching, persuading, entertaining, documenting?
- **Structure** — how is the argument or narrative organized?

### Step 2: Analyze content

Read through the post as a target reader would. For each section, consider:

- **Missing context** — does the reader need background the author assumed they have?
- **Leaps of logic** — does the argument skip steps? Would a reader think "wait, how did we get here?"
- **Unsupported claims** — are there assertions that need evidence, examples, or links?
- **Irrelevant tangents** — does anything distract from the main point without adding value?
- **Missing information** — is there something the reader would obviously want to know that isn't covered?
- **Dead ends** — does the post raise a topic or question and never resolve it?
- **Ordering** — would sections work better in a different order?
- **Factual accuracy** — are there verifiable claims (funding amounts, technical assertions, product names, dates, CLI flags, API details) that might be wrong? If unsure, research using WebSearch. Do NOT change opinions, subjective statements, or personal anecdotes.
- **Link quality** — when adding links or references, prefer primary sources and full-text reproductions over excerpts or secondary reporting. If a quote is cited, link to a source that contains the full text, not one that only paraphrases it.

**Critical rules:**

- **This is about substance, not style.** Do not suggest phrasing changes, grammar fixes, or sentence rewrites. Those are for edit-phrasing, edit-rephrasing, and edit-basic.
- **Respect the author's scope.** The author chose what to cover. Only suggest additions that genuinely serve the reader. Don't suggest expanding every aside into a full section.
- **Be specific.** "Add more detail here" is useless. "Explain what `print -z` does before showing the code, since most readers won't know this command" is actionable.
- **Preserve tone and voice.** Content suggestions should fit the existing style. Don't suggest adding formal disclaimers to a casual post.
- **Do not touch code blocks, frontmatter, or HTML/script tags.**
- **Be selective.** 3-7 suggestions for a typical blog post. If you have more than 10, you're nitpicking.

### Step 2.5: External suggestions (--multi only)

If `--multi` flag is present in $ARGUMENTS, get external content suggestions:

Use the **Skill tool** to invoke `second-opinion --quick` with this prompt:

```
Read-only consultation. Do not modify any files.

I'm reviewing a blog post for content quality. I want to find gaps in logic, missing context, irrelevant tangents, and information that should be added or removed. Do NOT suggest phrasing or style changes.

Here is the current text:
{paste the full prose content, excluding frontmatter and code blocks}

For each content issue:
1. Quote the relevant sentence or section
2. Describe the issue (gap, missing context, tangent, etc.)
3. Suggest what to add, remove, or change

Only flag issues where the content meaningfully improves. 250 words or less.
```

### Step 3: Present suggestions

Present each suggestion as:

> **Section:** "section name or paragraph location"
> **Issue:** what's missing, unclear, or unnecessary
> **Suggestion:** specific recommendation (add X, cut Y, move Z before W)

Group by section. List fact-check results separately (verified claims, corrections, unverifiable claims). If `--multi` was used, include external suggestions separately.

Ask the user to approve before making any changes.

### Step 4: Apply approved changes

Apply only what the user approves. For additions, draft the new content matching the author's tone and voice, then use the Edit tool. For removals, use the Edit tool to delete. For reordering, use multiple Edit calls.

## Examples

### Example 1: Missing context

**Section:** "Speedrunning Warpless"
**Issue:** The post uses `print -z` without explaining what it does. Readers unfamiliar with zsh internals won't understand why this is the key insight.
**Suggestion:** Add a one-sentence explanation after introducing the command, e.g., "It places text into the editing buffer so it appears as your next command, ready to review before hitting enter."

### Example 2: Irrelevant tangent

**Section:** "Warping Up"
**Issue:** The paragraph about hitting APIs directly introduces complexity (auth, system prompts) that the post then dismisses. It raises questions without payoff.
**Suggestion:** Cut or shorten to one sentence: "You could hit the APIs directly for speed, but this is simpler."

### Example 3: Leaving good content alone

Section discusses four different CLI tools with code examples.

Action: Leave it. The comparison is the core value of the post.

## Troubleshooting

### Suggestions overlap with other edit skills

**Cause:** Suggesting word changes or rephrasing instead of content changes.
**Solution:** Ask yourself: "Is the problem what the author said, or how they said it?" If it's how, that's edit-phrasing/edit-rephrasing territory. This skill is only for what.

### Too many suggestions

**Cause:** Treating every imperfect paragraph as a content issue.
**Solution:** Focus on issues that would confuse or lose the reader. If a paragraph is fine but not great, leave it.

### Suggestions change the post's scope

**Cause:** Recommending the author cover topics they intentionally left out.
**Solution:** Only suggest additions that serve the existing narrative. "You should also cover X" is overreach unless X is clearly implied by the post's promise to the reader.
