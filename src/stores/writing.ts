import { defineStore } from "pinia";
import { persistLoad, persistSave } from "../services/persist";

const STORE_KEY = "towriter:writing";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

interface WritingState {
  dailyGoal: number;
  dailyWords: Record<string, number>;
  baselines: Record<string, number>;
  loaded: boolean;
}

export const useWritingStore = defineStore("writing", {
  state: (): WritingState => ({
    dailyGoal: 2000,
    dailyWords: {},
    baselines: {},
    loaded: false,
  }),
  getters: {
    todayWords(): number {
      return this.dailyWords[todayKey()] ?? 0;
    },
    todayProgress(): number {
      if (this.dailyGoal <= 0) return 0;
      return Math.min(1, (this.dailyWords[todayKey()] ?? 0) / this.dailyGoal);
    },
    todayPercent(): number {
      return Math.round(this.todayProgress * 100);
    },
    streak(): number {
      const dates = Object.keys(this.dailyWords)
        .map(parseKey)
        .filter((d): d is Date => d !== null);
      const written = new Set(dates.filter((d) => (this.dailyWords[dateKey(d)] ?? 0) > 0).map(dateKey));
      let count = 0;
      const cursor = new Date();
      if (!written.has(dateKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (written.has(dateKey(cursor))) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return count;
    },
    totalWords(): number {
      return Object.values(this.dailyWords).reduce((a, b) => a + b, 0);
    },
  },
  actions: {
    async load() {
      const data = await persistLoad<Partial<WritingState>>(STORE_KEY);
      if (data) {
        this.dailyGoal = data.dailyGoal ?? this.dailyGoal;
        this.dailyWords = data.dailyWords ?? {};
      }
      this.loaded = true;
    },
    async persist() {
      await persistSave(STORE_KEY, {
        dailyGoal: this.dailyGoal,
        dailyWords: this.dailyWords,
      });
    },
    async setDailyGoal(goal: number) {
      this.dailyGoal = Math.max(0, Math.round(goal));
      await this.persist();
    },
    setBaseline(path: string, wordCount: number) {
      this.baselines[path] = wordCount;
    },
    async recordDelta(path: string, wordCount: number) {
      const prev = this.baselines[path] ?? wordCount;
      const delta = wordCount - prev;
      this.baselines[path] = wordCount;
      if (delta <= 0) return;
      const key = todayKey();
      this.dailyWords[key] = (this.dailyWords[key] ?? 0) + delta;
      await this.persist();
    },
    getWordsOn(date: Date): number {
      return this.dailyWords[dateKey(date)] ?? 0;
    },
    lastDays(n: number): Array<{ label: string; words: number; isToday: boolean }> {
      const out: Array<{ label: string; words: number; isToday: boolean }> = [];
      const today = new Date();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        out.push({ label, words: this.dailyWords[dateKey(d)] ?? 0, isToday: i === 0 });
      }
      return out;
    },
  },
});
