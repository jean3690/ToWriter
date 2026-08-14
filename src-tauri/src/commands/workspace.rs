use serde::Serialize;
use std::fs;
use std::path::PathBuf;

use super::book::{scan_books, scan_chapters, BookSummary};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub books: Vec<BookSummary>,
}

fn books_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("books")
}

fn ensure_workspace(path: &str) -> Result<(), String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        fs::create_dir_all(&root).map_err(|e| format!("无法创建目录 {}: {}", path, e))?;
    }
    let books = books_dir(path);
    if !books.is_dir() {
        fs::create_dir_all(&books).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_workspace(path: String) -> Result<WorkspaceInfo, String> {
    ensure_workspace(&path)?;
    let name = PathBuf::from(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let books = scan_books(&path)?;
    Ok(WorkspaceInfo { path, name, books })
}

#[tauri::command]
pub fn read_workspace_file(workspace: String, rel_path: String) -> Result<String, String> {
    let root = PathBuf::from(&workspace);
    let full = super::book::normalize_path(&root.join(&rel_path));
    if !full.starts_with(&root) {
        return Err("非法路径".into());
    }
    fs::read_to_string(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_workspace_file(
    workspace: String,
    rel_path: String,
    content: String,
) -> Result<(), String> {
    let root = PathBuf::from(&workspace);
    let full = super::book::normalize_path(&root.join(&rel_path));
    if !full.starts_with(&root) {
        return Err("非法路径".into());
    }
    let dir = full.parent().ok_or("非法路径")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    super::book::atomic_write(&full, &content)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub book_dir: String,
    pub book_title: String,
    pub chapter_path: String,
    pub chapter_title: String,
    pub line: u32,
    pub col: u32,
    pub snippet: String,
}

fn char_boundary(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() && (bytes[i] & 0xC0) == 0x80 {
        i += 1;
    }
    i.min(bytes.len())
}

fn safe_slice(line: &str, start: usize, end: usize) -> String {
    let bytes = line.as_bytes();
    let s = char_boundary(bytes, start.min(bytes.len()));
    let e = char_boundary(bytes, end.min(bytes.len()));
    line[s..e].to_string()
}

#[tauri::command]
pub fn search_workspace(workspace: String, query: String) -> Result<Vec<SearchHit>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let mut hits = Vec::new();
    for book in scan_books(&workspace)? {
        let book_path = PathBuf::from(&workspace).join("books").join(&book.dir);
        for ch in scan_chapters(&book_path)? {
            let content = fs::read_to_string(book_path.join(&ch.path)).unwrap_or_default();
            for (i, line) in content.lines().enumerate() {
                let lower = line.to_lowercase();
                if let Some(pos) = lower.find(&q) {
                    let start = pos.saturating_sub(20);
                    let end = (pos + q.len() + 40).min(line.len());
                    hits.push(SearchHit {
                        book_dir: book.dir.clone(),
                        book_title: book.meta.title.clone(),
                        chapter_path: ch.path.clone(),
                        chapter_title: ch.title.clone(),
                        line: (i + 1) as u32,
                        col: (pos + 1) as u32,
                        snippet: safe_slice(line, start, end),
                    });
                    if hits.len() >= 500 {
                        return Ok(hits);
                    }
                }
            }
        }
    }
    Ok(hits)
}

#[tauri::command]
pub fn create_workspace(path: String, name: String) -> Result<WorkspaceInfo, String> {
    let trimmed = name.trim();
    let target = if trimmed.is_empty() {
        PathBuf::from(&path)
    } else {
        let candidate = PathBuf::from(&path).join(trimmed);
        if candidate.exists() {
            return Err(format!("目录已存在: {}", candidate.to_string_lossy()));
        }
        candidate
    };
    ensure_workspace(&target.to_string_lossy())?;
    let settings_path = target.join("settings.json");
    if !settings_path.exists() {
        fs::write(&settings_path, "{}\n").map_err(|e| e.to_string())?;
    }
    open_workspace(target.to_string_lossy().to_string())
}
