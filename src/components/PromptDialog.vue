<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const { t } = useI18n();
const open = ref(false);
const label = ref("");
const value = ref("");
let resolver: ((v: string | null) => void) | null = null;

function prompt(title: string, initial = ""): Promise<string | null> {
  label.value = title;
  value.value = initial;
  open.value = true;
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(".prompt-dialog-input");
    input?.focus();
    input?.select();
  });
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

function commit() {
  open.value = false;
  resolver?.(value.value);
  resolver = null;
}

function dismiss() {
  open.value = false;
  resolver?.(null);
  resolver = null;
}

defineExpose({ prompt });
</script>

<template>
  <Dialog v-model:open="open" @update:open="(v: boolean) => { if (!v) dismiss() }">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ label }}</DialogTitle>
      </DialogHeader>
      <div class="py-1">
        <Input
          :model-value="value"
          class="prompt-dialog-input"
          @update:model-value="value = String($event)"
          @keydown.enter="commit"
          @keydown.esc="dismiss"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="dismiss">{{ t("promptDialog.cancel") }}</Button>
        <Button @click="commit">{{ t("promptDialog.ok") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
