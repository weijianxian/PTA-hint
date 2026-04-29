# PTA Hint

> PTA (pintia.cn) 编程题辅助工具 —— 题目提取、答案读写、AI 代码生成

## 这是什么

一个油猴脚本，跑在 PTA 考试/作业页面上。干三件事：

1. **提取题目** — 把页面上的题目内容（包括图片、公式、代码块、样例）转成干净的 Markdown
2. **读写答案** — 读取编辑器里已有的代码，或者往编辑器里写入代码
3. **AI 生成** — 接入 OpenAI 兼容 API，让 AI 看完题目直接把答案塞进编辑器

适配 PC 端和移动端布局，处理了 KaTeX 数学公式去重、CodeMirror 6 编辑器读写等细节。

## 安装

需要 [Tampermonkey](https://www.tampermonkey.net/) 或同类油猴扩展。

1. 打开 Tampermonkey 管理面板
2. 新建脚本，把 `pta-problem-reader.user.js` 的内容粘贴进去
3. 保存，刷新 PTA 页面

页面右下角会出现两个悬浮按钮：📋（主功能）和 ⚙（设置）。

## 功能

### 题目提取（📋）

点击 📋 按钮，脚本会自动定位题目区域，递归遍历 DOM 节点，输出结构化的 Markdown：

- 标题、段落、列表、表格、引用块
- 行内格式（加粗、斜体、代码、链接、上下标、删除线）
- 图片（保留原始 URL）
- 代码块（自动识别语言标签）
- KaTeX 数学公式（从 `<annotation>` 提取 LaTeX 源码，避免重复）
- 自动检测当前答题编程语言

输出到弹窗里，支持一键复制。

### 答案读写

- **读取**：自动检测 CodeMirror 6 编辑器中的已有代码，显示在弹窗的"已有答案"区域
- **写入**：点击"写入答案"按钮，将代码写入编辑器（通过 `execCommand` 触发 CM6 的输入处理链，确保内部状态同步）

### AI 生成

接入 OpenAI 兼容 API（DeepSeek、Ollama、本地部署的模型都行），流程：

1. 提取题目 Markdown
2. 填充 prompt 模板（支持变量替换）
3. 调用 API
4. 清理返回的代码围栏
5. 写入编辑器

点击"AI 生成"按钮即可，按钮会显示加载状态。

## 配置

点击 ⚙ 按钮打开设置面板：

| 字段 | 说明 |
|------|------|
| API Endpoint | OpenAI 兼容的接口地址，默认 `https://api.openai.com/v1/chat/completions` |
| API Key | 你的 API 密钥 |
| Model | 模型名称，如 `gpt-4o-mini`、`deepseek-coder` 等 |
| System Prompt | 系统提示词，定义 AI 角色 |
| User Prompt 模板 | 用户消息模板，支持变量替换 |

### 模板变量

在 User Prompt 中可以使用以下变量，脚本会在调用 API 时自动替换：

| 变量 | 含义 |
|------|------|
| `{question}` | 提取的题目内容（Markdown） |
| `{target_language}` | 当前编程语言（如 `Python (python3)`） |
| `{current_answer}` | 编辑器中已有的代码 |

默认模板不包含 `{current_answer}`，因为生成新答案时通常不需要已有代码。需要时自行在模板中加入。

配置通过 `GM_setValue` 持久化存储，跨页面、跨会话有效。

## 兼容性

- **平台**：pintia.cn / www.pintia.cn
- **布局**：PC 端和移动端（通过多 XPath 回退适配）
- **编辑器**：CodeMirror 6（contenteditable 模式）
- **数学公式**：KaTeX（从 `<annotation>` 提取，避免 mathml/html 重复）
- **API**：任何 OpenAI 兼容格式的接口

## 技术细节

### DOM → Markdown 转换

递归遍历题目容器的子元素，按标签类型分发处理：

- `h1`-`h6` → `# ... ######`
- `p` → 递归处理内联元素
- `ul`/`ol` → `- ` / `1. `
- `table` → GFM 表格语法
- `div` → 判断是否为叶子代码块（`data-code`、`.cm-editor`），是则提取代码，否则递归子元素
- `.katex` → 从 `annotation` 取 LaTeX 源

### CodeMirror 6 读写

- **读取**：查询 `.cm-line` 元素，逐行取 `textContent`，拼接为完整代码
- **写入**：`focus()` → `execCommand('selectAll')` → `execCommand('insertText')`，触发 CM6 的输入事件处理

## 项目结构

```
pta-problem-reader.user.js   # 油猴脚本主体
```

单文件，无构建步骤，无依赖。

## License

随便用。
