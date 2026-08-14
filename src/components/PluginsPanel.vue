<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { usePluginsStore } from "../stores/plugins";
import { useWorkspaceStore } from "../stores/workspace";
import { useEditorStore } from "../stores/editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MarketPanel from "./MarketPanel.vue";

const { t } = useI18n();
const plugins = usePluginsStore();
const ws = useWorkspaceStore();
const editorStore = useEditorStore();
const panelTab = ref<"installed" | "market">("installed");
const activeViewId = ref<string | null>(null);
const viewHtml = ref("");
const rendering = ref(false);
let renderTimer: ReturnType<typeof setTimeout> | null = null;

const diagList = computed(() => plugins.allDiagnostics());

function jumpToDiagnostic(offset: number) {
  if (!ws.chapter) return;
  const content = ws.chapterContent;
  let line = 1;
  for (let i = 0; i < Math.min(offset, content.length); i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  editorStore.setReveal(ws.chapter.path, line);
}

async function render() {
  if (!activeViewId.value) {
    viewHtml.value = "";
    return;
  }
  rendering.value = true;
  viewHtml.value = await plugins.renderView(activeViewId.value);
  rendering.value = false;
}

function selectView(id: string) {
  activeViewId.value = id;
  void render();
}

watch(
  () => plugins.viewEpoch,
  () => {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => void render(), 400);
  },
);

onMounted(() => {
  if (plugins.views.length > 0 && !activeViewId.value) {
    activeViewId.value = plugins.views[0].id;
    void render();
  }
});

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer);
});

async function reload() {
  await plugins.reload();
  activeViewId.value = null;
  viewHtml.value = "";
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Tabs v-model="panelTab" class="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList variant="line" class="w-full justify-start rounded-none border-b px-1.5">
        <TabsTrigger value="installed">{{ t("plugins.installed") }}</TabsTrigger>
        <TabsTrigger value="market">{{ t("plugins.market") }}</TabsTrigger>
      </TabsList>

      <TabsContent value="market" class="flex min-h-0 flex-1 overflow-y-auto">
        <MarketPanel class="w-full" />
      </TabsContent>

      <TabsContent value="installed" class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div class="flex items-center justify-between px-3 pt-3">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t("plugins.plugins") }}</span>
          <Button size="sm" variant="ghost" :title="t('plugins.reload')" @click="reload">⟳</Button>
        </div>

        <div class="plugin-list">
          <div v-for="p in plugins.plugins" :key="p.manifest.name" class="plugin-item">
            <div class="plugin-head">
              <span class="plugin-name">{{ p.manifest.displayName || p.manifest.name }}</span>
              <span class="plugin-status" :class="p.status">
                {{
                  p.status === "running"
                    ? t("plugins.running")
                    : p.status === "loading"
                      ? t("plugins.loading")
                      : t("plugins.error")
                }}
              </span>
            </div>
            <div class="plugin-meta">
              {{ p.manifest.publisher }} · v{{ p.manifest.version }}
              <span v-if="p.manifest.engines?.towriter" class="plugin-engine">
                {{ t("plugins.requires", { version: p.manifest.engines.towriter }) }}
              </span>
            </div>
            <div v-if="p.manifest.compatible === false" class="plugin-error">
              {{ t("plugins.incompatible") }}
            </div>
            <div v-else-if="p.status === 'error' && p.error" class="plugin-error">{{ p.error }}</div>
          </div>
          <div v-if="plugins.plugins.length === 0" class="empty-hint">{{ t("plugins.empty") }}</div>
        </div>

        <template v-if="plugins.views.length">
          <div class="flex items-center justify-between px-3 pt-2">
            <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t("plugins.views") }}</span>
          </div>
          <div class="view-list">
            <Button
              v-for="v in plugins.views"
              :key="v.id"
              size="sm"
              :variant="activeViewId === v.id ? 'secondary' : 'ghost'"
              @click="selectView(v.id)"
            >
              {{ v.title }}
            </Button>
          </div>
          <div class="view-body">
            <div v-if="rendering" class="empty-hint">{{ t("plugins.rendering") }}</div>
            <div v-else v-html="viewHtml" />
          </div>
        </template>

        <template v-if="diagList.length">
          <div class="flex items-center justify-between px-3 pt-2">
            <span class="text-xs uppercase tracking-wider text-muted-foreground">
              {{ t("plugins.diagnostics", { count: diagList.length }) }}
            </span>
          </div>
          <div class="diag-list">
            <div
              v-for="(d, i) in diagList"
              :key="i"
              class="diag-item"
              :class="d.diagnostic.severity"
              @click="jumpToDiagnostic(d.diagnostic.from)"
            >
              <span class="diag-sev">{{ d.diagnostic.severity === "error" ? "!" : "⚠" }}</span>
              <span class="diag-source">{{ d.source }}</span>
              <span class="diag-msg">{{ d.diagnostic.message }}</span>
            </div>
          </div>
        </template>
      </TabsContent>
    </Tabs>
  </div>
</template>
