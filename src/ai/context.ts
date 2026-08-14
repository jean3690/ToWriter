import { i18n } from "../i18n";
import type { Book } from "../types";

const PLACEHOLDER = "（在此编写";

function isMeaningful(text: string): boolean {
  const t = text?.trim() ?? "";
  return t.length > 0 && !t.includes(PLACEHOLDER);
}

export function buildBookContext(book: Book | null): string {
  if (!book) return "";
  const parts: string[] = [];
  const m = book.meta;
  const p = (key: string, ...params: Array<string | number>) => i18n.global.t(key, params as never);
  parts.push(`${p("aiPrompts.bookTitle")}${m.title}`);
  parts.push(`${p("aiPrompts.bookGenre")}${m.genre}`);
  if (m.description) parts.push(`${p("aiPrompts.bookIntro")}${m.description}`);
  if (isMeaningful(book.characters)) parts.push(`\n${p("aiPrompts.charactersSection")}\n${book.characters.trim()}`);
  if (isMeaningful(book.timeline)) parts.push(`\n${p("aiPrompts.timelineSection")}\n${book.timeline.trim()}`);
  if (isMeaningful(book.outline)) parts.push(`\n${p("aiPrompts.outlineSection")}\n${book.outline.trim()}`);
  return parts.join("\n");
}
