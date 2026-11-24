export type SeriesDef = {
  title: string;
  blurb: string;
  header: string;
  numbered?: string;
  titleIncludesSeries?: boolean;
};

const SERIES_DEFS = {
  "slimemold-diaries": {
    title: "Slimemold Diaries",
    blurb:
      "A weekly diary of turning a Mac Studio into a software factory run by a fleet of coding agents. What gets built, what breaks, and what I learn along the way.",
    header:
      "A weekly diary of handing a Mac Studio over to a fleet of coding agents.",
    numbered: "Slimemold Diaries Week %s",
  },
  "skill-showcase": {
    title: "Skill Showcase",
    blurb:
      "The agent skills I built and use every day, one per post. What problem each one solves, how it works, and where to get it.",
    header: "One of the agent skills I built and use every day.",
    numbered: "Skill Showcase #%s",
    titleIncludesSeries: true,
  },
} as const satisfies Record<string, SeriesDef>;

export type SeriesSlug = keyof typeof SERIES_DEFS;

export const SERIES: Record<SeriesSlug, SeriesDef> = SERIES_DEFS;

export const SERIES_SLUGS = Object.keys(SERIES) as [
  SeriesSlug,
  ...SeriesSlug[],
];
