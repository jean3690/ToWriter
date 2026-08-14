import { invoke } from "@tauri-apps/api/core";
import type {
  Book,
  BookMeta,
  ChapterInfo,
  CreateBookResult,
  NewBookInput,
  SearchHit,
  WorkspaceInfo,
} from "../types";

export const bookService = {
  openWorkspace(path: string): Promise<WorkspaceInfo> {
    return invoke("open_workspace", { path });
  },
  createWorkspace(path: string, name: string): Promise<WorkspaceInfo> {
    return invoke("create_workspace", { path, name });
  },
  createBook(workspace: string, input: NewBookInput): Promise<CreateBookResult> {
    return invoke("create_book", { workspace, input });
  },
  readBook(workspace: string, bookDir: string): Promise<Book> {
    return invoke("read_book", { workspace, bookDir });
  },
  readChapter(workspace: string, bookDir: string, chapterPath: string): Promise<string> {
    return invoke("read_chapter", { workspace, bookDir, chapterPath });
  },
  writeChapter(workspace: string, bookDir: string, chapterPath: string, content: string): Promise<void> {
    return invoke("write_chapter", { workspace, bookDir, chapterPath, content });
  },
  createChapter(workspace: string, bookDir: string, title: string): Promise<ChapterInfo> {
    return invoke("create_chapter", { workspace, bookDir, title });
  },
  deleteChapter(workspace: string, bookDir: string, chapterPath: string): Promise<void> {
    return invoke("delete_chapter", { workspace, bookDir, chapterPath });
  },
  writeBookDoc(workspace: string, bookDir: string, doc: string, content: string): Promise<void> {
    return invoke("write_book_doc", { workspace, bookDir, doc, content });
  },
  readWorkspaceFile(workspace: string, relPath: string): Promise<string> {
    return invoke("read_workspace_file", { workspace, relPath });
  },
  writeWorkspaceFile(workspace: string, relPath: string, content: string): Promise<void> {
    return invoke("write_workspace_file", { workspace, relPath, content });
  },
  searchWorkspace(workspace: string, query: string): Promise<SearchHit[]> {
    return invoke("search_workspace", { workspace, query });
  },
  exportBookMarkdown(workspace: string, bookDir: string, outPath: string): Promise<void> {
    return invoke("export_book_markdown", { workspace, bookDir, outPath });
  },
  exportBookHtml(workspace: string, bookDir: string, outPath: string): Promise<void> {
    return invoke("export_book_html", { workspace, bookDir, outPath });
  },
  exportBookPdf(workspace: string, bookDir: string, outPath: string): Promise<void> {
    return invoke("export_book_pdf", { workspace, bookDir, outPath });
  },
  deleteBook(workspace: string, bookDir: string): Promise<void> {
    return invoke("delete_book", { workspace, bookDir });
  },
  updateBookMeta(
    workspace: string,
    bookDir: string,
    patch: { title: string; author: string; genre: string; description: string },
  ): Promise<BookMeta> {
    return invoke("update_book_meta", { workspace, bookDir, ...patch });
  },
  renameChapter(workspace: string, bookDir: string, chapterPath: string, newTitle: string): Promise<ChapterInfo> {
    return invoke("rename_chapter", { workspace, bookDir, chapterPath, newTitle });
  },
  moveChapter(workspace: string, bookDir: string, chapterPath: string, delta: number): Promise<ChapterInfo[]> {
    return invoke("move_chapter", { workspace, bookDir, chapterPath, delta });
  },
};
