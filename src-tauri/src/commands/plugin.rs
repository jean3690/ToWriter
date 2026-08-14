use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// ToWriter 宿主版本，用于 `engines.towriter` 兼容性判断。
pub const HOST_VERSION: &str = "0.1.0";

/// 对 `^x.y.z`、`x.y.z`、`>=x.y.z`、`>x.y.z` 这类常见范围做轻量兼容判断。
/// 若无法解析则按宽松处理（视为兼容）。
fn satisfies_engine(range: &str, host: &str) -> bool {
    let range = range.trim();
    if range.is_empty() {
        return true;
    }
    let parse = |v: &str| -> Option<(u32, u32, u32)> {
        let trimmed = v.trim_start_matches(['v', 'V']);
        if trimmed.is_empty() {
            return None;
        }
        let parts: Vec<&str> = trimmed.split('.').take(3).collect();
        if parts
            .iter()
            .any(|p| p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()))
        {
            return None;
        }
        let a = parts[0].parse::<u32>().ok()?;
        let b = match parts.get(1) {
            Some(p) => p.parse::<u32>().ok()?,
            None => 0,
        };
        let c = match parts.get(2) {
            Some(p) => p.parse::<u32>().ok()?,
            None => 0,
        };
        Some((a, b, c))
    };
    let Some((hmaj, hmin, hpatch)) = parse(host) else {
        return true;
    };

    // 分离运算符（>= / > / ^ / 精确）与版本号
    let (op, version_part) = if let Some(rest) = range.strip_prefix(">=") {
        (1u8, rest)
    } else if let Some(rest) = range.strip_prefix('>') {
        (2u8, rest)
    } else if let Some(rest) = range.strip_prefix('^') {
        (3u8, rest)
    } else {
        (4u8, range)
    };
    let Some((maj, min, patch)) = parse(version_part) else {
        return true;
    };

    match op {
        1 => (hmaj, hmin, hpatch) >= (maj, min, patch),
        2 => (hmaj, hmin, hpatch) > (maj, min, patch),
        3 => hmaj == maj && (hmin, hpatch) >= (min, patch),
        _ => (hmaj, hmin, hpatch) == (maj, min, patch),
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PluginManifest {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub publisher: String,
    pub main: String,
    pub engines: serde_json::Value,
    pub contributes: Contributes,
    pub dir: String,
    /// 引擎兼容性：`engines.towriter` 是否满足当前宿主版本
    pub compatible: bool,
}

impl Default for PluginManifest {
    fn default() -> Self {
        Self {
            name: String::new(),
            display_name: String::new(),
            version: String::new(),
            publisher: String::new(),
            main: String::new(),
            engines: serde_json::Value::Null,
            contributes: Contributes::default(),
            dir: String::new(),
            compatible: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Contributes {
    pub commands: Vec<CommandContribution>,
    pub views: Vec<ViewContribution>,
    pub keybindings: Vec<KeybindingContribution>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CommandContribution {
    pub command: String,
    pub title: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ViewContribution {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct KeybindingContribution {
    pub command: String,
    pub key: String,
}

#[tauri::command]
pub fn scan_plugins(workspace: String) -> Result<Vec<PluginManifest>, String> {
    let plugins_dir = PathBuf::from(&workspace).join("plugins");
    let mut out = Vec::new();
    if !plugins_dir.is_dir() {
        return Ok(out);
    }
    for entry in fs::read_dir(&plugins_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dir = entry.path();
        let manifest_path = dir.join("manifest.json");
        if !dir.is_dir() || !manifest_path.is_file() {
            continue;
        }
        let raw = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("读取 {} 失败: {}", manifest_path.display(), e))?;
        let mut manifest: PluginManifest = serde_json::from_str(&raw)
            .map_err(|e| format!("解析 {} 失败: {}", manifest_path.display(), e))?;
        manifest.dir = dir.to_string_lossy().to_string();
        let engine_req = manifest
            .engines
            .as_object()
            .and_then(|m| m.get("towriter"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        manifest.compatible = satisfies_engine(engine_req, HOST_VERSION);
        out.push(manifest);
    }
    Ok(out)
}

#[tauri::command]
pub fn read_plugin_source(dir: String, main: String) -> Result<String, String> {
    let base = PathBuf::from(&dir);
    let file = super::book::normalize_path(&base.join(&main));
    if !file.starts_with(&base) {
        return Err("非法插件路径".into());
    }
    fs::read_to_string(&file).map_err(|e| format!("读取插件文件失败: {}", e))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketPlugin {
    pub manifest: PluginManifest,
    pub dir: String,
}

fn market_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("market"))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            fs::copy(&path, &target)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn scan_market(app: tauri::AppHandle) -> Result<Vec<MarketPlugin>, String> {
    let dir = market_dir(&app)?;
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let raw = match fs::read_to_string(p.join("manifest.json")) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        if let Ok(mut manifest) = serde_json::from_str::<PluginManifest>(&raw) {
            manifest.dir = p.to_string_lossy().to_string();
            let engine_req = manifest
                .engines
                .as_object()
                .and_then(|m| m.get("towriter"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            manifest.compatible = satisfies_engine(engine_req, HOST_VERSION);
            out.push(MarketPlugin {
                manifest,
                dir: p.to_string_lossy().to_string(),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn install_market_plugin(
    app: tauri::AppHandle,
    plugin_name: String,
    workspace: String,
) -> Result<(), String> {
    // plugin_name 必须是一个单层目录名，避免路径穿越
    if plugin_name.is_empty()
        || plugin_name.contains(['/', '\\'])
        || plugin_name == "."
        || plugin_name == ".."
        || plugin_name.contains("..")
    {
        return Err("非法的插件名".into());
    }
    let market = market_dir(&app)?;
    let src = market.join(&plugin_name);
    if !src.join("manifest.json").is_file() {
        return Err(format!("市场中没有插件: {}", plugin_name));
    }
    let dst = PathBuf::from(&workspace).join("plugins").join(&plugin_name);
    if dst.exists() {
        return Err(format!("插件已存在: {}", plugin_name));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    copy_dir_recursive(&src, &dst).map_err(|e| format!("安装失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn open_market_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = market_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    tauri_plugin_opener::open_path(dir, None::<String>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ensure_example_plugin(workspace: String) -> Result<(), String> {
    let plugins_dir = PathBuf::from(&workspace).join("plugins");
    install_bundled_plugin(
        &plugins_dir,
        "word-count-pro",
        include_str!("../../resources/plugins/word-count-pro/manifest.json"),
        include_str!("../../resources/plugins/word-count-pro/main.js"),
    )?;
    install_bundled_plugin(
        &plugins_dir,
        "ai-prompt-pack",
        include_str!("../../resources/plugins/ai-prompt-pack/manifest.json"),
        include_str!("../../resources/plugins/ai-prompt-pack/main.js"),
    )?;
    install_bundled_plugin(
        &plugins_dir,
        "grammar-hint",
        include_str!("../../resources/plugins/grammar-hint/manifest.json"),
        include_str!("../../resources/plugins/grammar-hint/main.js"),
    )?;
    Ok(())
}

fn install_bundled_plugin(
    plugins_dir: &Path,
    name: &str,
    manifest: &str,
    main: &str,
) -> Result<(), String> {
    let target = plugins_dir.join(name);
    if target.join("manifest.json").exists() {
        return Ok(());
    }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    fs::write(target.join("manifest.json"), manifest).map_err(|e| e.to_string())?;
    fs::write(target.join("main.js"), main).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_satisfies_engine() {
        // ^ 范围：主版本一致，次/修 ≥
        assert!(satisfies_engine("^0.1.0", "0.1.0"));
        assert!(satisfies_engine("^0.1.0", "0.1.5"));
        assert!(satisfies_engine("^0.2.0", "0.2.1"));
        assert!(!satisfies_engine("^0.2.0", "0.1.9"));
        assert!(!satisfies_engine("^1.0.0", "0.9.9"));
        // 精确匹配
        assert!(satisfies_engine("0.1.0", "0.1.0"));
        assert!(!satisfies_engine("0.1.0", "0.1.1"));
        // >= 与 >
        assert!(satisfies_engine(">=0.1.0", "0.5.0"));
        assert!(!satisfies_engine(">=0.2.0", "0.1.0"));
        assert!(satisfies_engine(">0.1.0", "0.1.1"));
        assert!(!satisfies_engine(">0.1.0", "0.1.0"));
        // 空 / 非法：宽松处理
        assert!(satisfies_engine("", "0.1.0"));
        assert!(satisfies_engine("latest", "0.1.0"));
    }

    #[test]
    fn test_scan_plugins_marks_incompatible() {
        let tmp = std::env::temp_dir().join(format!("tw-plg-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("plugins/good")).unwrap();
        fs::create_dir_all(tmp.join("plugins/bad")).unwrap();
        fs::write(
            tmp.join("plugins/good/manifest.json"),
            r#"{"name":"good","displayName":"好","version":"1.0.0","publisher":"p","main":"main.js","engines":{"towriter":"^0.1.0"},"contributes":{}}"#,
        )
        .unwrap();
        fs::write(
            tmp.join("plugins/bad/manifest.json"),
            r#"{"name":"bad","displayName":"坏","version":"1.0.0","publisher":"p","main":"main.js","engines":{"towriter":"^9.0.0"},"contributes":{}}"#,
        )
        .unwrap();
        let ws = tmp.to_string_lossy().to_string();
        let list = scan_plugins(ws).unwrap();
        assert_eq!(list.len(), 2);
        let good = list.iter().find(|m| m.name == "good").unwrap();
        let bad = list.iter().find(|m| m.name == "bad").unwrap();
        assert!(good.compatible);
        assert!(!bad.compatible);
        let _ = fs::remove_dir_all(&tmp);
    }
}
