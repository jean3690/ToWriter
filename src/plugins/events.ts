export type PluginEventName = "onDidChangeActiveChapter" | "onDidChangeText" | "onDidSaveChapter";

const listeners = new Map<PluginEventName, Set<(name: PluginEventName, payload: unknown) => void>>();
let lastTextEmit = 0;

export function onPluginEvent(
  name: PluginEventName,
  cb: (name: PluginEventName, payload: unknown) => void,
): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

export function emitPluginEvent(name: PluginEventName, payload: unknown): void {
  if (name === "onDidChangeText") {
    const now = Date.now();
    if (now - lastTextEmit < 300) return;
    lastTextEmit = now;
  }
  const set = listeners.get(name);
  if (set) set.forEach((cb) => cb(name, payload));
}
