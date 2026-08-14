import type { WriterEditor } from "./index";

let currentView: WriterEditor | null = null;

export function registerView(view: WriterEditor | null) {
  currentView = view;
}

export function getView(): WriterEditor | null {
  return currentView;
}

export function insertAtCursor(text: string): boolean {
  const view = currentView;
  if (!view) return false;
  const head = view.state.selection.main.head;
  view.dispatch({
    changes: { from: head, insert: text },
    selection: { anchor: head + text.length },
    scrollIntoView: true,
  });
  return true;
}
