import { i18n } from "../i18n";
import { bookService } from "../services/bookService";
import { useWorkspaceStore } from "../stores/workspace";
import { useAiStore } from "../stores/ai";
import { streamChat } from "./client";
import { outlineMessages } from "./prompts";

export async function generateOutline(onToken?: (text: string) => void): Promise<string> {
  const ws = useWorkspaceStore();
  const ai = useAiStore();
  if (!ws.book) {
    ai.error = i18n.global.t("store.openBookFirstShort");
    return "";
  }
  if (!ai.activeConfig.baseURL) {
    ai.error = i18n.global.t("store.configAiFirst");
    return "";
  }
  const messages = outlineMessages(ws.book.meta);
  let acc = "";
  ai.error = null;
  try {
    await streamChat({
      clientType: ai.activeConfig.clientType,
      config: ai.activeConfig,
      messages,
      temperature: 0.6,
      maxTokens: ai.maxTokens,
      onToken: (d) => {
        acc += d;
        onToken?.(acc);
      },
    });
  } catch (e) {
    ai.error = e instanceof Error ? e.message : String(e);
  }
  return acc;
}

export async function saveOutlineContent(content: string): Promise<void> {
  const ws = useWorkspaceStore();
  if (!ws.workspace || !ws.bookDir) return;
  await bookService.writeBookDoc(ws.workspace.path, ws.bookDir, "outline", content);
  await ws.reloadBook();
}
