import { load } from "@tauri-apps/plugin-store";

async function getStore(): Promise<Awaited<ReturnType<typeof load>> | null> {
  try {
    return await load("towriter-settings.json", { autoSave: false });
  } catch {
    return null;
  }
}

export async function persistLoad<T>(key: string): Promise<T | null> {
  try {
    const store = await getStore();
    if (!store) {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const value = await store.get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function persistSave(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    if (!store) {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    await store.set(key, value);
    await store.save();
  } catch {
    /* ignore persistence failures */
  }
}
