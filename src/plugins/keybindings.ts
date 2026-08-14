import { commandService } from "./commands";

export interface KeybindingEntry {
  command: string;
  key: string;
  pluginId?: string;
}

const keybindings = new Map<string, string>();

export function normalizeKey(key: string): string {
  const parts = key.toLowerCase().split("+");
  const mods = new Set<string>();
  let main = "";
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (t === "ctrl" || t === "cmd" || t === "meta" || t === "control") mods.add("mod");
    else if (t === "shift") mods.add("shift");
    else if (t === "alt" || t === "option") mods.add("alt");
    else if (t === "mod") mods.add("mod");
    else main = t;
  }
  const sorted = ["mod", "shift", "alt"].filter((m) => mods.has(m));
  return [...sorted, main].join("+");
}

export function keyFromEvent(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("mod");
  if (e.shiftKey) mods.push("shift");
  if (e.altKey) mods.push("alt");
  let main = e.key.toLowerCase();
  if (main === " ") main = "space";
  if (main.length > 1 && main !== "space") {
    const code = e.code.toLowerCase();
    main = code.startsWith("key") ? code.slice(3) : code;
  }
  return [...mods, main].join("+");
}

export const keybindingService = {
  register(entry: KeybindingEntry): () => void {
    const normalized = normalizeKey(entry.key);
    keybindings.set(normalized, entry.command);
    return () => {
      if (keybindings.get(normalized) === entry.command) keybindings.delete(normalized);
    };
  },
  clearPluginKeybindings(pluginId: string) {
    // 插件卸载时按需清理（调用方维护 disposer 即可，这里留作兜底）
    void pluginId;
  },
  handle(e: KeyboardEvent): boolean {
    const key = keyFromEvent(e);
    const cmdId = keybindings.get(key);
    if (!cmdId) return false;
    if (!commandService.has(cmdId)) return false;
    e.preventDefault();
    void commandService.execute(cmdId).catch(() => {});
    return true;
  },
};
