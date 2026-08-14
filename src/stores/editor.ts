import { defineStore } from "pinia";

interface EditorState {
  cursorLine: number;
  cursorCol: number;
  pendingReveal: { path: string; line: number } | null;
}

export const useEditorStore = defineStore("editor", {
  state: (): EditorState => ({
    cursorLine: 1,
    cursorCol: 1,
    pendingReveal: null,
  }),
  actions: {
    setCursor(line: number, col: number) {
      this.cursorLine = line;
      this.cursorCol = col;
    },
    setReveal(path: string, line: number) {
      this.pendingReveal = { path, line };
    },
    clearReveal() {
      this.pendingReveal = null;
    },
  },
});
