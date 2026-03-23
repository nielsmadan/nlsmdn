---
title: "Skill Showcase: research-online"
pubDatetime: 2026-03-24T00:00:00+00:00
description: "Making your coding agents smarter about evaluating online research since November 2025."
tags:
  - skills
  - ai
---

Has this ever happened to you?

Your friendly neighborhood coding agent makes a claim that seems a bit fishy to you. You ask it to check online to make sure whatever it is claiming is really true. It comes back reporting that yes, absolutely, totally true, internet confirms it, nothing to see here, upwards and onwards. You ask it to give you a reference, just to, you know, make sure, you don't have trust issues, oh no, you would just like to have a look... and it gives you some Reddit comment from three years ago with zero upvotes on a post with zero upvotes, where someone very confidently makes that claim.

## Never Again

Well, that kinda sucks. Sucked. That happened to me a few times. Then I figured I'd do something about it, so I came up with a skill. Well Claude did, of course. You think I'd write this myself? Anyway, here are the important bits, starting with the sources:

```
### Determine Which Agents to Spawn

| Agent | Spawn When | Purpose |
|-------|------------|---------|
| **Docs** | Library/framework mentioned | Context7 documentation lookup |
| **GitHub** | Library with known repository | Search issues AND discussions |
| **General** | Always | Broad "how to" web search |
| **Specific** | Error message provided | Search for exact error text |
| **StackOverflow** | Common problem/implementation pattern | Community Q&A solutions |
| **Changelog** | Version mentioned OR "stopped working" / "after upgrade" | Breaking changes, migration guides |
| **Best Practices** | Feature implementation (no error message) | Architecture patterns, recommended approaches |
| **Reddit** | Comparison, best practices, or "real world experience" queries | Candid developer opinions, warnings, real-world experience |
| **Comparison** | Query contains "vs", "or", "compare", "which", "best library" | Compare options, pros/cons |
```

Then we figure out which ones to use and check in parallel, defining more specific instructions in `reference`, so we keep the skill at a manageable length.

```
### Spawn Agents in Parallel

Use the Task tool to spawn ALL relevant agents in a **single message** (parallel execution). Each agent uses `subagent_type: general-purpose`.

**Every agent must capture metadata for each source:** URL, date, and source type (official docs / GitHub issue / blog / SO answer / forum).

| Agent | Tool | Search Strategy |
|-------|------|-----------------|
| Docs | Context7 | resolve-library-id then query-docs. If resolve-library-id returns no match, fall back to WebSearch for `{lib} official documentation {goal}` |
| GitHub | WebSearch | `site:github.com {lib} "{terms}"`, then WebFetch top 2-3 |
| General | WebSearch | `how to {goal} {lib}` |
| Specific | WebSearch | `"{exact_error_message}" {lib}` |
| StackOverflow | WebSearch | `site:stackoverflow.com {lib} {keywords}`, then WebFetch top answers |
| Changelog | WebSearch | `{lib} {version} changelog breaking changes migration` |
| Best Practices | WebSearch | `{lib} best practices {goal}` + `{lib} recommended architecture {goal}` |
| Reddit | WebSearch | `site:reddit.com {lib} {keywords}`, then WebFetch top 2-3 threads |
| Comparison | WebSearch | `{option_A} vs {option_B} {context}` |

For full agent prompt templates with detailed instructions, see `references/agent-prompts.md`.
```

Here is an example of what an agent prompt looks like:

```
## GitHub Agent

**Spawn when:** Library with known GitHub repo

Search GitHub for issues AND discussions related to this topic.

Use WebSearch to search: site:github.com {library_name} "{key_terms}"

Look for:
- Issues (bugs, feature requests)
- Discussions (implementation questions, best practices)
- Pull requests with relevant changes

If you find relevant results:
1. Use WebFetch to read the top 2-3 most relevant
2. Extract: problem/question, any solutions posted, recommended approaches

For each result, note:
- URL
- Date opened/last updated
- Type (issue/discussion/PR)
- Status (open/closed/merged)
- Whether maintainer responded
- Source type: GitHub issue (maintainer) / GitHub issue (community) / GitHub discussion

Return a summary of relevant findings with metadata.
```

And the most important step, evaluate the results!

```
Before synthesizing, evaluate each source:

**Recency** (adjust thresholds by library velocity):

| Age | Fast-moving libs (React, Next.js, etc.) | Stable libs (Express, lodash, etc.) |
|-----|----------------------------------------|-------------------------------------|
| < 6 months | High | High |
| 6-18 months | Medium | High |
| 18-36 months | Low | Medium |
| > 3 years | Very Low | Low |

**Authority:**

| Source Type | Score |
|-------------|-------|
| Official docs, changelogs, core team posts | High |
| GitHub issues (maintainer response) | High |
| GitHub issues (community), recent blogs (known author) | Medium |
| SO answers (accepted, high votes), comparison articles | Medium |
| Reddit threads (high upvotes, experienced devs) | Medium |
| SO answers (low votes), old blogs, old comparisons | Low |
| Reddit threads (low engagement), random forums | Very Low |

**Relevance:** Exact error/goal match = High. Same library, similar task = Medium. Related concept = Low.

**When sources conflict:** Prefer more recent, then higher authority. Note conflicts in synthesis. If official docs conflict with recent issues, the issue may reveal a bug or undocumented behavior.
```

There's some more bits around these, but that's the gist of it. Except one more thing! Add something like this to claude.md to auto-trigger:

```
When the user's prompt contains "research online", automatically invoke the `/research-online` skill to search documentation, GitHub issues, and web resources in parallel.
```

## Foom

Does it work? Let's use it on itself!

```
/research-online Can you find any other skills that are about researching topics online and see if there are any ideas, that we could take over for our own skill?

⏺ 3 agents finished (ctrl+o to expand)
   ├─ Search GitHub for research skills · 53 tool uses · 33.8k tokens
   │  ⎿  Done
   ├─ Search for research skill patterns · 27 tool uses · 25.4k tokens
   │  ⎿  Done
   └─ Check samber repo for research skill · 61 tool uses · 37.2k tokens
      ⎿  Done

⏺ Great research. Here's the synthesis of the most actionable ideas from other research skills, ordered by value for our
  /research-online skill:

  High-value ideas worth adopting

  1. Follow-up search loop (gap detection + delta queries)

  From 199-biotechnologies. After initial synthesis, if a topic area has thin results or low confidence, generate targeted follow-up
   queries and search again. Max 1-2 extra cycles. Our skill is currently single-pass — agents search once and we're done. Even one
  retry cycle would catch missing perspectives.

  2. Source independence analysis

  From standardhuman. Our deduplication only checks URL-level duplicates. But 5 blog posts all citing the same original tweet = 1
  source, not 5. Checking whether "independent" sources actually trace back to the same origin would prevent false confidence from
  echo chambers.

  3. "Search → Write → Search → Write" protocol

  From altmbr. Forces agents to persist findings after every search, not batch searches then write. Prevents the common failure mode
   where an agent does many searches and loses earlier results from context. Rule: "If you do two searches in a row without writing,
   you are violating the protocol."

  4. Adaptive depth classification

  From several skills. Simple lookups ("what version of X supports Y?") don't need 9 parallel agents. A quick classification step
  could route to:
  - Quick (1-2 agents, direct answer) for factual lookups
  - Standard (current behavior) for implementation questions
  - Deep (add follow-up loop + critique) for complex investigations

  5. Adversarial critique pass

  From 199-biotechnologies. After synthesis, run a brief red-team pass asking: "What's wrong with this conclusion? What did we miss?
   What would someone who disagrees say?" Catches overconfidence and blind spots.

  Medium-value ideas

  6. Claim-level source tracking

  Track which specific source backs each specific claim in the synthesis, not just "these agents found these sources." Makes it easy
   to verify any individual assertion.

  7. Engagement metrics as quality signal

  From last30days. For Reddit/SO, use upvotes, comment count, and views as additional credibility signals beyond just "accepted
  answer" or "high engagement."

  8. Stuck agent detection + relaunch

  From altmbr. Monitor agent progress; if an agent hasn't produced output after a timeout, kill and relaunch with pre-loaded partial
   data. Our skill just waits and notes gaps.

  Lower priority but interesting

  - Hypothesis generation before searching — form theories first to avoid confirmation bias
  - Skeleton files with embedded instructions — prevents agents from forgetting their role
  - Research artifact persistence — saving query logs, source catalogs for reproducibility
  - Cross-model review — routing critique to a different model

  Would you like me to implement any of these into the skill?
```

Indeed I would! And I did. You can find the final version of the skill [here](https://github.com/nielsmadan/agentic-coding/tree/main/claude/skills/research-online).

I'm not a big fan of installing random marketplace add-ons or npm packages of skills and all the ways people try to distribute them. If you want to have this skill, just give the [github link](https://github.com/nielsmadan/agentic-coding/tree/main/claude/skills/research-online) to your LLM and tell it to make it so. Then build on top of it yourself. Also, have peace of mind that no malicious instructions come through in a skill update.

Clickable links for the other research online skills that my research online skill found:

* [199-biotechnologies](https://github.com/199-biotechnologies/claude-deep-research-skill) — 8-phase research pipeline with source credibility scoring and automated validation
* [standardhuman](https://github.com/standardhuman/deep-research-skill) — 7-phase deep research with domain overlays for healthcare, financial, legal, and market research
* [altmbr](https://github.com/altmbr/claude-research-skill) — multi-agent research orchestrator with strict write-after-every-search protocol
* [last30days](https://github.com/mvanhorn/last30days-skill) — researches any topic across Reddit, X, YouTube, HN, and the web from the last 30 days

Not shown here, because it is less recursive: this has also stopped my LLM from giving me clearly bogus references when researching programming topics. I lived happily ever after.

PS: Remember kids, if you use your research online skill to research someone else's research online skill online, you will research all the research online skills that skill's researched online... online.
