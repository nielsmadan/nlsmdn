import { diffArrays, diffWords, diffWordsWithSpace } from "diff";

export interface DiffSegment {
  op: "eq" | "ins" | "del";
  text: string;
  url?: boolean;
}

export interface DiffBlock {
  kind: "same" | "changed" | "added" | "removed";
  level: "heading" | "text" | "row" | "code";
  segments: DiffSegment[];
}

export interface CollapsedBlocks {
  kind: "collapsed";
  count: number;
  blocks: DiffBlock[];
}

export interface SourceBlock {
  level: DiffBlock["level"];
  text: string;
  urls: string[];
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const LINK =
  /(!?)\[((?:[^[\]\\]|\\.|\[[^[\]]*\])*)\]\(\s*(<[^>]*>|(?:[^()\s]|\([^)]*\))*)(?:\s+"[^"]*")?\s*\)/g;
const REF_LINK = /\[((?:[^[\]\\]|\\.)+)\]\[[^\]]*\]/g;
const REF_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s+\S+/;
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, body: string) => {
    if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? all;
    const code =
      body[1].toLowerCase() === "x"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
  });
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const CODE_SPAN = /(`+)([\s\S]*?[^`])\1(?!`)/g;

const stripEmphasis = (text: string) =>
  text
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
    .replace(/(?<!\w)__(?=\S)(.+?)(?<=\S)__(?!\w)/g, "$1")
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, "$1")
    .replace(/(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1")
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, "$1");

const PLACEHOLDER = /\u0001(\d+)\u0001/g;

export const inlineText = (md: string): { text: string; urls: string[] } => {
  const codes: string[] = [];
  const protectedMd = md.replace(CODE_SPAN, (_all, _ticks, body: string) => {
    codes.push(body);
    return `\u0001${codes.length - 1}\u0001`;
  });
  const urls: string[] = [];
  const stripLinks = (text: string): string => {
    const next = text.replace(
      LINK,
      (_all, _bang: string, label: string, url: string) => {
        urls.push(url.replace(/^<|>$/g, ""));
        return label;
      },
    );
    return next === text ? text : stripLinks(next);
  };
  const text = decodeEntities(
    stripEmphasis(
      stripLinks(protectedMd).replace(AUTOLINK, "$1").replace(REF_LINK, "$1"),
    ).replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, "$1"),
  )
    .replace(PLACEHOLDER, (_all, k: string) => codes[Number(k)])
    .replace(/\s+/g, " ")
    .trim();
  return { text, urls };
};

const splitCells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/);

const rowBlock = (row: string): SourceBlock => {
  const cells = splitCells(row).map((cell) => inlineText(cell));
  return {
    level: "row",
    text: cells.map((c) => c.text).join(" | "),
    urls: cells.flatMap((c) => c.urls),
  };
};

const textBlock = (
  level: "heading" | "text",
  md: string,
  prefix = "",
): SourceBlock => {
  const { text, urls } = inlineText(md);
  return { level, text: `${prefix}${text}`, urls };
};

const listPrefix = (marker: string) =>
  /^\d/.test(marker) ? `${marker.replace(")", ".")} ` : "• ";

const startsBlock = (line: string) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  RULE.test(line) ||
  LIST_ITEM.test(line) ||
  TABLE_ROW.test(line);

export const splitBlocks = (md: string): SourceBlock[] => {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: SourceBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      const close = new RegExp(
        `^\\s{0,3}${fence[1][0]}{${fence[1].length},}\\s*$`,
      );
      const body: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ level: "code", text: body.join("\n"), urls: [] });
      continue;
    }
    if (line.trim() === "" || RULE.test(line) || REF_DEFINITION.test(line)) {
      i++;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push(textBlock("heading", heading[1]));
      i++;
      continue;
    }
    if (TABLE_ROW.test(line)) {
      if (!TABLE_SEPARATOR.test(line)) blocks.push(rowBlock(line));
      i++;
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item) {
      const parts = [item[3]];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !startsBlock(lines[i])
      )
        parts.push(lines[i++].trim());
      blocks.push(textBlock("text", parts.join(" "), listPrefix(item[2])));
      continue;
    }
    const parts = [line.replace(/^\s*>\s?/, "")];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i]))
      parts.push(lines[i++].replace(/^\s*>\s?/, "").trim());
    blocks.push(textBlock("text", parts.join(" ")));
  }
  return blocks;
};

const blockKey = (b: SourceBlock) =>
  `${b.level}\u0000${b.text}\u0000${b.urls.join("\u0000")}`;

export const displayUrl = (url: string) => {
  const match = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)([^?#]*)/i);
  return match ? `${match[1]}${match[2]}` : url;
};

const urlSegments = (oldUrls: string[], newUrls: string[]): DiffSegment[] => {
  const changes = diffArrays(oldUrls, newUrls).filter(
    (c) => c.added || c.removed,
  );
  const shortForms = changes.flatMap((c) => c.value.map(displayUrl));
  const label = (url: string) =>
    shortForms.filter((s) => s === displayUrl(url)).length > 1
      ? url
      : displayUrl(url);
  return changes.flatMap((change) =>
    change.value.map((url) => ({
      op: change.added ? ("ins" as const) : ("del" as const),
      text: label(url),
      url: true,
    })),
  );
};

const wordSegments = (oldText: string, newText: string): DiffSegment[] =>
  diffWordsWithSpace(oldText, newText).map((part) => ({
    op: part.added ? "ins" : part.removed ? "del" : "eq",
    text: part.value,
  }));

const changedBlock = (a: SourceBlock, b: SourceBlock): DiffBlock => ({
  kind: "changed",
  level: b.level,
  segments: [...wordSegments(a.text, b.text), ...urlSegments(a.urls, b.urls)],
});

const wholeBlock = (
  kind: "same" | "added" | "removed",
  b: SourceBlock,
): DiffBlock => ({
  kind,
  level: b.level,
  segments: [
    {
      op: kind === "same" ? "eq" : kind === "added" ? "ins" : "del",
      text: b.text,
    },
  ],
});

const MIN_SIMILARITY = 0.4;
export const MAX_PAIRING_PAIRS = 2500;

export const similarity = (a: string, b: string) => {
  const visible = (s: string) => s.replace(/\s+/g, "").length;
  const total = visible(a) + visible(b);
  if (total === 0) return 1;
  const common = diffWords(a, b)
    .filter((part) => !part.added && !part.removed)
    .reduce((sum, part) => sum + visible(part.value), 0);
  return (2 * common) / total;
};

const pairRuns = (
  removed: SourceBlock[],
  added: SourceBlock[],
): DiffBlock[] => {
  if (removed.length * added.length > MAX_PAIRING_PAIRS)
    return [
      ...removed.map((b) => wholeBlock("removed", b)),
      ...added.map((b) => wholeBlock("added", b)),
    ];
  const out: DiffBlock[] = [];
  let next = 0;
  for (const old of removed) {
    const match = added.findIndex(
      (candidate, k) =>
        k >= next &&
        candidate.level === old.level &&
        similarity(old.text, candidate.text) >= MIN_SIMILARITY,
    );
    if (match === -1) {
      out.push(wholeBlock("removed", old));
      continue;
    }
    out.push(...added.slice(next, match).map((b) => wholeBlock("added", b)));
    out.push(changedBlock(old, added[match]));
    next = match + 1;
  }
  out.push(...added.slice(next).map((b) => wholeBlock("added", b)));
  return out;
};

const diffCache = new Map<string, DiffBlock[]>();

export const diffDocumentsCached = (oldMd: string, newMd: string) => {
  const key = `${oldMd.length}\u0000${oldMd}\u0000${newMd}`;
  const hit = diffCache.get(key);
  if (hit) return hit;
  const result = diffDocuments(oldMd, newMd);
  diffCache.set(key, result);
  return result;
};

export const diffDocuments = (oldMd: string, newMd: string): DiffBlock[] => {
  const changes = diffArrays(splitBlocks(oldMd), splitBlocks(newMd), {
    comparator: (a, b) => blockKey(a) === blockKey(b),
  });
  const out: DiffBlock[] = [];
  let removed: SourceBlock[] = [];
  let added: SourceBlock[] = [];
  const flush = () => {
    out.push(...pairRuns(removed, added));
    removed = [];
    added = [];
  };
  for (const change of changes) {
    if (change.removed) removed.push(...change.value);
    else if (change.added) added.push(...change.value);
    else {
      flush();
      out.push(...change.value.map((b) => wholeBlock("same", b)));
    }
  }
  flush();
  return out;
};

export const collapseUnchanged = (
  blocks: DiffBlock[],
  context = 1,
): (DiffBlock | CollapsedBlocks)[] => {
  const out: (DiffBlock | CollapsedBlocks)[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].kind !== "same") {
      out.push(blocks[i++]);
      continue;
    }
    let end = i;
    while (end < blocks.length && blocks[end].kind === "same") end++;
    const run = blocks.slice(i, end);
    const lead = i === 0 ? 0 : context;
    const trail = end === blocks.length ? 0 : context;
    if (run.length > 2 * context + 1 && run.length > lead + trail) {
      const hidden = run.slice(lead, run.length - trail);
      out.push(...run.slice(0, lead));
      out.push({ kind: "collapsed", count: hidden.length, blocks: hidden });
      out.push(...run.slice(run.length - trail));
    } else {
      out.push(...run);
    }
    i = end;
  }
  return out;
};
