export type ParsedIdeaPaste = {
  title: string;
  originalText: string;
  description: string;
  tags: string[];
  sourceUrl?: string;
};

const labelPattern = /^(?:제목|title|name)\s*[:：]\s*(.+)$/i;
const descriptionPattern = /^(?:설명|description|summary|요약)\s*[:：]\s*(.+)$/i;
const tagPattern = /(?:^|\s)#([A-Za-z0-9가-힣_-]+)/g;
const urlPattern = /https?:\/\/[^\s)]+/i;

export function parseIdeaPaste(raw: string): ParsedIdeaPaste {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "붙여넣은 아이디어";
  const titleMatch = firstLine.match(labelPattern);
  const title = (titleMatch?.[1] ?? firstLine).slice(0, 180);
  const descriptionLine = lines.find((line) => descriptionPattern.test(line));
  const description = descriptionLine?.match(descriptionPattern)?.[1] ?? lines.slice(1, 3).join(" ").slice(0, 500);
  const tags = Array.from(normalized.matchAll(tagPattern), (match) => match[1]).slice(0, 12);
  const sourceUrl = normalized.match(urlPattern)?.[0];
  const originalText = normalized.slice(0, 12000);

  return { title, originalText, description, tags, sourceUrl };
}

export function tagsToText(tags: string[]) {
  return tags.join(", ");
}
