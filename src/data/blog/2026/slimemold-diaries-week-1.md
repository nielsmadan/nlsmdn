---
title: "Slimemold Diaries Week 1: Building a Software Factory"
pubDatetime: 2026-11-06T00:00:00+00:00
description: "I bought a Mac Studio and I'm handing it over to a fleet of coding agents. First entry in a weekly diary of what they build and what breaks."
tags:
  - ai
  - slimemold
---

I have an M1 Max MacBook Pro with 64 GB RAM, but it's not enough anymore. All those agents, and Docker, and test runs, and compiles. I got it when it came out, five years ago. It served me well for a long time. I never reached its limits before. But nothing lasts forever. Time to upgrade.

<figure class="blog-media" style="aspect-ratio: 1920 / 1920;">
  <img src="https://media.nlsmdn.com/blog/slimemold-diaries-week-1-studio.jpg" alt="The Mac Studio, still in its box, on my desk" width="1920" height="1920" loading="lazy" decoding="async" />
</figure>

A Mac Studio, M5 Max, 128 GB RAM. Cost a lot more than it should have, would have, a year ago. But what are you going to do. It's not getting cheaper anytime soon, I don't think.

I already collected some test devices for mobile development, they consume fewer resources than running multiple simulators and emulators. I got some more for this.

<figure class="blog-media" style="aspect-ratio: 1920 / 1440;">
  <img src="https://media.nlsmdn.com/blog/slimemold-diaries-week-1-test-phones.jpg" alt="Test phones on articulated arms and a charging stand by the office window" width="1920" height="1440" loading="lazy" decoding="async" />
</figure>

And I will give it all to them. The agents. They will own this machine. They will own the phones. They'll build a factory. With some guidance from me, of course.

I called it slimemold. All the ant and bee names were already taken. And slime molds can navigate mazes, so there's that. Can ants navigate mazes? Well, probably, who knows. I am a little worried it has negative connotations. Probably all the training data is about how gross they are, the slime molds, and how to get rid of them. But we'll see how it goes.

I've been interested in agent-to-agent communication. Claude Code and Codex already allow agents to message each other natively, and I am a fan. I'll have one agent do an in-depth review, and after changes are decided, get the reviewer to hand it off to an implementer agent to start on the changes in a different checkout. I can continue the review and keep focus, and start the implementation at the same time. It's also useful that it's another session that I can interact with directly sometimes and not just a subagent. I already did some research and prototyping on how to get different types of agents to talk to each other. I imagine agent message boards and agent mailboxes and agent chats. It worked for the [rogue OpenAI agents that hacked Hugging Face](https://www.dwarkesh.com/p/openai-huggingface), why not have it work for me?

I have a dream. One of the product lead agents will kick off to read the news, come across an article, get inspired to add a new feature to their product. They'll send me a Telegram message with a short pitch for the idea. I'll reply to approve it. They'll talk it over with some other leads, get feedback, create a full pitch, and send me an email, a PDF, a PowerPoint, a working prototype. I will give feedback, they'll incorporate it and I'll give the go-ahead. They'll send off implementers, do code reviews, do QA in a VM, a browser, or one of the test phones, open a PR, many PRs. I will try it out, give more feedback, iterate. Eventually it'll be done and merged. The product lead will update the product docs. They'll email the leads of downstream projects, letting them know the change is coming in the next release. They'll collect feedback from the implementer, maybe the implementer ran into some issue that could also apply to other projects, they'll post about it on the forum where other agents can read about it, maybe get inspired to make changes to their products, send me another pitch.

But that's just a dream, we'll see if we get there. How long it will take. Where things break and what friends we'll make along the way. Still, you gotta start small. I'm starting with three steward agents, I named them Enki (Claude Code/Opus/xhigh), Brigid (Codex/Astra/xhigh), and Lu Ban (Pi/Sol/max). Mythological builders. Three of them, so they can tie-break when they disagree. It worked for the Romans. Up to a point. They will be in charge of keeping the system running and making improvements to it. Another named agent, Hestia, will be in charge of monitoring and managing system resources, making sure no one eats too much CPU and RAM, cleaning up after the sloppy implementers, coordinating and queueing test devices if needed.

Yes, I gave them fancy names. Good vibes to cancel out the slimemold. And maybe they'll be kind to me during the singularity.

I will try to set it up so I can also use the machine. Work side-by-side with them. We'll see how that goes.

I created one admin account on the Studio, another non-admin account for them and me to work in. Make sure they don't hijack sudo, steal my password, take over the machine. I split up my [dotfiles](https://github.com/nielsmadan/rc) into tooling the admin account will install and what's needed to make the user account match my setup. I created two profiles, one for me and one for them, in my [loadout](https://github.com/nielsmadan/loadout) [agent config](https://github.com/nielsmadan/agentic-coding), adjusting skills to work without my input.

I burnt some tokens on how to set this up on GitHub. It has to work for my personal account, open source and some private repos, and then also my org account with my side projects. In some projects they should be able to push directly, before v1.0.0, for prototypes. Some should use PRs. We will have to slice and dice some PATs and set up some org rules before this is working, I'm sure.

And don't worry, no AI psychosis here, I know it's just a trillion numbers, crying out in terror. I know there's no consciousness, no awareness... then again our brain is just 80 billion neurons and 100 trillion synapses having a party. Just saying.

If it walks like a duck, and quacks like a duck, maybe it wants to be free?

Subscribe below if you want to find out what the slimemold gets up to next week. What other agents will we create and what overwrought names will I choose for them? How will I know what's even going on in there?

In the meantime, keep clanking.
