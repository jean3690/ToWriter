import { defineStore } from "pinia";
import { i18n } from "../i18n";
import { useWorkspaceStore } from "./workspace";
import { pluginService } from "../services/pluginService";
import { commandService, registerCoreCommands } from "../plugins/commands";
import { keybindingService } from "../plugins/keybindings";
import { PluginSession } from "../plugins/session";
import { getView } from "../editor/bridge";
import { setPluginDiagnostics, type Diagnostic } from "../editor/diagnostics";
import type { PluginManifest } from "../plugins/manifest";

const sessions = new Map<string, PluginSession>();
const kbDisposers = new Map<string, Array<() => void>>();

export interface PluginState {
  manifest: PluginManifest;
  status: "loading" | "running" | "error";
  error?: string;
}

export interface PluginView {
  id: string;
  title: string;
  pluginId: string;
}

interface PluginsState {
  plugins: PluginState[];
  views: PluginView[];
  statusBarText: string;
  loading: boolean;
  viewEpoch: number;
  /** 插件来源的诊断：source -> 诊断列表 */
  diagnostics: Record<string, Diagnostic[]>;
}

export const usePluginsStore = defineStore("plugins", {
  state: (): PluginsState => ({
    plugins: [],
    views: [],
    statusBarText: "",
    loading: false,
    viewEpoch: 0,
    diagnostics: {},
  }),
  actions: {
    bumpViews() {
      this.viewEpoch += 1;
    },

    async ensureAndLoad() {
      const ws = useWorkspaceStore();
      if (!ws.workspace) return;
      this.loading = true;
      try {
        await pluginService.ensureExamplePlugin(ws.workspace.path);
        await this.reload();
      } finally {
        this.loading = false;
      }
    },

    async reload() {
      const ws = useWorkspaceStore();
      if (!ws.workspace) return;
      registerCoreCommands();
      this.unloadAll();
      this.plugins = [];
      this.views = [];
      const manifests = await pluginService.scanPlugins(ws.workspace.path);
      for (const manifest of manifests) {
        if (manifest.compatible === false) {
          this.plugins.push({
            manifest,
            status: "error",
            error: i18n.global.t("plugins.incompatible"),
          });
          continue;
        }
        this.loadOne(manifest);
      }
    },

    unloadAll() {
      for (const [id, session] of sessions) {
        this.clearPluginDiagnostics(id);
        session.dispose();
        sessions.delete(id);
      }
      this.diagnostics = {};
      commandService
        .list()
        .filter((c) => c.pluginId)
        .forEach((c) => commandService.unregister(c.id));
      for (const [, disposers] of kbDisposers) disposers.forEach((d) => d());
      kbDisposers.clear();
      this.statusBarText = "";
      this.bumpViews();
    },

    loadOne(manifest: PluginManifest) {
      void pluginService
        .readPluginSource(manifest.dir, manifest.main)
        .then((source) => {
          const session = new PluginSession(manifest, source);
          sessions.set(manifest.name, session);
          session.setCallbacks({
            onStatus: (status, error) => {
              const p = this.plugins.find((x) => x.manifest.name === manifest.name);
              if (p) {
                p.status = status;
                p.error = error;
              }
              this.bumpViews();
            },
            onViewsChange: () => this.refreshViews(),
            onStatusBarText: (text) => {
              this.statusBarText = text;
              this.bumpViews();
            },
            onDiagnostics: (diags) => {
              this.applyDiagnostics(manifest.name, diags as Diagnostic[]);
            },
          });
          this.refreshViews();

          for (const c of manifest.contributes?.commands ?? []) {
            commandService.register({
              id: c.command,
              title: c.title,
              category: c.category || manifest.displayName || manifest.name,
              pluginId: manifest.name,
              handler: (args) => session.runCommand(c.command, args),
            });
          }

          for (const kb of manifest.contributes?.keybindings ?? []) {
            const disposer = keybindingService.register({
              command: kb.command,
              key: kb.key,
              pluginId: manifest.name,
            });
            const arr = kbDisposers.get(manifest.name) ?? [];
            arr.push(disposer);
            kbDisposers.set(manifest.name, arr);
          }

          this.plugins.push({ manifest, status: "loading" });
          session.start();
        })
        .catch((e) => {
          this.plugins.push({
            manifest,
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        });
    },

    refreshViews() {
      const next: PluginView[] = [];
      for (const [pluginId, session] of sessions) {
        for (const v of session.listViews()) {
          next.push({ id: v.id, title: v.title, pluginId });
        }
      }
      this.views = next;
      this.bumpViews();
    },

    async renderView(viewId: string): Promise<string> {
      let lastError: string | null = null;
      for (const session of sessions.values()) {
        try {
          const html = await session.renderView(viewId);
          if (html) return html;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      return lastError ? `${i18n.global.t("store.renderFailed")}：${lastError}` : i18n.global.t("store.viewNotFound");
    },

    /** 插件通过 setDiagnostics 上报诊断：应用波浪线并缓存列表 */
    applyDiagnostics(source: string, diags: Diagnostic[]) {
      this.diagnostics[source] = diags.filter((d) => d.to > d.from);
      const view = getView();
      if (view) setPluginDiagnostics(view, { source, diagnostics: this.diagnostics[source] });
      this.bumpViews();
    },

    clearPluginDiagnostics(source: string) {
      delete this.diagnostics[source];
      const view = getView();
      if (view) setPluginDiagnostics(view, { source, diagnostics: [] });
      this.bumpViews();
    },

    allDiagnostics(): Array<{ source: string; diagnostic: Diagnostic }> {
      const out: Array<{ source: string; diagnostic: Diagnostic }> = [];
      for (const [source, diags] of Object.entries(this.diagnostics)) {
        for (const d of diags) out.push({ source, diagnostic: d });
      }
      return out;
    },
  },
});
