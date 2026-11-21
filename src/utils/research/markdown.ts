import { createMarkdownProcessor } from "@astrojs/markdown-remark";

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

export const renderResearchMarkdown = async (md: string) => {
  processor ??= createMarkdownProcessor({ syntaxHighlight: false });
  const { code } = await (await processor).render(md);
  return code;
};

export const demoteHeadings = (html: string, by: number) =>
  html.replace(
    /<(\/?)h([1-6])(?=[\s>])/g,
    (_all, slash: string, level: string) =>
      `<${slash}h${Math.min(6, Number(level) + by)}`,
  );
