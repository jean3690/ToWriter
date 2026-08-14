import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest } from "../plugins/manifest";

export interface RemotePluginEntry {
  name: string;
  displayName: string;
  version: string;
  publisher: string;
  description: string;
  /** GitHub 仓库，如 "owner/repo" */
  repo: string;
  /** 仓库内插件目录，如 "plugins/grammar-hint" */
  path: string;
  /** 分支，默认 main */
  branch?: string;
}

export interface RemoteMarketIndex {
  name?: string;
  plugins: RemotePluginEntry[];
}

export interface RemotePluginItem extends RemotePluginEntry {
  /** 解析出的 manifest */
  manifest: PluginManifest;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

const RAW_PREFIX = "https://raw.githubusercontent.com";

function repoParts(repo: string): { owner: string; name: string } {
  const parts = repo.trim().replace(/^https?:\/\/(www\.)?github\.com\//, "").split("/");
  return { owner: parts[0] ?? "", name: parts[1] ?? "" };
}

/** 从任意 URL 拉取市场索引（GitHub raw / gist / 自建） */
export async function fetchRemoteIndex(url: string): Promise<RemoteMarketIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`获取索引失败 (${res.status})`);
  const data = (await res.json()) as RemoteMarketIndex;
  if (!data || !Array.isArray(data.plugins)) {
    throw new Error("索引格式不正确：缺少 plugins 数组");
  }
  return data;
}

/** 用 GitHub Contents API 列出仓库某目录下的文件 */
export async function listRepoFiles(
  repo: string,
  dirPath: string,
  branch = "main",
): Promise<GitHubContentItem[]> {
  const { owner, name } = repoParts(repo);
  if (!owner || !name) throw new Error(`仓库格式不正确：${repo}（应为 owner/repo）`);
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${dirPath}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`仓库目录不存在：${repo}/${dirPath}（分支 ${branch}）`);
    if (res.status === 403) throw new Error("GitHub API 限流（403），请稍后再试");
    throw new Error(`GitHub 请求失败 (${res.status})`);
  }
  const items = (await res.json()) as GitHubContentItem[];
  return items.filter((i) => i.type === "file");
}

/** 下载仓库内某个文件（raw.githubusercontent.com） */
export async function downloadRepoFile(
  repo: string,
  filePath: string,
  branch = "main",
): Promise<string> {
  const { owner, name } = repoParts(repo);
  const url = `${RAW_PREFIX}/${owner}/${name}/${branch}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 (${res.status}): ${filePath}`);
  return res.text();
}

/** 从远程插件条目提取插件名（目录最后一段） */
export function pluginNameFromEntry(entry: RemotePluginEntry): string {
  const parts = entry.path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? entry.name;
}

/**
 * 安装远程插件：读取目录 → 下载全部文件 → 写入工作区 plugins/。
 * 返回安装目录名。
 */
export async function installRemotePlugin(
  workspace: string,
  entry: RemotePluginEntry,
  onProgress?: (file: string) => void,
): Promise<string> {
  const branch = entry.branch || "main";
  const files = await listRepoFiles(entry.repo, entry.path, branch);
  if (files.length === 0) throw new Error("插件目录中没有文件");

  const hasManifest = files.some((f) => f.name === "manifest.json");
  if (!hasManifest) throw new Error("插件目录缺少 manifest.json");

  const pluginName = pluginNameFromEntry(entry);
  for (const file of files) {
    onProgress?.(file.name);
    const content = await downloadRepoFile(entry.repo, file.path, branch);
    const rel = `plugins/${pluginName}/${file.name}`;
    await invoke("write_workspace_file", { workspace, relPath: rel, content });
  }
  return pluginName;
}
