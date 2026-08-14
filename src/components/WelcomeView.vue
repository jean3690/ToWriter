<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../stores/workspace";
import { useSettingsStore } from "../stores/settings";
import { usePluginsStore } from "../stores/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const { t } = useI18n();
const ws = useWorkspaceStore();
const settings = useSettingsStore();
const plugins = usePluginsStore();
const newWsName = ref("");
const showCreateForm = ref(false);

async function openWorkspaceAndLoad(path: string) {
  await ws.openWorkspace(path);
  if (ws.workspace) await plugins.ensureAndLoad();
}

async function pickWorkspace() {
  const dir = await open({ directory: true, multiple: false, title: t("welcome.pickWorkspace") });
  if (typeof dir === "string") await openWorkspaceAndLoad(dir);
}

async function createWorkspaceFlow() {
  const parent = await open({ directory: true, multiple: false, title: t("welcome.pickParent") });
  if (typeof parent !== "string") return;
  const name = newWsName.value.trim();
  if (!name) return;
  await ws.createWorkspace(parent, name);
  if (ws.workspace) await plugins.ensureAndLoad();
  showCreateForm.value = false;
  newWsName.value = "";
}
</script>

<template>
  <section class="welcome">
    <template v-if="!ws.workspace">
      <h1>{{ t("app.title") }}</h1>
      <p class="subtitle">{{ t("app.subtitle") }}</p>

      <div class="actions">
        <Button @click="pickWorkspace">{{ t("welcome.openWorkspace") }}</Button>
        <Button variant="outline" @click="showCreateForm = !showCreateForm">{{ t("welcome.newWorkspace") }}</Button>
      </div>

      <div v-if="showCreateForm" class="form">
        <Input v-model="newWsName" :placeholder="t('welcome.workspaceName')" class="w-56" @keydown.enter="createWorkspaceFlow" />
        <Button :disabled="!newWsName.trim()" @click="createWorkspaceFlow">{{ t("welcome.create") }}</Button>
      </div>

      <p
        v-if="settings.lastWorkspace"
        class="recent"
        :title="t('welcome.openWorkspace')"
        @click="openWorkspaceAndLoad(settings.lastWorkspace)"
      >
        {{ t("welcome.recent", { path: settings.lastWorkspace }) }}
      </p>
    </template>

    <template v-else>
      <h2>{{ ws.workspace.name }}</h2>
      <p class="subtitle">{{ t("welcome.noBookHint") }}</p>
      <Button @click="ws.openNewBook()">{{ t("welcome.newBook") }}</Button>
    </template>

    <p v-if="ws.error" class="error">{{ ws.error }}</p>
  </section>
</template>
