import {
  createMarkdownProcessor,
  type RehypePlugin,
} from "@astrojs/markdown-remark";

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);
const URL_PROPERTIES = new Set(["href", "src"]);

const isSafeUrl = (url: string) => {
  const scheme = url
    .replace(/[\t\n\r]/g, "")
    .trimStart()
    .match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  return !scheme || SAFE_SCHEMES.has(scheme.toLowerCase());
};

const safeProperties = (properties: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        !URL_PROPERTIES.has(key) ||
        typeof value !== "string" ||
        isSafeUrl(value),
    ),
  );

const withoutUnsafe = (node: HastNode): HastNode => ({
  ...node,
  ...(node.properties ? { properties: safeProperties(node.properties) } : {}),
  ...(node.children
    ? {
        children: node.children
          .filter((c) => c.type !== "raw" && c.tagName !== "img")
          .map(withoutUnsafe),
      }
    : {}),
});

const rehypeSafeSummary: RehypePlugin = () => (tree) =>
  withoutUnsafe(tree as HastNode) as typeof tree;

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

export const renderResearchMarkdown = async (md: string) => {
  processor ??= createMarkdownProcessor({
    syntaxHighlight: false,
    remarkRehype: { allowDangerousHtml: false },
    rehypePlugins: [rehypeSafeSummary],
  });
  const { code } = await (await processor).render(md);
  return code;
};

export const demoteHeadings = (html: string, by: number) =>
  html.replace(
    /<(\/?)h([1-6])(?=[\s>])/g,
    (_all, slash: string, level: string) =>
      `<${slash}h${Math.min(6, Number(level) + by)}`,
  );
