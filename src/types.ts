export interface BookMeta {
  id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settingsVersion: number;
}

export interface BookSummary extends BookMeta {
  dir: string;
}

export interface ChapterInfo {
  path: string;
  title: string;
  order: number;
  wordCount: number;
  lastModified: number;
}

export interface Book {
  meta: BookMeta;
  outline: string;
  characters: string;
  timeline: string;
  chapters: ChapterInfo[];
}

export interface WorkspaceInfo {
  path: string;
  name: string;
  books: BookSummary[];
}

export interface NewBookInput {
  title: string;
  author: string;
  genre: string;
  description: string;
}

export interface CreateBookResult {
  meta: BookMeta;
  dir: string;
}

export interface SearchHit {
  bookDir: string;
  bookTitle: string;
  chapterPath: string;
  chapterTitle: string;
  line: number;
  col: number;
  snippet: string;
}
