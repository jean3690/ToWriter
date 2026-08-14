# ToWriter 插件市场

ToWriter 的插件市场支持两种来源：

1. **本地市场**：把插件目录放到系统应用数据目录的 `market/` 下。
2. **GitHub 市场**：把一份「索引 JSON」放到任意 GitHub 仓库里，粘贴 raw 地址即可浏览、安装远端插件。

---

## GitHub 市场

### 1. 索引文件（plugins.json）

在 GitHub 仓库里放一个 JSON 索引（任意文件名），例如仓库根目录的 `plugins.json`：

```json
{
  "name": "我的插件索引",
  "description": "描述（可选）",
  "plugins": [
    {
      "name": "grammar-hint",
      "displayName": "中文语法提示",
      "version": "0.1.0",
      "publisher": "my-name",
      "description": "一句话介绍",
      "repo": "my-name/my-plugins",
      "path": "plugins/grammar-hint",
      "branch": "main"
    }
  ]
}
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✓ | 插件标识（目录名） |
| `displayName` |  | 展示名，缺省用 `name` |
| `version` |  | 展示版本号 |
| `publisher` |  | 发布者 |
| `description` |  | 一句话介绍 |
| `repo` | ✓ | GitHub 仓库，格式 `owner/repo` |
| `path` | ✓ | 仓库内插件目录（含 manifest.json 的目录） |
| `branch` |  | 分支，默认 `main` |

### 2. 插件目录结构

远端插件与本地插件结构一致，必须包含 `manifest.json` 和一个入口 JS：

```
plugins/grammar-hint/
├── manifest.json
└── main.js
```

`manifest.json` 示例：

```json
{
  "name": "grammar-hint",
  "displayName": "中文语法提示",
  "version": "0.1.0",
  "publisher": "my-name",
  "main": "main.js",
  "engines": { "towriter": "^0.1.0" },
  "contributes": {
    "commands": [
      { "command": "grammarHint.check", "title": "语法检查", "category": "校对" }
    ],
    "views": [
      { "id": "grammarHint.help", "title": "说明" }
    ]
  }
}
```

### 3. 在应用中使用

1. 打开「插件 → 市场」。
2. 粘贴索引的 **raw 地址**（如 `https://raw.githubusercontent.com/owner/repo/main/plugins.json`）到「索引地址」输入框。
3. 点「加载」，远端插件列表会显示出来。
4. 点「安装」→ 应用会用 GitHub API 列出插件目录文件，逐个下载到工作区 `plugins/` 下，然后自动重载。

安装通过 `raw.githubusercontent.com` 下载、写入工作区 `plugins/<name>/`，与本地插件完全一致。

### 获取 raw 地址

在 GitHub 仓库页打开 `plugins.json`，点右上角 **Raw** 按钮，浏览器地址栏的 URL 就是 raw 地址。

---

## 本地市场

点击市场面板的「打开市场目录」，把插件目录（含 `manifest.json`）放进去，点「刷新」即可出现在本地市场列表。

---

## 内置示例

`public/sample-plugins.json` 是一份可参考的索引模板；`src-tauri/resources/plugins/` 下有内置插件源码（`word-count-pro`、`ai-prompt-pack`、`grammar-hint`），可直接复制到自己的仓库作为远端插件。
