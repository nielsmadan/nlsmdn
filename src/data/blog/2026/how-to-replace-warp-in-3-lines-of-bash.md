---
title: "How to replace Warp in 3 lines of bash"
pubDatetime: 2026-03-17T21:00:00+00:00
description: "I start off this soon-to-be-esteemed blog by replacing a 100+ million-dollar startup's flagship software with a little bit of bash. You're welcome!"
tags:
  - tooling
  - ai
---

Alright, a blog's gotta start somewhere, pop the cork, that kind of thing, so here we go.

I am sorry. About the clickbait title, I mean. For what it's worth, this wretched attention economy was not my idea. And for the record, while I am ever so lightly poking fun at Warp in this here blog post, I have nothing against it, and I have nothing against you if you're using it. I might even give it another spin at some point. So don't come at me, yea?

## Adventures in Warp

So, in ancient times, before the advent of agentic coding, you know, about a year and a half ago, when we had to copy and paste our fingers raw to get AI to do our work for us, I decided to give [Warp](https://www.warp.dev/) a try. The idea that you could just tell Warp what you wanted to do, and it would figure out the command and params for you and give it to you directly without any copy pasting was seductive.

Alas, it was a short-lived affair as I soon ended up in config hell with Warp constantly adding more options, messing up what was previously set up, sloppily pushing its AI features all over the place, until eventually some legit commands errored out in Warp while working just fine in other terminals. After a while I figured this was too much time to spend getting basic terminal functions to work, and went back to my old love, [iTerm2](https://iterm2.com/).

And I cannot say I was pining for Warp after going back, turns out when you have AI inside your shell, you don't really need it sprayed all over your terminal as well. But there was one thing I did miss: being able to describe a terminal command and get it to generate right there in the terminal was as nice as I imagined. It didn't work reliably and would sometimes trigger its AI on valid commands, but when it did work... it felt good. Going back to reading man pages, googling, or asking Claude / Codex how to do something and then copying the response over like a medieval peasant? Quite the downer, actually. You get used to convenience quickly.

## Speedrunning Warpless

So what are you gonna do? Ask Claude about it, of course, and it turns out there's a `print -z` command in zsh that will insert whatever you pass to it into the next command line, ready for you to review and edit before hitting enter. Or look up `READLINE_LINE` for bash and `commandline` in fish if you're so inclined. Who knew? I did not.

So then it's really just three things: call the AI, capture the output, and stick it on the command line with `print -z`. One shot calling the coding harness of our choice to get us the command:

Claude Code:

```bash
_ccli() {
  local result
  result=$(claude --model haiku --tools "" --disable-slash-commands --no-session-persistence --system-prompt "You are a shell command generator. Return ONLY a single shell command. No explanation, no markdown, no code blocks." -p "Request: $*")
  result=$(echo "$result" | sed '/^```/d' | sed '/^$/d')
  print -z "$result"
}
alias ccli="noglob _ccli"
```

Claude Code, the naughty dog, would sometimes return ``` around the command, so we are filtering those out. 

Gemini:

```bash
_gemcli() {
  local result
  result=$(gemini -m gemini-2.5-flash -e none "Return ONLY a single shell command that can be executed directly. No explanation, no markdown, no code blocks - just the raw command. Request: $*")
  print -z "$result"
}
alias gemcli="noglob _gemcli"
```

Codex:

```bash
_cxcli() {
  local result
  result=$(codex exec -m gpt-5-codex-mini -s read-only --skip-git-repo-check "Return ONLY a single shell command that can be executed directly. No explanation, no markdown, no code blocks - just the raw command. Request: $*" 2>/dev/null)
  print -z "$result"
}
alias cxcli="noglob _cxcli"
```

The `2>/dev/null` is here because Codex likes to print progress info to stderr, which would otherwise clutter the output.

OpenCode (replace openrouter/glm-5 with whatever you are using):

```bash
_occli() {
  local result
  result=$(opencode run -m openrouter/z-ai/glm-5 "Return ONLY a single shell command that can be executed directly. No explanation, no markdown, no code blocks - just the raw command. Request: $*" | tail -1)
  print -z "$result"
}
alias occli="noglob _occli"
```

We are selecting faster, simpler models here since we do not need anything sophisticated for a basic shell command. GLM-5 is actually more frontier, but it's roughly the same price as the others.

If you're wondering about the noglob, it's so the terminal does not expand e.g., ? into glob patterns and we can run `ccli what's the git command to list all branches, sorted by committerdate?`

<video id="demo-video" src="https://media.nlsmdn.com/ai-cli.mp4" controls playsinline muted width="100%"></video>
<script>
new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.play(); });
}, { threshold: 0.5 }).observe(document.getElementById("demo-video"));
</script>

And we are done. All (the useful features) of Warp without the constantly changing kitchen sink design!

## Warping Up

To improve speed, we could hit the chat AI APIs directly, which would skip the coding harness system prompts and what have you, but this works well enough and you don't have to worry about authentication. Keep it simple, stupid, and all that.

Final word of advice, at least for me, Codex produces the best output here with its low-cost model and is also consistently the fastest. The speed advantage may well be because my Claude Code config is more sophisticated, so startup takes longer. Maybe I'll look into it in the future, but at this point my recommendation is Codex for this if you have access to it.

If you want to have a look at more of my agentic coding setup / config including a bunch of Claude Code skills, feel free to check it out on [GitHub](https://github.com/nielsmadan/agentic-coding).

First blog post on the books. Fin.
