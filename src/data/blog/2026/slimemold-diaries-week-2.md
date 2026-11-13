---
title: "Slimemold Diaries Week 2: Software Factory Must Haves & Git Shenanigans"
pubDatetime: 2026-11-13T00:00:00+00:00
description: "What OpenClaw and Gas City taught me about agent systems, the one job that keeps my own assistant alive, and how the factory agents will ask for tools and open PRs."
tags:
  - ai
  - slimemold
---

I set up some software factory-ish things in the past and learned a few lessons.

Back in February or March, when everyone lost their mind about OpenClaw, or whatever it was called then, I also gave it a try. Installed it on my Mac Mini. Figured I'd start it off with a simple job: a news digest. So I told it what I'm interested in, where to look, connected it to Telegram.

I don't think it ever ran for more than 3 days in a row.

I remember I set up some extra security, forget what exactly it was, just some common-sense security thing. With the next OpenClaw update they added the same piece of config to the defaults, but they hadn't considered the case where someone already had it. It broke my config. Move fast and break things or whatever. Kept breaking over and over again for little benefit. Eventually I gave up on fixing it, a little while later deleted it wholesale.

I built my own little AI assistant inside my Obsidian vault. A bash dispatcher, some cron jobs, some Python. It's been working quite well. Some of the jobs I run there:

The news digest. It collects articles, and puts them into Obsidian. Also sends them to me via Telegram. I can grade the selection and give feedback, which it uses to get better at picking what I want to read.

Everything tracker. I used agents to move my IMDb wishlist and my Goodreads readlist into Airtable. Also added tracking for games, restaurants, recipes, and beverages (beer & wine). Gave the job an Airtable token, connected to Telegram. Now I can take a photo of a beer bottle, send it over Telegram to an agent, the agent will look up details (brewery, type of beer, etc.) and put it all in Airtable with my rating. I can also tell it to look up new cinema releases or restaurant openings and add whatever it thinks I would like to my Airtable lists, based on stated preferences and past ratings.

Dependabot tracker. Every Monday morning all my Dependabots run and open PRs. On Monday afternoon an agent looks for any PRs that are red, checks them out, figures out if there is a simple solution, and either pushes it or leaves a comment on the PR explaining why it's too complex to one-shot. I pick those up from there.

There are some more jobs and they work fairly reliably, and that's because of the most important job: Health Fix.

Whenever something goes wrong, a command returns an error code, a job does not complete when it should have, another job gets kicked off that checks if anything needs to be fixed in the system itself and opens a PR with what's fixable. I'd say this solves over 90% of the issues automatically. I open the PR, skim it, merge it. It also catches false positives and adds code or instructions, so they don't happen again. This will be one of the first things I add to slimemold.

I tried [Gas City](https://github.com/gastownhall/gascity) as well. Tried to connect it to my todo manager. Maybe I should have started with the stock config. Figured it'd just be a matter of time to get it running. It never got off the ground. I'd start a run, some feature I wanted in the project where I set it up, check back with the session a couple hours later, ask for the status. The agent in charge would check the system, the agents doing the work, the coordinators, something invariably got stuck somewhere. Kill this agent or that agent, start over. Happened ten more times until I gave up.

What I particularly didn't like about it, aside from having the issues in the first place, is that I'd have to ask the agent what was going on, and then the agent had to do its own digging to find out what went wrong where. For slimemold I want alerts, I want logs, I want control planes and I want it pretty!

Maybe I should not build this myself. Maybe I should have explored the many other projects that purport to do it first. Maybe I got unlucky with other people's systems. Maybe I got lucky with my own. But oh well. It's fun to build this thing in any case. I might learn something. And it's nice to be in charge of your own destiny.

This week I mostly did system tooling and git / GitHub setup.

I think I need some kind of guardrails to stop agents from messing with the system. But there should be some way to change things as well.

All system tools are installed by the OS admin account. When an agent wants to install a new tool, it opens a PR on the [config repo](https://github.com/nielsmadan/rc). If I approve and merge it, the new config gets applied henceforth! I set it all up and did a dry run. Check!

Git and GitHub configuration is not simple. I have some public and private repos on my personal account. Some more private repos on my org account. For some of them I'm okay with the agents just making changes based on my feature requests, like for prototypes and pre-release projects. Maybe others as well over time if the system works well. Maybe we get to a point where the agents implement new features, we A/B test it, if it works, great, if not, revert. But agents, even the smartest ones, are still not great at product management in my experience. They're prone to overindexing and obsessing on one thing and forgetting everything else.

Anyway! Two GitHub accounts, both alike in dignity! GitHub won't let an account approve its own PR, so whoever is doing the approving needs to have a separate account. Maybe I could have found a workaround. Add some approval label, tell the agents not to add it to their own PRs. Or just tell them not to merge their own stuff. Oh well, went with this now. Maybe having some hard rules is a good thing? I tested it and it works at least. That's a start.

Then the repo setup. Used to do it manually for myself, not a big deal, but too cumbersome for all these rules. Created an [OpenTofu](https://opentofu.org/) repo with two configs, one for my personal account, one for the org. Imported what was already there, added the new branch rules on top. Tested the PR workflow. Check!

Figured I would go with [automatic permission classifiers](https://code.claude.com/docs/en/auto-mode-config) for the agents. Claude and Codex have it built in, Pi has a plugin. But then the agent I was using to test it got some commands denied. If the classifier doesn't like it being tested, it probably also does not like it running for real. Decided to skip it for now. If they go feral, we can figure it out then.

Next week, maybe we'll be ready to incept the stewards. Exciting.
