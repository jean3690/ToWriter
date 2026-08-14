<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "../stores/ui";
import { useWorkspaceStore } from "../stores/workspace";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatsPanel from "./StatsPanel.vue";

const { t } = useI18n();
const ui = useUiStore();
const ws = useWorkspaceStore();

type DocKind = "outline" | "characters" | "timeline";

const drafts = reactive<Record<DocKind, string>>({
  outline: "",
  characters: "",
  timeline: "",
});
const dirty = reactive<Record<DocKind, boolean>>({
  outline: false,
  characters: false,
  timeline: false,
});
const saving = ref(false);

function syncAll() {
  if (!ws.book) return;
  drafts.outline = ws.book.outline;
  drafts.characters = ws.book.characters;
  drafts.timeline = ws.book.timeline;
  dirty.outline = false;
  dirty.characters = false;
  dirty.timeline = false;
}

watch(() => ws.book?.meta.id, syncAll, { immediate: true });

watch(
  () => [ws.book?.outline, ws.book?.characters, ws.book?.timeline] as const,
  ([o, c, t]) => {
    if (!ws.book) return;
    if (!dirty.outline) drafts.outline = o ?? "";
    if (!dirty.characters) drafts.characters = c ?? "";
    if (!dirty.timeline) drafts.timeline = t ?? "";
  },
);

function onEdit(kind: DocKind) {
  dirty[kind] = true;
}

async function save(kind: DocKind) {
  if (saving.value || !ws.book) return;
  saving.value = true;
  try {
    await ws.saveBookDoc(kind, drafts[kind]);
    dirty[kind] = false;
    ui.showToast(t("auxPanel.savedToast"));
  } catch {
    /* error handled by store */
  } finally {
    saving.value = false;
  }
}

const tabMeta: Array<{ value: DocKind; label: string }> = [
  { value: "outline", label: "auxPanel.outline" },
  { value: "characters", label: "auxPanel.characters" },
  { value: "timeline", label: "auxPanel.timeline" },
];
</script>

<template>
  <aside v-if="ui.auxPanelVisible" class="aux-panel">
    <Tabs v-model="ui.auxTab" class="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList variant="line" class="w-full justify-start rounded-none border-b px-1.5">
        <TabsTrigger v-for="tab in tabMeta" :key="tab.value" :value="tab.value">{{ t(tab.label) }}</TabsTrigger>
        <TabsTrigger value="stats">{{ t("auxPanel.stats") }}</TabsTrigger>
      </TabsList>
      <TabsContent v-for="tab in tabMeta" :key="tab.value" :value="tab.value" class="aux-body flex-1 overflow-auto">
        <div class="aux-doc">
          <div class="aux-doc-bar">
            <span class="aux-doc-hint">{{ t("auxPanel.editHint", { doc: tab.value }) }}</span>
            <Button variant="outline" size="xs" :disabled="!dirty[tab.value] || saving" @click="save(tab.value)">
              {{ saving ? t("auxPanel.saving") : t("auxPanel.save") }}
            </Button>
          </div>
          <textarea
            v-model="drafts[tab.value]"
            class="aux-doc-textarea"
            spellcheck="false"
            :placeholder="t('auxPanel.placeholder')"
            @input="onEdit(tab.value)"
          />
        </div>
      </TabsContent>
      <TabsContent value="stats" class="flex-1 overflow-auto">
        <StatsPanel />
      </TabsContent>
    </Tabs>
  </aside>
</template>
