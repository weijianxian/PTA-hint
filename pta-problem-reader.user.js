// ==UserScript==
// @name         PTA 题目读取器
// @namespace    https://github.com/weijianxian/PTA-hint
// @version      1.2.0
// @description  从 PTA 平台提取题目并转换为 Markdown 格式，支持 AI 代码生成
// @author       weijianxian
// @homepage     https://github.com/weijianxian/PTA-hint
// @supportURL   https://github.com/weijianxian/PTA-hint/issues
// @match        https://pintia.cn/*
// @match        https://www.pintia.cn/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// ==================== 常量配置 ====================

// 题目容器选择器（按优先级排序）
const CONTAINER_SELECTORS = [
    'div.bg-bg-base.space-y-4',
    'div.problem-detail',
    'div.problem-body',
    'div.question-content',
    'main [class*="space-y"]',
    'main article'
];

// 回退选择器：查找包含 h3 + data-code 的 div
const FALLBACK_CRITERIA = { heading: 'h3', codeBlock: '[data-code]' };

// 标题选择器
const TITLE_SELECTOR = 'h1, h2, [class*="title"]';

// CodeMirror 相关选择器
const CODEMIRROR = {
    line: '.cm-line',
    content: '.cm-content',
    editor: '.cm-editor',
    leafClasses: ['codeEditor', 'cm-editor'],
    structuredContent: 'p, h1, h2, h3, h4, h5, h6, ul, ol, table, [data-code]'
};

// UI 元素 ID
const UI_IDS = {
    btn: 'pta-reader-btn',
    modal: 'pta-reader-modal',
    overlay: 'pta-reader-overlay',
    content: 'pta-markdown-content',
    closeBtn: 'pta-close-btn',
    cancelBtn: 'pta-cancel-btn',
    copyBtn: 'pta-copy-btn'
};

// 复制成功提示文本及持续时间
const COPY_FEEDBACK = { text: '已复制!', duration: 2000 };

// 答题编程语言选择器 XPath（PC 和手机布局不同）
const LANG_XPATHS = [
    '//*[@id="exam-app"]/div[1]/div[1]/div/main/div[2]/div/div[3]/div[1]/div[2]/div/div[1]/div[1]/div[1]/div/div[1]/div/div/div/div',
    '//*[@id="exam-app"]/div[1]/div[1]/div/main/div[2]/div/div[3]/div[2]/div[2]/div/div[1]/div[1]/div[1]/div/div[1]/div/div/div/div'
];

// 答题编程语言选择器（CSS，用于回退）
const LANG_SELECTORS = [
    '[class*="languageName"]',
    '[class*="language"] select',
    'select[class*="lang"]'
];

// 答题区代码编辑器 XPath
const ANSWER_EDITOR_XPATH = '//*[@id="exam-app"]/div[1]/div[1]/div/main/div[2]/div/div[3]/div[2]/div[2]/div/div[1]/div[2]/div';

// 答题区代码编辑器 CSS 选择器（用于回退）
const ANSWER_EDITOR_SELECTORS = [
    '.cm-content[contenteditable="true"]'
];

// AI API 配置默认值
const DEFAULT_API_CONFIG = {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
    systemPrompt: '你是一个 PTA 编程题解题助手。根据题目和已有代码，给出下一步解题提示。严格要求：不要修改已有代码的任何部分，只能在已有代码的基础上添加注释来提示下一步思路。注释应该简洁明了，指出下一步该做什么、需要注意什么。输出时保留所有原有代码，仅插入注释。',
    userPrompt: '题目描述:\n{question}\n\n目标语言: {target_language}\n\n已有代码:\n{current_answer}\n\n请分析题目和已有代码，给出下一步的解题提示。只在已有代码中添加注释，不要修改任何原有代码，只提示，不答题。'
};

// 模板变量说明
const TEMPLATE_VARS = '{question} = 题目内容 | {target_language} = 编程语言 | {current_answer} = 已有代码';

// GM_setValue 键名
const API_CONFIG_KEY = 'pta_api_config';
const AI_WARN_IGNORED_KEY = 'pta_ai_warn_ignored';

// 设置面板 UI ID
const SETTINGS_IDS = {
    modal: 'pta-settings-modal',
    closeBtn: 'pta-settings-close',
    saveBtn: 'pta-settings-save',
    endpoint: 'pta-setting-endpoint',
    apiKey: 'pta-setting-apikey',
    model: 'pta-setting-model',
    systemPrompt: 'pta-setting-prompt',
    userPrompt: 'pta-setting-user-prompt'
};

// ==================== 脚本主体 ====================

(function() {
    'use strict';

    // ==================== 样式 ====================
    GM_addStyle(`
        #pta-reader-btn {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 99999;
            background: #4A90D9;
            color: white;
            border: none;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #pta-reader-btn:hover {
            background: #357ABD;
            transform: scale(1.1);
        }
        #pta-ai-btn {
            position: fixed;
            right: 20px;
            bottom: 148px;
            z-index: 99999;
            background: #e8a838;
            color: #1e1e1e;
            border: none;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #pta-ai-btn:hover {
            background: #d49520;
            transform: scale(1.1);
        }
        #pta-reader-modal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100000;
            background: #1e1e1e;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            width: 85vw;
            max-width: 1000px;
            max-height: 85vh;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #pta-reader-modal .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #252525;
            border-bottom: 1px solid #3e3e3e;
        }
        #pta-reader-modal .modal-header h3 {
            margin: 0;
            color: #e0e0e0;
            font-size: 16px;
        }
        #pta-reader-modal .modal-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(85vh - 130px);
        }
        #pta-reader-modal .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 12px 20px;
            background: #252525;
            border-top: 1px solid #3e3e3e;
        }
        #pta-reader-modal pre {
            background: #2d2d2d;
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
            margin: 0;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 14px;
            line-height: 1.6;
            color: #d4d4d4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        #pta-reader-modal .btn {
            padding: 8px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        #pta-reader-modal .btn-primary {
            background: #4A90D9;
            color: white;
        }
        #pta-reader-modal .btn-primary:hover {
            background: #357ABD;
        }
        #pta-reader-modal .btn-secondary {
            background: #3e3e3e;
            color: #e0e0e0;
        }
        #pta-reader-modal .btn-secondary:hover {
            background: #4e4e4e;
        }
        #pta-reader-modal .btn-warning {
            background: #e8a838;
            color: #1e1e1e;
        }
        #pta-reader-modal .btn-warning:hover {
            background: #d49520;
        }
        #pta-reader-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 99999;
        }
        #pta-settings-btn {
            position: fixed;
            right: 20px;
            bottom: 84px;
            z-index: 99999;
            background: #666;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #pta-settings-btn:hover {
            background: #888;
            transform: scale(1.1);
        }
        #pta-settings-modal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100001;
            background: #1e1e1e;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            width: 500px;
            max-width: 90vw;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 24px;
            color: #e0e0e0;
        }
        #pta-settings-modal h3 {
            margin: 0 0 20px 0;
            color: #e0e0e0;
            font-size: 18px;
        }
        #pta-settings-modal label {
            display: block;
            margin-bottom: 12px;
            font-size: 13px;
            color: #aaa;
        }
        #pta-settings-modal label span {
            display: block;
            margin-bottom: 4px;
        }
        #pta-settings-modal input,
        #pta-settings-modal textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #3e3e3e;
            border-radius: 6px;
            background: #2d2d2d;
            color: #e0e0e0;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
        }
        #pta-settings-modal textarea {
            height: 80px;
            resize: vertical;
        }
        #pta-settings-modal input:focus,
        #pta-settings-modal textarea:focus {
            outline: none;
            border-color: #4A90D9;
        }
        #pta-settings-modal .settings-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        }
        #pta-warn-modal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100002;
            background: #1e1e1e;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            width: 380px;
            max-width: 90vw;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .btn-danger {
            background: #e74c3c;
            color: white;
        }
        .btn-danger:hover {
            background: #c0392b;
        }
    `);

    // ==================== HTML → Markdown 转换 ====================

    // 从 CodeMirror 编辑器提取代码
    function extractCodeFromEditor(editorEl) {
        const lines = editorEl.querySelectorAll(CODEMIRROR.line);
        return Array.from(lines).map(line => line.textContent).join('\n');
    }

    // 从带 data-code 属性的 div 提取代码块
    function extractCodeBlock(codeDiv) {
        const lang = codeDiv.getAttribute('data-lang') || '';
        const editor = codeDiv.querySelector(CODEMIRROR.content);
        const code = editor ? extractCodeFromEditor(editor) : codeDiv.innerText.trim();
        return { lang, code };
    }

    // 判断 div 是否为叶子节点代码块（只含编辑器，无结构化文本）
    function isLeafCodeBlock(el) {
        if (el.hasAttribute('data-code')) return true;
        if (CODEMIRROR.leafClasses.some(cls => el.classList.contains(cls))) return true;
        if (el.querySelector(CODEMIRROR.editor) && !el.querySelector(CODEMIRROR.structuredContent)) {
            return true;
        }
        return false;
    }

    // 转换段落为 Markdown（处理内联元素）
    function paragraphToMarkdown(pEl) {
        let result = '';
        const childNodes = pEl.childNodes;

        for (let i = 0; i < childNodes.length; i++) {
            const node = childNodes[i];

            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
                continue;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const tag = node.tagName.toLowerCase();

            // KaTeX 公式：从 annotation 取 LaTeX 源，避免 mathml+html 重复
            if (node.classList && node.classList.contains('katex')) {
                const ann = node.querySelector('annotation');
                if (ann) {
                    result += ann.textContent;
                    continue;
                }
                // 回退：取 katex-mathml 中的 mrow（避免 fallback 文本重复）
                const mathml = node.querySelector('.katex-mathml');
                if (mathml) {
                    const mrow = mathml.querySelector('mrow');
                    if (mrow) {
                        result += mrow.textContent;
                    } else {
                        result += mathml.textContent;
                    }
                    continue;
                }
            }
            switch (tag) {
                case 'code':   result += '`' + node.textContent + '`'; break;
                case 'strong':
                case 'b':      result += '**' + node.textContent + '**'; break;
                case 'em':
                case 'i':      result += '*' + node.textContent + '*'; break;
                case 'a':      result += '[' + node.textContent + '](' + (node.href || '') + ')'; break;
                case 'br':     result += '\n'; break;
                case 'sub':    result += '~' + node.textContent + '~'; break;
                case 'sup':    result += '^' + node.textContent + '^'; break;
                case 'del':
                case 's':      result += '~~' + node.textContent + '~~'; break;
                case 'img':    result += '![' + (node.alt || '') + '](' + (node.src || '') + ')'; break;
                case 'span':
                case 'div':    result += paragraphToMarkdown(node); break;
                default:       result += node.textContent;
            }
        }
        return result;
    }

    // 转换列表为 Markdown
    function listToMarkdown(listEl, ordered) {
        const items = listEl.querySelectorAll(':scope > li');
        return Array.from(items).map((item, i) => {
            const prefix = ordered ? (i + 1) + '. ' : '- ';
            return prefix + item.textContent.trim();
        }).join('\n') + '\n';
    }

    // 转换表格为 Markdown
    function tableToMarkdown(tableEl) {
        const rows = tableEl.querySelectorAll('tr');
        let result = '';

        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td, th');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
            result += '| ' + cellTexts.join(' | ') + ' |\n';
            if (rowIndex === 0) {
                result += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
            }
        });

        return result;
    }

    // 将单个 HTML 元素转换为 Markdown
    function elementToMarkdown(el) {
        if (!el) return '';

        const tag = el.tagName ? el.tagName.toLowerCase() : '';

        // 标题
        if (/^h[1-6]$/.test(tag)) {
            const level = '#'.repeat(parseInt(tag[1]));
            return level + ' ' + el.textContent.trim() + '\n\n';
        }

        // 段落
        if (tag === 'p') return paragraphToMarkdown(el) + '\n\n';

        // 列表
        if (tag === 'ul') return listToMarkdown(el, false) + '\n';
        if (tag === 'ol') return listToMarkdown(el, true) + '\n';

        // 引用、分割线、表格
        if (tag === 'blockquote') return '> ' + el.textContent.trim() + '\n\n';
        if (tag === 'hr') return '---\n\n';
        if (tag === 'table') return tableToMarkdown(el) + '\n';

        // div
        if (tag === 'div') {
            // 叶子节点代码块：直接提取
            if (isLeafCodeBlock(el)) {
                const { lang, code } = extractCodeBlock(el);
                return '```' + lang + '\n' + code + '\n```\n\n';
            }

            // 其他 div：递归处理子元素
            let md = '';
            for (const child of el.children) {
                md += elementToMarkdown(child);
            }
            return md;
        }

        return '';
    }

    // ==================== 答案提取 ====================

    // 从答题区提取已有代码
    function extractAnswer() {
        // 方法1: 通过 XPath 查找
        try {
            const result = document.evaluate(ANSWER_EDITOR_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                const el = result.singleNodeValue;
                // 尝试用 cm-line 提取
                const lines = el.querySelectorAll('.cm-line');
                if (lines.length > 0) {
                    return Array.from(lines).map(line => line.textContent).join('\n');
                }
                // 回退: 直接取文本
                return el.textContent.trim();
            }
        } catch (e) {}

        // 方法2: 通过 CSS 选择器查找
        for (const selector of ANSWER_EDITOR_SELECTORS) {
            const el = document.querySelector(selector);
            if (el) {
                const lines = el.querySelectorAll('.cm-line');
                if (lines.length > 0) {
                    return Array.from(lines).map(line => line.textContent).join('\n');
                }
                return el.textContent.trim();
            }
        }

        return '';
    }

    // 向答题区写入代码
    function insertAnswer(text) {
        // 定位编辑器
        let editorEl = null;
        try {
            const result = document.evaluate(ANSWER_EDITOR_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) editorEl = result.singleNodeValue;
        } catch (e) {}

        if (!editorEl) {
            for (const selector of ANSWER_EDITOR_SELECTORS) {
                editorEl = document.querySelector(selector);
                if (editorEl) break;
            }
        }

        if (!editorEl) {
            alert('未找到答题区编辑器');
            return false;
        }

        // 聚焦编辑器
        editorEl.focus();

        // 全选已有内容
        document.execCommand('selectAll', false, null);

        // 方法1: execCommand insertText（触发 CM6 input 处理）
        if (document.execCommand('insertText', false, text)) {
            console.log('[PTA] 写入成功 (execCommand)');
            return true;
        }

        // 方法2: InputEvent dispatch
        editorEl.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'insertText', data: text, bubbles: true, cancelable: true
        }));
        editorEl.dispatchEvent(new InputEvent('input', {
            inputType: 'insertText', data: text, bubbles: true, cancelable: true
        }));
        console.log('[PTA] 写入尝试 (InputEvent)');
        return true;
    }

    // ==================== AI API ====================

    // 加载 API 配置
    function loadApiConfig() {
        const saved = GM_getValue(API_CONFIG_KEY, null);
        if (saved) {
            try { return Object.assign({}, DEFAULT_API_CONFIG, JSON.parse(saved)); }
            catch (e) {}
        }
        return Object.assign({}, DEFAULT_API_CONFIG);
    }

    // 保存 API 配置
    function saveApiConfig(config) {
        GM_setValue(API_CONFIG_KEY, JSON.stringify(config));
    }

    // 清理 markdown 代码围栏
    function stripCodeFence(text) {
        return text.replace(/^```(?:\w+)?\n/, '').replace(/\n```$/, '').trim();
    }

    // 调用 AI API 生成答案
    function generateAnswer(problemText, onDone) {
        const config = loadApiConfig();
        if (!config.apiKey) {
            alert('请先配置 API Key（点击齿轮按钮）');
            return;
        }

        // 填充模板变量
        const lang = extractAnswerLanguage() || '未知';
        const currentAnswer = extractAnswer() || '';
        const userContent = config.userPrompt
            .replace(/\{question\}/g, problemText)
            .replace(/\{target_language\}/g, lang)
            .replace(/\{current_answer\}/g, currentAnswer);

        const payload = {
            model: config.model,
            messages: [
                { role: 'system', content: config.systemPrompt },
                { role: 'user', content: userContent }
            ],
            stream: false
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url: config.endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.apiKey
            },
            data: JSON.stringify(payload),
            onload: function(res) {
                if (res.status !== 200) {
                    alert('API 请求失败 (' + res.status + '): ' + res.responseText.slice(0, 200));
                    if (onDone) onDone(false);
                    return;
                }
                try {
                    const data = JSON.parse(res.responseText);
                    let code = data.choices[0].message.content;
                    code = stripCodeFence(code);
                    insertAnswer(code);
                    if (onDone) onDone(true);
                } catch (e) {
                    alert('解析 API 响应失败: ' + e.message);
                    if (onDone) onDone(false);
                }
            },
            onerror: function(err) {
                alert('API 网络错误: ' + (err.statusText || '请检查网络连接'));
                if (onDone) onDone(false);
            }
        });
    }

    // ==================== 题目提取 ====================

    // 提取答题编程语言
    function extractAnswerLanguage() {
        // 方法1: 通过 XPath 查找（尝试多个布局）
        for (const xpath of LANG_XPATHS) {
            try {
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                if (result.singleNodeValue) {
                    const text = result.singleNodeValue.textContent.trim();
                    if (text) return text;
                }
            } catch (e) {}
        }

        // 方法2: 通过 CSS 选择器查找
        for (const selector of LANG_SELECTORS) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
                if (text) return text;
            }
        }

        return '';
    }

    // 查找题目容器
    function findProblemContainer() {
        // 优先使用精确选择器
        for (const selector of CONTAINER_SELECTORS) {
            const el = document.querySelector(selector);
            if (el) return el;
        }

        // 回退：找包含 h3 + data-code 的 div
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
            if (div.querySelector(FALLBACK_CRITERIA.heading) && div.querySelector(FALLBACK_CRITERIA.codeBlock)) {
                return div;
            }
        }

        return null;
    }

    // 主函数：提取题目并转换为 Markdown
    function extractProblem() {
        const container = findProblemContainer();
        if (!container) {
            alert('未找到题目内容，请确保在题目页面使用此脚本。');
            return null;
        }

        // 提取答题语言
        const answerLang = extractAnswerLanguage();

        // 提取标题
        let markdown = '';
        const titleEl = document.querySelector(TITLE_SELECTOR);
        if (titleEl) {
            markdown = '# ' + titleEl.textContent.trim() + '\n\n';
        }

        // 添加答题语言信息
        if (answerLang) {
            markdown += '> 答题语言: **' + answerLang + '**\n\n';
        }

        // 遍历子元素转换
        for (const child of container.children) {
            markdown += elementToMarkdown(child);
        }

        // 如果结构化提取失败，回退到纯文本
        if (!markdown.trim()) {
            markdown = container.innerText + '\n';
        }

        return markdown;
    }

    // ==================== UI ====================

    function createUI() {
        // 悬浮按钮
        const btn = document.createElement('button');
        btn.id = UI_IDS.btn;
        btn.innerHTML = '📋';
        btn.title = '提取题目为 Markdown';
        document.body.appendChild(btn);

        // AI 生成悬浮按钮
        const aiBtn = document.createElement('button');
        aiBtn.id = 'pta-ai-btn';
        aiBtn.innerHTML = '🤖';
        aiBtn.title = 'AI 生成代码';
        document.body.appendChild(aiBtn);

        // 设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'pta-settings-btn';
        settingsBtn.innerHTML = '⚙';
        settingsBtn.title = 'API 设置';
        document.body.appendChild(settingsBtn);

        // 遮罩层
        const overlay = document.createElement('div');
        overlay.id = UI_IDS.overlay;
        document.body.appendChild(overlay);

        // 主模态框
        const modal = document.createElement('div');
        modal.id = UI_IDS.modal;
        modal.innerHTML = `
            <div class="modal-header">
                <h3>PTA 题目读取器</h3>
                <button class="btn btn-secondary" id="${UI_IDS.closeBtn}">✕</button>
            </div>
            <div class="modal-body">
                <pre id="${UI_IDS.content}"></pre>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="${UI_IDS.cancelBtn}">取消</button>
                <button class="btn btn-primary" id="${UI_IDS.copyBtn}">复制 Markdown</button>
            </div>
        `;
        document.body.appendChild(modal);

        // AI 警告对话框
        const warnModal = document.createElement('div');
        warnModal.id = 'pta-warn-modal';
        warnModal.innerHTML = `
            <div style="padding:24px;">
                <h3 style="margin:0 0 12px;color:#e8a838;font-size:16px;">⚠ 警告</h3>
                <p style="margin:0 0 20px;color:#ccc;font-size:14px;line-height:1.5;">AI 生成会清除答题区现有内容，是否继续？</p>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button class="btn btn-secondary" id="pta-warn-cancel">取消</button>
                    <button class="btn btn-secondary" id="pta-warn-ignore">忽略</button>
                    <button class="btn btn-danger" id="pta-warn-confirm">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(warnModal);

        // 设置模态框
        const settingsModal = document.createElement('div');
        settingsModal.id = SETTINGS_IDS.modal;
        const cfg = loadApiConfig();
        settingsModal.innerHTML = `
            <h3>AI API 设置</h3>
            <label><span>API Endpoint</span>
                <input type="text" id="${SETTINGS_IDS.endpoint}" value="${cfg.endpoint}" />
            </label>
            <label><span>API Key</span>
                <input type="password" id="${SETTINGS_IDS.apiKey}" value="${cfg.apiKey}" placeholder="sk-..." />
            </label>
            <label><span>Model</span>
                <input type="text" id="${SETTINGS_IDS.model}" value="${cfg.model}" />
            </label>
            <label><span>System Prompt</span>
                <textarea id="${SETTINGS_IDS.systemPrompt}">${cfg.systemPrompt}</textarea>
            </label>
            <label><span>User Prompt 模板 <span style="color:#666;font-size:11px;">${TEMPLATE_VARS}</span></span>
                <textarea id="${SETTINGS_IDS.userPrompt}" style="height:120px;">${cfg.userPrompt}</textarea>
            </label>
            <div class="settings-actions">
                <button class="btn btn-secondary" id="${SETTINGS_IDS.closeBtn}">取消</button>
                <button class="btn btn-primary" id="${SETTINGS_IDS.saveBtn}">保存</button>
            </div>
        `;
        document.body.appendChild(settingsModal);

        // === 事件绑定 ===

        // 提取题目按钮
        btn.addEventListener('click', () => {
            const markdown = extractProblem();
            if (markdown) {
                const answer = extractAnswer();
                const lang = extractAnswerLanguage().toLowerCase() || '';
                let output = markdown;
                if (answer) {
                    output += '\n---\n\n## 已有答案\n\n```' + lang + '\n' + answer + '\n```\n';
                } else {
                    output += '\n---\n\n> 未检测到已有答案\n';
                }
                document.getElementById(UI_IDS.content).textContent = output;
                modal.style.display = 'block';
                overlay.style.display = 'block';
            }
        });

        // 关闭主模态框
        const closeModal = () => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
        };

        // 关闭设置面板
        const closeSettings = () => {
            settingsModal.style.display = 'none';
            overlay.style.display = 'none';
        };

        document.getElementById(UI_IDS.closeBtn).addEventListener('click', closeModal);
        document.getElementById(UI_IDS.cancelBtn).addEventListener('click', closeModal);
        overlay.addEventListener('click', () => {
            closeModal();
            closeSettings();
            closeWarnModal();
        });

        // AI 警告对话框事件
        const showWarnModal = () => {
            warnModal.style.display = 'block';
            overlay.style.display = 'block';
        };
        const closeWarnModal = () => {
            warnModal.style.display = 'none';
            overlay.style.display = 'none';
        };

        document.getElementById('pta-warn-cancel').addEventListener('click', closeWarnModal);

        document.getElementById('pta-warn-ignore').addEventListener('click', () => {
            GM_setValue(AI_WARN_IGNORED_KEY, true);
            closeWarnModal();
            // 执行 AI 生成
            doAiGenerate();
        });

        document.getElementById('pta-warn-confirm').addEventListener('click', () => {
            closeWarnModal();
            // 执行 AI 生成
            doAiGenerate();
        });

        // AI 生成逻辑
        function doAiGenerate() {
            const problemText = extractProblem();
            if (!problemText || !problemText.trim()) {
                alert('未找到题目内容');
                return;
            }
            aiBtn.innerHTML = '⏳';
            aiBtn.disabled = true;
            generateAnswer(problemText, (success) => {
                aiBtn.innerHTML = '🤖';
                aiBtn.disabled = false;
            });
        }

        // AI 生成按钮
        aiBtn.addEventListener('click', () => {
            const ignored = GM_getValue(AI_WARN_IGNORED_KEY, false);
            if (ignored) {
                doAiGenerate();
            } else {
                showWarnModal();
            }
        });

        // 复制按钮
        document.getElementById(UI_IDS.copyBtn).addEventListener('click', () => {
            const content = document.getElementById(UI_IDS.content).textContent;
            GM_setClipboard(content, 'text');
            const copyBtn = document.getElementById(UI_IDS.copyBtn);
            copyBtn.textContent = COPY_FEEDBACK.text;
            setTimeout(() => { copyBtn.textContent = '复制 Markdown'; }, COPY_FEEDBACK.duration);
        });

        // 设置面板
        const openSettings = () => {
            const cfg = loadApiConfig();
            document.getElementById(SETTINGS_IDS.endpoint).value = cfg.endpoint;
            document.getElementById(SETTINGS_IDS.apiKey).value = cfg.apiKey;
            document.getElementById(SETTINGS_IDS.model).value = cfg.model;
            document.getElementById(SETTINGS_IDS.systemPrompt).value = cfg.systemPrompt;
            document.getElementById(SETTINGS_IDS.userPrompt).value = cfg.userPrompt;
            settingsModal.style.display = 'block';
            overlay.style.display = 'block';
        };

        settingsBtn.addEventListener('click', openSettings);

        document.getElementById(SETTINGS_IDS.closeBtn).addEventListener('click', closeSettings);

        document.getElementById(SETTINGS_IDS.saveBtn).addEventListener('click', () => {
            saveApiConfig({
                endpoint: document.getElementById(SETTINGS_IDS.endpoint).value.trim(),
                apiKey: document.getElementById(SETTINGS_IDS.apiKey).value.trim(),
                model: document.getElementById(SETTINGS_IDS.model).value.trim(),
                systemPrompt: document.getElementById(SETTINGS_IDS.systemPrompt).value.trim(),
                userPrompt: document.getElementById(SETTINGS_IDS.userPrompt).value.trim()
            });
            closeSettings();
        });
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }
})();
