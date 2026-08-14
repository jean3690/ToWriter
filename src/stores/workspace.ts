import { defineStore } from "pinia";
import { ask } from "@tauri-apps/plugin-dialog";
import { i18n } from "../i18n";
import { bookService } from "../services/bookService";
import { errMsg } from "../utils/error";
import { emitPluginEvent } from "../plugins/events";
import type { Book, BookSummary, ChapterInfo, NewBookInput, WorkspaceInfo } from "../types";
import { useSettingsStore } from "./settings";
import { useWritingStore } from "./writing";
import { useUiStore } from "./ui";

interface WorkspaceState {
  workspace: WorkspaceInfo | null;
  book: Book | null;
  bookDir: string | null;
  chapter: ChapterInfo | null;
  chapterContent: string;
  dirty: boolean;
  loading: boolean;
  error: string | null;
  newBookDialog: boolean;
}

export const useWorkspaceStore = defineStore("workspace", {
  state: (): WorkspaceState => ({
    workspace: null,
    book: null,
    bookDir: null,
    chapter: null,
    chapterContent: "",
    dirty: false,
    loading: false,
    error: null,
    newBookDialog: false,
  }),
  actions: {
    openNewBook() {
      this.newBookDialog = true;
    },
    closeNewBook() {
      this.newBookDialog = false;
    },

    async openWorkspace(path: string) {
      this.loading = true;
      this.error = null;
      try {
        const info = await bookService.openWorkspace(path);
        this.workspace = info;
        useSettingsStore().setLastWorkspace(path);
      } catch (e) {
        this.error = errMsg(e);
      } finally {
        this.loading = false;
      }
    },

    async createWorkspace(parent: string, name: string) {
      this.loading = true;
      this.error = null;
      try {
        const info = await bookService.createWorkspace(parent, name);
        this.workspace = info;
        useSettingsStore().setLastWorkspace(info.path);
      } catch (e) {
        this.error = errMsg(e);
      } finally {
        this.loading = false;
      }
    },

    async createBook(input: NewBookInput) {
      if (!this.workspace) return;
      this.error = null;
      try {
        const res = await bookService.createBook(this.workspace.path, input);
        const summary: BookSummary = { ...res.meta, dir: res.dir };
        this.workspace.books.push(summary);
        this.workspace.books.sort((a, b) => a.title.localeCompare(b.title));
        this.newBookDialog = false;
        await this.openBook(summary.dir);
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async openBook(bookDir: string) {
      if (!this.workspace) return;
      await this.flush();
      this.loading = true;
      this.error = null;
      try {
        const book = await bookService.readBook(this.workspace.path, bookDir);
        this.book = book;
        this.bookDir = bookDir;
        this.chapter = null;
        this.chapterContent = "";
        useSettingsStore().setLastBook(bookDir);
        if (book.chapters.length > 0) {
          await this.openChapter(book.chapters[0]);
        }
      } catch (e) {
        this.error = errMsg(e);
      } finally {
        this.loading = false;
      }
    },

    closeBook() {
      this.book = null;
      this.bookDir = null;
      this.chapter = null;
      this.chapterContent = "";
      this.dirty = false;
      useSettingsStore().setLastBook(null);
      useSettingsStore().setLastChapter(null);
    },

    async openChapter(ch: ChapterInfo) {
      if (!this.workspace || !this.bookDir) return;
      await this.flush();
      this.error = null;
      try {
        const content = await bookService.readChapter(this.workspace.path, this.bookDir, ch.path);
        this.chapter = ch;
        this.chapterContent = content;
        this.dirty = false;
        useWritingStore().setBaseline(ch.path, ch.wordCount);
        useSettingsStore().setLastChapter(ch.path);
        emitPluginEvent("onDidChangeActiveChapter", { path: ch.path, title: ch.title });
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    updateContent(content: string, wordCount: number) {
      this.chapterContent = content;
      this.dirty = true;
      if (this.chapter) this.chapter.wordCount = wordCount;
      emitPluginEvent("onDidChangeText", { path: this.chapter?.path, title: this.chapter?.title, wordCount });
    },

    async flush() {
      if (!this.dirty || !this.workspace || !this.bookDir || !this.chapter) return;
      try {
        await bookService.writeChapter(this.workspace.path, this.bookDir, this.chapter.path, this.chapterContent);
        this.dirty = false;
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async saveChapter() {
      if (!this.dirty) return;
      await this.flush();
      if (this.chapter) {
        this.chapter.lastModified = Math.floor(Date.now() / 1000);
        useWritingStore().recordDelta(this.chapter.path, this.chapter.wordCount);
        emitPluginEvent("onDidSaveChapter", { path: this.chapter.path, title: this.chapter.title });
        if (useSettingsStore().consistencyAfterSave) {
          useUiStore().showToast(i18n.global.t("store.savedConsistencyHint"), false);
        }
      }
    },

    async createChapter(title: string) {
      if (!this.workspace || !this.bookDir) return;
      this.error = null;
      try {
        const ch = await bookService.createChapter(this.workspace.path, this.bookDir, title);
        await this.reloadBook();
        await this.openChapter(ch);
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async deleteChapter(ch: ChapterInfo) {
      if (!this.workspace || !this.bookDir) return;
      const ok = await ask(i18n.global.t("store.deleteChapterBody", { title: ch.title }), {
        title: i18n.global.t("store.deleteChapterTitle"),
        kind: "warning",
        okLabel: i18n.global.t("app.delete"),
        cancelLabel: i18n.global.t("app.cancel"),
      });
      if (!ok) return;
      this.error = null;
      try {
        await bookService.deleteChapter(this.workspace.path, this.bookDir, ch.path);
        if (this.chapter?.path === ch.path) {
          this.chapter = null;
          this.chapterContent = "";
          this.dirty = false;
          useSettingsStore().setLastChapter(null);
        }
        await this.reloadBook();
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async reloadBook() {
      if (!this.workspace || !this.bookDir || !this.book) return;
      const book = await bookService.readBook(this.workspace.path, this.bookDir);
      this.book = book;
      if (this.chapter) {
        const match = book.chapters.find((c) => c.path === this.chapter!.path);
        if (match) this.chapter = match;
      }
    },

    async deleteBook(summary: BookSummary) {
      if (!this.workspace) return;
      const ok = await ask(i18n.global.t("store.deleteBookBody", { title: summary.title }), {
        title: i18n.global.t("store.deleteBookTitle"),
        kind: "warning",
        okLabel: i18n.global.t("app.delete"),
        cancelLabel: i18n.global.t("app.cancel"),
      });
      if (!ok) return;
      this.error = null;
      try {
        await bookService.deleteBook(this.workspace.path, summary.dir);
        this.workspace.books = this.workspace.books.filter((b) => b.dir !== summary.dir);
        if (this.bookDir === summary.dir) {
          this.book = null;
          this.bookDir = null;
          this.chapter = null;
          this.chapterContent = "";
          this.dirty = false;
          useSettingsStore().setLastBook(null);
          useSettingsStore().setLastChapter(null);
        }
        useUiStore().showToast(i18n.global.t("store.bookDeleted", { title: summary.title }));
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async saveBookDoc(doc: "outline" | "characters" | "timeline", content: string) {
      if (!this.workspace || !this.bookDir) return;
      this.error = null;
      try {
        await bookService.writeBookDoc(this.workspace.path, this.bookDir, doc, content);
        await this.reloadBook();
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async updateBookMeta(patch: { title: string; author: string; genre: string; description: string }) {
      if (!this.workspace || !this.bookDir || !this.book) return;
      this.error = null;
      try {
        const meta = await bookService.updateBookMeta(this.workspace.path, this.bookDir, patch);
        this.book.meta = { ...this.book.meta, ...meta };
        const summary = this.workspace.books.find((b) => b.dir === this.bookDir);
        if (summary) Object.assign(summary, meta);
        this.workspace.books.sort((a, b) => a.title.localeCompare(b.title));
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async renameChapter(ch: ChapterInfo, newTitle: string) {
      if (!this.workspace || !this.bookDir) return;
      await this.flush(); // 先把未保存内容写到旧路径，避免改名前丢内容
      this.error = null;
      try {
        const updated = await bookService.renameChapter(this.workspace.path, this.bookDir, ch.path, newTitle);
        await this.reloadBook();
        if (this.chapter?.path === ch.path) {
          const match = this.book?.chapters.find((c) => c.path === updated.path);
          if (match) await this.openChapter(match);
        }
      } catch (e) {
        this.error = errMsg(e);
      }
    },

    async moveChapter(ch: ChapterInfo, delta: number) {
      if (!this.workspace || !this.bookDir) return;
      await this.flush(); // 先落盘，防止移动后旧路径失效导致内容丢失
      this.error = null;
      try {
        const activeTitle = this.chapter?.path === ch.path ? this.chapter.title : null;
        await bookService.moveChapter(this.workspace.path, this.bookDir, ch.path, delta);
        await this.reloadBook();
        if (activeTitle && this.book) {
          const match = this.book.chapters.find((c) => c.title === activeTitle);
          if (match) await this.openChapter(match);
        }
      } catch (e) {
        this.error = errMsg(e);
      }
    },
  },
});
