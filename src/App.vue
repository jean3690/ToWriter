<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWorkspaceStore } from "./stores/workspace";
import { useSettingsStore } from "./stores/settings";
import { setLocale } from "./i18n";
import { useAiStore } from "./stores/ai";
import { useUiStore } from "./stores/ui";
import { usePluginsStore } from "./stores/plugins";
import { usePromptsStore } from "./stores/prompts";
import { useRulesStore } from "./stores/rules";
import { useWritingStore } from "./stores/writing";
import { useFocusStore } from "./stores/focus";
import { registerCoreCommands } from "@/plugins/commands";
import { keybindingService } from "@/plugins/keybindings";
import ActivityBar from "./components/ActivityBar.vue";
import Sidebar from "./components/Sidebar.vue";
import EditorArea from "./components/EditorArea.vue";
import AuxPanel from "./components/AuxPanel.vue";
import StatusBar from "./components/StatusBar.vue";
import WelcomeView from "./components/WelcomeView.vue";
import NewBookDialog from "./components/NewBookDialog.vue";
import AiSettingsDialog from "./components/AiSettingsDialog.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import CommandPalette from "./components/CommandPalette.vue";
import { Toaster } from "@/components/ui/sonner";

const ws = useWorkspaceStore();
const settings = useSettingsStore();
const ai = useAiStore();
const ui = useUiStore();
const plugins = usePluginsStore();
const prompts = usePromptsStore();
const rules = useRulesStore();
const writing = useWritingStore();
const focus = useFocusStore();

function onKeydown(e: KeyboardEvent) {
  if (keybindingService.handle(e)) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyP") {
    e.preventDefault();
    ui.openCommandPalette();
  } else if (e.key === "Escape" && ui.commandPaletteOpen) {
    ui.closeCommandPalette();
  }
}

function applyAppearance() {
  document.documentElement.classList.toggle("dark", settings.effectiveTheme === "dark");
  document.documentElement.setAttribute("data-theme", settings.preset);
  setLocale(settings.language);
}

watch(
  () => settings.effectiveTheme,
  () => applyAppearance(),
);

watch(
  () => settings.preset,
  () => applyAppearance(),
);

watch(
  () => settings.language,
  () => applyAppearance(),
);

applyAppearance();

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  registerCoreCommands();
  await Promise.all([ai.load(), prompts.load(), rules.load(), writing.load(), focus.load()]);
  if (!settings.lastWorkspace) return;
  await ws.openWorkspace(settings.lastWorkspace);
  if (ws.workspace) {
    await plugins.ensureAndLoad();
    if (settings.lastBookDir) {
      await ws.openBook(settings.lastBookDir);
      if (settings.lastChapter && ws.book) {
        const ch = ws.book.chapters.find((c) => c.path === settings.lastChapter);
        if (ch) await ws.openChapter(ch);
      }
    }
  }
});

let closing = false;
onMounted(() => {
  try {
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (closing) return;
        closing = true;
        if (ws.dirty) {
          event.preventDefault();
          try {
            await ws.flush();
          } finally {
            await getCurrentWindow().destroy();
          }
        }
      })
      .catch(() => {
        /* not in Tauri runtime */
      });
  } catch {
    /* running in plain browser */
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="app" :class="{ immersive: ui.immersive }">
    <div class="app-main">
      <ActivityBar />
      <Sidebar v-if="ws.workspace && !ui.immersive" />
      <main class="editor-zone">
        <EditorArea v-if="ws.chapter" />
        <WelcomeView v-else />
      </main>
      <AuxPanel v-if="ws.book && ws.chapter && !ui.immersive" />
    </div>
    <StatusBar v-if="!ui.immersive" />
    <NewBookDialog />
    <AiSettingsDialog v-if="ui.aiSettingsOpen" @close="ui.closeAiSettings()" />
    <SettingsDialog v-if="ui.settingsOpen" @close="ui.closeSettings()" />
    <CommandPalette v-if="ui.commandPaletteOpen" />
    <Toaster position="bottom-center" />
  </div>
</template>
