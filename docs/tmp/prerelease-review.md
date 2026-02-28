# Pre-Release Review — nlsmdn.com

**Date:** 2026-02-27
**Reviewers:** 6 Claude agents + Gemini + Codex (two rounds)

---

## Critical Issues (Must Fix)

### 1. Resend API return value not checked

**File:** `src/pages/api/subscribe.ts:22`

The Resend SDK returns `{ data, error }` — when `error` is set, the call doesn't throw but the operation failed. The current code only catches thrown exceptions. A failed create (validation error, rate limit, duplicate) returns 200 "Subscribed!" to the user.

**Fix:** `const { error } = await resend.contacts.create(...)` and handle accordingly. Also return a friendly "You're already subscribed!" for duplicates instead of a generic error.

### 2. Share link URLs not URI-encoded

**File:** `src/components/ShareLinks.astro:13`

`href={social.href + URL}` concatenates the page URL into query parameters without `encodeURIComponent()`. If a URL contains `&`, `#`, or `?`, share links for Reddit, Bluesky, and HN break.

**Fix:** Use `encodeURIComponent(URL)` when building the href.

### 3. Future/scheduled posts are accessible

**Files:** `src/pages/posts/[...slug]/index.astro:12`, `src/pages/archives/index.astro:16`

Both `getStaticPaths` and the archives page filter only `!data.draft`, not future-dated posts. Static pages are generated for scheduled posts, making them accessible by direct URL before their publish date.

**Fix:** Add the `isPublishTimePassed` check or use `getSortedPosts()` which already filters these.

### 4. Structured data issues on non-post pages

**File:** `src/layouts/Layout.astro:35-49`

Every page (404, search, about, home) gets `BlogPosting` structured data. Non-post pages should use `WebSite` or `WebPage` schema. Google Search Console will flag incorrect structured data.

**Fix:** Only emit `BlogPosting` when `pubDatetime` is provided; use `WebSite` otherwise.

### 5. RSS `pubDate` uses modification date

**File:** `src/pages/rss.xml.ts:18`

`pubDate: new Date(data.modDatetime ?? data.pubDatetime)` — editing a typo in an old post changes its RSS publication date. RSS readers will re-surface old posts as new.

**Fix:** Always use `data.pubDatetime` for RSS `pubDate`.

---

## Improvements (Should Fix)

### 6. ~~Tag links produce 404s~~ FIXED

~~`src/components/Tag.astro:13` linked to `/tags/${tag}/` but tag pages were deleted.~~

**Status:** Fixed — tags now link to `/search?q=${tag}`, which searches for the tag via Pagefind.

### 7. Off-by-one in next post navigation

**File:** `src/layouts/PostDetails.astro:79-80`

`currentPostIndex !== allPosts.length` is always true for valid indices. Should be `allPosts.length - 1`. Currently masked because `undefined` is falsy, but if `findIndex` returns `-1`, `allPosts[0]` would incorrectly be used as next post.

### 8. Missing `og:type` meta tag

**File:** `src/layouts/Layout.astro:82-86`

OG tags include title/description/url/image but not `og:type`. Should be `"article"` for blog posts, `"website"` for other pages.

### 9. Empty `theme-color` meta tag

**File:** `src/layouts/Layout.astro:129`

`<meta name="theme-color" content="" />` — set actual color values (e.g., accent color for light, background color for dark).

### 10. Missing HSTS header

**File:** `vercel.json`

Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

### 11. Dev warning says `pnpm` instead of `bun`

**File:** `src/pages/search.astro:41`

The dev-mode warning tells developers to run `pnpm run build` but this project uses bun.

### 12. Significant dead code from deleted features

**Components:** `Pagination.astro`, `EditPost.astro`, `BackButton.astro`, `StructuredData.astro`
**Utilities:** `getPostsByTag.ts`, `getUniqueTags.ts`, `getPostsByGroupCondition.ts`
**Icons:** `IconWhatsapp`, `IconPinterest`, `IconTelegram`, `IconFacebook`, `IconMoon`, `IconSunHigh`, `IconHash`, `IconSearch`
**Pages:** `src/pages/archives/` (permanently disabled via `showArchives: false`)
**Config:** `postPerIndex`, `postPerPage`, `showArchives`, `showBackButton`, `editPost` — all unused
**Other:** `backUrl` logic in `Main.astro` and `search.astro`, stale breadcrumb logic for `/tags/` and `/posts/` pagination, `hideEditPost` and `featured` fields in content schema, `eslint-disable-next-line` comment in `astro.config.ts`

---

## Suggestions (Nice to Have)

### 13. No rate limiting on subscribe endpoint

All external advisors flagged this. Consider Vercel Edge Middleware with Upstash, or a simple honeypot field for bot protection.

### 14. Missing CSP header

Not strictly required for launch, but a good defense-in-depth measure. Will require `'unsafe-inline'` for theme script and Vercel analytics.

### 15. Missing `Permissions-Policy` header

`camera=(), microphone=(), geolocation=()` — easy win.

### 16. Theme toggle `aria-label` accessibility

**File:** `src/components/Header.astro:131`, `src/scripts/theme.ts:35`

Label is `"auto"`/`"light"`/`"dark"` instead of describing the action (e.g., "Switch to dark mode").

### 17. `X-XSS-Protection` header is deprecated

**File:** `vercel.json`

Modern browsers ignore it; `1; mode=block` can actually introduce vulnerabilities in older IE. Set to `0` or remove.

### 18. Missing `og:site_name` meta tag

Recommended for better social sharing appearance.

### 19. Twitter meta tags use `property` instead of `name`

Works in practice but technically incorrect per Twitter Card spec.

---

## External Advisor Reviews

### Gemini

Flagged broken tag links, nextPost index bug, newsletter security (rate limiting + hardcoded audience ID), share link encoding, dead code, and lack of pagination. Suggested redirecting tag links to search with tag as query parameter (adopted).

### Codex

Flagged subscribe API validation/rate-limiting gaps, DOM double-injection of heading links on client navigation, broken tag links, share link encoding, potential `tags.map` crash if tags undefined, OG image fallback. Suggested replacing DOM mutation with rehype/remark plugins at build time.

### Cross-Model Agreement

All 3 models (Claude, Gemini, Codex) converge on:
1. **Tag links broken** — unanimous (now fixed)
2. **Share URLs need encoding** — unanimous
3. **Subscribe API needs validation** — unanimous
4. **Dead code cleanup needed** — unanimous
5. **NextPost boundary check wrong** — Gemini + Claude

---

## What Looks Good

- Build pipeline (astro check + build + pagefind) is correct
- Vercel config properly set up with bun
- Content collection schema is well-defined
- Analytics loads only in production
- Search, RSS, sitemap, canonical URLs all work
- About page has real personalized content
- Pre-commit hooks (Biome + astro check) are solid
- Social links point to real profiles
- Dark mode and FOUC prevention properly implemented
- Newsletter subscription with Resend works end-to-end
- Dependabot configured for automated dependency updates
- `RESEND_API_KEY` correctly declared as server-only secret

---

**Bottom line:** Fix items 1-5 (Resend error handling, share URL encoding, future post filtering, structured data, RSS pubDate), then clean up dead code. Security headers (HSTS at minimum) are worth adding but aren't blockers.
