import { i18n } from "../i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useAiStore } from "../stores/ai";
import { getView } from "../editor/bridge";
import { streamChat } from "./client";
import { buildBookContext } from "./context";
import { continuationMessages } from "./prompts";

let controller: AbortController | null = null;
let running = false;
let listener: ((running: boolean) => void) | null = null;

export function isContinuationRunning(): boolean {
  return running;
}

export function subscribeContinuationState(cb: (running: boolean) => void): () => void {
  listener = cb;
  cb(running);
  return () => {
    if (listener === cb) listener = null;
  };
}

export function stopContinuation() {
  controller?.abort();
}

function setRunning(v: boolean) {
  running = v;
  listener?.(v);
}

export async function startContinuation(instruction = ""): Promise<void> {
  const view = getView();
  if (!view || running) return;
  const ws = useWorkspaceStore();
  const ai = useAiStore();
  if (!ws.book || !ws.chapter) {
    ai.error = i18n.global.t("store.openBookFirst");
    return;
  }
  if (!ai.activeConfig.baseURL) {
    ai.error = i18n.global.t("store.configAiFirst");
    return;
  }

  const doc = view.state.doc;
  const head = view.state.selection.main.head;
  const tailStart = Math.max(0, head - 2000);
  const tail = doc.sliceString(tailStart, head);
  const context = buildBookContext(ws.book);
  const messages = continuationMessages(context, instruction, tail);
  const config = ai.activeConfig;

  const ctrl = new AbortController();
  controller = ctrl;
  setRunning(true);
  ai.error = null;
  let inserted = "";
  const from = head;
  try {
    await streamChat({
      clientType: config.clientType,
      config,
      messages,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      signal: ctrl.signal,
      onToken: (delta) => {
        const prevLen = inserted.length;
        inserted += delta;
        view.dispatch({
          changes: { from, to: from + prevLen, insert: inserted },
          selection: { anchor: from + inserted.length },
        });
      },
    });
  } catch (e) {
    if (!ctrl.signal.aborted) {
      ai.error = e instanceof Error ? e.message : String(e);
    }
    if (inserted) {
      view.dispatch({
        changes: { from, to: from + inserted.length },
        selection: { anchor: from },
      });
    }
  } finally {
    controller = null;
    setRunning(false);
  }
}
