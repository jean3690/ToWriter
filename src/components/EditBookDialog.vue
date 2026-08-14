<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useUiStore } from "../stores/ui";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const { t } = useI18n();
const ws = useWorkspaceStore();
const ui = useUiStore();

const title = ref("");
const author = ref("");
const genre = ref("");
const description = ref("");
const open = ref(false);
const submitting = ref(false);
const genreKeys = ["novel", "prose", "essay", "short", "script", "other"] as const;
const genres = computed(() =>
  genreKeys.map((k) => ({ value: t(`genres.${k}`), label: t(`genres.${k}`) })),
);

watch(
  () => open.value,
  (v) => {
    if (v && ws.book) {
      title.value = ws.book.meta.title;
      author.value = ws.book.meta.author;
      genre.value = ws.book.meta.genre;
      description.value = ws.book.meta.description;
    }
  },
);

function close() {
  if (submitting.value) return;
  open.value = false;
}

async function submit() {
  if (!title.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    await ws.updateBookMeta({
      title: title.value,
      author: author.value,
      genre: genre.value,
      description: description.value,
    });
    open.value = false;
    ui.showToast(t("editBook.updatedToast"));
  } catch {
    /* error handled by store */
  } finally {
    submitting.value = false;
  }
}

function openDialog() {
  open.value = true;
}

defineExpose({ openDialog });
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("editBook.title") }}</DialogTitle>
        <DialogDescription>{{ t("editBook.desc") }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <Label>{{ t("editBook.name") }}</Label>
          <Input v-model="title" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("editBook.author") }}</Label>
          <Input v-model="author" :placeholder="t('editBook.authorPlaceholder')" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("editBook.genre") }}</Label>
          <Select v-model="genre">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="g in genres" :key="g.value" :value="g.value">{{ g.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-2">
          <Label>{{ t("editBook.intro") }}</Label>
          <Textarea v-model="description" rows="3" :placeholder="t('editBook.introPlaceholder')" />
        </div>
        <p v-if="ws.error" class="text-sm text-destructive">{{ ws.error }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">{{ t("editBook.cancel") }}</Button>
        <Button :disabled="submitting || !title.trim()" @click="submit">
          {{ submitting ? t("editBook.saving") : t("editBook.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
