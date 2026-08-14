import { defineStore } from "pinia";
import { i18n } from "../i18n";
import { persistLoad, persistSave } from "../services/persist";
import { useUiStore } from "./ui";

const STORE_KEY = "towriter:focus";

export type FocusMode = "idle" | "work" | "break";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface FocusState {
  workMinutes: number;
  breakMinutes: number;
  mode: FocusMode;
  running: boolean;
  remainingSeconds: number;
  completedByDate: Record<string, number>;
  totalCompleted: number;
  loaded: boolean;
}

let timerHandle: ReturnType<typeof setInterval> | null = null;

export const useFocusStore = defineStore("focus", {
  state: (): FocusState => ({
    workMinutes: 25,
    breakMinutes: 5,
    mode: "idle",
    running: false,
    remainingSeconds: 0,
    completedByDate: {},
    totalCompleted: 0,
    loaded: false,
  }),
  getters: {
    display(state): string {
      const s = Math.max(0, state.remainingSeconds);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    },
    modeKey(state): string {
      return state.mode === "work" ? "focus.work" : state.mode === "break" ? "focus.break" : "focus.idle";
    },
    modeLabel(state): string {
      return state.mode === "work" ? "专注" : state.mode === "break" ? "休息" : "空闲";
    },
    completedToday(): number {
      return this.completedByDate[todayKey()] ?? 0;
    },
  },
  actions: {
    async load() {
      const data = await persistLoad<Partial<FocusState>>(STORE_KEY);
      if (data) {
        this.workMinutes = data.workMinutes ?? this.workMinutes;
        this.breakMinutes = data.breakMinutes ?? this.breakMinutes;
        this.completedByDate = data.completedByDate ?? {};
        this.totalCompleted = data.totalCompleted ?? 0;
      }
      this.loaded = true;
    },
    async persist() {
      await persistSave(STORE_KEY, {
        workMinutes: this.workMinutes,
        breakMinutes: this.breakMinutes,
        completedByDate: this.completedByDate,
        totalCompleted: this.totalCompleted,
      });
    },
    async setDurations(work: number, rest: number) {
      this.workMinutes = Math.max(1, Math.round(work));
      this.breakMinutes = Math.max(1, Math.round(rest));
      await this.persist();
    },
    stopTimer() {
      if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
    },
    reset() {
      this.stopTimer();
      this.mode = "idle";
      this.running = false;
      this.remainingSeconds = 0;
    },
    startWork() {
      this.stopTimer();
      this.mode = "work";
      this.running = true;
      this.remainingSeconds = this.workMinutes * 60;
      this.tickLoop();
    },
    startBreak() {
      this.stopTimer();
      this.mode = "break";
      this.running = true;
      this.remainingSeconds = this.breakMinutes * 60;
      this.tickLoop();
    },
    pause() {
      this.running = false;
      this.stopTimer();
    },
    resume() {
      if (this.mode === "idle" || this.remainingSeconds <= 0) return;
      this.running = true;
      this.tickLoop();
    },
    tickLoop() {
      this.stopTimer();
      timerHandle = setInterval(() => {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds -= 1;
        }
        if (this.remainingSeconds <= 0) {
          this.onComplete();
        }
      }, 1000);
    },
    onComplete() {
      this.stopTimer();
      if (this.mode === "work") {
        const key = todayKey();
        this.completedByDate[key] = (this.completedByDate[key] ?? 0) + 1;
        this.totalCompleted += 1;
        void this.persist();
        useUiStore().showToast(i18n.global.t("focus.workDone"));
        this.mode = "break";
        this.running = true;
        this.remainingSeconds = this.breakMinutes * 60;
        this.tickLoop();
      } else {
        useUiStore().showToast(i18n.global.t("focus.breakDone"));
        this.mode = "idle";
        this.running = false;
        this.remainingSeconds = 0;
      }
    },
  },
});
