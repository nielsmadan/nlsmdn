export interface ResearchMeta {
  slug: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  lastVerified: string;
  cursor: string;
  minorEdits: string[];
  versions: ResearchVersion[];
}

export interface ResearchVersion {
  n: number;
  date: string;
  summary: string;
  pr: number | null;
}
