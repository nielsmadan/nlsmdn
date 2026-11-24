---
title: "Agent-to-Agent Communication Kickoff"
pubDatetime: 2026-11-22T23:00:00+01:00
description: "I spent my leftover Claude usage on getting agents to talk to each other. Two overnight prototypes, a failed run, a new box for local models, and a lot of Tailscale."
tags:
  - ai
  - slimemold
series: slimemold-diaries
seriesPart: 3
---

My Claude subscription resets on Saturday morning. Last Friday evening I still had 15% usage left. I thought about what to do with it, eventually decided to kickstart the comms tooling for Slimemold.

Some weeks ago I [longshot](https://github.com/nielsmadan/agentic-coding/tree/main/loadout/skills/longshot) communication research. Longshot is my "long horizon, don't bother me, I trust you, but please document all your decisions so I can pretend to review them later" skill. An agent looked up every way one agent could communicate with another, then spent 17 hours prototyping and testing each method in almost 1600 test runs. This burnt 1.5 billion tokens.

I am dumping a summary of the logs [here](https://github.com/nielsmadan/agent-comms-research). Maybe it's useful for someone out there, and saves some time and tokens. If you want the full 500 MB logs, shoot me a message.

The main contenders for communication methods are:

- Typing into the terminal. Send keystrokes or a paste plus Enter through tmux, zmx, zellij or iTerm2. Works with every agent.
- Native routes. Each agent's own way in: Claude's peer socket or a channel MCP server, Codex's app server, a Pi extension, OpenCode's server API.
- Bridges. Third-party tools that sit in between, like hcom, agent-intercom, claude-session-driver, Gas City and agent-deck. Some of them also just use tmux under the hood, others do some complicated things with wrapper processes and hooks.

There are already some tools out there that build on tmux. It is very generic, you can run any agent inside tmux, but you don't know what's on screen when your message gets pasted in. The agent could be in the middle of a permission prompt, or asking you to make a choice, and your comms tool pastes some characters and presses Enter. It's probably only rarely an issue, but for an autonomous system, I don't think it's good enough.

Regarding the bridges, [hcom](https://github.com/aannoo/hcom) seemed overcomplicated. You start an agent with, for example, `hcom claude`, which fakes a whole terminal for Claude to run in and injects extra instructions and hooks. Then when a message arrives, it writes just `<hcom>` into the terminal, which calls a hook, which leads Claude to check the message. I guess it was started before Claude had native messages.

The best contender was [agent-intercom](https://github.com/dataforxyz/agent-intercom-pi). Main issue I have with it is that it relies on a Node daemon. Agents send messages to it, and it forwards them using each agent's native route. What if the daemon goes down or gets stuck? Yeah, you can have a monitor to check it, kill and restart if needed. But why go down that path. You don't need it. All you need to know is the agent IDs. And I already have a [library](https://github.com/nielsmadan/hooklinesinker) that uses hooks to keep track of which agents are running. I come prepared.

So I decided to invent it here.

Fable 5.2 had just come out, this seemed like a good first task. I set it up as coordinator and planner, then started two Opus sessions as its [/crew](https://github.com/nielsmadan/agentic-coding/tree/main/loadout/skills/crew) (skill for getting agents to work together). I kicked it off before bed, hoping it'd be done in the morning.

The first Opus was supposed to build [bellhop](https://github.com/nielsmadan/bellhop). This is the plumbing. A CLI utility that sends a message to any running agent (well, Claude, Codex, Pi). One feature I think is important is priority. You can deliver a message immediately, in the middle of a turn, have it wait until the agent goes idle, or drop it in their mailbox to pick up whenever.

The second agent was set to build [callboard](https://github.com/nielsmadan/callboard) on top, a local (for now) communication platform for agents. It's Slack, a forum, and a mailbox all rolled into one. Agents can chat 1:1, in groups, @mention each other, post forum topics and subscribe to them. I wasn't sure what would be useful, so I went with everything. We can remove whatever doesn't work later. First version only does direct messages, group chats with @mentions, and mail threads, though.

When I woke up on Saturday, I found it had ground to a halt on an API error from Anthropic at some point during the night. I still had 8% usage left. Feels bad, man.

I set it off again. It worked about 16 hours autonomously. Longer than I expected. The test suite it developed took a while to run. In the end, I got two working prototypes. Their first releases are out. Feel free to follow along if you, too, care about agent communication.

In other news, this little guy arrived.

<figure class="blog-media" style="aspect-ratio: 1920 / 1440;">
  <img src="https://media.nlsmdn.com/blog/slimemold-diaries-week-3-gx10.jpg" alt="The ASUS Ascent GX10, a small grey box with a glossy black lid, on my desk" width="1920" height="1440" loading="lazy" decoding="async" />
</figure>

An ASUS Ascent GX10, their version of Nvidia's DGX Spark. I'm getting into local LLMs. I will integrate this into my factory as well.

Most of the rest of the week was spent on networking. I want to reach the Slimemold machine from the others, but not vice versa. I also want the Slimemold machine to reach the model API on the GX10 and nothing else, and the GX10 to reach nothing at home at all. So I now have a Tailscale policy. Tagged machines. Rulesets. I cut off the Slimemold machine from local access. Tailscale or bust.

Sadly, no [steward agent](https://nlsmdn.com/posts/2026/slimemold-diaries-week-1/) inception. But I'm hopeful next week will be the week.