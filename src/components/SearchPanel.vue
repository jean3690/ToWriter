<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "../stores/workspace";
import { useEditorStore } from "../stores/editor";
import { bookService } from "../services/bookService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchHit } from "../types";

const { t } = useI18n();
const ws = useWorkspaceStore();
const editor = useEditorStore();
const query = ref("");
const results = ref<SearchHit[]>([]);
const searching = ref(false);
const searched = ref(false);

async function search() {
  const q = query.value.trim();
  if (!q || !ws.workspace || searching.value) return;
  searching.value = true;
  searched.value = true;
  try {
    results.value = await bookService.searchWorkspace(ws.workspace.path, q);
  } finally {
    searching.value = false;
  }
}

function clear() {
  query.value = "";
  results.value = [];
  searched.value = false;
}

async function openHit(hit: SearchHit) {
  if (ws.bookDir !== hit.bookDir) {
    await ws.openBook(hit.bookDir);
  }
  const ch = ws.book?.chapters.find((c) => c.path === hit.chapterPath);
  if (ch) {
    await ws.openChapter(ch);
    editor.setReveal(hit.chapterPath, hit.line);
  }
}
</script>

<template>
  <div class="search-panel">
    <div class="search-input-row">
      <Input
        v-model="query"
        :placeholder="t('search.placeholder')"
        @keydown.enter="search"
      />
      <Button size="sm" :disabled="searching || !query.trim()" @click="search">
        {{ searching ? "…" : t("search.search") }}
      </Button>
      <Button v-if="searched" size="sm" variant="ghost" @click="clear">{{ t("search.clear") }}</Button>
    </div>

    <div v-if="searched" class="search-summary">{{ t("search.matches", { count: results.length }) }}</div>

    <ul class="search-results">
      <li v-for="(hit, i) in results" :key="i" class="search-hit" @click="openHit(hit)">
        <div class="search-hit-head">
          <span class="search-book">{{ hit.bookTitle }}</span>
          <span class="search-chapter">{{ hit.chapterTitle }}</span>
          <span class="search-line">L{{ hit.line }}</span>
        </div>
        <div class="search-snippet">{{ hit.snippet }}</div>
      </li>
    </ul>

    <div v-if="searched && results.length === 0" class="empty-hint">{{ t("search.noResult") }}</div>
  </div>
</template>
