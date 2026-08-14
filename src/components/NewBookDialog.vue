<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "../stores/workspace";
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
const title = ref("");
const author = ref("");
const genre = ref(t("genres.novel"));
const description = ref("");
const submitting = ref(false);
const genreKeys = ["novel", "prose", "essay", "short", "script", "other"] as const;
const genres = computed(() =>
  genreKeys.map((k) => ({ value: t(`genres.${k}`), label: t(`genres.${k}`) })),
);

async function submit() {
  if (!title.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    await ws.createBook({
      title: title.value,
      author: author.value,
      genre: genre.value,
      description: description.value,
    });
    title.value = "";
    author.value = "";
    description.value = "";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="ws.newBookDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("newBook.title") }}</DialogTitle>
        <DialogDescription>{{ t("newBook.desc") }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <Label>{{ t("newBook.name") }}</Label>
          <Input v-model="title" :placeholder="t('newBook.namePlaceholder')" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("newBook.author") }}</Label>
          <Input v-model="author" :placeholder="t('newBook.authorPlaceholder')" />
        </div>
        <div class="grid gap-2">
          <Label>{{ t("newBook.genre") }}</Label>
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
          <Label>{{ t("newBook.intro") }}</Label>
          <Textarea v-model="description" rows="3" :placeholder="t('newBook.introPlaceholder')" />
        </div>
        <p v-if="ws.error" class="text-sm text-destructive">{{ ws.error }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="ws.closeNewBook()">{{ t("newBook.cancel") }}</Button>
        <Button :disabled="submitting || !title.trim()" @click="submit">
          {{ submitting ? t("newBook.creating") : t("newBook.create") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
