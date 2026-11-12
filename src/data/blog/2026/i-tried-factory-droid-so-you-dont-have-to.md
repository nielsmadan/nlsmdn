---
title: "I Tried Factory Droid So You Don't Have To"
pubDatetime: 2026-11-12T00:00:00+00:00
description: "A month on Factory Droid's $200 plan: the models, the usage limits, Auto Model, Missions, and whether it earns a place next to Claude Code and Codex."
tags:
  - ai
  - tooling
---

In my quest to find the optimal setup, with the most elite coding agents, where I jump between them with ease and they all talk to each other, and like each other, and merrily work together for the greater good of whatever the heck it is I'm trying to do, I tried [Factory Droid](https://factory.com). Should I invite it onto my little ark of agents and tooling or should I leave it to be washed away by the flood of slopware, never to be heard from again? And maybe more importantly, should you?

## Context

Before we get going, just a few things about me, so you know where I am coming from and what I'll be comparing Droid against.

I've been a software developer for almost 20 years. I went freelance about 8 years ago and mostly worked on mobile apps since, but also some web frontends and backends along the way. You can see when I started agentic coding with Sonnet 4 in July 2025 here:

<figure class="blog-media" style="aspect-ratio: 739 / 157;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-git-stats.png" alt="My GitHub contribution graph: sparse until mid-July, then busy for the rest of the year" width="739" height="157" loading="lazy" decoding="async" />
</figure>

I went from finding the motivation, time, and brainspace to work on my side projects once in a blue moon to suddenly making real progress. The project I was working on back then? It'll be done any day now, I swear!

Since then I've worked with Claude Code, Codex, OpenCode, and Pi. I'm subscribed to Claude Ultra, ChatGPT Pro 20x, OpenCode Go Plus, and I got some OpenRouter credits, too. I've used agents for client work, meticulously reviewing every line, making sure it's all exactly like it would have been if I'd artisanally typed it in myself; I've used agents in some of my open-source and side projects without looking at the code at all. I've also used agents to synthesize recipes from my favorite blogs and YouTube videos, to manage and plan D&D campaigns, and to build my own little OpenClaw-ish AI assistant that reviews my Dependabot and CI failures and fixes them autonomously, and does ten other things.

<figure class="blog-media" style="aspect-ratio: 998 / 804; max-width: 499px;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-invoice.png" alt="Factory invoice for $200.00, paid on Sep 14, 2026" width="998" height="804" loading="lazy" decoding="async" />
</figure>

I opted for the $200 plan from Factory Droid for an apples to apples comparison, and we're off to the races. Let's see what it can do.

## The Models

Factory Droid does not have its own models. Instead, you choose from a smorgasbord of options from different AI labs, from frontier models like Opus and Astra all the way to DeepSeek Flash and Mistral.

<figure class="blog-media" style="aspect-ratio: 733 / 399;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-model-select.png" alt="Droid's model picker, listing models with their credit multipliers and an Auto Model option" width="733" height="399" loading="lazy" decoding="async" />
</figure>

I did this test a month ago, so the models look a bit outdated now, but they were the latest you could get at the time, with no delay between a model's release and its arrival in Droid.

As you can see, all the models get multipliers on their tokens depending on how expensive they are, and now and then some of them are on offer. When I started using it, Sol 5.6 was 20% off for a 1.6x multiplier, and since I had already used the same Sol in Codex and Pi, I figured keeping the model constant would be a good test case for my first week of Droid.

I would say the weekly window got me about 50% of the Sol usage I get from ChatGPT Pro 20x. I sent an agent off to beancount the tokens in the logs, and it reported that my gut feeling is in the right ballpark. It also claimed the monthly window is even lower, around 25%. Take these numbers with a grain of salt: I did not deep dive to verify.

I am confident that you get less usage, and that is what you would expect from a third-party subscription compared to buying directly from a lab, so it's not a huge surprise. It does seem to be substantially less, though, which makes you ask: does Droid offer anything to make up for it?

## Core Models

You do get a second tier of usage, for what it's worth.

<figure class="blog-media" style="aspect-ratio: 622 / 183; max-width: 622px;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-core-models.png" alt="The Droid Core section of the model picker, with open models and their multipliers" width="622" height="183" loading="lazy" decoding="async" />
</figure>

This is on a completely different budget. You can certainly squeeze some usage out of it, but you have to remember that it's there, and remember to switch it on when working on less complex tasks, or find some other way to integrate it into your workflow.

By default, Droid will also fall back to one of the Core models when it runs out of normal usage. This is of course not what you want most of the time. When you select, say, Opus for complex work, you do not want it to switch to some lower-tier model mid-task. If you could enable the fallback per session, it would be more useful. You could set it for the tasks where you're using a low- or mid-tier model to begin with, but it's a global setting. Thankfully, you can disable it completely, so it just stops if it runs out of usage.

And stop it will. A lot.

Droid's 5h limit is brutal. I have used Claude Code for more than a year, and I can fairly easily hit the weekly limit these days if I go all out, but I have never hit a 5h window. With Droid I hit it constantly.

The weekly limit is manageable if you keep track of how much you have left. But when the 5h window is used up and you need to get something done that day, you just sit there. Well, I didn't. I switched to Claude or Codex, but I would've sat there if I'd been fully on Droid.

## Auto Model

After a week of this, I decided it was time to start exploring what else Droid has to offer. Enter Auto Model. Droid advertises this as selecting the right model for whatever the job is. Sounds good, right? I think we all have a tendency to pick beefier models than we need, so if Droid could get this right, we could squeeze the same productivity out of fewer, cheaper tokens.

Unfortunately, Droid is not particularly smart about it, and just selects one model based on the first message of the session. Then you're stuck with it until compact. First message sounds simple, but then the task gets more complex, or vice versa? Auto Model will not switch to match. It also seems to prioritize cheaper models, picking Luna, GLM 5.3, and DeepSeek 94 out of 104 times for me. I was not impressed with their performance on those tasks, either, and often felt they were underpowered.

## Missions

Another (potentially) standout feature: Droid has Missions for long-horizon tasks. First thing it does, it evaluates your project's mission readiness.

<figure class="blog-media" style="aspect-ratio: 533 / 262; max-width: 533px;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-mission-readiness.png" alt="Droid warning that the repository is not agent-ready before starting a Mission" width="533" height="262" loading="lazy" decoding="async" />
</figure>

This will check for unit tests, static analysis, and 80+ other things. You don't need to meet them all to start a mission, but allegedly it helps. Or it would if the 5h limit didn't play spoilsport again, because after you use it up, the mission just stops. It does not restart automatically after the 5h are up, either. So much for being long-horizon.

<figure class="blog-media" style="aspect-ratio: 809 / 123;">
  <img src="https://media.nlsmdn.com/blog/factory-droid-mission-models.png" alt="The Mission prompt showing the orchestrator, worker and validator models Droid selected" width="809" height="123" loading="lazy" decoding="async" />
</figure>

I did not choose these models, by the way; the harness did. (This screenshot is from a later run, so the lineup changed a bit.) So I started the mission, did some preparation tasks to make Droid happy and mission-ready, then sent it off. Contrary to its Auto Model tendencies, it picked high-tier models here: Claude Opus 4.8 high for the implementation workers and GPT-5.6 Sol high for the validation ones. Then it hit the limit in 1h40 and gave up. I kickstarted it a few more times for science, and it ended up burning about one sixth of my monthly allowance in Sol and Opus tokens for mediocre output.

## The Harness

Apparently no one informed Factory about the RAM crisis, because the harness gobbles up memory non-stop. A single Droid session can easily take up more than 1.5 GB after running a while.

I have 64 GB of RAM in my main dev machine, and I can run 30-40 Claude / Codex / Pi sessions at the same time without feeling it, but when I added 5-10 Droid sessions into the mix my machine would noticeably slow down. When you are done with a Droid session, you better close it.

Finally, when going through the logs, my trusty agents also found that Droid had thrown away 87 subagent results over a nine day period. They all came back with "No output available", because Factory's own backend answered 404. That's about 8% of my monthly usage, gone.

## Final Verdict

If you want to try out some models outside of the frontier labs, this is not a bad way to do it. Or at least not a worse way than OpenCode Go or Cursor CLI; can't speak to Copilot. You get more usage out of it than if you paid by the token, that's for sure.

But ultimately, this feels like a resource-hungry, poorly designed piece of software compared to Pi, Codex, and even the [famously slopcoded](https://alex000kim.com/posts/2026-03-31-claude-code-source-leak/) Claude Code. I'll probably stick to the $20 tier just for my [second-opinion skill](https://github.com/nielsmadan/skills/tree/main/skills/second-opinion) and to keep tabs on it, because, let's face it, I'm poly-agent curious, but I would not even recommend that for most people.

I'm planning to try out Devin next. Subscribe if you want to find out how that goes.
