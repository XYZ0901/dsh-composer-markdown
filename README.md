# Composer Markdown — DSH Web plugin

Renders the message you are writing as Markdown, attached to the DSH Web
composer, and keeps the editor itself untouched: what you send is still the
exact Markdown source.

[中文说明](#中文说明)

## What it does

- Renders the current draft as Markdown in a compact panel directly above the
  composer card, on every keystroke.
- A formatting toolbar inside that panel writes Markdown back into the draft:
  bold, italic, strikethrough, inline code, link, heading, quote, bulleted,
  numbered and task lists, code block, table and horizontal rule. With a
  selection the inline formats wrap it; block formats start on their own line.
- A `M↓` toggle in the composer tool row turns it on and off. The choice is
  kept in `localStorage` under `dsh.composer-markdown.preview`.
- The draft is never modified. The panel is a read-only projection of
  `InputState.draft`, so submissions stay byte-identical.

## Supported syntax

Headings, paragraphs, bold / italic / strikethrough, inline code, fenced code
blocks (language label kept), ordered, unordered, nested and task lists,
blockquotes, tables with column alignment, links, autolinks, bare URLs, images
(shown as a labelled link chip), horizontal rules and hard line breaks.

Only `http:`, `https:`, `mailto:` and `#` targets become links; anything else,
such as `javascript:`, is rendered as plain text. Raw HTML in the draft is
escaped, never injected.

## Install

Install the bundle through the Web GUI — **Settings → Plugins → Install** — or
by package name:

```bash
dsh plugin --profile <profile> add @xyz2zyx/composer-markdown
```

The GUI path also selects the bundle. The CLI only adds the dependency, so
enable the bundle afterwards on the Plugins page.

Requires DSH `>=0.2.2-rc.1` (declared as `dsh.engines.dsh`).

## How it is built

- Host half (`index.js`) is inert: the bundle only needs a Loader row.
- Client half (`client.js`) registers two entries: the rendering in
  `conversation.input.dock` and the toggle in `conversation.input.left`.
- No runtime dependencies: the bundle resolves only `react` from the shell's
  module table, and the Markdown parser is part of the bundle.
- Styles use theme tokens (`--dsw-*`, `--dsh-*`) and the shell's composer width
  variables, so the panel follows light/dark themes and the composer column.

## Why the editor itself does not change

The composer is a shell-owned Lexical contenteditable. Plugins receive the
draft text and the input actions (`insertText`, `insertQuote`, `setDraft`,
`submit`) but no editor handle, so formatting cannot be applied inside it. Even
with a handle it would corrupt submissions: the draft is serialized through the
editor's plain text projection, which drops inline formatting — turning `**x**`
into bold would silently send `x`.

## 中文说明

在 DSH Web 输入框上方实时渲染你正在输入的 Markdown，并且不改动编辑器本身：
发送出去的仍然是你写的原始 Markdown 文本。

- 每次按键都会重新渲染；输入框工具行左侧的 `M↓` 开关控制显隐，状态存在
  `localStorage` 的 `dsh.composer-markdown.preview`。
- 面板内有格式化工具条，直接改写草稿：粗体、斜体、删除线、行内代码、链接、
  标题、引用、无序/有序/任务列表、代码块、表格、分隔线。行内格式会包裹当前
  选区，块级格式单独起一行。
- 支持标题、段落、粗体/斜体/删除线、行内代码、围栏代码块、有序/无序/嵌套/
  任务列表、引用、表格（含对齐）、链接、自动链接、裸链接、图片（显示为带标签
  的链接块）、分隔线与硬换行。
- 只有 `http:`、`https:`、`mailto:`、`#` 会变成链接，`javascript:` 等一律按
  普通文本显示；草稿里的 HTML 会被转义，不会注入。
- 安装：设置 → 插件 → 安装，或用包名安装后在该页启用。

## License

MIT. See [LICENSE](LICENSE).
