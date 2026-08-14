import { i18n } from "../i18n";
import type { ChatMessage } from "./types";

function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params as never);
}

export function continuationMessages(
  context: string,
  instruction: string,
  tail: string,
): ChatMessage[] {
  const system = [
    t("aiPrompts.continuationSystem1"),
    context ? `${t("aiPrompts.settingsLabel")}\n${context}` : t("aiPrompts.noSettings"),
    t("aiPrompts.continuationSystem2"),
    t("aiPrompts.continuationSystem3"),
  ].join("\n");
  const user = instruction
    ? `${t("aiPrompts.instruction", { text: instruction })}\n\n${t("aiPrompts.body")}\n${tail}`
    : `${t("aiPrompts.body")}\n${tail}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function chatMessages(
  context: string,
  history: ChatMessage[],
  input: string,
): ChatMessage[] {
  const system = [
    t("aiPrompts.chatSystem1"),
    context ? `${t("aiPrompts.settingsLabel")}\n${context}` : t("aiPrompts.noSettings"),
    t("aiPrompts.chatSystem2"),
  ].join("\n");
  return [
    { role: "system", content: system },
    ...history,
    { role: "user", content: input },
  ];
}

export interface ConsistencyChapter {
  title: string;
  text: string;
}

export function consistencyMessages(
  context: string,
  chapters: ConsistencyChapter[],
  rules: string[],
): ChatMessage[] {
  const ruleText =
    rules.length > 0
      ? rules.map((r) => `- ${r}`).join("\n")
      : `- ${t("aiPrompts.consistencyFallbackRules")}`;
  const system = [
    t("aiPrompts.consistencySystem1"),
    t("aiPrompts.consistencySystem2"),
    ruleText,
    t("aiPrompts.consistencySystem3"),
    t("aiPrompts.consistencySystem4"),
    t("aiPrompts.consistencySystem5"),
  ].join("\n");
  const body = [
    `${t("aiPrompts.consistencySettings")}\n${context}`,
    t("aiPrompts.consistencyBody"),
    ...chapters.map((c) => `## ${c.title}\n${c.text}`),
  ].join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: body },
  ];
}

export function outlineMessages(meta: {
  title: string;
  author: string;
  genre: string;
  description: string;
}): ChatMessage[] {
  const system = [
    t("aiPrompts.outlineSystem1"),
    t("aiPrompts.outlineSystem2"),
    t("aiPrompts.outlineSystem3"),
    t("aiPrompts.outlineSystem4"),
    t("aiPrompts.outlineSystem5"),
    t("aiPrompts.outlineSystem6"),
    t("aiPrompts.outlineSystem7"),
    t("aiPrompts.outlineSystem8"),
  ].join("\n");
  const user = [
    `${t("aiPrompts.bookTitle")}${meta.title || t("aiPrompts.untitled")}`,
    `${t("aiPrompts.bookGenre")}${meta.genre || t("aiPrompts.unknown")}`,
    `${t("aiPrompts.bookIntro")}${meta.description || t("aiPrompts.notProvided")}`,
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
