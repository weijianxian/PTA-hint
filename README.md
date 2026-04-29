# PTA Hint

> PTA (pintia.cn) 编程题辅助工具 —— 题目提取、答案读写、AI 解题提示

## 这是什么

一个油猴脚本，跑在 PTA 考试/作业页面上。干三件事：

1. **提取题目** — 把页面上的题目内容（包括图片、公式、代码块、样例）转成干净的 Markdown
2. **读写答案** — 读取编辑器里已有的代码，或者往编辑器里写入代码
3. **AI 提示** — 接入 OpenAI 兼容 API，分析题目和已有代码，给出下一步解题提示

适配 PC 端和移动端布局，处理了 KaTeX 数学公式去重、CodeMirror 6 编辑器读写等细节。

## 安装

需要 [Tampermonkey](https://www.tampermonkey.net/) 或同类油猴扩展。

1. 打开 Tampermonkey 管理面板
2. 新建脚本，把 `pta-problem-reader.user.js` 的内容粘贴进去
3. 保存，刷新 PTA 页面

页面右下角会出现三个悬浮按钮：📋（提取题目）、🤖（AI 提示）和 ⚙（设置）。

## 功能

### 题目提取（📋）

点击 📋 按钮，脚本会自动定位题目区域，递归遍历 DOM 节点，输出结构化的 Markdown：

- 标题、段落、列表、表格、引用块
- 行内格式（加粗、斜体、代码、链接、上下标、删除线）
- 图片（保留原始 URL）
- 代码块（自动识别语言标签）
- KaTeX 数学公式
- 自动检测当前答题编程语言

输出到弹窗里，支持一键复制。

### 答案读写

- **读取**：自动检测 CodeMirror 6 编辑器中的已有代码，显示在弹窗的"已有答案"区域
- **写入**：点击"写入答案"按钮，将代码写入编辑器（通过 `execCommand` 触发 CM6 的输入处理链，确保内部状态同步）

### AI 提示

接入 OpenAI 兼容 API（DeepSeek、Ollama、本地部署的模型都行），流程：

1. 提取题目 Markdown + 已有代码
2. 填充 prompt 模板（支持变量替换）
3. 调用 API
4. 清理返回的代码围栏
5. 写入编辑器

点击 🤖 按钮，AI 会分析题目和已有代码，**在原有代码基础上添加注释提示下一步思路**，不会修改已有代码。

首次点击会弹出警告（AI 会清除编辑器内容），支持三个选项：
- **取消**：不执行
- **确定**：本次执行，下次仍会提示
- **忽略**：记住选择，以后不再提示

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

默认模板会使用 `{current_answer}` 来分析已有代码并给出解题提示。

配置通过 `GM_setValue` 持久化存储，跨页面、跨会话有效。

## 兼容性

- **平台**：pintia.cn / www.pintia.cn
- **布局**：PC 端和移动端（通过多 XPath 回退适配）
- **编辑器**：CodeMirror 6（contenteditable 模式）
- **数学公式**：KaTeX（优先从 `<annotation>` 提取，回退从 `<mrow>` 提取避免 fallback 文本重复）
- **API**：任何 OpenAI 兼容格式的接口


## 致谢

- 小米 MiMo — 感谢小米 MiMo 100T Token 计划提供的算力支持，本项目的 AI 生成功能基于此开发调试
- 其他开源项目和社区的贡献者们