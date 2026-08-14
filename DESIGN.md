# ToWriter — 作家 IDE 技术设计方案

> 目标：一款面向通用写作（小说 / 随笔 / 短篇 / 长文）的桌面 IDE，具备 **AI 辅助能力** 与 **VS Code 风格插件系统**。
> 技术栈：Tauri 2 + Vue 3 + TypeScript + CodeMirror 6（前端），Rust（后端宿主）。

---

## 1. 项目定位

| 维度 | 定位 |
|------|------|
| 用户 | 中文通用写作作者（小说、散文、随笔、长篇连载） |
| 核心价值 | 把「写作 - 管理 - 校对 - AI 辅助」收敛到一个 IDE 里 |
| 形态 | 桌面应用（Tauri），Markdown 为主、所见即所得的沉浸写作 |
| 差异点 | ① AI 深度整合进写作流程 ② VS Code 风格插件生态 ③ 本地优先、文件即数据 |

---

## 2. 技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| 桌面壳 | Tauri 2 | 体积小、性能好、Rust 后端可做文件系统/插件宿主 |
| UI 框架 | Vue 3 `<script setup>` + TypeScript | 现有模板，生态成熟 |
| 编辑器 | CodeMirror 6 | 类 VS Code 体验、扩展机制灵活、Markdown 高亮、虚拟滚动适合长文 |
| 状态管理 | Pinia | 项目/编辑器/AI/插件模块各自独立 store |
| 排版/导出 | Markdown + 自研渲染 | 本地优先，不引入重编辑器 |
| 插件运行 | Web Worker + postMessage 桥 | 沙箱隔离，参照 VS Code 的 Extension Host 模式 |
| AI 通信 | fetch + SSE 流式 | 兼容 OpenAI/Anthropic/Ollama 协议 |
| 文件存储 | Tauri fs 插件 + 自研 Book 数据模型 | 项目即磁盘目录，用户可随时查看/迁移 |

**编辑器为什么不选 Monaco / ProseMirror：**
- Monaco 是代码编辑器，对中文写作场景（字数统计、分章、软换行、连续写作）适配成本高，且体积大。
- ProseMirror/Tiptap 偏富文本，破坏"文件即 Markdown"的简洁性。
- CodeMirror 6 是两者中间态：纯文本 + 扩展点 + 轻量，最适合写作 IDE。

---

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端（Vue 3）                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  UI 层（布局/组件）               │    │
│  │  编辑器  资源管理器  大纲面板  AI 助手 插件面板 状态栏 │    │
│  └───────────────┬─────────────────────────────────┘    │
│                  │ 调用                                   │
│  ┌───────────────▼─────────────────────────────────┐    │
│  │             核心服务层（Pinia stores）            │    │
│  │  Workspace  Editor  AIProvider  PluginHost  Settings│  │
│  └───────┬──────────────┬──────────────┬────────────┘    │
│          │              │              │                  │
│   ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼────────┐        │
│   │ 编辑器内核  │ │  AI 客户端  │ │  插件宿主     │        │
│   │ CodeMirror │ │ (SSE流式)   │ │ (Web Worker) │        │
│   └──────┬─────┘ └──────┬─────┘ └──────┬────────┘        │
└──────────┼──────────────┼──────────────┼─────────────────┘
           │ Tauri IPC (invoke/events)   │
┌──────────▼──────────────▼──────────────▼─────────────────┐
│                    Rust 后端 (src-tauri)                 │
│  fs 读写   Book 结构管理  插件文件发现  全局搜索  配置持久化 │
└──────────────────────────────────────────────────────────┘
```

**分层原则：**
1. UI 只依赖核心服务层，不直接碰 Tauri IPC 与插件。
2. AI 客户端与插件宿主在 UI 侧仍是服务，通过 `@tauri-apps/plugin-*` 与 Rust 交互。
3. 所有 IO 走服务层封装，未来替换（例如换成纯 Web 版）只动服务层。

---

## 4. 数据模型

### 4.1 工作区（Workspace）

一个工作区 = 一个磁盘目录，包含多个"书（Book）"。

```
my-workspace/
├── books/
│   ├── 我的第一本书/
│   │   ├── towriter.json          # 书元数据（书名、作者、类型、设置版本）
│   │   ├── outline.md             # 大纲
│   │   ├── characters.md          # 人物设定
│   │   ├── timeline.md            # 时间线（一致性检查数据源）
│   │   ├── chapters/
│   │   │   ├── 001-第一章.md
│   │   │   └── ...
│   │   └── assets/                # 封面、插图、参考资料
│   └── 我的第二本书/
├── plugins/                       # 用户级插件目录
└── settings.json                  # 工作区级配置
```

### 4.2 书元数据（towriter.json）

```ts
interface BookMeta {
  id: string;
  title: string;
  author: string;
  genre: string;            // 小说/散文/随笔/短篇
  createdAt: string;
  updatedAt: string;
  settingsVersion: number;  // 一致性检查时使用的设定版本
  // 章节排序/草稿箱等派生信息由文件系统推导，不冗余存储
}
```

### 4.3 统一数据类型

```ts
type Chapter = {
  path: string;            // 磁盘相对路径
  title: string;           // 从文件首行 # 标题解析
  order: number;
  wordCount: number;
  content: string;
  lastModified: number;
};

type Book = {
  meta: BookMeta;
  outline: string;         // 原文 + 解析出的结构化大纲节点
  characters: string;      // 原始 Markdown，供 AI 上下文注入
  chapters: Chapter[];
};
```

> 设计原则：**磁盘文件是唯一事实来源**。`towriter.json` 只存轻量元数据，正文一律是 Markdown 文件，保证用户用任意编辑器都能打开写作。

---

## 5. 编辑器核心（CodeMirror 6）

### 5.1 特性清单

- Markdown 语法高亮 + 中文标点软换行
- 沉浸模式（隐藏侧栏、居中写作、行距/字号调节）
- 实时字数统计（目标字数进度，状态栏展示）
- 章节内自动生成书名、章节分隔
- 光标位置 / 选中文本可被 AI 与插件读取
- 自动保存（防抖写盘）+ 手动保存
- 全文搜索 / 章节内搜索
- 快捷键系统（可被插件贡献 keybinding）

### 5.2 扩展接口

```ts
// 编辑器对外暴露的核心钩子
interface EditorAPI {
  getDoc(): string;
  getSelection(): { text: string; from: number; to: number } | null;
  replaceSelection(text: string): void;
  insertAt(pos: number, text: string): void;
  setDoc(text: string): void;
  focus(): void;
}
```

编辑器通过 `EditorView.updateListener` 广播变更事件，供 **AI 续写**、**插件**、**字数统计** 订阅。

---

## 6. AI 子系统

### 6.1 提供商抽象层

统一接口，兼容 OpenAI / Anthropic / DeepSeek / Ollama 等：

```ts
interface AIProvider {
  id: string;
  name: string;
  // 流式对话，SSE 逐段回调
  chatStream(params: ChatParams, onToken: (t: string) => void): Promise<void>;
  completeStream(params: CompleteParams, onToken: (t: string) => void): Promise<void>;
  config: AIProviderConfig;
}

interface AIProviderConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}
```

### 6.2 四类 AI 功能

| 功能 | 触发方式 | 实现要点 |
|------|----------|----------|
| **AI 续写** | 快捷键 / 行尾触发 / 指令面板 | 注入「当前书设定 + 大纲上下文 + 上文 N 千字」拼 prompt，流式插入光标处，可中断/接受/放弃 |
| **对话助手** | 侧边栏 Chat 面板 | 全局上下文开关（携带当前章节/选中文本），支持多轮记忆，消息可一键插入正文 |
| **一致性检查** | 命令 / 保存后提示 | 读取 `characters.md`、`timeline.md`、全书章节，把「设定 + 全书内容」交给模型比对，产出缺陷清单（等级、位置、原因、建议） |
| **大纲生成** | 新建书向导 / 指令 | 根据书类型与一句话主题，生成结构化大纲 → 预览 → 一键写入 `outline.md` |

### 6.3 Prompt 组装器

所有功能共用一层"上下文收集器"，避免各处拼 prompt 失控：

```ts
interface AIContext {
  book: Book | null;
  chapter?: Chapter;
  selection?: string;
  instruction: string;        // 用户指令
  temperature?: number;
}
```

Prompt 模板集中存放在 `src/ai/prompts/`，可被插件覆盖/扩展。

### 6.4 流式输出

- 续写：令牌流入 CodeMirror 的 `replaceSelection`，实时渲染，支持 Esc 停止。
- 对话：流入 Chat 面板消息气泡。
- 一致性检查：产出结构化 JSON，前端渲染为可定位的缺陷列表（点击跳到章节位置）。

### 6.5 设置与密钥

- 密钥存 Rust 侧（`tauri-plugin-store`），不落明文到前端 store。
- 默认支持本地模型（Ollama），开箱即用无需密钥。

---

## 7. 插件系统（VS Code 风格）

### 7.1 插件形态

每个插件是一个目录，含 `manifest.json` + 一个入口 JS 文件：

```json
{
  "name": "word-counter-pro",
  "displayName": "字数统计增强",
  "version": "0.1.0",
  "publisher": "jean",
  "main": "main.js",
  "engines": { "towriter": "^0.1.0" },
  "activationEvents": ["onCommand:wordCounter.show"],
  "contributes": {
    "commands": [{ "command": "wordCounter.show", "title": "显示统计", "category": "工具" }],
    "views": [{ "id": "wordCounter.panel", "title": "统计面板", "type": "sidebar" }],
    "keybindings": [{ "command": "wordCounter.show", "key": "ctrl+shift+w" }],
    "menus": { "editor/context": ["wordCounter.show"] },
    "aiPrompts": [{ "id": "translate", "title": "翻译为英文", "template": "..." }]
  }
}
```

### 7.2 运行模型

```
┌─────────────┐   主线程消息    ┌──────────────────────┐
│  主窗口 UI  │ ◄────────────► │  Extension Host (Worker) │
│ (调用 API)  │                │  加载多个插件 main.js    │
└─────────────┘                └──────────────────────┘
       │                              │
       │ 通过暴露的 host API 订阅/调用
       ▼
  workspace / editor / window / commands / events / ai
```

- 插件跑在 **Web Worker** 沙箱里，无法直接碰 DOM 与文件系统。
- 所有能力通过 `window.toWriterAPI`（前端 bridge）或 `invoke`（Rust bridge）注入。
- 插件 API 采用 **能力白名单**（manifest 声明用到的能力，运行时按需授权）。

### 7.3 Host API（插件可用的对象）

```ts
interface ExtensionHost {
  commands: {
    register(id: string, fn: (args?: unknown) => void | Promise<void>): void;
    execute(id: string, args?: unknown): Promise<unknown>;
  };
  workspace: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    getBooks(): Promise<BookMeta[]>;
  };
  editor: {
    getDoc(): string;
    getSelection(): Selection | null;
    replaceSelection(text: string): void;
    insertAt(pos: number, text: string): void;
  };
  window: {
    registerView(contrib: ViewContribution): void;  // 向主 UI 注册侧栏面板
    showStatusBarItem(item: StatusBarItem): void;
    showMessage(msg: string): void;
  };
  ai: {
    chatStream(prompt: string, onToken: (t: string) => void): Promise<void>;
    registerPrompt(contrib: AIPromptContribution): void;  // 新增 AI 预设指令
  };
  events: {
    onDidChangeActiveChapter(cb: (chapter: Chapter) => void): Disposable;
    onDidChangeText(cb: (e: { doc: string; sel?: Selection }) => void): Disposable;
    onDidSave(cb: (chapter: Chapter) => void): Disposable;
  };
  // 生命周期
  activate(ctx: ExtensionContext): void;
  deactivate?(): void;
}
```

### 7.4 插件加载流程

1. Rust 扫描工作区 `plugins/` + 用户全局插件目录，读取 `manifest.json` 校验。
2. 前端口令 `activatePlugin(pluginDir)` 把入口脚本交给 Worker。
3. Worker 里 `import(/* @vite-ignore */ url)` 或经桥注入源码执行，调用 `activate(ctx)`。
4. 插件通过 host API 注册命令 / 面板 / 事件订阅，UI 侧同步刷新菜单与侧栏。

### 7.5 内置示例插件（验证生态）

- `word-count-pro`：状态栏字数 + 目标进度。
- `ai-prompt-pack`：注册若干 AI 预设指令（翻译、润色、人物卡生成）。
- 官方插件市场脚本（一期仅为本地目录，二期可对接 Git/下载源）。

---

## 8. UI / UX 布局

```
┌──────────────────────────────────────────────────────────────────┐
│ 标题栏（标题/保存状态）                                            │
├─────────┬──────────────────────────┬────────────┬───────────────┤
│ 活动栏   │ 侧边栏                    │  编辑器区    │  辅助面板      │
│ (文件/   │ 书列表+章节树            │  CodeMirror │ 大纲/人物/时间 │
│  搜索/   │ 插件视图                 │  写作区      │  AI 助手/插   │
│  AI)     │                         │            │  件面板        │
├─────────┴──────────────────────────┴────────────┴───────────────┤
│ 状态栏：光标位置 · 字数/目标 · 保存状态 · 模型选择 · 插件状态       │
└──────────────────────────────────────────────────────────────────┘
```

- 采用 VS Code 式可拖拽分栏，侧栏与辅助面板可折叠/切换。
- 深色/浅色主题 + 沉浸写作模式。
- 中文字体优先（思源宋体/黑体），行距与分栏宽度可调。

---

## 9. 目录结构规划

```
src/
├── main.ts
├── App.vue                     # 顶层布局（分栏容器）
├── components/                 # 通用 UI 组件
├── layouts/                    # 分栏/活动栏/状态栏布局
├── stores/                     # Pinia
│   ├── workspace.ts            # 工作区/书本管理
│   ├── editor.ts               # 编辑器状态
│   ├── ai.ts                   # AI 会话与请求状态
│   ├── plugin.ts               # 插件加载/命令注册表
│   └── settings.ts             # 用户设置
├── services/
│   ├── fs.ts                   # 文件系统封装（Tauri fs 插件）
│   ├── bookService.ts          # Book 读写/解析（章节扫描、字数统计）
│   └── search.ts               # 全文搜索
├── editor/
│   ├── index.ts                # CodeMirror 初始化
│   ├── extensions/             # 高亮、字数、软换行、沉浸模式等扩展
│   └── theme.ts
├── ai/
│   ├── types.ts
│   ├── provider.ts             # 提供商抽象 + 注册表
│   ├── clients/                # openai.ts / anthropic.ts / ollama.ts
│   ├── context.ts              # 上下文收集器（书/章节/选中/设定）
│   ├── prompts/                # 续写/对话/一致性/大纲模板
│   ├── useContinuation.ts      # 续写 hook
│   ├── useChat.ts              # 对话 hook
│   ├── useConsistencyCheck.ts  # 一致性检查 hook
│   └── useOutline.ts           # 大纲生成 hook
├── plugins/
│   ├── host.ts                 # Extension Host 桥（Worker 通信）
│   ├── worker.ts               # Worker 内执行插件
│   ├── api.ts                  # 暴露给插件的 host API 定义
│   ├── manifest.ts             # manifest 解析与校验
│   └── loader.ts               # 插件发现/生命周期
└── views/                      # 各面板组件（资源管理器、大纲、AI 助手等）

src-tauri/src/
├── main.rs
├── lib.rs                      # Tauri 命令注册
├── commands/
│   ├── workspace.rs            # 打开/新建工作区
│   ├── book.rs                 # 书/章节 CRUD
│   └── plugin.rs               # 插件目录扫描
└── store.rs                    # 安全配置存储（API key）
```

---

## 10. 里程碑

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| **M0 地基** | 工作区/书/章节数据模型 + fs 服务 + CodeMirror 集成 + 分栏布局 | 能新建书、创建/切换章节、编辑保存、字数统计 |
| **M1 AI** | 提供商抽象 + Ollama/OpenAI 客户端 + 续写/对话/一致性检查/大纲生成 | 四类 AI 功能端到端可用，流式输出流畅 |
| **M2 插件** | Extension Host + manifest + 命令/视图/事件 + 示例插件 | 第三方插件能注册命令与侧栏面板 |
| **M3 打磨** | 全文搜索、沉浸模式、导出（PDF/Markdown）、主题、设置页 | 具备可发布的最小产品形态 |
| **M4 生态** | 插件市场（本地源/下载）、AI Prompt 共享、一致性规则库 | 插件可从市场安装 |

---

## 11. 关键风险与对策

| 风险 | 对策 |
|------|------|
| 插件沙箱安全性（恶意脚本） | Worker 隔离 + 能力白名单 + manifest 声明校验 + 后续可加权限提示 |
| AI 上下文 token 超限 | 上下文收集器做智能裁剪（滑动窗口 + 设定摘要），模型支持长上下文 |
| 一致性检查质量不稳定 | 输出结构化 JSON + 前端缺陷定位；用户可标注"已忽略"形成回归基线 |
| 长文性能（万字以上章节） | CodeMirror 虚拟化 + 分章存储 + 延迟渲染大纲树 |
| 平台差异（Windows/Linux/macOS） | Tauri 跨平台 + 文件路径统一用相对路径 + CI 三平台构建 |

---

## 12. 下一步（确认后动手）

1. **M0 地基**：搭建工作区/书/章节数据模型、Tauri fs 命令、CodeMirror 编辑器、分栏布局。
2. 完成 M0 后演示，再进入 M1 AI 功能。
