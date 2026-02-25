# Pre-Release Review — nlsmdn.com

**Date:** 2026-02-15
**Reviewers:** 6 Claude agents + Gemini + Codex

---

## Critical Issues (Must Fix)

### 1. `SITE.desc` is a TODO placeholder

**Confidence:** 99 (all reviewers flagged)

- `src/config.ts:5` — `desc: "TODO - add your site description"`
- Ships in meta description, OG tags, RSS feed, and the dynamic OG image
- Biggest SEO and presentation issue

### 2. Structured data emits `"datePublished": "undefined"` on non-post pages

**Confidence:** 95 (5/8 reviewers)

- `src/layouts/Layout.astro:40` — `datePublished: \`${pubDatetime?.toISOString()}\``
- Every non-post page (home, about, search, tags) gets invalid JSON-LD
- Google Search Console will flag this
- **Fix:** `...(pubDatetime && { datePublished: pubDatetime.toISOString() })` or only emit `BlogPosting` structured data on actual post pages

---

## Improvements (Should Fix)

### 3. Default Astro favicon

**Confidence:** 95 (2/8 reviewers)

- `public/favicon.svg` is the stock Astro rocket icon — replace with your own

### 4. Missing HSTS header

**Confidence:** 95 (3/8 reviewers)

- `vercel.json` — add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### 5. Missing `og:type` meta tag

**Confidence:** 95 (3/8 reviewers)

- `src/layouts/Layout.astro` — OG protocol requires `og:type` (`"website"` or `"article"`)

### 6. Empty `theme-color` meta tag

**Confidence:** 92 (3/8 reviewers)

- `src/layouts/Layout.astro:125` — `<meta name="theme-color" content="" />` — set actual color values

### 7. Off-by-one in next post navigation

**Confidence:** 95 (1/8 reviewers, but a real bug)

- `src/layouts/PostDetails.astro:81` — should check `currentPostIndex !== allPosts.length - 1`
- Currently masked because `undefined` is falsy, but it's a latent bug

---

## Suggestions (Nice to Have)

### 8. Missing CSP header

**Confidence:** 90 (4/8 reviewers)

- Not strictly required for launch, but a good defense-in-depth measure
- Will require `'unsafe-inline'` for the theme script and Vercel analytics

### 9. Missing `Permissions-Policy` header

**Confidence:** 85 (3/8 reviewers)

- `camera=(), microphone=(), geolocation=()` — easy win

### 10. Deprecated `X-XSS-Protection` header

**Confidence:** 85 (2/8 reviewers)

- Modern browsers ignore it; set to `0` or remove

### 11. Missing `og:site_name` meta tag

**Confidence:** 90 (1/8 reviewers)

- Recommended for better social sharing appearance

### 12. Unused `NewsletterForm.astro` has placeholder username

**Confidence:** 95 (2/8 reviewers)

- Not imported anywhere, so not rendered — but should be configured or deleted

### 13. Twitter meta tags use `property` instead of `name`

**Confidence:** 88 (1/8 reviewers)

- Works in practice but technically incorrect per Twitter Card spec

---

## External Advisor Reviews

### Gemini

Flagged the same top issues: `SITE.desc` placeholder, empty `ogImage`, and missing CSP/HSTS headers. Noted the about page and social links look properly personalized. No unique findings beyond what Claude agents found.

### Codex

Flagged all major issues and additionally called out the `BlogPosting` JSON-LD being used on all page types (should be `WebSite`/`Person` on non-post pages). Also flagged the newsletter form placeholder and empty `theme-color`. Agreed on missing security headers.

### Cross-Model Agreement

All 3 models (Claude, Gemini, Codex) converge on these high-confidence issues:

1. **`SITE.desc` TODO placeholder** — unanimous, must fix
2. **Invalid structured data on non-post pages** — Claude + Codex flagged explicitly
3. **Missing security headers (HSTS, CSP)** — all three models

---

## What Looks Good

- Build pipeline (astro check + build + pagefind) is correct
- Vercel config is properly set up with bun
- Content collection schema is well-defined
- Analytics loads only in production
- Search, RSS, sitemap, canonical URLs all work
- About page has real personalized content
- Pre-commit hooks (Biome + astro check) are solid
- Social links point to real profiles
- Dark mode and FOUC prevention are properly implemented

---

**Bottom line:** Fix items 1 and 2, replace the favicon, and you're good to deploy. The security headers (HSTS at minimum) are worth adding but aren't blockers.
