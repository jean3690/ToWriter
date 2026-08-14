import { i18n } from "../i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useAiStore } from "../stores/ai";
import { useUiStore } from "../stores/ui";
import { bookService } from "../services/bookService";
import { getView } from "../editor/bridge";
import { streamChat } from "../ai/client";
import { commandService } from "./commands";
import { onPluginEvent, type PluginEventName } from "./events";
import { RUNTIME_SOURCE } from "./runtime";
import type { PluginManifest } from "./manifest";

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

interface RegisteredView {
  id: string;
  title: string;
}

const BOOTSTRAP = `
self.__towriterPlugin = {
  activate: typeof activate === "function" ? activate : null,
  deactivate: typeof deactivate === "function" ? deactivate : null
};
`;

export class PluginSession {
  readonly pluginId: string;
  readonly manifest: PluginManifest;
  status: "loading" | "running" | "error" = "loading";
  errorMessage = "";

  private worker: Worker;
  private reqId = 0;
  private pending = new Map<number, Pending>();
  private viewReqs = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
  private commandHandlers = new Map<string, () => void>();
  private views = new Map<string, RegisteredView>();
  private disposers: Array<() => void> = [];

  private onStatus?: (status: "running" | "error", error?: string) => void;
  private onViewsChange?: () => void;
  private onStatusBarText?: (text: string) => void;
  private onDiagnostics?: (diags: Array<{ from: number; to: number; message: string; severity: string }>) => void;

  constructor(manifest: PluginManifest, source: string) {
    this.pluginId = manifest.name;
    this.manifest = manifest;

    const wrapper = `${RUNTIME_SOURCE}\n${source}\n${BOOTSTRAP}`;
    const blob = new Blob([wrapper], { type: "application/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (e) => this.handleMessage(e.data);

    const eventNames: PluginEventName[] = [
      "onDidChangeActiveChapter",
      "onDidChangeText",
      "onDidSaveChapter",
    ];
    for (const name of eventNames) {
      this.disposers.push(
        onPluginEvent(name, (_n, payload) => {
          if (!this.worker) return;
          this.worker.postMessage({ kind: "event", name, payload });
        }),
      );
    }
  }

  setCallbacks(opts: {
    onStatus?: (status: "running" | "error", error?: string) => void;
    onViewsChange?: () => void;
    onStatusBarText?: (text: string) => void;
    onDiagnostics?: (diags: Array<{ from: number; to: number; message: string; severity: string }>) => void;
  }) {
    this.onStatus = opts.onStatus;
    this.onViewsChange = opts.onViewsChange;
    this.onStatusBarText = opts.onStatusBarText;
    this.onDiagnostics = opts.onDiagnostics;
  }

  start() {
    this.worker.postMessage({
      kind: "activate",
      ctx: { extensionPath: this.manifest.dir, pluginName: this.pluginId },
    });
  }

  async runCommand(id: string, args?: unknown): Promise<unknown> {
    const reqId = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.worker.postMessage({ kind: "command", id, args, reqId });
    });
  }

  listViews(): RegisteredView[] {
    return [...this.views.values()];
  }

  async renderView(viewId: string): Promise<string> {
    const reqId = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.viewReqs.set(reqId, { resolve, reject });
      this.worker.postMessage({ kind: "requestViewHtml", viewId, reqId });
    });
  }

  dispose() {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.commandHandlers.forEach((dispose) => dispose());
    this.commandHandlers.clear();
    this.worker.terminate();
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.kind) {
      case "activated":
        this.status = "running";
        this.errorMessage = "";
        this.onStatus?.("running");
        break;
      case "activatedError":
        this.status = "error";
        this.errorMessage = String(msg.error ?? i18n.global.t("store.activationFailed"));
        this.onStatus?.("error", this.errorMessage);
        break;
      case "api":
        this.handleApiRequest(msg as { id: number; ns: string; method: string; args: unknown[] });
        break;
      case "registerCommand":
        this.registerCommand(String(msg.id));
        break;
      case "unregisterCommand":
        this.unregisterCommand(String(msg.id));
        break;
      case "registerView": {
        const view = msg.view as { id: string; title: string };
        if (view?.id) {
          this.views.set(view.id, view);
          this.onViewsChange?.();
        }
        break;
      }
      case "setDiagnostics": {
        const diags = (msg.diags as Array<{ from: number; to: number; message: string; severity: string }>) ?? [];
        this.onDiagnostics?.(diags);
        break;
      }
      case "unregisterView": {
        this.views.delete(String(msg.viewId));
        this.onViewsChange?.();
        break;
      }
      case "commandResult": {
        const id = Number(msg.reqId);
        const p = this.pending.get(id);
        if (p) {
          this.pending.delete(id);
          if (msg.ok) p.resolve(msg.value);
          else p.reject(new Error(String(msg.error ?? i18n.global.t("store.commandFailed"))));
        }
        break;
      }
      case "viewHtml": {
        const id = Number(msg.reqId);
        const p = this.viewReqs.get(id);
        if (p) {
          this.viewReqs.delete(id);
          if (msg.error) p.reject(new Error(String(msg.error)));
          else p.resolve(String(msg.html ?? ""));
        }
        break;
      }
    }
  }

  private registerCommand(id: string) {
    if (this.commandHandlers.has(id)) return;
    const dispose = commandService.register({
      id,
      title: id,
      category: this.manifest.displayName || this.pluginId,
      pluginId: this.pluginId,
      handler: (args) => this.runCommand(id, args),
    });
    this.commandHandlers.set(id, dispose);
  }

  private unregisterCommand(id: string) {
    this.commandHandlers.get(id)?.();
    this.commandHandlers.delete(id);
  }

  private async handleApiRequest(msg: { id: number; ns: string; method: string; args: unknown[] }) {
    const { id, ns, method, args } = msg;
    try {
      let value: unknown;
      if (ns === "commands") {
        value = await commandService.execute(String(args[0]), args[1]);
      } else if (ns === "workspace") {
        value = await this.handleWorkspace(method, args);
      } else if (ns === "editor") {
        value = this.handleEditor(method, args);
      } else if (ns === "window") {
        value = this.handleWindow(method, args);
      } else if (ns === "ai") {
        await this.handleAiChatStream(id, String(args[0]));
        value = null;
      } else {
        throw new Error(`${i18n.global.t("store.unknownNamespace")}: ${ns}`);
      }
      this.worker.postMessage({ kind: "apiResult", id, ok: true, value });
    } catch (e) {
      this.worker.postMessage({
        kind: "apiResult",
        id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async handleWorkspace(method: string, args: unknown[]): Promise<unknown> {
    const ws = useWorkspaceStore();
    if (!ws.workspace) throw new Error(i18n.global.t("store.noWorkspace"));
    switch (method) {
      case "readFile":
        return bookService.readWorkspaceFile(ws.workspace.path, String(args[0]));
      case "writeFile":
        await bookService.writeWorkspaceFile(ws.workspace.path, String(args[0]), String(args[1]));
        return null;
      case "getBooks":
        return ws.workspace.books ?? [];
      case "getCurrentChapter":
        if (!ws.chapter) return null;
        return { path: ws.chapter.path, title: ws.chapter.title, content: ws.chapterContent };
      default:
        throw new Error(`${i18n.global.t("store.unknownWsMethod")}: ${method}`);
    }
  }

  private handleEditor(method: string, args: unknown[]): unknown {
    const view = getView();
    if (!view) throw new Error(i18n.global.t("store.editorNotReady"));
    switch (method) {
      case "getDoc":
        return view.state.doc.toString();
      case "getSelection": {
        const sel = view.state.selection.main;
        return { from: sel.from, to: sel.to, text: view.state.doc.sliceString(sel.from, sel.to) };
      }
      case "replaceSelection": {
        const sel = view.state.selection.main;
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: String(args[0]) } });
        return null;
      }
      case "insertAtCursor": {
        const head = view.state.selection.main.head;
        const text = String(args[0]);
        view.dispatch({ changes: { from: head, insert: text }, selection: { anchor: head + text.length } });
        return null;
      }
      case "setDoc": {
        const text = String(args[0]);
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
        return null;
      }
      default:
        throw new Error(`${i18n.global.t("store.unknownEditorMethod")}: ${method}`);
    }
  }

  private handleWindow(method: string, args: unknown[]): unknown {
    const ui = useUiStore();
    switch (method) {
      case "showMessage":
        ui.showToast(String(args[0]));
        return null;
      case "showErrorMessage":
        ui.showToast(String(args[0]), true);
        return null;
      case "setStatusBarItem":
        this.onStatusBarText?.(String(args[0]));
        return null;
      default:
        throw new Error(`${i18n.global.t("store.unknownWindowMethod")}: ${method}`);
    }
  }

  private async handleAiChatStream(reqId: number, prompt: string) {
    const ai = useAiStore();
    if (!ai.activeConfig.baseURL) throw new Error(i18n.global.t("store.configAiFirst"));
    await streamChat({
      clientType: ai.activeConfig.clientType,
      config: ai.activeConfig,
      messages: [
        { role: "system", content: i18n.global.t("store.writingAssistantSystem") },
        { role: "user", content: prompt },
      ],
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      signal: undefined,
      onToken: (delta) => {
        this.worker.postMessage({ kind: "aiToken", id: reqId, delta });
      },
    });
  }
}
