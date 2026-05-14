---
title: "quickie: single source of truth for agent permissions"
pubDatetime: 2026-05-14T12:00:00+00:00
description: "Keep all your agent permissions in one place."
tags:
  - ai
  - tooling
---

I bounce around between agents / harnesses, mostly just to see what's out there, but keeping their different configurations in sync can be a pain. Particularly, permissions drift quickly, so I built myself a little system to keep them in sync.

The idea is simple: create a single source of truth for all permissions, then generate the permission files for the agents (Claude, Codex, Gemini, opencode in my case) from it.

Here's an excerpt of the permission file:

```toml
[shell]

# allow — run without prompting on every agent.
allow = [
  # git — read-only
  "git status",
  "git log",
  "git diff",
  # ... gh, glab, file inspection, version checks, docker, xcrun ...
]

# deny — hard-blocked on every agent.
deny = [
  "git push",
  "git reset --hard",
  "git clean -fd",
  # ...
]

# ask — always prompt for confirmation, even in auto modes.
ask = [
  "heroku",
]
```

[Full file.](https://github.com/nielsmadan/agentic-coding/blob/main/permissions/permissions.toml)

Then we have a simple Python script that does the generation:

```python
CODEX_DECISION = {"allow": "allow", "deny": "forbidden", "ask": "prompt"}

def codex_rule(entry, decision):
    tokens = ", ".join(json.dumps(t) for t in entry.split())
    return f'prefix_rule(pattern = [{tokens}], decision = "{decision}")'

def render_codex(rules):
    lines = []
    for category in ("allow", "deny", "ask"):
        decision = CODEX_DECISION[category]
        for entry in rules[category]:
            lines.append(codex_rule(entry, decision))
    # ... write lines to codex/rules/permissions.rules ...
```

There's one `render_<agent>` per target format, so `"git status"` becomes `prefix_rule(pattern = ["git", "status"], decision = "allow")` for Codex, `"Bash(git status:*)"` for Claude, and so on.

[Full file.](https://github.com/nielsmadan/agentic-coding/blob/main/permissions/sync.py)

Now we just have to add a guard to make sure we, and when I say we I mean some agent of course, don't accidentally ignore this whole setup. I use [lefthook](https://github.com/evilmartians/lefthook) for all my git hook guarding needs:

```yaml
pre-commit:
  commands:
    sync-permissions:
      run: python3 permissions/sync.py --check
```

`sync.py --check` regenerates everything in memory and diffs it against what's on disk. If anything is stale, it exits nonzero and the commit is blocked.

Check out my [agentic coding config repo](https://github.com/nielsmadan/agentic-coding) for more agentic coding config goodness.
