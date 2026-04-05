# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal blog at nlsmdn.com, built with Astro 5 and based on the AstroPaper theme. Uses Tailwind CSS v4, MDX, and React. Deployed on Vercel.

## Commands

```bash
bun install              # install dependencies
bun run dev              # dev server at localhost:4321
bun run build            # type-check + build + pagefind index
bun run preview          # preview production build
bun run lint             # biome lint (src only)
bun run check:fix        # biome lint + format with auto-fix
bun run sync             # regenerate Astro types
```

## Architecture

- **Package manager**: bun (not npm/yarn/pnpm)
- **Linter/formatter**: Biome (not ESLint/Prettier) — double quotes, semicolons, 2-space indent
- **Pre-commit hooks**: lefthook runs `biome check --write` and `astro check`
- **Before finishing a task**: always run `bun run build` to catch type errors, unused imports, and build issues
- **Path alias**: `@/*` maps to `./src/*`
- **SVG icons**: Never hand-code SVG paths. Always use proper brand assets from official sources (e.g. Simple Icons, Lucide)

### Key files

- `src/config.ts` — site-wide settings (SITE constant): author, title, URL, feature flags
- `src/constants.ts` — social links and share link definitions
- `src/content.config.ts` — blog collection schema (Astro content collections with glob loader)

### Blog posts

Posts live in `src/data/blog/` as Markdown files, organized by year subdirectory. Frontmatter schema:

```yaml
title: string          # required
pubDatetime: date      # required
description: string    # required
tags: string[]         # defaults to ["others"]
draft: boolean         # optional, hides from production
featured: boolean      # optional
modDatetime: date      # optional
```

Posts with `draft: true` or `pubDatetime` in the future are filtered out in production.

### Links and references

When adding links and references to blog posts, prefer academic studies, primary sources, and reputable outlets (e.g. research institutions, major news organizations, official documentation) over aggregator blogs and SEO content farms. Before inserting a link, quote the specific line(s) from the source that support the claim being linked, so the user can verify the source actually says what we need it to say.

### OG images

Dynamic OG images are generated via satori + resvg-js. Templates are in `src/utils/og-templates/`.

### Search

Client-side search powered by Pagefind. The build step generates the index into `dist/pagefind` and copies it to `public/pagefind`.
