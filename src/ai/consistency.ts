import { i18n } from "../i18n";
import { bookService } from "../services/bookService";
import { useWorkspaceStore } from "../stores/workspace";
import { useAiStore } from "../stores/ai";
import { useRulesStore } from "../stores/rules";
import { streamChat } from "./client";
import { buildBookContext } from "./context";
import { consistencyMessages } from "./prompts";

export interface ConsistencyIssue {
  level: "高" | "中" | "低";
  chapter: string;
  quote: string;
  issue: string;
  suggestion: string;
}

let controller: AbortController | null = null;

export function stopConsistency() {
  controller?.abort();
}

export function parseIssues(raw: string): ConsistencyIssue[] {
  let text = raw.trim();
  text = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim();
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) {
      return arr
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
        .map((x) => ({
          level: x.level === "高" ? "高" : x.level === "中" ? "中" : "低",
          chapter: String(x.chapter ?? ""),
          quote: String(x.quote ?? ""),
          issue: String(x.issue ?? ""),
          suggestion: String(x.suggestion ?? ""),
        }));
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function runConsistency(
  onProgress?: (text: string) => void,
): Promise<ConsistencyIssue[]> {
  const ws = useWorkspaceStore();
  const ai = useAiStore();
  if (!ws.workspace || !ws.bookDir || !ws.book) {
    ai.error = i18n.global.t("store.openBookFirstShort");
    return [];
  }
  if (!ai.activeConfig.baseURL) {
    ai.error = i18n.global.t("store.configAiFirst");
    return [];
  }

  const book = ws.book;
  const chapters: { title: string; text: string }[] = [];
  let total = 0;
  for (const ch of book.chapters.slice(0, 50)) {
    const text = await bookService.readChapter(ws.workspace.path, ws.bookDir, ch.path);
    const capped = text.slice(0, 4000);
    chapters.push({ title: ch.title, text: capped });
    total += capped.length;
    if (total > 50000) break;
  }

  const context = buildBookContext(book);
  const rules = useRulesStore().enabledDescriptions;
  const messages = consistencyMessages(context, chapters, rules);

  const ctrl = new AbortController();
  controller = ctrl;
  ai.error = null;
  let acc = "";
  try {
    await streamChat({
      clientType: ai.activeConfig.clientType,
      config: ai.activeConfig,
      messages,
      temperature: 0.3,
      maxTokens: ai.maxTokens,
      signal: ctrl.signal,
      onToken: (d) => {
        acc += d;
        onProgress?.(acc);
      },
    });
  } catch (e) {
    if (!ctrl.signal.aborted) {
      ai.error = e instanceof Error ? e.message : String(e);
    }
  } finally {
    controller = null;
  }
  return parseIssues(acc);
}
