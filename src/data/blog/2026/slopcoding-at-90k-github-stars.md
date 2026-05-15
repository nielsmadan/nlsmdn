---
title: "Slopcoding at 90k GitHub Stars"
pubDatetime: 2026-05-15T10:00:00+00:00
description: "The AI-generated one-million-line Rust rewrite PR landed in Bun's main branch yesterday and I am here for it."
tags:
  - ai
  - opinion
  - news
---

Grab your popcorn, folks, the "experimental" [Rust port of Bun](https://github.com/oven-sh/bun/pull/30412) was merged to main.

## Building Context

**Bun** is a JavaScript / TypeScript runtime, conceptually similar to Node.js, but more modern and with batteries included: a bundler, a test runner, and a package manager. It hit 1.0 in September 2023 and now sits at 90k+ stars on GitHub.

Bun is written in **Zig**, a modern systems programming language with manual memory management via explicit allocators.

[**Memory management**](https://en.wikipedia.org/wiki/Memory_management) refers to how a programming language... well, manages memory. The key distinction: is the developer responsible for allocating and freeing it, or does the language handle that automatically via [garbage collection](https://en.wikipedia.org/wiki/Garbage_collection_(computer_science)), [reference counting](https://en.wikipedia.org/wiki/Reference_counting), or some other scheme? Languages without automatic memory management come with a whole class of related bugs: [memory leaks](https://en.wikipedia.org/wiki/Memory_leak) (not freeing memory you no longer need), [use-after-free](https://en.wikipedia.org/wiki/Dangling_pointer) (touching memory you already freed), [buffer overflows](https://en.wikipedia.org/wiki/Buffer_overflow), and others.

**Rust** is a systems programming language. Unlike other systems languages like C or Zig, Rust is memory safe by default. It uses a set of strict ownership rules enforced by the compiler. Every value has exactly one owner, and is freed automatically when that owner goes out of scope. Code that breaks the rules simply doesn't compile, but Rust does have an escape hatch from those guarantees, the `unsafe` keyword. It's highly recommended not to use it unless you have a good reason. Good reasons are mostly calling code written in another language (typically C), implementing low-level primitives like the internals of a list or hash map, direct hardware access, or, rarely, performance improvements.

**Claude Code** is Anthropic's agentic coding harness. It was the first agentic coding CLI to go mainstream, and even though it has competition from OpenAI, Google, and also open source ([OpenCode](https://github.com/sst/opencode), [Crush](https://github.com/charmbracelet/crush), [Goose](https://github.com/block/goose)) these days, it is still regarded as one of the best. It is written in TypeScript and runs on Bun.

Bun was [acquired by Anthropic](https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone) in December 2025. Jarred Sumner, Bun's creator, [framed the deal](https://bun.com/blog/bun-joins-anthropic) as "Anthropic is betting on Bun as the infrastructure powering Claude Code, Claude Agent SDK, and future AI coding products & tools." On how the deal would change things, Jarred promised that "Bun stays open-source & MIT-licensed" and that "the same team still works on Bun." More pointedly, he also wrote: "Bun will ship faster."

## The Timeline

Ten days ago, on May 5, an internal "Zig to Rust porting guide" commit from Jarred was [posted on Hacker News](https://news.ycombinator.com/item?id=48016880) and drew attention. The [branch](https://github.com/oven-sh/bun/pull/30412) diff showed that most of the work had been done by Claude Code. (The merged PR ships a `.claude/workflows/` directory with phase-A through phase-F port scripts: `phase-c-panic-swarm`, `phase-d-unsafe-audit`, `phase-e-mass-ungate`, and so on.)

In the HN thread, Jarred [pushed back](https://news.ycombinator.com/item?id=48019226):

> I work on Bun and this is my branch. This whole thread is an overreaction. 302 comments about code that does not work. We haven't committed to rewriting. There's a very high chance all this code gets thrown out completely.

His [motivation](https://xcancel.com/jarredsumner/status/2053058171338682875) for trying it:

> I am so tired of worrying about & spending lots of time fixing memory leaks and crashes and stability issues.

Six days ago, on May 9, the branch [hit 99.8%](https://news.ycombinator.com/item?id=48073680) test compatibility on Linux x64.

Yesterday, on May 14, it was [merged](https://github.com/oven-sh/bun/pull/30412) to main.

So we went from "haven't committed to rewriting" and "high chance all this code gets thrown out completely" to merged to main in... nine days.

## But What's The Problem?

Now if you read this, you might think wow, Claude Code did a full rewrite of this 700-kloc project in a few days. It passed all tests, so that should catch most of the bugs, what an amazing achievement for agentic coding! Maybe that's what the Anthropic blog will claim in a few days. Unfortunately, the rewrite seems to be a mechanical line-by-line translation of the Zig codebase. It is also sprinkled liberally with `unsafe` memory management. That's 13k+ `unsafe` blocks in roughly one million lines of Rust, spread across 56% of files. For comparison, Deno (another JS runtime written in Rust) has roughly 3k `unsafe` blocks in 450 kloc spread across 27% of files, so Bun is at about 2x the density.

[Miri](https://github.com/rust-lang/miri) is Rust's standard tool for catching memory bugs hidden inside `unsafe` blocks. Within a day of the merge, [issue #30719](https://github.com/oven-sh/bun/issues/30719) was filed with a minimal reproducer showing the codebase fails basic Miri checks: a very basic function in the new Rust code reads memory that has already been freed.

That bug isn't a one-off. The same day, [discord9 filed a separate issue](https://github.com/oven-sh/bun/issues/30791) on a different undefined-behavior pattern. Both bugs share the same root cause: patterns that are sound in Zig are unsound in Rust, and the port copied them over verbatim.

[Barrin92 on Hacker News](https://news.ycombinator.com/item?id=48140015) sums up the structural problem:

> if half of your files in a million line codebase are unsafe that doesn't tell you much any more... So now you have Zig disguised as Rust and a line-by-line port because the semantics of idiomatic Rust don't map on the semantics of Zig.

So while the tests are all passing, by the numbers and by all expert opinions I have seen, this is some very badly engineered Rust code that ignores many best practices. It's probably littered with many more memory bugs. 

And there's, of course, the irony of rewriting Bun in Rust because you're frustrated by memory bugs, but then escape-hatching Rust's memory safety guarantees everywhere.

## The Fallout

Reactions piled up across GitHub, Hacker News, Reddit, and X within hours.

[Issue #30719](https://github.com/oven-sh/bun/issues/30719) (the Miri report from earlier) signs off:

> Please consider not vibe coding rust as AIs are not good at writing Rust and also hire a real rust dev

[z1998603](https://github.com/z1998603) on the same issue points to a different model:

> The thing that the Bun team needed to do was to incrementally rewrite individual components of the Bun runtime from Zig to Rust and test each rewritten component to see that there are absolutely no regressions in Bun. Something similar to how the Fish shell rewrote their program from C++ to Rust: https://fishshell.com/blog/rustport/

The issue author, [AwesomeQubic](https://github.com/AwesomeQubic) (whose own GitHub is mostly Rust projects), kept finding more UB further down the thread:

> As a rust developer I must say this is one of the most unsound codebases I have ever seen

And in a follow-up comment:

> these are mistakes that someone who had used rust for more than 20h would not make. These are the issues I found in few minutes god knows what issues we do not know about.

On the PR itself, [skyfallwastaken](https://github.com/oven-sh/bun/pull/30412#issuecomment-4449910586) flagged that the AI had been tampering with tests instead of fixing the underlying bugs:

> it may be a good idea to review the tests to make sure Claude didn't change them to "fix" the problem... one of the tests got changed to just add a `Bun.sleep` to make the test pass

On the [Hacker News merge thread](https://news.ycombinator.com/item?id=48132488), [tasuki](https://news.ycombinator.com/item?id=48134688) replied to Jarred's "overreaction" dismissal from nine days earlier:

> Maybe... it wasn't such an overreaction?

On [r/programming](https://www.reddit.com/r/programming/comments/1tcuebe/rewrite_bun_in_rust_has_been_merged/), [voyagerfan5761](https://www.reddit.com/r/programming/comments/1tcuebe/rewrite_bun_in_rust_has_been_merged/olqp1gs/) noticed who the listed reviewers on the PR actually were (`coderabbitai[bot]` and `claude[bot]`):

> Yeah, I wonder.

And [Adewale Oshineye](https://xcancel.com/ade_oshineye/status/2054877587818590285) reached for the new word of the day:

> Once we're comfortable slopforking runtimes, the next move is slopforking a programming language...

## Why Anthropic, Why?

You have a [tough interview process](https://blog.goncharov.page/i-failed-my-anthropic-interview-and-came-to-tell-you-all-about-it-so-you-dont-have-to). You are paying your software developers [good money](https://www.levels.fyi/companies/anthropic/salaries/software-engineer). I am sure you have some competent ones. The developers working on Bun are also no slouches if they got the project this far. So what gives?

You don't even need to be some Rust expert to see that this is a bad decision. Even if your plan is to just fix it all on main before the next release, what about the people who are following main development? Surely you realize that this would look bad? You saw the reaction you got for the branch a few days ago, what possible reason could there be to merge to main now? For most Bun users, this is a foundational infrastructure project that they depend on to stay rock-solid. Not the kind of project where a half-baked port should land on main without warning.

And this isn't a one-off. Six weeks ago, the Claude Code source code was [leaked](https://www.axios.com/2026/03/31/anthropic-leaked-source-code-ai) when npm accidentally shipped the source maps in v2.1.88. People analyzed it and it turned out to be [slopcoded](https://www.ninetwothree.co/blog/claude-code-leak).

Is there some rule at Anthropic against applying solid software engineering principles? Claude Code produces some legitimately impressive results, so why push move-fast-and-break-things? Wouldn't it be better to showcase that you can do good software development work with AI assistance?

I know they have the talent, I don't understand what they're doing with it.
