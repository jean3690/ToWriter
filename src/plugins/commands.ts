import { i18n } from "../i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useUiStore } from "../stores/ui";
import { useSettingsStore } from "../stores/settings";
import { useFocusStore } from "../stores/focus";
import { startContinuation } from "../ai/continuation";

export interface CommandEntry {
  id: string;
  title: string;
  category: string;
  pluginId?: string;
  /** 内置命令的 i18n key（存在时优先用 t(titleKey) 展示标题） */
  titleKey?: string;
  categoryKey?: string;
  handler: (args?: unknown) => unknown | Promise<unknown>;
}

const registry = new Map<string, CommandEntry>();
let coreRegistered = false;

export const commandService = {
  list(): CommandEntry[] {
    return [...registry.values()];
  },
  register(entry: CommandEntry): () => void {
    registry.set(entry.id, entry);
    return () => {
      if (registry.get(entry.id) === entry) registry.delete(entry.id);
    };
  },
  unregister(id: string): void {
    registry.delete(id);
  },
  has(id: string): boolean {
    return registry.has(id);
  },
  async execute(id: string, args?: unknown): Promise<unknown> {
    const entry = registry.get(id);
    if (!entry) throw new Error(`${i18n.global.t("store.unknownCommand")}: ${id}`);
    return entry.handler(args);
  },
};

export function registerCoreCommands(): void {
  if (coreRegistered) return;
  coreRegistered = true;

  commandService.register({
    id: "towriter.newBook",
    title: i18n.global.t("commands.newBook"),
    titleKey: "commands.newBook",
    category: i18n.global.t("commands.catWriting"),
    categoryKey: "commands.catWriting",
    handler: () => useWorkspaceStore().openNewBook(),
  });
  commandService.register({
    id: "towriter.save",
    title: i18n.global.t("commands.saveChapter"),
    titleKey: "commands.saveChapter",
    category: i18n.global.t("commands.catWriting"),
    categoryKey: "commands.catWriting",
    handler: () => useWorkspaceStore().saveChapter(),
  });
  commandService.register({
    id: "towriter.aiContinuation",
    title: i18n.global.t("commands.aiContinuation"),
    titleKey: "commands.aiContinuation",
    category: i18n.global.t("commands.catAi"),
    categoryKey: "commands.catAi",
    handler: () => startContinuation(),
  });
  commandService.register({
    id: "towriter.aiSettings",
    title: i18n.global.t("commands.aiSettings"),
    titleKey: "commands.aiSettings",
    category: i18n.global.t("commands.catAi"),
    categoryKey: "commands.catAi",
    handler: () => useUiStore().openAiSettings(),
  });
  commandService.register({
    id: "towriter.openAi",
    title: i18n.global.t("commands.openAi"),
    titleKey: "commands.openAi",
    category: i18n.global.t("commands.catAi"),
    categoryKey: "commands.catAi",
    handler: () => {
      const ui = useUiStore();
      ui.setActivity("ai");
      ui.setSidebarVisible(true);
    },
  });
  commandService.register({
    id: "towriter.openPlugins",
    title: i18n.global.t("commands.openPlugins"),
    titleKey: "commands.openPlugins",
    category: i18n.global.t("commands.catPlugin"),
    categoryKey: "commands.catPlugin",
    handler: () => {
      const ui = useUiStore();
      ui.setActivity("plugins");
      ui.setSidebarVisible(true);
    },
  });
  commandService.register({
    id: "towriter.toggleSidebar",
    title: i18n.global.t("commands.toggleSidebar"),
    titleKey: "commands.toggleSidebar",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => useUiStore().toggleSidebar(),
  });
  commandService.register({
    id: "towriter.toggleAux",
    title: i18n.global.t("commands.toggleAux"),
    titleKey: "commands.toggleAux",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => useUiStore().toggleAuxPanel(),
  });
  commandService.register({
    id: "towriter.toggleTheme",
    title: i18n.global.t("commands.toggleTheme"),
    titleKey: "commands.toggleTheme",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => useSettingsStore().toggleTheme(),
  });
  commandService.register({
    id: "towriter.immersive",
    title: i18n.global.t("commands.immersive"),
    titleKey: "commands.immersive",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => useUiStore().toggleImmersive(),
  });
  commandService.register({
    id: "towriter.search",
    title: i18n.global.t("commands.openSearch"),
    titleKey: "commands.openSearch",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => {
      const ui = useUiStore();
      ui.setActivity("search");
      ui.setSidebarVisible(true);
    },
  });
  commandService.register({
    id: "towriter.settings",
    title: i18n.global.t("commands.openSettings"),
    titleKey: "commands.openSettings",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => useUiStore().openSettings(),
  });
  commandService.register({
    id: "towriter.togglePreview",
    title: i18n.global.t("commands.togglePreview"),
    titleKey: "commands.togglePreview",
    category: i18n.global.t("commands.catView"),
    categoryKey: "commands.catView",
    handler: () => {
      const el = document.querySelector<HTMLElement>(".preview-toggle");
      el?.click();
    },
  });
  commandService.register({
    id: "towriter.focusStart",
    title: i18n.global.t("commands.focusStart"),
    titleKey: "commands.focusStart",
    category: i18n.global.t("commands.catWriting"),
    categoryKey: "commands.catWriting",
    handler: () => {
      const focus = useFocusStore();
      if (focus.running) focus.pause();
      else if (focus.mode === "idle" || focus.remainingSeconds <= 0) focus.startWork();
      else focus.resume();
    },
  });
  commandService.register({
    id: "towriter.editBook",
    title: i18n.global.t("commands.editBook"),
    titleKey: "commands.editBook",
    category: i18n.global.t("commands.catWriting"),
    categoryKey: "commands.catWriting",
    handler: () => {
      const el = document.querySelector<HTMLElement>('[title="编辑书信息"]');
      (el as HTMLButtonElement | null)?.click();
    },
  });
}

export function getCurrentChapterForPlugin() {
  const ws = useWorkspaceStore();
  if (!ws.chapter) return null;
  return { path: ws.chapter.path, title: ws.chapter.title, content: ws.chapterContent };
}
