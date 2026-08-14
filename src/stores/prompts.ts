import { defineStore } from "pinia";
import { i18n } from "../i18n";
import { persistLoad, persistSave } from "../services/persist";

const STORE_KEY = "towriter:prompts";

export interface PromptItem {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface PromptsState {
  prompts: PromptItem[];
  loaded: boolean;
}

export const usePromptsStore = defineStore("prompts", {
  state: (): PromptsState => ({
    prompts: [],
    loaded: false,
  }),
  actions: {
    async load() {
      const data = await persistLoad<PromptItem[]>(STORE_KEY);
      if (Array.isArray(data)) this.prompts = data;
      this.loaded = true;
    },
    async persist() {
      await persistSave(STORE_KEY, this.prompts);
    },
    add(name: string, content: string) {
      const trimmed = content.trim();
      if (!trimmed) return;
      const item: PromptItem = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: name.trim() || trimmed.slice(0, 20),
        content: trimmed,
        createdAt: Date.now(),
      };
      this.prompts.unshift(item);
      void this.persist();
    },
    rename(id: string, name: string) {
      const p = this.prompts.find((x) => x.id === id);
      if (p && name.trim()) {
        p.name = name.trim();
        void this.persist();
      }
    },
    remove(id: string) {
      this.prompts = this.prompts.filter((x) => x.id !== id);
      void this.persist();
    },
    exportData() {
      return JSON.stringify(this.prompts, null, 2);
    },
    importData(raw: string): number {
      const data = JSON.parse(raw) as PromptItem[];
      if (!Array.isArray(data)) throw new Error(i18n.global.t("store.promptFileInvalid"));
      this.prompts = [
        ...data.filter((x) => x && typeof x.content === "string"),
        ...this.prompts,
      ];
      void this.persist();
      return data.length;
    },
  },
});
