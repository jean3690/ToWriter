use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const CHAPTERS_DIR: &str = "chapters";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookMeta {
    pub id: String,
    pub title: String,
    pub author: String,
    pub genre: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings_version: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSummary {
    #[serde(flatten)]
    pub meta: BookMeta,
    pub dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookResult {
    pub meta: BookMeta,
    pub dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterInfo {
    pub path: String,
    pub title: String,
    pub order: u32,
    pub word_count: usize,
    pub last_modified: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookData {
    pub meta: BookMeta,
    pub outline: String,
    pub characters: String,
    pub timeline: String,
    pub chapters: Vec<ChapterInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewBookInput {
    pub title: String,
    pub author: String,
    pub genre: String,
    pub description: String,
}

fn books_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("books")
}

pub fn book_path(workspace: &str, book_dir: &str) -> PathBuf {
    books_dir(workspace).join(book_dir)
}

/// 词法规范化路径（解析 `.` 与 `..`），不访问文件系统。
pub fn normalize_path(path: &Path) -> PathBuf {
    use std::path::Component;
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn now_parts() -> (u64, u64) {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (d.as_secs(), u64::from(d.subsec_nanos()))
}

fn sanitize_dir_name(name: &str) -> String {
    let mut s: String = name
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\n' | '\r' => '-',
            c => c,
        })
        .collect();
    while s.ends_with('.') || s.ends_with(' ') {
        s.pop();
    }
    let stem = s
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end()
        .to_ascii_uppercase();
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "CLOCK$", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
        "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
    ];
    if RESERVED.contains(&stem.as_str()) {
        s = format!("_{}", s);
    }
    if s.is_empty() {
        s = "book".into();
    }
    while s.len() > 50 {
        s.pop();
    }
    s
}

/// 原子写入：先写临时文件再 rename，避免中途崩溃产生损坏文件。
/// 在 Windows 上，`fs::rename` 若目标已存在可能失败，这里尝试先移除目标作为兜底。
pub fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let tmp = dir.join(format!(".{}.tmp{}", file_name, std::process::id()));
    fs::write(&tmp, content).map_err(|e| format!("写入临时文件失败: {}", e))?;
    let result = fs::rename(&tmp, path);
    if result.is_err() {
        // Windows 上目标已存在时 rename 可能失败：先删除旧文件再重命名
        let _ = fs::remove_file(path);
        fs::rename(&tmp, path).map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("写入文件失败: {}", e)
        })
    } else {
        Ok(())
    }
}

pub fn read_book_meta(book_path: &Path) -> Result<BookMeta, String> {
    let raw = fs::read_to_string(book_path.join("towriter.json"))
        .map_err(|e| format!("读取 towriter.json 失败: {}", e))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析 towriter.json 失败: {}", e))
}

pub fn scan_books(workspace: &str) -> Result<Vec<BookSummary>, String> {
    let dir = books_dir(workspace);
    let mut books = Vec::new();
    if !dir.is_dir() {
        return Ok(books);
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() && path.join("towriter.json").is_file() {
            if let Ok(meta) = read_book_meta(&path) {
                let dir = path
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                books.push(BookSummary { meta, dir });
            }
        }
    }
    books.sort_by(|a, b| a.meta.title.cmp(&b.meta.title));
    Ok(books)
}

fn parse_order(filename: &str) -> u32 {
    let digits: String = filename
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse().unwrap_or(0)
}

fn read_chapter_title(path: &Path) -> String {
    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            let trimmed = line.trim_start();
            if let Some(t) = trimmed.strip_prefix("# ") {
                return t.trim().to_string();
            }
            if !trimmed.is_empty() {
                break;
            }
        }
    }
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

pub fn count_words(text: &str) -> usize {
    let mut count = 0usize;
    let mut in_word = false;
    for ch in text.chars() {
        let cp = ch as u32;
        if (0x4E00..=0x9FFF).contains(&cp) {
            count += 1;
            in_word = false;
        } else if ch.is_ascii_alphanumeric() {
            if !in_word {
                count += 1;
                in_word = true;
            }
        } else {
            in_word = false;
        }
    }
    count
}

fn chapter_info(path: &Path) -> Result<ChapterInfo, String> {
    let filename = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let title = read_chapter_title(path);
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let word_count = count_words(&content);
    let last_modified = fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(ChapterInfo {
        path: format!("{}/{}", CHAPTERS_DIR, filename),
        title,
        order: parse_order(&filename),
        word_count,
        last_modified,
    })
}

pub fn scan_chapters(book_path: &Path) -> Result<Vec<ChapterInfo>, String> {
    let dir = book_path.join(CHAPTERS_DIR);
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with('.') {
            continue; // 跳过隐藏/临时文件（如 .reorder-*、.DS_Store）
        }
        if path.is_file() && path.extension().map(|x| x == "md").unwrap_or(false) {
            if let Ok(info) = chapter_info(&path) {
                out.push(info);
            }
        }
    }
    out.sort_by_key(|c| c.order);
    Ok(out)
}

fn ensure_book(book_path: &Path) -> Result<(), String> {
    if !book_path.is_dir() {
        return Err("书籍不存在".into());
    }
    Ok(())
}

fn resolve_chapter(workspace: &str, book_dir: &str, chapter_path: &str) -> Result<PathBuf, String> {
    let book_path = book_path(workspace, book_dir);
    ensure_book(&book_path)?;
    let chapters = book_path.join(CHAPTERS_DIR);
    let full = normalize_path(&book_path.join(chapter_path));
    if !full.starts_with(normalize_path(&chapters)) {
        return Err("非法章节路径".into());
    }
    Ok(full)
}

#[tauri::command]
pub fn create_book(workspace: String, input: NewBookInput) -> Result<CreateBookResult, String> {
    let (secs, nanos) = now_parts();
    let id = format!("{}-{:06x}", secs, nanos & 0xFFFFFF);
    let base = sanitize_dir_name(&input.title);
    let dir_name = {
        let candidate = book_path(&workspace, &base);
        if candidate.exists() {
            let suffix = format!("{:06x}", nanos & 0xFFFFFF);
            format!("{}-{}", base, suffix)
        } else {
            base
        }
    };
    let book_path = book_path(&workspace, &dir_name);
    fs::create_dir_all(book_path.join(CHAPTERS_DIR)).map_err(|e| e.to_string())?;
    fs::create_dir_all(book_path.join("assets")).map_err(|e| e.to_string())?;

    let meta = BookMeta {
        id: id.clone(),
        title: input.title.trim().to_string(),
        author: input.author.trim().to_string(),
        genre: input.genre.trim().to_string(),
        description: input.description.trim().to_string(),
        created_at: secs.to_string(),
        updated_at: secs.to_string(),
        settings_version: 1,
    };
    let raw = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    atomic_write(&book_path.join("towriter.json"), &raw)?;
    atomic_write(
        &book_path.join("outline.md"),
        "# 大纲\n\n（在此编写故事大纲）\n",
    )?;
    atomic_write(
        &book_path.join("characters.md"),
        "# 人物设定\n\n（在此编写人物设定）\n",
    )?;
    atomic_write(
        &book_path.join("timeline.md"),
        "# 时间线\n\n（在此编写时间线）\n",
    )?;

    Ok(CreateBookResult {
        meta,
        dir: dir_name,
    })
}

#[tauri::command]
pub fn read_book(workspace: String, book_dir: String) -> Result<BookData, String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let meta = read_book_meta(&book_path)?;
    let read = |name: &str| fs::read_to_string(book_path.join(name)).unwrap_or_default();
    let outline = read("outline.md");
    let characters = read("characters.md");
    let timeline = read("timeline.md");
    let chapters = scan_chapters(&book_path)?;
    Ok(BookData {
        meta,
        outline,
        characters,
        timeline,
        chapters,
    })
}

#[tauri::command]
pub fn read_chapter(
    workspace: String,
    book_dir: String,
    chapter_path: String,
) -> Result<String, String> {
    let full = resolve_chapter(&workspace, &book_dir, &chapter_path)?;
    fs::read_to_string(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_chapter(
    workspace: String,
    book_dir: String,
    chapter_path: String,
    content: String,
) -> Result<(), String> {
    let full = resolve_chapter(&workspace, &book_dir, &chapter_path)?;
    atomic_write(&full, &content)
}

#[tauri::command]
pub fn create_chapter(
    workspace: String,
    book_dir: String,
    title: String,
) -> Result<ChapterInfo, String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let chapters = book_path.join(CHAPTERS_DIR);
    fs::create_dir_all(&chapters).map_err(|e| e.to_string())?;

    let mut max_order = 0u32;
    for entry in fs::read_dir(&chapters).map_err(|e| e.to_string())? {
        if let Ok(Ok(name)) = entry.map(|e| e.file_name().into_string()) {
            max_order = max_order.max(parse_order(&name));
        }
    }
    let order = max_order + 1;
    let filename = format!("{:03}-{}.md", order, sanitize_dir_name(&title));
    let path = chapters.join(&filename);
    let content = format!("# {}\n\n", title.trim());
    fs::write(&path, content).map_err(|e| e.to_string())?;
    chapter_info(&path)
}

#[tauri::command]
pub fn delete_chapter(
    workspace: String,
    book_dir: String,
    chapter_path: String,
) -> Result<(), String> {
    let full = resolve_chapter(&workspace, &book_dir, &chapter_path)?;
    fs::remove_file(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_book_doc(
    workspace: String,
    book_dir: String,
    doc: String,
    content: String,
) -> Result<(), String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    match doc.as_str() {
        "outline" | "characters" | "timeline" => {}
        _ => return Err("非法文档名".into()),
    }
    atomic_write(&book_path.join(format!("{}.md", doc)), &content)
}

#[tauri::command]
pub fn delete_book(workspace: String, book_dir: String) -> Result<(), String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    fs::remove_dir_all(&book_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_book_meta(
    workspace: String,
    book_dir: String,
    title: String,
    author: String,
    genre: String,
    description: String,
) -> Result<BookMeta, String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let mut meta = read_book_meta(&book_path)?;
    let new_title = title.trim().to_string();
    if new_title.is_empty() {
        return Err("书名不能为空".into());
    }
    meta.title = new_title;
    meta.author = author.trim().to_string();
    meta.genre = genre.trim().to_string();
    meta.description = description.trim().to_string();
    let (secs, _) = now_parts();
    meta.updated_at = secs.to_string();
    let raw = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    atomic_write(&book_path.join("towriter.json"), &raw)?;
    Ok(meta)
}

fn strip_order_prefix(filename: &str) -> String {
    let name = filename.rsplit('/').next().unwrap_or(filename);
    let digits: String = name.chars().take_while(|c| c.is_ascii_digit()).collect();
    let rest = &name[digits.len()..];
    rest.strip_prefix('-').unwrap_or(rest).to_string()
}

#[tauri::command]
pub fn rename_chapter(
    workspace: String,
    book_dir: String,
    chapter_path: String,
    new_title: String,
) -> Result<ChapterInfo, String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let chapters_dir = book_path.join(CHAPTERS_DIR);
    let full = resolve_chapter(&workspace, &book_dir, &chapter_path)?;
    let filename = full
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let title_trim = new_title.trim().to_string();
    if title_trim.is_empty() {
        return Err("章节名不能为空".into());
    }
    let new_name = format!(
        "{:03}-{}.md",
        parse_order(&filename),
        sanitize_dir_name(&title_trim)
    );
    let new_path = chapters_dir.join(&new_name);
    if new_path.exists() && new_path != full {
        return Err("同名章节已存在".into());
    }

    let mut content = fs::read_to_string(&full).map_err(|e| e.to_string())?;
    if let Some(pos) = content.find("# ") {
        if let Some(end) = content[pos..].find('\n') {
            content.replace_range(pos..pos + end, &format!("# {}", title_trim));
        } else {
            content = format!("# {}\n", title_trim);
        }
    } else {
        content = format!("# {}\n\n{}", title_trim, content);
    }

    fs::rename(&full, &new_path).map_err(|e| e.to_string())?;
    atomic_write(&new_path, &content)?;
    chapter_info(&new_path)
}

#[tauri::command]
pub fn move_chapter(
    workspace: String,
    book_dir: String,
    chapter_path: String,
    delta: i32,
) -> Result<Vec<ChapterInfo>, String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let chapters_dir = book_path.join(CHAPTERS_DIR);
    let mut chapters = scan_chapters(&book_path)?;
    let idx = chapters
        .iter()
        .position(|c| c.path == chapter_path)
        .ok_or_else(|| "章节不存在".to_string())?;
    let target = idx as i32 + delta;
    if target < 0 || target >= chapters.len() as i32 {
        return Ok(chapters);
    }
    let target = target as usize;
    chapters.swap(idx, target);

    let old_names: Vec<String> = chapters
        .iter()
        .map(|c| c.path.rsplit('/').next().unwrap_or(&c.path).to_string())
        .collect();

    let temp_names: Vec<String> = old_names
        .iter()
        .enumerate()
        .map(|(i, n)| format!(".reorder-{:03}-{}", i, n))
        .collect();

    for (i, n) in old_names.iter().enumerate() {
        fs::rename(chapters_dir.join(n), chapters_dir.join(&temp_names[i]))
            .map_err(|e| e.to_string())?;
    }
    for (i, n) in old_names.iter().enumerate() {
        let final_name = format!("{:03}-{}", i + 1, strip_order_prefix(n));
        fs::rename(
            chapters_dir.join(&temp_names[i]),
            chapters_dir.join(&final_name),
        )
        .map_err(|e| e.to_string())?;
    }
    scan_chapters(&book_path)
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn md_to_html(text: &str) -> String {
    let mut html = String::new();
    for para in text.split("\n\n") {
        let trimmed = para.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(t) = trimmed.strip_prefix("# ") {
            html.push_str(&format!("<h1>{}</h1>\n", escape_html(t.trim())));
        } else if let Some(t) = trimmed.strip_prefix("## ") {
            html.push_str(&format!("<h2>{}</h2>\n", escape_html(t.trim())));
        } else if let Some(t) = trimmed.strip_prefix("### ") {
            html.push_str(&format!("<h3>{}</h3>\n", escape_html(t.trim())));
        } else {
            let lines: Vec<String> = trimmed.lines().map(escape_html).collect();
            html.push_str(&format!("<p>{}</p>\n", lines.join("<br>")));
        }
    }
    html
}

#[tauri::command]
pub fn export_book_markdown(
    workspace: String,
    book_dir: String,
    out_path: String,
) -> Result<(), String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let meta = read_book_meta(&book_path)?;
    let chapters = scan_chapters(&book_path)?;
    let mut md = String::new();
    md.push_str(&format!("# {}\n\n", meta.title));
    if !meta.author.is_empty() {
        md.push_str(&format!("作者：{}\n\n", meta.author));
    }
    if !meta.description.is_empty() {
        md.push_str(&format!("简介：{}\n\n", meta.description));
    }
    for ch in &chapters {
        let content = fs::read_to_string(book_path.join(&ch.path)).unwrap_or_default();
        md.push_str(&format!("\n\n---\n\n{}\n", content));
    }
    atomic_write(Path::new(&out_path), &md)
}

#[tauri::command]
pub fn export_book_html(
    workspace: String,
    book_dir: String,
    out_path: String,
) -> Result<(), String> {
    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let meta = read_book_meta(&book_path)?;
    let chapters = scan_chapters(&book_path)?;
    let html = build_book_html(&book_path, &meta, &chapters);
    atomic_write(Path::new(&out_path), &html)
}

fn build_book_html(book_path: &Path, meta: &BookMeta, chapters: &[ChapterInfo]) -> String {
    let mut body = String::new();
    body.push_str(&format!("<h1>{}</h1>\n", escape_html(&meta.title)));
    if !meta.author.is_empty() {
        body.push_str(&format!(
            "<p class=\"meta\">作者：{}</p>\n",
            escape_html(&meta.author)
        ));
    }
    if !meta.description.is_empty() {
        body.push_str(&format!(
            "<p class=\"meta\">简介：{}</p>\n",
            escape_html(&meta.description)
        ));
    }
    for ch in chapters {
        let content = fs::read_to_string(book_path.join(&ch.path)).unwrap_or_default();
        body.push_str(&format!("<h2>{}</h2>\n", escape_html(&ch.title)));
        body.push_str(&md_to_html(&content));
    }
    format!(
        "<!DOCTYPE html>\n<html lang=\"zh\">\n<head>\n<meta charset=\"utf-8\">\n<title>{}</title>\n<style>\nbody {{ font-family: {font_stack}; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.9; color: #222; }}\nh1 {{ margin-top: 0.2em; }}\nh2 {{ margin-top: 1.6em; }}\np.meta {{ color: #666; font-size: 0.95em; }}\n</style>\n</head>\n<body>\n{}\n</body>\n</html>\n",
        escape_html(&meta.title),
        body,
        font_stack = FONT_STACK,
    )
}

/// 生成 PDF 时使用的字体名：优先「托写的内嵌字体」，找不到则退回系统衬线字体。
const FONT_STACK: &str =
    "\"Towriter CJK\", \"Noto Serif CJK SC\", \"Source Han Serif SC\", \"SimSun\", serif";

/// 跨平台搜索系统中可用的 CJK 字体文件，返回 (注册名, 字节)。
fn find_cjk_font_bytes() -> Option<(String, Vec<u8>)> {
    let candidates: &[&str] = &[
        // Linux
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        // macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        // Windows
        "C:\\Windows\\Fonts\\msyh.ttc",
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\simsun.ttc",
    ];
    for p in candidates {
        if let Ok(bytes) = fs::read(p) {
            if bytes.len() > 1024 {
                return Some(("Towriter CJK".to_string(), bytes));
            }
        }
    }
    None
}

#[tauri::command]
pub fn export_book_pdf(
    workspace: String,
    book_dir: String,
    out_path: String,
) -> Result<(), String> {
    use printpdf::{Base64OrRaw, GeneratePdfOptions, PdfDocument, PdfSaveOptions};
    use std::collections::BTreeMap;

    let book_path = book_path(&workspace, &book_dir);
    ensure_book(&book_path)?;
    let meta = read_book_meta(&book_path)?;
    let chapters = scan_chapters(&book_path)?;

    let html = build_book_html(&book_path, &meta, &chapters);

    let mut fonts = BTreeMap::new();
    if let Some((name, bytes)) = find_cjk_font_bytes() {
        fonts.insert(name, Base64OrRaw::Raw(bytes));
    }

    let options = GeneratePdfOptions {
        page_width: Some(210.0),
        page_height: Some(297.0),
        margin_top: Some(25.0),
        margin_bottom: Some(25.0),
        margin_left: Some(25.0),
        margin_right: Some(25.0),
        show_page_numbers: Some(true),
        footer_text: Some(format!("{} · 第 {{page}} / {{pages}} 页", meta.title)),
        ..Default::default()
    };

    let mut warnings = Vec::new();
    let doc = PdfDocument::from_html(&html, &BTreeMap::new(), &fonts, &options, &mut warnings)
        .map_err(|e| format!("PDF 渲染失败: {}", e))?;
    let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());
    atomic_write_bytes(Path::new(&out_path), &bytes)
}

/// 原子写入二进制内容（PDF 等非 UTF-8 文件）。
pub fn atomic_write_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let tmp = dir.join(format!(".{}.tmp{}", file_name, std::process::id()));
    fs::write(&tmp, bytes).map_err(|e| format!("写入临时文件失败: {}", e))?;
    let result = fs::rename(&tmp, path);
    if result.is_err() {
        let _ = fs::remove_file(path);
        fs::rename(&tmp, path).map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("写入文件失败: {}", e)
        })
    } else {
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup(tmp: &Path) -> PathBuf {
        let ws = tmp.join("ws");
        let book = ws.join("books").join("test");
        fs::create_dir_all(book.join("chapters")).unwrap();
        let meta = BookMeta {
            id: "1".into(),
            title: "t".into(),
            author: "".into(),
            genre: "小说".into(),
            description: "".into(),
            created_at: "0".into(),
            updated_at: "0".into(),
            settings_version: 1,
        };
        fs::write(
            book.join("towriter.json"),
            serde_json::to_string_pretty(&meta).unwrap(),
        )
        .unwrap();
        for i in 1..=3 {
            fs::write(
                book.join("chapters").join(format!("{:03}-第{}章.md", i, i)),
                format!("# 第{}章\n\n内容{}", i, i),
            )
            .unwrap();
        }
        book
    }

    #[test]
    fn test_move_down_renumbers() {
        let tmp = std::env::temp_dir().join(format!("tw-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let book = setup(&tmp);
        let ws = tmp.join("ws");
        let ws_s = ws.to_string_lossy().to_string();
        let book_s = "test".to_string();

        let chapters = move_chapter(
            ws_s.clone(),
            book_s.clone(),
            "chapters/001-第1章.md".into(),
            1,
        )
        .unwrap();
        assert_eq!(chapters.len(), 3);
        assert_eq!(chapters[0].title, "第2章");
        assert_eq!(chapters[1].title, "第1章");
        // file names reflect new order
        let names: Vec<String> = chapters
            .iter()
            .map(|c| c.path.rsplit('/').next().unwrap().to_string())
            .collect();
        assert_eq!(names[0], "001-第2章.md");
        assert_eq!(names[1], "002-第1章.md");
        assert_eq!(names[2], "003-第3章.md");
        // content preserved
        let c1 = fs::read_to_string(book.join("chapters/001-第2章.md")).unwrap();
        assert!(c1.contains("# 第2章"));

        // move first up (no-op)
        let chapters = move_chapter(
            ws_s.clone(),
            book_s.clone(),
            "chapters/001-第2章.md".into(),
            -1,
        )
        .unwrap();
        assert_eq!(chapters[0].title, "第2章");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_sanitize_dir_name_windows_safe() {
        assert_eq!(sanitize_dir_name("CON"), "_CON"); // Windows 保留设备名
        assert_eq!(sanitize_dir_name("aux.txt"), "_aux.txt");
        assert_eq!(sanitize_dir_name("nul"), "_nul");
        assert_eq!(sanitize_dir_name("COM1"), "_COM1");
        // 非法字符被替换为 -
        assert_eq!(sanitize_dir_name("a/b\\c:d*e"), "a-b-c-d-e");
        // 去除首尾空白与尾部点/空格（Windows 不允许）
        assert_eq!(sanitize_dir_name("  我的书  "), "我的书");
        assert_eq!(sanitize_dir_name("第一章. "), "第一章");
        assert_eq!(sanitize_dir_name("  "), "book"); // 空退化为 book
                                                     // 超长截断仍为合法 UTF-8
        let long = "很".repeat(80);
        let s = sanitize_dir_name(&long);
        assert!(s.len() <= 50);
        assert!(s.chars().all(|c| c == '很'));
    }

    #[test]
    fn test_atomic_write_and_hidden_filter() {
        let tmp = std::env::temp_dir().join(format!("tw-atomic-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let book = setup(&tmp);
        let chapters = book.join("chapters");

        // 隐藏/临时文件不应被扫描为章节
        fs::write(chapters.join(".reorder-000-001-第一章.md"), "# 第一章").unwrap();
        fs::write(chapters.join(".DS_Store"), "junk").unwrap();
        let list = scan_chapters(&book).unwrap();
        assert_eq!(list.len(), 3, "隐藏文件不应被当成章节");

        // 原子写入覆盖旧内容且保留读取
        atomic_write(&chapters.join("001-第1章.md"), "# 第1章\n\n修改后的内容").unwrap();
        let content = fs::read_to_string(chapters.join("001-第1章.md")).unwrap();
        assert!(content.contains("修改后的内容"));
        assert!(
            !chapters.join(".001-第1章.md.tmp").exists(),
            "临时文件应被清理"
        );

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_export_pdf_generates_valid_file() {
        let tmp = std::env::temp_dir().join(format!("tw-pdf-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        setup(&tmp);
        let ws = tmp.join("ws");
        let ws_s = ws.to_string_lossy().to_string();
        let book_s = "test".to_string();
        let out = tmp.join("out.pdf");
        let out_s = out.to_string_lossy().to_string();

        let res = export_book_pdf(ws_s, book_s, out_s);
        assert!(res.is_ok(), "PDF export failed: {:?}", res.err());
        let bytes = fs::read(&out).unwrap();
        assert!(bytes.starts_with(b"%PDF"), "output is not a PDF");
        assert!(bytes.len() > 1000, "PDF too small: {} bytes", bytes.len());

        // 反向解析 PDF，验证中文文本确实写入
        use printpdf::{PdfDocument, PdfParseOptions};
        let mut warnings = Vec::new();
        let doc = PdfDocument::parse(&bytes, &PdfParseOptions::default(), &mut warnings)
            .unwrap_or_else(|e| panic!("parse pdf failed: {}", e));
        let text: Vec<String> = doc.extract_text().into_iter().flatten().collect();
        let joined = text.join("\n");
        assert!(
            joined.contains("第1章"),
            "CJK title missing from PDF text: {}",
            joined
        );

        let _ = fs::remove_dir_all(&tmp);
    }
}
