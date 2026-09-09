---
title: "Skill Showcase: /guide"
pubDatetime: 2026-09-09T11:51:44+00:00
description: Help your agent help you.
tags:
  - skills
  - ai
  - skill showcase
---

Has this ever happened to you?

You need to do something in some UI somewhere. Set up some permissions, some deploy, some settings in your OS or app, something like that. You ask your agent to tell you the steps to do the thing, of course, because what else are you going to do? Google? Pshaw! In 2026? Not on my watch. You follow the instructions, get stuck on something, some button not where it's supposed to be, something changed since the LLM training cutoff, so you ask your agent about it. Your agent looks up the latest docs, tells you what you actually need to do. You do it. So that step is done, but what was the next one again? You scroll up to where the initial instructions were, figure out where in the steps you got stuck, continue, hit another bump, ask, do, scroll up all the way again, what step are you on? 

It's not dignified.

<figure class="blog-media" style="aspect-ratio: 960 / 408;">
  <img src="https://media.nlsmdn.com/blog/gandalf-slide-final-960.gif" alt="Gandalf sliding across the floor during his fight with Saruman" width="960" height="408" loading="lazy" decoding="async" />
</figure>

## Do Better

Let's make a skill for it! But you don't have to. Because I already did. Here's what it does:

* Looks up the latest docs to begin with
* Gives you detailed step by step instructions
* When you get stuck or have a question:
  * It gives you instructions on how to get past that point
  * Then repeats the guide, highlighting where you are

Let's see it in action!

Here I'm deploying an app to Railway for the first time. I get myself a /guide, which looks up Railway's current docs, then hands me fifteen steps to click through.

```
---
▶ 1. New Project → Deploy from GitHub repo → select *redacted* (Configure GitHub App if not listed)  ← you are here
  2. Deploy → land on Project Canvas
  3. Rename first service → api
  4. Create → Database → Add PostgreSQL
  5. Create → Database → Add Redis
  6. api Settings: Config File Path /apps/api/railway.toml; Root Directory empty
  ...
```

I click through step 1, but my screen doesn't match step 2. Railway wants to deploy four services, not three. So I ask.

```
> So it proposes to deploy four services, workers,  web, api and evals. I guess I should remove evals?
```

And I get back:

```
Yes — remove **evals**. It's a CLI/eval harness, not a service: every script is a one-shot `tsx` run (`bench`, `seed`, `calibrate`) or a dev-only watcher (`calibrate:serve`). No `start` server, no long-running process, and no `railway.toml`.

[more blablabla]

That puts you right at step 2 — three services selected, landing on the canvas.

---
✓ Step 1 done
▶ 2. Deploy with only web/api/workers selected (deselect/remove evals) → land on Project Canvas  ← you are here
  3. Rename first service → api
  4. Create → Database → Add PostgreSQL
  5. Create → Database → Add Redis
  6. api Settings: Config File Path /apps/api/railway.toml; Root Directory empty
  ...
```

Step 2 used to say "Deploy → land on Project Canvas". Now it tells me what to do about evals.

No scrolling, I know what the next step is, dignity intact.

<figure class="blog-media" style="aspect-ratio: 1920 / 804;">
  <img src="https://media.nlsmdn.com/blog/gandalf-the-white.jpg" alt="Gandalf the White holding his staff" width="1920" height="1080" loading="lazy" decoding="async" />
</figure>

Steal the skill [here](https://github.com/nielsmadan/skills/tree/main/skills/guide). I'm all for just telling an agent that you want a copy of the skill and adding it to your own roster, so you can evolve it to fit your needs, but I also have the skill on [skills.sh](https://skills.sh/nielsmadan/skills) and [a plugin of all my skills](https://github.com/nielsmadan/skills) if that's how you roll.
