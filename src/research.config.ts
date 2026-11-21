export const RESEARCH = {
  path: "/research",
  title: "Research",
  siteUrl: "https://nlsmdn.com/",
  segmentId: "30295bea-a99f-4b47-a275-751eb467de8e",
  allTopicId: "", // "All research notes"; filled during setup
  blogTopicId: "", // "Blog posts"; filled during setup
  from: "Niels Madan <research@nlsmdn.com>",
  notifyFrom: "", // YYYY-MM-DD go-live date; "" = notifications never send
  // Shown on the sign-up form and the confirm page; bump consentTextVersion when it changes.
  consentText:
    "I'll only email you about new and updated research notes. You can unsubscribe any time.",
  consentTextVersion: "2026-11-21",
  turnstileSiteKey: "", // public; filled during setup
} as const;
