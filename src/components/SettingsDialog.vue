<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useSettingsStore, type ThemeMode, type ThemePreset } from "../stores/settings";
import { useUiStore } from "../stores/ui";
import { useFocusStore } from "../stores/focus";
import { LOCALES, type Locale } from "../i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emit = defineEmits<{ (e: "close"): void }>();
const { t } = useI18n();
const settings = useSettingsStore();
const ui = useUiStore();
const focus = useFocusStore();
const themes: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "settings.themeDark" },
  { value: "light", label: "settings.themeLight" },
  { value: "system", label: "settings.themeSystem" },
];
const presets: Array<{ value: ThemePreset; label: string; swatch: string[] }> = [
  { value: "default", label: "settings.presetDefault", swatch: ["#ffffff", "#1f1f1f"] },
  { value: "paper", label: "settings.presetPaper", swatch: ["#f7f0e0", "#3f3a2e"] },
  { value: "forest", label: "settings.presetForest", swatch: ["#f4f7f2", "#2f6b4f"] },
  { value: "ocean", label: "settings.presetOcean", swatch: ["#f0f4f8", "#2b6cb0"] },
];

function openAiSettings() {
  emit("close");
  ui.openAiSettings();
}
</script>

<template>
  <Dialog open @update:open="(v: boolean) => { if (!v) emit('close') }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("settings.title") }}</DialogTitle>
        <DialogDescription>{{ t("settings.desc") }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <Label>{{ t("settings.language") }}</Label>
          <Select
            :model-value="settings.language"
            @update:model-value="(v: unknown) => settings.setLanguage(v as Locale)"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="l in LOCALES" :key="l.value" :value="l.value">{{ l.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <Label>{{ t("settings.theme") }}</Label>
          <Select :model-value="settings.theme" @update:model-value="(v: unknown) => settings.setTheme(v as ThemeMode)">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="th in themes" :key="th.value" :value="th.value">{{ t(th.label) }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <Label>{{ t("settings.preset") }}</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in presets"
              :key="p.value"
              class="preset-swatch"
              :class="{ active: settings.preset === p.value }"
              :title="t(p.label)"
              @click="settings.setPreset(p.value)"
            >
              <span class="preset-dot" :style="{ background: p.swatch[0] }" />
              <span class="preset-dot" :style="{ background: p.swatch[1] }" />
              <span class="preset-name">{{ t(p.label) }}</span>
            </button>
          </div>
        </div>

        <div class="grid gap-2">
          <Label class="flex items-center justify-between">
            {{ t("settings.fontSize") }}
            <span class="text-muted-foreground">{{ settings.fontSize }}px</span>
          </Label>
          <input
            :value="settings.fontSize"
            type="range"
            min="14"
            max="22"
            step="1"
            class="w-full accent-foreground"
            @input="settings.setFontSize(Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="grid gap-2">
          <Label class="flex items-center justify-between">
            {{ t("settings.lineHeight") }}
            <span class="text-muted-foreground">{{ settings.lineHeight.toFixed(1) }}</span>
          </Label>
          <input
            :value="settings.lineHeight"
            type="range"
            min="1.2"
            max="2.8"
            step="0.1"
            class="w-full accent-foreground"
            @input="settings.setLineHeight(Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="grid gap-2">
          <Label class="flex items-center justify-between">
            {{ t("settings.writingWidth") }}
            <span class="text-muted-foreground">
              {{ settings.writingWidth ? settings.writingWidth + "px" : t("settings.writingWidthNone") }}
            </span>
          </Label>
          <input
            :value="settings.writingWidth"
            type="range"
            min="0"
            max="1000"
            step="20"
            class="w-full accent-foreground"
            @input="settings.setWritingWidth(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="text-muted-foreground text-xs">{{ t("settings.writingWidthHint") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="settings.typewriterScroll" @update:checked="(v: boolean | 'indeterminate') => settings.setTypewriterScroll(v === true)" />
          <Label class="cursor-pointer" @click="settings.setTypewriterScroll(!settings.typewriterScroll)">{{ t("settings.typewriterScroll") }}</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="settings.consistencyAfterSave" @update:checked="(v: boolean | 'indeterminate') => settings.setConsistencyAfterSave(v === true)" />
          <Label class="cursor-pointer" @click="settings.setConsistencyAfterSave(!settings.consistencyAfterSave)">{{ t("settings.consistencyAfterSave") }}</Label>
        </div>
        <div class="grid gap-2">
          <Label>{{ t("settings.autosaveDelay") }}</Label>
          <Select :model-value="settings.autosaveDelay" @update:model-value="(v: unknown) => settings.setAutosaveDelay(Number(v))">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="500">{{ t("settings.autosaveFast") }}</SelectItem>
              <SelectItem :value="800">{{ t("settings.autosaveNormal") }}</SelectItem>
              <SelectItem :value="1500">{{ t("settings.autosaveSlow") }}</SelectItem>
              <SelectItem :value="3000">{{ t("settings.autosaveVerySlow") }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-2">
          <Label>{{ t("settings.focusDuration") }}</Label>
          <div class="flex gap-3">
            <div class="flex items-center gap-2">
              <Select :model-value="focus.workMinutes" @update:model-value="(v: unknown) => focus.setDurations(Number(v), focus.breakMinutes)">
                <SelectTrigger class="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in [15, 20, 25, 30, 40, 50]" :key="m" :value="m">{{ m }} {{ t("settings.minutes") }}</SelectItem>
                </SelectContent>
              </Select>
              <Select :model-value="focus.breakMinutes" @update:model-value="(v: unknown) => focus.setDurations(focus.workMinutes, Number(v))">
                <SelectTrigger class="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in [5, 8, 10, 15, 20]" :key="m" :value="m">{{ m }} {{ t("settings.minutes") }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button variant="link" class="h-auto w-fit justify-start p-0" @click="openAiSettings">
          {{ t("settings.openAi") }}
        </Button>
      </div>

      <DialogFooter>
        <Button @click="emit('close')">{{ t("settings.done") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
