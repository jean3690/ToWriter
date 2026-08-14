<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { save } from "@tauri-apps/plugin-dialog";
import { useUiStore } from "../stores/ui";
import { useWorkspaceStore } from "../stores/workspace";
import { bookService } from "../services/bookService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AiAssistant from "./AiAssistant.vue";
import PluginsPanel from "./PluginsPanel.vue";
import SearchPanel from "./SearchPanel.vue";
import EditBookDialog from "./EditBookDialog.vue";
import PromptDialog from "./PromptDialog.vue";

const { t } = useI18n();
const ui = useUiStore();
const ws = useWorkspaceStore();
const creatingChapter = ref(false);
const newChapterTitle = ref("");
const exporting = ref(false);
const editBookDialog = ref<InstanceType<typeof EditBookDialog>>();
const promptDialog = ref<InstanceType<typeof PromptDialog>>();

async function renameChapter(index: number) {
  const ch = ws.book?.chapters[index];
  if (!ch) return;
  const title = await promptDialog.value?.prompt(t("sidebar.rename"), ch.title);
  if (title && title.trim() && title.trim() !== ch.title) {
    await ws.renameChapter(ch, title.trim());
  }
}

function startCreateChapter() {
  creatingChapter.value = true;
  newChapterTitle.value = "";
}

async function submitChapter() {
  const title = newChapterTitle.value.trim();
  if (!title) return;
  await ws.createChapter(title);
  creatingChapter.value = false;
  newChapterTitle.value = "";
}

async function exportBook(kind: "md" | "html" | "pdf") {
  if (!ws.workspace || !ws.bookDir || !ws.book || exporting.value) return;
  const ext = kind === "md" ? "md" : kind === "pdf" ? "pdf" : "html";
  const path = await save({
    defaultPath: `${ws.book.meta.title}.${ext}`,
    filters:
      kind === "md"
        ? [{ name: "Markdown", extensions: ["md"] }]
        : kind === "pdf"
          ? [{ name: "PDF", extensions: ["pdf"] }]
          : [{ name: "HTML", extensions: ["html"] }],
  });
  if (!path) return;
  exporting.value = true;
  try {
    if (kind === "md") {
      await bookService.exportBookMarkdown(ws.workspace.path, ws.bookDir, path);
    } else if (kind === "pdf") {
      await bookService.exportBookPdf(ws.workspace.path, ws.bookDir, path);
    } else {
      await bookService.exportBookHtml(ws.workspace.path, ws.bookDir, path);
    }
    ui.showToast(t("sidebar.exported", { path }));
  } catch (e) {
    ui.showToast(t("sidebar.exportedFail", { err: e instanceof Error ? e.message : String(e) }), true);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <aside v-if="ui.sidebarVisible" class="sidebar">
    <template v-if="ui.activity === 'files'">
      <div class="sidebar-body">
        <div class="section-header">
          <span>{{ t("sidebar.bookShelf") }}</span>
          <Button variant="ghost" size="icon-xs" :title="t('sidebar.newBook')" @click="ws.openNewBook()">+</Button>
        </div>
        <ul class="book-list">
          <li
            v-for="b in ws.workspace?.books"
            :key="b.dir"
            :class="{ active: ws.bookDir === b.dir }"
            @click="ws.openBook(b.dir)"
          >
            <div class="book-title">{{ b.title }}</div>
            <div class="book-meta">{{ b.genre }}<template v-if="b.description"> · {{ b.description }}</template></div>
            <Button
              variant="ghost"
              size="icon-xs"
              class="chapter-del"
              :title="t('sidebar.bookDelete')"
              @click.stop="ws.deleteBook(b)"
            >
              ×
            </Button>
          </li>
        </ul>

        <template v-if="ws.book">
          <div class="section-header">
            <span>{{ t("sidebar.chapters") }}</span>
            <div class="section-actions">
              <Button variant="ghost" size="xs" :title="t('sidebar.editBookInfo')" @click="editBookDialog?.openDialog()">✎</Button>
              <Button variant="ghost" size="xs" :title="t('sidebar.exportMd')" @click="exportBook('md')">MD</Button>
              <Button variant="ghost" size="xs" :title="t('sidebar.exportHtml')" @click="exportBook('html')">HTML</Button>
              <Button variant="ghost" size="xs" :title="t('sidebar.exportPdf')" @click="exportBook('pdf')">PDF</Button>
              <Button variant="ghost" size="icon-xs" :title="t('sidebar.newChapter')" @click="startCreateChapter">+</Button>
            </div>
          </div>
          <div v-if="creatingChapter" class="px-3 pb-2">
            <Input
              v-model="newChapterTitle"
              :placeholder="t('sidebar.chapterTitle')"
              @keydown.enter="submitChapter"
              @keydown.esc="creatingChapter = false"
            />
          </div>
          <ul class="chapter-list">
            <li
              v-for="(c, i) in ws.book.chapters"
              :key="c.path"
              :class="{ active: ws.chapter?.path === c.path }"
              @click="ws.openChapter(c)"
            >
              <button class="chapter-arrow" :title="t('sidebar.moveUp')" :disabled="i === 0" @click.stop="ws.moveChapter(c, -1)">↑</button>
              <button class="chapter-arrow" :title="t('sidebar.moveDown')" :disabled="i === ws.book.chapters.length - 1" @click.stop="ws.moveChapter(c, 1)">↓</button>
              <span class="chapter-no">{{ String(c.order).padStart(2, "0") }}</span>
              <span class="chapter-title">{{ c.title }}</span>
              <span class="chapter-wc">{{ c.wordCount }}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                class="chapter-del"
                :title="t('sidebar.rename')"
                @click.stop="renameChapter(i)"
              >
                ✎
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                class="chapter-del"
                :title="t('sidebar.delete')"
                @click.stop="ws.deleteChapter(c)"
              >
                ×
              </Button>
            </li>
          </ul>
        </template>
        <div v-else class="empty">
          <span>{{ t("sidebar.noBook") }}</span>
          <Button variant="outline" size="sm" @click="ws.openNewBook()">{{ t("sidebar.newBookBtn") }}</Button>
        </div>
      </div>
    </template>

    <template v-else-if="ui.activity === 'ai'">
      <AiAssistant />
    </template>

    <template v-else-if="ui.activity === 'plugins'">
      <PluginsPanel />
    </template>

    <template v-else-if="ui.activity === 'search'">
      <SearchPanel />
    </template>
  </aside>
  <EditBookDialog ref="editBookDialog" />
  <PromptDialog ref="promptDialog" />
</template>
