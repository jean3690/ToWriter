<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { usePluginsStore } from "../stores/plugins";
import { useUiStore } from "../stores/ui";
import { useSettingsStore } from "../stores/settings";
import { pluginService, type MarketPlugin } from "../services/pluginService";
import {
  fetchRemoteIndex,
  installRemotePlugin,
  listRepoFiles,
  downloadRepoFile,
  pluginNameFromEntry,
  type RemotePluginEntry,
  type RemotePluginItem,
} from "../services/marketService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_INDEX_URL = "https://raw.githubusercontent.com/OWNER/REPO/main/plugins.json";

const { t } = useI18n();
const ws = useWorkspaceStore();
const plugins = usePluginsStore();
const ui = useUiStore();
const settings = useSettingsStore();

// ---- 本地市场 ----
const market = ref<MarketPlugin[]>([]);
const loading = ref(false);
const installing = ref("");

// ---- GitHub 市场 ----
const indexUrl = ref(settings.marketIndexUrl || "");
const remotePlugins = ref<RemotePluginItem[]>([]);
const remoteLoading = ref(false);
const remoteInstalling = ref("");
const remoteError = ref("");
const indexName = ref("");

async function loadMarket() {
  loading.value = true;
  try {
    market.value = await pluginService.scanMarket();
  } catch (e) {
    ui.showToast(e instanceof Error ? e.message : String(e), true);
  } finally {
    loading.value = false;
  }
}

async function installLocal(item: MarketPlugin) {
  if (!ws.workspace || installing.value) return;
  installing.value = item.manifest.name;
  try {
    await pluginService.installMarketPlugin(item.manifest.name, ws.workspace.path);
    ui.showToast(t("plugins.installedToast", { name: item.manifest.displayName || item.manifest.name }));
    await plugins.reload();
    await loadMarket();
  } catch (e) {
    ui.showToast(e instanceof Error ? e.message : String(e), true);
  } finally {
    installing.value = "";
  }
}

async function loadRemote() {
  const url = indexUrl.value.trim();
  if (!url) {
    ui.showToast(t("plugins.indexUrlRequired"), true);
    return;
  }
  remoteLoading.value = true;
  remoteError.value = "";
  remotePlugins.value = [];
  try {
    settings.setMarketIndexUrl(url);
    const index = await fetchRemoteIndex(url);
    indexName.value = index.name || "";
    remotePlugins.value = await Promise.all(
      index.plugins.map(async (p: RemotePluginEntry) => ({
        ...p,
        manifest: await resolveRemoteManifest(p),
      })),
    );
  } catch (e) {
    remoteError.value = e instanceof Error ? e.message : String(e);
  } finally {
    remoteLoading.value = false;
  }
}

/** 读取远端插件目录里的 manifest.json 用于展示版本 / 兼容性 */
async function resolveRemoteManifest(entry: RemotePluginEntry) {
  const branch = entry.branch || "main";
  const base: Partial<import("../plugins/manifest").PluginManifest> = {
    name: pluginNameFromEntry(entry),
    displayName: entry.displayName || entry.name,
    version: entry.version || "0.0.0",
    publisher: entry.publisher || "unknown",
    main: "main.js",
    engines: {},
    contributes: { commands: [], views: [], keybindings: [] },
    dir: "",
  };
  try {
    const files = await listRepoFiles(entry.repo, entry.path, branch);
    const mf = files.find((f) => f.name === "manifest.json");
    if (mf) {
      const raw = await downloadRepoFile(entry.repo, mf.path, branch);
      const parsed = JSON.parse(raw) as Partial<import("../plugins/manifest").PluginManifest>;
      return {
        ...base,
        ...parsed,
        name: parsed.name || base.name,
        displayName: parsed.displayName || base.displayName,
        version: parsed.version || base.version,
        publisher: parsed.publisher || base.publisher,
        contributes: parsed.contributes ?? base.contributes,
        engines: parsed.engines ?? base.engines,
      } as import("../plugins/manifest").PluginManifest;
    }
  } catch {
    /* 拿不到 manifest 就用索引里的字段兜底 */
  }
  return base as import("../plugins/manifest").PluginManifest;
}

async function installRemote(entry: RemotePluginEntry) {
  if (!ws.workspace || remoteInstalling.value) return;
  remoteInstalling.value = entry.name;
  remoteError.value = "";
  try {
    const name = await installRemotePlugin(ws.workspace.path, entry, (file) => {
      ui.showToast(t("plugins.downloading", { name, file }));
    });
    ui.showToast(t("plugins.installedToast", { name: entry.displayName || name }));
    await plugins.reload();
  } catch (e) {
    remoteError.value = e instanceof Error ? e.message : String(e);
  } finally {
    remoteInstalling.value = "";
  }
}

function isInstalled(name: string): boolean {
  return plugins.plugins.some((p) => p.manifest.name === name);
}

onMounted(loadMarket);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Tabs default-value="github" class="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList variant="line" class="w-full justify-start rounded-none border-b px-1.5">
        <TabsTrigger value="github">{{ t("plugins.marketGithub") }}</TabsTrigger>
        <TabsTrigger value="local">{{ t("plugins.marketLocal") }}</TabsTrigger>
      </TabsList>

      <TabsContent value="github" class="flex min-h-0 flex-1 flex-col gap-3 p-2.5">
        <div class="grid gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t("plugins.indexUrlLabel") }}</label>
          <div class="flex gap-1.5">
            <Input v-model="indexUrl" :placeholder="DEFAULT_INDEX_URL" class="h-8 text-xs" @keydown.enter="loadRemote" />
            <Button size="sm" :disabled="remoteLoading" @click="loadRemote">
              {{ remoteLoading ? t("plugins.loadingIndex") : t("plugins.loadIndex") }}
            </Button>
          </div>
          <span class="text-[11px] text-muted-foreground">{{ t("plugins.indexUrlHint") }}</span>
        </div>

        <div v-if="remoteError" class="plugin-error">{{ remoteError }}</div>
        <div v-if="indexName && remotePlugins.length" class="text-xs text-muted-foreground">{{ indexName }}</div>

        <div v-if="remoteLoading" class="empty-hint">{{ t("plugins.loadingIndex") }}…</div>
        <div v-else-if="remotePlugins.length === 0 && !remoteError" class="empty-hint">
          {{ t("plugins.marketEmptyRemote") }}
        </div>

        <div class="plugin-list">
          <div v-for="item in remotePlugins" :key="item.name" class="plugin-item">
            <div class="plugin-head">
              <span class="plugin-name">{{ item.manifest.displayName || item.name }}</span>
              <Button
                size="sm"
                :disabled="remoteInstalling === item.name || isInstalled(item.name)"
                @click="installRemote(item)"
              >
                {{
                  remoteInstalling === item.name
                    ? t("plugins.installing")
                    : isInstalled(item.name)
                      ? t("plugins.installedBtn")
                      : t("plugins.install")
                }}
              </Button>
            </div>
            <div class="plugin-meta">
              {{ item.manifest.publisher }} · v{{ item.manifest.version }} ·
              {{ item.repo }}
            </div>
            <div v-if="item.description" class="plugin-error" style="color: var(--muted-foreground)">
              {{ item.description }}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="local" class="flex min-h-0 flex-1 flex-col gap-3 p-2.5">
        <div class="panel-actions">
          <Button size="sm" :disabled="loading" @click="loadMarket">{{ loading ? t("plugins.refreshing") : t("plugins.refresh") }}</Button>
          <Button
            size="sm"
            variant="outline"
            :title="t('plugins.openMarketFolder')"
            @click="pluginService.openMarketFolder()"
          >
            {{ t("plugins.openMarketFolder") }}
          </Button>
          <span class="hint">{{ t("plugins.marketHint") }}</span>
        </div>

        <div v-if="market.length === 0 && !loading" class="empty-hint">
          {{ t("plugins.marketEmpty") }}
        </div>

        <div class="plugin-list">
          <div v-for="item in market" :key="item.manifest.name" class="plugin-item">
            <div class="plugin-head">
              <span class="plugin-name">{{ item.manifest.displayName || item.manifest.name }}</span>
              <Button
                size="sm"
                :disabled="installing === item.manifest.name || item.manifest.compatible === false"
                :title="item.manifest.compatible === false ? t('plugins.incompatible') : ''"
                @click="installLocal(item)"
              >
                {{
                  installing === item.manifest.name
                    ? t("plugins.installing")
                    : item.manifest.compatible === false
                      ? t("plugins.incompatibleBtn")
                      : t("plugins.install")
                }}
              </Button>
            </div>
            <div class="plugin-meta">
              {{ item.manifest.publisher }} · v{{ item.manifest.version }} ·
              {{ (item.manifest.contributes?.commands ?? []).length }} {{ t("plugins.commands") }}
              <template v-if="item.manifest.engines?.towriter">
                {{ t("plugins.requires", { version: item.manifest.engines.towriter }) }}
              </template>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
