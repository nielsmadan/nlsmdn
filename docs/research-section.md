# Research section

Opted-in research notes from the private notes vault are published at `nlsmdn.com/research` as versioned articles with diffs. Subscribers get an email when an article gets a new version.

Two repos are involved: `nielsmadan/notes` (private vault, export side) and `nielsmadan/nlsmdn` (this blog, site and notifications).

## Data flow

1. A research PR merges into notes `main`, or `research-publish` is dispatched by hand (sync mode).
2. Notes workflow `.github/workflows/research-publish.yml`, job `export` (no write token): checks out notes and the blog, runs `.github/scripts/research_publish.py` (sanitize, leak check, write `src/data/research/<slug>/`), and uploads the changed `src/data/research` tree as an artifact, with the exporter's exit code as a job output.
3. Job `publish` runs only when the export exit code is 0 or 1, there are changes, and it is not a dry run. It checks out only the blog, applies the artifact, sets up Node from the blog's `.nvmrc` and Bun 1.4.4, runs `bun install --frozen-lockfile && bun run build`, then pushes one commit to blog `main` (`chore: publish research (<slugs>)`) using `NLSMDN_TOKEN`. The workflow's final exit code is the export exit code.
4. Vercel deploys the commit to production.
5. Vercel sends a `repository_dispatch` (`vercel.deployment.success`) to `nielsmadan/nlsmdn`.
6. `.github/workflows/research-notify.yml` runs `bun run research:notify` (`scripts/research-notify/`): check the dispatched SHA is still the tip of `main` (otherwise skip), find or create article topics, opt all-research subscribers into the article topic if the article has never been announced (propagation), check the article is live, send the broadcast. An article dir without `meta.json` is skipped with a warning.
7. Resend delivers the email to the article topic within the segment.

Only the latest version of an article is announced, and only if its date is on or after `notifyFrom` in `src/research.config.ts`. An empty `notifyFrom` means nothing is ever sent.

## Publishing rules (notes side)

- A doc under `work/reference/research/` is published when its frontmatter has `publish: true` (or `yes`). Docs whose file name starts with `_` are never published (skipped with a one-line note). Setting `publish: false` (or `no`) on a published doc unpublishes it (files deleted, git history stays). Removing the key fails the run ("article is published but the doc has no publish: key") and unpublishes nothing.
- Each refresh PR (`research-refresh/<slug>-<date>`) merged since the article's `cursor` is one step. If the sanitized title or body differs from the current public text (`current.md` when present, otherwise the latest version), it becomes a new version (`vN.md`, summary taken from the PR body, PR number recorded). If not, it only moves `lastVerified` ("verified").
- Sync mode also compares the current vault text. A change to the body that no version covers is a minor edit: it goes to `current.md`, and its date is added to `minorEdits`. No version, no email. A description-only change updates the description. Reverting to the latest version deletes `current.md`.
- `cursor` is the notes commit the article is up to date with. Discovery of PRs starts there.
- The latest version is the last entry of `meta.versions`. Every listed `vN.md` must exist and no unlisted `v*.md` may exist; a mismatch fails that article.
- Verify-only runs (no content change) never create a version or an email.
- Sanitization: `<!-- private -->` ... `<!-- /private -->` blocks, HTML and Obsidian comments are removed, wikilinks to unpublished docs become plain text, relative `.md` links to published docs become `/research/<slug>`, any other markdown relative link becomes its plain text (a bare `.md` link text becomes the doc title), markdown images with relative targets are removed (external `http(s)` images are kept and hotlinked), and raw HTML `<a>`/`<img>` tags with relative targets and reference-style link definitions fail the doc.
- Raw HTML: a doc fails if its sanitized body or summary contains `<script`, `<iframe`, `<style`, `<object`, `<embed`, `<img`, `<form`, `<svg`, `<math`, `<base`, `<link`, `<meta`, an `on...=` attribute in a tag, or a `javascript:` URL, checked both as written and with HTML entities decoded. Other inline HTML (`details`, `summary`, `br`, `sup`, `sub`, `kbd`, `abbr`) is allowed. The blog also renders version summaries (changes pages and emails) with all raw HTML, images and non-web link targets stripped.
- Leak check: `.github/scripts/research_denylist.txt` in notes holds one Python regex per line. A hit fails that doc and nothing of it is published. `allow:` lines blank out matches before the deny patterns run. Besides first-person phrasing and paths, it rejects third-person mentions of the author (`\bNiels\b`, which also covers "Niels's").
- Exit codes: 0 ok, 1 some docs failed (others published), 2 crash (nothing pushed).
- Dry run (`workflow_dispatch` default) prints actions and diffs and writes nothing.

### Stuck refresh PR

A refresh PR whose merge snapshot fails the leak check blocks its article: every run hits the same error. Fix it one of two ways:

- Add an `allow:` line to the denylist for the false positive, or
- Set that article's `cursor` in the blog's `src/data/research/<slug>/meta.json` to the PR's merge SHA, which skips that PR. Commit it normally: the pre-commit Biome hook passes when only ignored files are staged.

### Before publishing another doc

Several vault docs fail the leak check, among them agent-to-agent-messaging, agentic-browser-automation, coding-agent-subscription-terms, local-ai-hardware, sandboxing-coding-agents-on-macos and tool-agent-skill-integration; the `Niels` pattern adds more. Before publishing another doc, run the sync dry run, which lists every failing doc, and fix leak-check hits with private markers.

## Subscription model

- One Resend segment (`RESEARCH.segmentId`, the old newsletter audience) holds every contact.
- Three kinds of topic:
  - "Blog posts" (`blogTopicId`, opt_in, public): the existing newsletter.
  - "All research notes" (`allTopicId`, opt_out, public): everything research.
  - One topic per article, found by its description `nlsmdn.com/research/<slug>`, created by research-notify or by a confirm. Do not edit these descriptions in the dashboard; an edited one is orphaned and a duplicate gets created. If several topics share a description, sign-up and notify always use the same one: earliest `created_at`, then lowest id. Names follow the article title and are renamed automatically.
- Research sign-up (`POST /api/research/subscribe`) takes an email, a scope (one article or "all") and a Turnstile token. It sends a confirmation email with a signed token (AES-256, 48 hour expiry). Nothing is written to Resend until the link is used.
- Confirm (`/research/confirm`, then `POST /api/research/confirm`) is a form POST so mail scanners that prefetch the link cannot confirm. The confirm page shows the consent line above the Confirm button, so the recorded `research_consent_text` is the wording shown at the moment of consent. It creates or updates the contact, opts them into the topics, and sets the consent properties. The page sends `Referrer-Policy: same-origin` (vercel.json).
- A new or previously unsubscribed contact is reset to research only: "Blog posts" is set to opt_out. An existing newsletter contact keeps their topics.
- Consent record, contact properties: `research_consent_at`, `research_consent_scope` (comma list, grows), `research_consent_requested_at`, `research_consent_text` (the `consentTextVersion` of the consent wording; both live in `src/research.config.ts` as `consentText` and `consentTextVersion`, bump the version when the text changes).
- Abuse control: Turnstile on sign-up, plus a 10 minute resend cooldown kept in a signed HttpOnly cookie (per browser, address and scope: a sign-up for another scope is sent).
- Newsletter (`POST /api/subscribe`) adds to the segment and "Blog posts" with no double opt-in. An address that unsubscribed earlier gets a 409 explaining that it will not receive emails; `unsubscribed` is left untouched. An existing contact whose "Blog posts" topic is explicitly `opt_out` (research-only subscribers, or readers who unticked it) is left alone and gets a 409 pointing to the preferences link. While `blogTopicId` is empty, the endpoint only adds or creates the contact in the segment; it answers 503 only when `RESEND_API_KEY` is missing.
- Broadcasts: created as drafts (deduped by name `research:<slug>:v<n>:<date>`), then sent by id with no retry on 5xx. A failed send exits 1; rerunning research-notify (Actions "Re-run" or dispatch) sends the existing draft.
- Propagation runs only before an article's first announcement, that is when no broadcast `research:<slug>:v*:<published>` with the same published date has a status other than draft. All-research subscribers are then opted in to the article topic. Later versions never propagate, so a per-article opt-out on the preferences page stands. A propagation failure skips that broadcast and exits 1. It scans every contact in the segment that has not unsubscribed.
- Newsletter broadcasts sent from the Resend dashboard must select the "Blog posts" topic.

## Local commands (blog repo)

- Sample articles: `RESEARCH_SAMPLES=1 bun run dev` (or `build`). The `_sample` article in `src/data/research/` is excluded without it.
- Export dry run, from the notes repo: `python3 .github/scripts/research_publish.py --notes . --blog ~/wrksp/nlsmdn/dev1 --mode sync --dry-run` (`--mode auto` needs `GH_TOKEN` and the PR history).
- Notify dry run: `bun run research:notify -- --dry-run` (reads topics and broadcasts if `RESEND_API_KEY` is set, otherwise prints "topics and broadcasts not read"; writes nothing), or in Actions: `gh workflow run research-notify --repo nielsmadan/nlsmdn -f dry_run=true`.
- Checks: `bun run check-all`; unit tests with `bun test`.

## One-time setup checklist

Do these in order. Nothing in the code does them for you. Config edits in `src/research.config.ts` are code: each needs a commit and push to blog `main` and a deploy. Vercel and GitHub settings do not carry them, because the Actions notify run reads `notifyFrom` from the checked-out repo.

### Resend (resend.com dashboard)

- [ ] Verify the sending domain for `research@nlsmdn.com` (Domains).
- [ ] Confirm the old audience appears as segment `30295bea-a99f-4b47-a275-751eb467de8e` (matches `RESEARCH.segmentId`).
- [ ] Create topic "Blog posts" (opt_in, public). Paste its id into `blogTopicId` in `src/research.config.ts` (blog repo).
- [ ] Create topic "All research notes" (opt_out, public). Paste its id into `allTopicId` in `src/research.config.ts`.
- [ ] Create four contact properties, type string: `research_consent_at`, `research_consent_scope`, `research_consent_requested_at`, `research_consent_text`. Do this before go-live: every confirm fails without them.
- [ ] Create an API key with full access for sending and contact management. Use it for Vercel and GitHub below.
- [ ] From now on, send newsletter broadcasts with the "Blog posts" topic selected.

### Cloudflare (dash.cloudflare.com)

- [ ] Create a Turnstile widget for `nlsmdn.com`. Put the site key (public) in `turnstileSiteKey` in `src/research.config.ts`. The secret goes to Vercel below.

### Vercel (nlsmdn project settings, Environment Variables, Production)

- [ ] `RESEARCH_TOKEN_SECRET`: output of `openssl rand -base64 32`. It must decode to 32 or more bytes; a shorter value counts as unconfigured and sign-up answers 503.
- [ ] `TURNSTILE_SECRET_KEY`: the Turnstile secret.
- [ ] `RESEND_API_KEY`: the same Resend key (already set for the newsletter; confirm it still is).
- [ ] Settings, Git: confirm `repository_dispatch` events are enabled for the GitHub integration, so `vercel.deployment.success` reaches `nielsmadan/nlsmdn`.
- [ ] Redeploy after setting the variables (the commit that carries the ids does this, see go-live step 1).

### GitHub `nielsmadan/nlsmdn` (repo settings)

- [ ] Secret `RESEND_API_KEY` (Settings, Secrets and variables, Actions).
- [ ] Variable `RESEARCH_NOTIFY_ENABLED=true`: set at go-live step 5, not before.

### GitHub `nielsmadan/notes` (repo settings)

- [ ] Secret `NLSMDN_TOKEN`: fine-grained personal access token, Contents read/write on `nielsmadan/nlsmdn` only, 1 year expiry. Set a calendar reminder to rotate it.
- [ ] Variable `RESEARCH_PUBLISH_ENABLED=true`: set at go-live step 6, not before. The publish job is skipped until it is set.
- [ ] The workflow's `GH_TOKEN` is the built-in `github.token`; nothing to set.

### Config values in the blog repo (`src/research.config.ts`)

- [ ] `segmentId`, `allTopicId`, `blogTopicId`, `turnstileSiteKey` filled in.
- [ ] `from` is `Niels Madan <research@nlsmdn.com>` and `siteUrl` is `https://nlsmdn.com/`.
- [ ] `notifyFrom` stays `""` until go-live step 3, then is set to coding-benchmarks' v1 date.
- [ ] `consentTextVersion` matches the form wording.

### Go-live sequence

Do these in order. Each step says where it is done.

1. One-time service setup: everything in the checklists above (Resend, Cloudflare, Vercel, GitHub secrets). In the blog repo, paste the topic ids and the Turnstile site key into `src/research.config.ts`, leave `notifyFrom` as `""`, commit and push to `main`. The production deploy puts `/research` live. No email can go out: `notifyFrom` is empty and `RESEARCH_NOTIFY_ENABLED` is unset.
2. In the browser, subscribe your own address to coding-benchmarks and, separately, to all research notes. Confirm both. In Resend, check the contact, its topics and the four consent properties.
3. In the blog repo, set `notifyFrom` to coding-benchmarks' v1 date (from `src/data/research/coding-benchmarks/meta.json`) in `src/research.config.ts`, commit and push. The deploy's notify run is skipped (variable unset).
4. Dry run, from any shell: `gh workflow run research-notify --repo nielsmadan/nlsmdn -f dry_run=true`. Dry runs are allowed before enablement. Read the plan in the run log: exactly one broadcast, for coding-benchmarks v1. A manual dispatch uses the dispatched `main` tip as `NOTIFY_SHA`, so the tip check passes as long as `main` has not moved since the dispatch.
5. On `nielsmadan/nlsmdn` (Settings, Secrets and variables, Actions) set variable `RESEARCH_NOTIFY_ENABLED=true`, then run `gh workflow run research-notify --repo nielsmadan/nlsmdn -f dry_run=false`. Check exactly one email arrives (the v1 announcement; anyone else subscribed to that note meanwhile gets it too, which is the real announcement). Unsubscribe via the hosted page and check Resend. Also try the newsletter form with an existing newsletter address, with a previously unsubscribed one and with a research-only one (expect the two 409 texts).
6. Last, on `nielsmadan/notes` set variable `RESEARCH_PUBLISH_ENABLED=true`. From then on merged refresh PRs publish and announce automatically. First publishes and minor edits need a manual sync dispatch of `research-publish` (notes repo). A minor edit never sends email.

### CI fixer

`ai/jobs/ci-watch/config.md` in the notes repo excludes both `research-publish.yml` and `research-notify.yml`: the autonomous CI fixer never edits them, so a red research run needs a manual fix.

## Design decisions

- **Automation lives in GitHub Actions, not in the research-refresh job.** Export runs in the notes repo, so the blog never sees the vault; notification runs in the blog repo after Vercel's production deploy, so emails only go out for what is live. The notes repo holds no Resend key. The refresh job only writes PR bodies with the public summary in mind.
- **Only merged refresh PRs create versions, automatically.** Their bodies were reviewed when merged. Anything else (first publish, direct edits) waits for a manual sync dispatch with a dry run first, because vault-backup commits can carry half-written edits every 30 minutes. notes-maintenance and other PR bodies are never read.
- **A version is the doc at the PR's merge commit, and never changes.** Diffs and summaries stay true to what subscribers were told. Later quiet edits live in `current.md` and get their own diff.
- **Per-article cursor instead of the push range.** A failed or replaced run loses nothing: the next run finds the same merges.
- **No Resend ids in git.** Article topics are found by description, so creating one never needs a commit and deploy. Config ids (segment, two topics, Turnstile site key) are set once during setup.
- **One broadcast per version, to the article topic.** All-research subscribers are opted in to each article topic on confirm and on the article's first announcement, so nobody gets two copies and a per-article opt-out holds.
- **Drafts first, send by id without 5xx retries.** Resend idempotency keys do not cover broadcasts; a retried create-and-send could mail everyone twice.
- **The export's build and write token run in a job without the vault checkout,** so third-party build code never sees private notes.
- **The diff is computed at build time from immutable snapshots,** word-level inside paired blocks, with link targets compared too.

## Known limits

- The newsletter has no double opt-in.
- The cooldown is per browser, not per address.
- A manual sync dispatch can be replaced by a queued push run; rerun it. The per-article cursor means the newest run catches up on what older runs would have done.
- Propagation scans every non-unsubscribed contact in the segment.
- Git history of the blog is public: unpublishing deletes files but not history, so every path to the blog goes through the leak check.
