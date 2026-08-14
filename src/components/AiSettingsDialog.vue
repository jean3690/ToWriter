<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAiStore, PROVIDER_PRESETS } from "../stores/ai";
import { errMsg } from "../utils/error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
const ai = useAiStore();

const baseURL = ref(ai.activeConfig.baseURL);
const apiKey = ref(ai.activeConfig.apiKey);
const model = ref(ai.activeConfig.model);
const temperature = ref(ai.temperature);
const maxTokens = ref(ai.maxTokens);
const testResult = ref<{ ok: boolean; text: string } | null>(null);
const testing = ref(false);
const saving = ref(false);

watch(
  () => ai.activeId,
  () => {
    baseURL.value = ai.activeConfig.baseURL;
    apiKey.value = ai.activeConfig.apiKey;
    model.value = ai.activeConfig.model;
    testResult.value = null;
  },
);

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    await ai.updateProvider(ai.activeId, {
      baseURL: baseURL.value,
      apiKey: apiKey.value,
      model: model.value,
    });
    await ai.updateTemperature(temperature.value);
    await ai.updateMaxTokens(maxTokens.value);
    emit("close");
  } finally {
    saving.value = false;
  }
}

async function test() {
  if (testing.value) return;
  testing.value = true;
  testResult.value = null;
  try {
    const text = await ai.testConnection({
      baseURL: baseURL.value,
      apiKey: apiKey.value,
      model: model.value,
    });
    testResult.value = { ok: true, text };
    await ai.updateProvider(ai.activeId, {
      baseURL: baseURL.value,
      apiKey: apiKey.value,
      model: model.value,
    });
  } catch (e) {
    testResult.value = { ok: false, text: errMsg(e) };
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <Dialog open @update:open="(v: boolean) => { if (!v) emit('close') }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("aiSettings.title") }}</DialogTitle>
        <DialogDescription>{{ t("aiSettings.desc") }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <Label>{{ t("aiSettings.provider") }}</Label>
          <Select :model-value="ai.activeId" @update:model-value="(v: unknown) => ai.setActive(v as string)">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in PROVIDER_PRESETS" :key="p.id" :value="p.id">
                {{ p.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-2">
          <Label>{{ t("aiSettings.baseUrl") }}</Label>
          <Input v-model="baseURL" placeholder="https://api.example.com/v1" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("aiSettings.model") }}</Label>
          <Input v-model="model" :placeholder="t('aiSettings.modelPlaceholder')" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("aiSettings.apiKey") }}</Label>
          <Input v-model="apiKey" type="password" :placeholder="t('aiSettings.apiKeyPlaceholder')" />
        </div>
        <div class="grid gap-2">
          <Label class="flex items-center justify-between">
            {{ t("aiSettings.temperature") }}
            <span class="text-muted-foreground">{{ temperature }}</span>
          </Label>
          <Input v-model.number="temperature" type="range" min="0" max="1.5" step="0.05" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("aiSettings.maxTokens") }}</Label>
          <Input v-model.number="maxTokens" type="number" min="64" max="8192" />
        </div>
        <p v-if="testResult" class="text-sm" :class="testResult.ok ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive'">
          {{ testResult.ok ? "✓ " : "✗ " }}{{ testResult.text }}
        </p>
      </div>

      <DialogFooter class="justify-between sm:justify-between">
        <Button variant="outline" :disabled="testing" @click="test">
          {{ testing ? t("aiSettings.testing") : t("aiSettings.test") }}
        </Button>
        <div class="flex gap-2">
          <Button variant="ghost" @click="emit('close')">{{ t("aiSettings.cancel") }}</Button>
          <Button :disabled="saving" @click="save">{{ saving ? t("aiSettings.saving") : t("aiSettings.save") }}</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
