import { defineStore } from "pinia";
import type { Locale } from "../i18n";

export type ThemeMode = "dark" | "light" | "system";

/** 主题预设：默认 / 护眼纸黄 / 森林 / 海洋 */
export type ThemePreset = "default" | "paper" | "forest" | "ocean";

export interface SettingsState {
  lastWorkspace: string | null;
  lastBookDir: string | null;
  lastChapter: string | null;
  theme: ThemeMode;
  preset: ThemePreset;
  language: Locale;
  fontSize: number;
  lineHeight: number;
  writingWidth: number;
  typewriterScroll: boolean;
  autosaveDelay: number;
  consistencyAfterSave: boolean;
  marketIndexUrl: string;
}

const KEY = "towriter.settings";
const DEFAULT: SettingsState = {
  lastWorkspace: null,
  lastBookDir: null,
  lastChapter: null,
  theme: "dark",
  preset: "default",
  language: "zh-CN",
  fontSize: 16,
  lineHeight: 1.9,
  writingWidth: 0,
  typewriterScroll: false,
  autosaveDelay: 800,
  consistencyAfterSave: false,
  marketIndexUrl: "",
};

function load(): SettingsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<SettingsState>) };
  } catch {
    /* ignore corrupt settings */
  }
  return { ...DEFAULT };
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => load(),
  getters: {
    effectiveTheme(state): "dark" | "light" {
      if (state.theme === "system") {
        return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      return state.theme;
    },
  },
  actions: {
    persist() {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          lastWorkspace: this.lastWorkspace,
          lastBookDir: this.lastBookDir,
          lastChapter: this.lastChapter,
          theme: this.theme,
          preset: this.preset,
          language: this.language,
          fontSize: this.fontSize,
          lineHeight: this.lineHeight,
          writingWidth: this.writingWidth,
          typewriterScroll: this.typewriterScroll,
          autosaveDelay: this.autosaveDelay,
          consistencyAfterSave: this.consistencyAfterSave,
          marketIndexUrl: this.marketIndexUrl,
        }),
      );
    },
    setLastWorkspace(path: string | null) {
      this.lastWorkspace = path;
      this.persist();
    },
    setLastBook(bookDir: string | null) {
      this.lastBookDir = bookDir;
      this.persist();
    },
    setLastChapter(path: string | null) {
      this.lastChapter = path;
      this.persist();
    },
    setTheme(theme: ThemeMode) {
      this.theme = theme;
      this.persist();
    },
    toggleTheme() {
      this.theme = this.effectiveTheme === "dark" ? "light" : "dark";
      this.persist();
    },
    setFontSize(size: number) {
      this.fontSize = size;
      this.persist();
    },
    setAutosaveDelay(ms: number) {
      this.autosaveDelay = ms;
      this.persist();
    },
    setLineHeight(v: number) {
      this.lineHeight = Math.min(3, Math.max(1.2, v));
      this.persist();
    },
    setWritingWidth(px: number) {
      this.writingWidth = Math.min(1000, Math.max(0, px));
      this.persist();
    },
    setTypewriterScroll(v: boolean) {
      this.typewriterScroll = v;
      this.persist();
    },
    setConsistencyAfterSave(v: boolean) {
      this.consistencyAfterSave = v;
      this.persist();
    },
    setPreset(preset: ThemePreset) {
      this.preset = preset;
      this.persist();
    },
    setMarketIndexUrl(url: string) {
      this.marketIndexUrl = url;
      this.persist();
    },
    setLanguage(language: Locale) {
      this.language = language;
      this.persist();
    },
  },
});
