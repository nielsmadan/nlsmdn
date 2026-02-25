import type { Props } from "astro";
import IconBluesky from "@/assets/icons/IconBluesky.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconHackerNews from "@/assets/icons/IconHackerNews.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconMail from "@/assets/icons/IconMail.svg";
import IconReddit from "@/assets/icons/IconReddit.svg";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

export const SOCIALS: Social[] = [
  {
    name: "GitHub",
    href: "https://github.com/nielsmadan",
    linkTitle: `${SITE.title} on GitHub`,
    icon: IconGitHub,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/nielsmadan/",
    linkTitle: `${SITE.title} on LinkedIn`,
    icon: IconLinkedin,
  },
] as const;

export const SHARE_LINKS: Social[] = [
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
  },
  {
    name: "Reddit",
    href: "https://reddit.com/submit?url=",
    linkTitle: `Share this post on Reddit`,
    icon: IconReddit,
  },
  {
    name: "Hacker News",
    href: "https://news.ycombinator.com/submitlink?u=",
    linkTitle: `Share this post on Hacker News`,
    icon: IconHackerNews,
  },
  {
    name: "Bluesky",
    href: "https://bsky.app/intent/compose?text=",
    linkTitle: `Share this post on Bluesky`,
    icon: IconBluesky,
  },
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: `Share this post via email`,
    icon: IconMail,
  },
] as const;
