<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useEditorStore } from "../stores/editor";
import { useAiStore } from "../stores/ai";
import { usePluginsStore } from "../stores/plugins";
import { useSettingsStore } from "../stores/settings";
import { useUiStore } from "../stores/ui";
import { useWritingStore } from "../stores/writing";
import { useFocusStore } from "../stores/focus";

const { t } = useI18n();
const ws = useWorkspaceStore();
const editor = useEditorStore();
const ai = useAiStore();
const plugins = usePluginsStore();
const settings = useSettingsStore();
const ui = useUiStore();
const writing = useWritingStore();
const focus = useFocusStore();

function toggleFocus() {
  if (focus.running) {
    focus.pause();
  } else if (focus.mode === "idle" || focus.remainingSeconds <= 0) {
    focus.startWork();
  } else {
    focus.resume();
  }
}
</script>

<template>
  <footer class="status-bar">
    <span class="status-item">{{ ws.workspace?.name ?? t("statusBar.noWorkspace") }}</span>
    <span v-if="ws.book" class="status-item">{{ ws.book.meta.title }}</span>
    <span v-if="ws.chapter" class="status-item">{{ ws.chapter.title }}</span>
    <span class="spacer" />
    <span v-if="plugins.statusBarText" class="status-item">{{ plugins.statusBarText }}</span>
    <span v-if="ai.activeConfig" class="status-item">{{ ai.activeConfig.name }} · {{ ai.activeConfig.model }}</span>
    <span v-if="ws.chapter" class="status-item">{{ t("statusBar.words", { count: ws.chapter.wordCount }) }}</span>
    <span v-if="ws.chapter" class="status-item">Ln {{ editor.cursorLine }}, Col {{ editor.cursorCol }}</span>
    <span class="status-item" :title="t('statusBar.todayTitle')">
      {{ t("statusBar.today", { today: writing.todayWords, goal: writing.dailyGoal }) }}
      <span :class="writing.todayProgress >= 1 ? 'status-done' : ''">
        {{ writing.todayProgress >= 1 ? "✓" : `${writing.todayPercent}%` }}
      </span>
    </span>
    <span class="status-item" :title="t('statusBar.streak')">{{ t("statusBar.streak", { days: writing.streak }) }}</span>
    <span class="status-item" :title="t('statusBar.focusTitle')" @click="toggleFocus">
      🍅 {{ focus.mode !== "idle" ? `${t(focus.modeKey)} ${focus.display}` : t("statusBar.startFocus") }}
      <span v-if="focus.running" class="status-focus" />
    </span>
    <span class="status-item">{{ ws.dirty ? t("statusBar.unsaved") : t("statusBar.saved") }}</span>
    <button class="status-btn" :title="t('statusBar.immersive')" @click="ui.toggleImmersive()">
      {{ ui.immersive ? t("statusBar.exitImmersive") : t("statusBar.immersive") }}
    </button>
    <button class="status-btn" :title="t('statusBar.theme')" @click="settings.toggleTheme()">
      {{ t("statusBar.theme") }}
    </button>
    <button class="status-btn" :title="t('statusBar.settings')" @click="ui.openSettings()">{{ t("statusBar.settings") }}</button>
  </footer>
</template>
