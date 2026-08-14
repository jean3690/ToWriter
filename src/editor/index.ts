import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { countWords } from "../services/wordCount";
import { diagnosticsField } from "./diagnostics";

export type WriterEditor = EditorView;

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "#ffffff", color: "#1f1f1f" },
  ".cm-gutters": {
    backgroundColor: "#f5f5f5",
    color: "#999999",
    borderRight: "1px solid #e5e5e5",
  },
  ".cm-activeLine": { backgroundColor: "#f0f4ff" },
  ".cm-activeLineGutter": { backgroundColor: "#e8f0ff" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#cfe8ff",
  },
  ".cm-cursor": { borderLeftColor: "#1f1f1f" },
  "&.cm-focused": { outline: "none" },
});

const stateCache = new Map<string, EditorState>();

export function getCachedState(key: string): EditorState | undefined {
  return stateCache.get(key);
}

export function cacheState(key: string, state: EditorState) {
  stateCache.set(key, state);
}

export interface WriterEditorOptions {
  doc: string;
  savedState?: EditorState;
  dark?: boolean;
  typewriter?: boolean;
  onChange?: (content: string, wordCount: number) => void;
  onCursor?: (line: number, col: number) => void;
  onSave?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
}

export function createWriterEditor(container: HTMLElement, opts: WriterEditorOptions): WriterEditor {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString();
      opts.onChange?.(content, countWords(content));
    }
    if (update.selectionSet || update.docChanged) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      opts.onCursor?.(line.number, head - line.from + 1);
      if (opts.typewriter && (update.selectionSet || update.docChanged)) {
        update.view.dispatch({
          effects: EditorView.scrollIntoView(head, { y: "center", yMargin: 120 }),
        });
      }
    }
  });

  const saveBindings = keymap.of([
    { key: "Mod-s", preventDefault: true, run: () => { opts.onSave?.(); return true; } },
    { key: "Mod-Shift-s", preventDefault: true, run: () => { opts.onSave?.(); return true; } },
  ]);

  const continueBindings = opts.onContinue
    ? Prec.high(
        keymap.of([
          { key: "Mod-j", preventDefault: true, run: () => { opts.onContinue?.(); return true; } },
        ]),
      )
    : [];

  const cancelBindings = opts.onCancel
    ? Prec.highest(
        keymap.of([
          { key: "Escape", preventDefault: true, run: () => { opts.onCancel?.(); return true; } },
        ]),
      )
    : [];

  const extensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    markdown({ codeLanguages: languages }),
    highlightSelectionMatches(),
    diagnosticsField,
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    keymap.of(searchKeymap),
    saveBindings,
    continueBindings,
    cancelBindings,
    ...(opts.dark === false
      ? [lightTheme, syntaxHighlighting(defaultHighlightStyle)]
      : [oneDark]),
    updateListener,
  ];

  const state = opts.savedState ?? EditorState.create({ doc: opts.doc, extensions });
  const view = new EditorView({ state, parent: container });
  view.focus();
  return view;
}

export function destroyWriterEditor(view: WriterEditor) {
  view.destroy();
}
