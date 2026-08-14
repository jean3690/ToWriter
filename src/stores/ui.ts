import { defineStore } from "pinia";
import { toast } from "vue-sonner";

type Activity = "files" | "ai" | "plugins" | "search";

interface UiState {
  activity: Activity;
  sidebarVisible: boolean;
  auxPanelVisible: boolean;
  auxTab: "outline" | "characters" | "timeline" | "stats";
  aiSettingsOpen: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  immersive: boolean;
}

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    activity: "files",
    sidebarVisible: true,
    auxPanelVisible: true,
    auxTab: "outline",
    aiSettingsOpen: false,
    commandPaletteOpen: false,
    settingsOpen: false,
    immersive: false,
  }),
  actions: {
    setActivity(a: Activity) {
      this.activity = a;
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },
    setSidebarVisible(v: boolean) {
      this.sidebarVisible = v;
    },
    toggleAuxPanel() {
      this.auxPanelVisible = !this.auxPanelVisible;
    },
    setAuxTab(tab: UiState["auxTab"]) {
      this.auxTab = tab;
    },
    openAiSettings() {
      this.aiSettingsOpen = true;
    },
    closeAiSettings() {
      this.aiSettingsOpen = false;
    },
    openSettings() {
      this.settingsOpen = true;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
    toggleImmersive() {
      this.immersive = !this.immersive;
    },
    openCommandPalette() {
      this.commandPaletteOpen = true;
    },
    closeCommandPalette() {
      this.commandPaletteOpen = false;
    },
    showToast(text: string, error = false) {
      if (error) toast.error(text);
      else toast(text);
    },
  },
});
