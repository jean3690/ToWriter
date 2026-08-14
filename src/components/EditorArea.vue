<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { EditorView } from "@codemirror/view";
import { useWorkspaceStore } from "../stores/workspace";
import { useEditorStore } from "../stores/editor";
import { useSettingsStore } from "../stores/settings";
import { renderMarkdown } from "../services/markdown";
import {
  createWriterEditor,
  destroyWriterEditor,
  getCachedState,
  cacheState,
  type WriterEditor,
} from "../editor";
import { registerView } from "../editor/bridge";
import {
  startContinuation,
  stopContinuation,
  subscribeContinuationState,
} from "../ai/continuation";

const { t } = useI18n();
const ws = useWorkspaceStore();
const editorStore = useEditorStore();
const settings = useSettingsStore();
const host = ref<HTMLElement>();
const aiRunning = ref(false);
const previewOpen = ref(false);
let view: WriterEditor | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

const previewHtml = computed(() => renderMarkdown(ws.chapterContent));

function cacheKey(path: string): string {
  return `${path}|${settings.effectiveTheme}`;
}

function scheduleAutosave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => ws.saveChapter(), settings.autosaveDelay);
}

function applyReveal() {
  const target = editorStore.pendingReveal;
  if (!target || !view || !ws.chapter || target.path !== ws.chapter.path) return;
  editorStore.clearReveal();
  const line = Math.max(1, target.line);
  if (line > view.state.doc.lines) return;
  const l = view.state.doc.line(line);
  view.dispatch({
    selection: { anchor: l.from },
    effects: EditorView.scrollIntoView(l.from, { y: "center" }),
  });
  view.focus();
}

function mountEditor() {
  if (!host.value || !ws.chapter) return;
  view = createWriterEditor(host.value, {
    doc: ws.chapterContent,
    savedState: getCachedState(cacheKey(ws.chapter.path)),
    dark: settings.effectiveTheme === "dark",
    typewriter: settings.typewriterScroll,
    onChange: (content, wordCount) => {
      ws.updateContent(content, wordCount);
      scheduleAutosave();
    },
    onCursor: (line, col) => editorStore.setCursor(line, col),
    onSave: () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      ws.saveChapter();
    },
    onContinue: () => {
      void startContinuation();
    },
    onCancel: () => {
      if (aiRunning.value) stopContinuation();
    },
  });
  registerView(view);
  applyReveal();
}

function unmountEditor() {
  if (view) {
    if (ws.chapter?.path) cacheState(cacheKey(ws.chapter.path), view.state);
    destroyWriterEditor(view);
    view = null;
    registerView(null);
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

watch(
  () => ws.chapter?.path,
  (newPath, oldPath) => {
    if (view) {
      if (oldPath) cacheState(cacheKey(oldPath), view.state);
      destroyWriterEditor(view);
      view = null;
      registerView(null);
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (newPath) mountEditor();
  },
);

watch(
  () => editorStore.pendingReveal,
  () => applyReveal(),
);

watch(
  () => settings.effectiveTheme,
  () => {
    if (ws.chapter?.path) {
      const key = cacheKey(ws.chapter.path);
      if (view) {
        cacheState(key, view.state);
        destroyWriterEditor(view);
        view = null;
        registerView(null);
      }
      mountEditor();
    }
  },
);

watch(
  () => settings.typewriterScroll,
  (typewriter) => {
    if (view && ws.chapter?.path) {
      cacheState(cacheKey(ws.chapter.path), view.state);
      destroyWriterEditor(view);
      view = null;
      registerView(null);
      mountEditor();
    }
    void typewriter;
  },
);

onMounted(() => {
  unsubscribe = subscribeContinuationState((v) => {
    aiRunning.value = v;
  });
  mountEditor();
});
onBeforeUnmount(() => {
  unsubscribe?.();
  unmountEditor();
});
</script>

<template>
  <div class="editor-area">
    <div class="editor-tabs">
      <span v-if="ws.chapter" class="tab">
        {{ ws.chapter.title }}
        <span v-if="ws.dirty" class="dot">•</span>
      </span>
      <button
        v-if="ws.chapter"
        class="preview-toggle"
        :class="{ active: previewOpen }"
        :title="previewOpen ? t('editor.closePreview') : t('editor.openPreview')"
        @click="previewOpen = !previewOpen"
      >
        {{ previewOpen ? t("editor.previewClose") : t("editor.preview") }}
      </button>
    </div>
    <div class="editor-split" :class="{ split: previewOpen }">
      <div
        ref="host"
        class="editor-host"
        :style="{
          '--editor-font-size': settings.fontSize + 'px',
          '--editor-line-height': settings.lineHeight,
          '--editor-writing-width': settings.writingWidth ? settings.writingWidth + 'px' : 'none',
        }"
      />
      <div v-if="previewOpen" class="preview-pane">
        <div class="preview-body" v-html="previewHtml" />
      </div>
    </div>
    <div v-if="aiRunning" class="ai-stream">
      <span class="ai-stream-label">{{ t("editor.aiStreaming") }}</span>
      <button @click="stopContinuation()">{{ t("editor.stop") }}</button>
    </div>
  </div>
</template>
