import { Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export interface Diagnostic {
  from: number;
  to: number;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface DiagnosticsUpdate {
  /** 来自哪个插件 */
  source: string;
  diagnostics: Diagnostic[];
}

export const setDiagnosticsEffect = StateEffect.define<DiagnosticsUpdate>();

const diagClass: Record<Diagnostic["severity"], string> = {
  error: "cm-diag-error",
  warning: "cm-diag-warning",
  info: "cm-diag-info",
};

export const diagnosticsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setDiagnosticsEffect)) {
        const { source, diagnostics } = e.value;
        const add: Range<Decoration>[] = [];
        for (const d of diagnostics) {
          if (d.to <= d.from) continue;
          const cls = diagClass[d.severity] ?? diagClass.warning;
          add.push(
            Decoration.mark({
              class: cls,
              attributes: {
                "data-diag-source": source,
                "data-diag-severity": d.severity,
                title: d.message,
              },
            }).range(d.from, d.to),
          );
        }
        deco = Decoration.set(add);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** 向视图注入某插件的诊断（整体替换该来源的诊断）。 */
export function setPluginDiagnostics(view: EditorView, update: DiagnosticsUpdate): void {
  view.dispatch({ effects: setDiagnosticsEffect.of(update) });
}
