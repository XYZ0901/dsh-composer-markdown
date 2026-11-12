window.__ModuleLoader__.load({
  id: '@xyz2zyx/composer-markdown',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace; also the `locale` option of both slot registrations. */
    const NS = 'composer-markdown';
    /** Page-local on/off switch shared by the tool-row toggle and the panel. */
    const PREF_STORAGE_KEY = 'dsh.composer-markdown.preview';
    const STYLE_TAG_ID = '@xyz2zyx/composer-markdown/client.css';

    /* ------------------------------------------------------------------ *
     * Shared preference
     * ------------------------------------------------------------------ */

    let enabledCache = null;
    const preferenceListeners = new Set();

    function readPreference() {
      try {
        const stored = window.localStorage.getItem(PREF_STORAGE_KEY);
        return stored === null ? true : stored !== '0';
      } catch {
        return true;
      }
    }

    function isEnabled() {
      if (enabledCache === null) enabledCache = readPreference();
      return enabledCache;
    }

    function setEnabled(next) {
      if (isEnabled() === next) return;
      enabledCache = next;
      try {
        window.localStorage.setItem(PREF_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* Private mode or a blocked storage area keeps the choice page-local. */
      }
      for (const listener of [...preferenceListeners]) listener();
    }

    function useEnabled() {
      const [value, setValue] = React.useState(isEnabled);
      React.useEffect(() => {
        const listener = () => setValue(isEnabled());
        preferenceListeners.add(listener);
        return () => {
          preferenceListeners.delete(listener);
        };
      }, []);
      return value;
    }

    /* ------------------------------------------------------------------ *
     * Markdown: inline level
     * ------------------------------------------------------------------ */

    const ESCAPABLE = '\\`*_{}[]()#+-.!~|>';

    /** Accept only link targets a preview may safely navigate to. */
    function safeUrl(raw) {
      const value = String(raw).trim();
      if (value === '') return null;
      if (/^(?:https?:|mailto:)/i.test(value)) return value;
      if (value.startsWith('#')) return value;
      return null;
    }

    function externalLink(href, key, children) {
      return h(
        'a',
        { key, href, target: '_blank', rel: 'noreferrer noopener' },
        children,
      );
    }

    /**
     * Read `[label](target "title")` starting at the `[` position.
     * @returns {{ label: string, target: string, end: number } | null}
     */
    function readLink(text, start) {
      if (text[start] !== '[') return null;
      let depth = 0;
      let index = start;
      for (; index < text.length; index += 1) {
        const character = text[index];
        if (character === '\\') {
          index += 1;
          continue;
        }
        if (character === '[') depth += 1;
        else if (character === ']') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (index >= text.length) return null;
      if (text[index + 1] !== '(') return null;
      const label = text.slice(start + 1, index);
      let cursor = index + 2;
      let parens = 1;
      for (; cursor < text.length; cursor += 1) {
        const character = text[cursor];
        if (character === '\\') {
          cursor += 1;
          continue;
        }
        if (character === '(') parens += 1;
        else if (character === ')') {
          parens -= 1;
          if (parens === 0) break;
        }
      }
      if (cursor >= text.length) return null;
      let destination = text.slice(index + 2, cursor).trim();
      if (destination.startsWith('<') && destination.endsWith('>')) {
        destination = destination.slice(1, -1);
      } else {
        const titled = /^(\S+?)\s+(?:"[^"]*"|'[^']*'|\([^)]*\))$/.exec(destination);
        if (titled !== null) destination = titled[1];
      }
      return { label, target: destination, end: cursor + 1 };
    }

    /**
     * Render one paragraph-scale chunk of inline Markdown into React children.
     * @param text - source text with soft line breaks still present.
     * @param keyPrefix - stable prefix for generated element keys.
     */
    function renderInline(text, keyPrefix) {
      const out = [];
      let buffer = '';
      let index = 0;
      let seq = 0;
      const key = () => `${keyPrefix}-i${seq++}`;
      const flush = () => {
        if (buffer !== '') {
          out.push(buffer);
          buffer = '';
        }
      };

      while (index < text.length) {
        const character = text[index];

        if (character === '\n') {
          if (text[index - 1] === '\\') {
            buffer = buffer.replace(/\\$/, '');
            flush();
            out.push(h('br', { key: key() }));
          } else if (/ {2,}$/.test(buffer)) {
            buffer = buffer.replace(/ +$/, '');
            flush();
            out.push(h('br', { key: key() }));
          } else {
            buffer += ' ';
          }
          index += 1;
          continue;
        }

        if (character === '\\' && index + 1 < text.length && ESCAPABLE.includes(text[index + 1])) {
          buffer += text[index + 1];
          index += 2;
          continue;
        }

        if (character === '`') {
          let ticks = 0;
          while (text[index + ticks] === '`') ticks += 1;
          const fence = '`'.repeat(ticks);
          const close = text.indexOf(fence, index + ticks);
          if (close > index + ticks) {
            let code = text.slice(index + ticks, close);
            if (/^ .* $/.test(code) && code.trim() !== '') code = code.slice(1, -1);
            flush();
            out.push(h('code', { key: key(), className: 'cm-md-code' }, code));
            index = close + ticks;
            continue;
          }
          buffer += fence;
          index += ticks;
          continue;
        }

        if (character === '!' && text[index + 1] === '[') {
          const image = readLink(text, index + 1);
          if (image !== null) {
            flush();
            const href = safeUrl(image.target);
            const label = image.label.trim() === '' ? image.target : image.label;
            out.push(
              href === null
                ? h('span', { key: key(), className: 'cm-md-image' }, `🖼 ${label}`)
                : externalLink(href, key(), h('span', { className: 'cm-md-image' }, `🖼 ${label}`)),
            );
            index = image.end;
            continue;
          }
        }

        if (character === '[') {
          const link = readLink(text, index);
          if (link !== null) {
            flush();
            const href = safeUrl(link.target);
            const label = renderInline(link.label, `${keyPrefix}-l${seq}`);
            out.push(
              href === null
                ? h('span', { key: key(), className: 'cm-md-nolink' }, label)
                : externalLink(href, key(), label),
            );
            index = link.end;
            continue;
          }
        }

        if (character === '<') {
          const auto = /^<((?:https?|mailto):[^>\s]+)>/i.exec(text.slice(index));
          if (auto !== null) {
            flush();
            out.push(externalLink(auto[1], key(), auto[1]));
            index += auto[0].length;
            continue;
          }
        }

        if (character === 'h' || character === 'H') {
          const bare = /^(https?:\/\/[^\s<>"'`]+)/i.exec(text.slice(index));
          if (bare !== null) {
            let url = bare[1];
            while (url.length > 8 && /[.,;:!?\])}'"。，、；：！？）】》」』…]$/u.test(url)) url = url.slice(0, -1);
            flush();
            out.push(externalLink(url, key(), url));
            index += url.length;
            continue;
          }
        }

        if (character === '*' || character === '_' || character === '~') {
          const emphasis = readEmphasis(text, index);
          if (emphasis !== null) {
            flush();
            const inner = renderInline(emphasis.inner, `${keyPrefix}-e${seq}`);
            out.push(emphasis.render(inner, key()));
            index = emphasis.end;
            continue;
          }
        }

        buffer += character;
        index += 1;
      }

      flush();
      return out;
    }

    /**
     * Read one emphasis/del span starting at a `*`, `_`, or `~` run.
     * @returns {{ inner: string, end: number, render: Function } | null}
     */
    function readEmphasis(text, start) {
      const character = text[start];

      if (character === '~') {
        if (text[start + 1] !== '~') return null;
        const close = text.indexOf('~~', start + 2);
        if (close < 0) return null;
        return {
          inner: text.slice(start + 2, close),
          end: close + 2,
          render: (children, key) => h('del', { key }, children),
        };
      }

      if (character !== '~' && text[start + 1] === character && text[start + 2] === character) {
        const triple = character.repeat(3);
        const close = text.indexOf(triple, start + 3);
        if (close > start + 3) {
          return {
            inner: text.slice(start + 3, close),
            end: close + 3,
            render: (children, key) => h('strong', { key }, h('em', null, children)),
          };
        }
      }

      const double = text[start + 1] === character;
      const marker = double ? character + character : character;
      const innerStart = start + marker.length;
      const previous = start > 0 ? text[start - 1] : '';
      const next = text[innerStart] ?? '';
      if (next === '' || /\s/.test(next)) return null;
      if (character === '_' && previous !== '' && /[\w\u4e00-\u9fff]/.test(previous)) return null;

      const close = text.indexOf(marker, innerStart + 1);
      if (close < 0) return null;
      const last = text[close - 1];
      if (last === undefined || /\s/.test(last)) return null;
      if (character === '_') {
        const after = text[close + marker.length] ?? '';
        if (/[\w\u4e00-\u9fff]/.test(after)) return null;
      }

      const inner = text.slice(innerStart, close);
      const end = close + marker.length;
      if (double) {
        return { inner, end, render: (children, key) => h('strong', { key }, children) };
      }
      return { inner, end, render: (children, key) => h('em', { key }, children) };
    }

    /* ------------------------------------------------------------------ *
     * Markdown: block level
     * ------------------------------------------------------------------ */

    const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*$/;
    const HEADING_LINE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
    const RULE_LINE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
    const QUOTE_LINE = /^ {0,3}>/;
    const LIST_LINE = /^( *)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;
    const TABLE_RULE = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(?:\|[ \t]*:?-{1,}:?[ \t]*)+\|?[ \t]*$/;

    function isBlockStart(line) {
      return (
        FENCE_LINE.test(line) ||
        HEADING_LINE.test(line) ||
        RULE_LINE.test(line) ||
        QUOTE_LINE.test(line) ||
        LIST_LINE.test(line)
      );
    }

    /** Split one table row into trimmed cells, honouring `\|`. */
    function splitRow(line) {
      let row = line.trim();
      if (row.startsWith('|')) row = row.slice(1);
      if (row.endsWith('|')) row = row.slice(0, -1);
      const cells = [];
      let buffer = '';
      for (let index = 0; index < row.length; index += 1) {
        const character = row[index];
        if (character === '\\' && row[index + 1] === '|') {
          buffer += '|';
          index += 1;
          continue;
        }
        if (character === '|') {
          cells.push(buffer.trim());
          buffer = '';
          continue;
        }
        buffer += character;
      }
      cells.push(buffer.trim());
      return cells;
    }

    function renderTable(lines, start, keyPrefix) {
      const header = splitRow(lines[start]);
      const separators = splitRow(lines[start + 1]);
      const align = separators.map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return undefined;
      });
      const rows = [];
      let index = start + 2;
      while (index < lines.length && lines[index].includes('|') && !/^\s*$/.test(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      const cell = (tag, content, column, rowKey) =>
        h(tag, { key: rowKey, style: align[column] === undefined ? undefined : { textAlign: align[column] } }, content);
      return {
        node: h(
          'div',
          { key: `${keyPrefix}-table${start}`, className: 'cm-md-tablewrap' },
          h(
            'table',
            null,
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                header.map((text, column) => cell('th', renderInline(text, `${keyPrefix}-th${column}`), column, `h${column}`)),
              ),
            ),
            rows.length === 0
              ? null
              : h(
                  'tbody',
                  null,
                  rows.map((row, rowIndex) =>
                    h(
                      'tr',
                      { key: `r${rowIndex}` },
                      header.map((_, column) =>
                        cell(
                          'td',
                          renderInline(row[column] ?? '', `${keyPrefix}-td${rowIndex}-${column}`),
                          column,
                          `c${column}`,
                        ),
                      ),
                    ),
                  ),
                ),
          ),
        ),
        next: index,
      };
    }

    function renderList(lines, start, keyPrefix) {
      const first = LIST_LINE.exec(lines[start]);
      const baseIndent = first[1].length;
      const ordered = /\d/.test(first[2]);
      const items = [];
      let index = start;

      while (index < lines.length) {
        const marker = LIST_LINE.exec(lines[index]);
        if (marker === null) break;
        if (marker[1].length !== baseIndent) break;
        if (/\d/.test(marker[2]) !== ordered) break;

        const contentIndent = baseIndent + marker[2].length + marker[3].length;
        const body = [marker[4]];
        index += 1;

        while (index < lines.length) {
          const line = lines[index];
          if (/^\s*$/.test(line)) {
            let lookahead = index + 1;
            while (lookahead < lines.length && /^\s*$/.test(lines[lookahead])) lookahead += 1;
            if (lookahead >= lines.length) {
              index = lookahead;
              break;
            }
            const nextIndent = /^ */.exec(lines[lookahead])[0].length;
            const nextIsMarker = LIST_LINE.test(lines[lookahead]);
            if (nextIndent >= contentIndent || (nextIsMarker && nextIndent >= baseIndent)) {
              body.push('');
              index += 1;
              continue;
            }
            break;
          }
          const indent = /^ */.exec(line)[0].length;
          if (indent < contentIndent) {
            if (LIST_LINE.test(line)) break;
            body.push(line.replace(/^ +/, ''));
            index += 1;
            continue;
          }
          body.push(line.slice(Math.min(contentIndent, indent)));
          index += 1;
        }

        items.push(body);
      }

      const rendered = items.map((body, itemIndex) => {
        let task = null;
        const taskMatch = /^\[([ xX])\][ \t]+(.*)$/.exec(body[0]);
        if (taskMatch !== null) {
          task = taskMatch[1] !== ' ';
          body[0] = taskMatch[2];
        }
        const content = renderBlocks(body.join('\n'), `${keyPrefix}-li${itemIndex}`);
        return h(
          'li',
          { key: `${keyPrefix}-item${itemIndex}`, className: task === null ? undefined : 'cm-md-task' },
          task === null
            ? content
            : [h('span', { key: 'box', className: 'cm-md-check', 'aria-hidden': true }, task ? '☑' : '☐'), ...content],
        );
      });

      return {
        node: h(ordered ? 'ol' : 'ul', { key: `${keyPrefix}-list${start}`, start: ordered ? Number(first[2]) || 1 : undefined }, rendered),
        next: index,
      };
    }

    /**
     * Render a block-level Markdown document into React children.
     * @param text - full draft text.
     * @param keyPrefix - stable prefix for generated element keys.
     */
    function renderBlocks(text, keyPrefix) {
      const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
      const out = [];
      let index = 0;
      let seq = 0;
      const nextKey = (tag) => `${keyPrefix}-${tag}${seq++}`;

      while (index < lines.length) {
        const line = lines[index];
        if (/^\s*$/.test(line)) {
          index += 1;
          continue;
        }

        const fence = FENCE_LINE.exec(line);
        if (fence !== null) {
          const marker = fence[1][0];
          const run = fence[1].length;
          const language = fence[2] ?? '';
          const closing = new RegExp(`^ {0,3}\\${marker}{${run},}\\s*$`);
          const body = [];
          index += 1;
          while (index < lines.length) {
            if (closing.test(lines[index])) {
              index += 1;
              break;
            }
            body.push(lines[index]);
            index += 1;
          }
          out.push(
            h(
              'pre',
              { key: nextKey('pre'), className: 'cm-md-pre', 'data-lang': language === '' ? undefined : language },
              h('code', null, body.join('\n')),
            ),
          );
          continue;
        }

        const heading = HEADING_LINE.exec(line);
        if (heading !== null) {
          const level = heading[1].length;
          out.push(h(`h${level}`, { key: nextKey('h') }, renderInline(heading[2], nextKey('hi'))));
          index += 1;
          continue;
        }

        if (RULE_LINE.test(line)) {
          out.push(h('hr', { key: nextKey('hr') }));
          index += 1;
          continue;
        }

        if (QUOTE_LINE.test(line)) {
          const body = [];
          while (index < lines.length) {
            if (QUOTE_LINE.test(lines[index])) {
              body.push(lines[index].replace(/^ {0,3}> ?/, ''));
              index += 1;
              continue;
            }
            if (/^\s*$/.test(lines[index]) && index + 1 < lines.length && QUOTE_LINE.test(lines[index + 1])) {
              body.push('');
              index += 1;
              continue;
            }
            break;
          }
          out.push(h('blockquote', { key: nextKey('bq') }, renderBlocks(body.join('\n'), nextKey('bqi'))));
          continue;
        }

        if (line.includes('|') && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1])) {
          const table = renderTable(lines, index, nextKey('t'));
          out.push(table.node);
          index = table.next;
          continue;
        }

        if (LIST_LINE.test(line)) {
          const list = renderList(lines, index, nextKey('l'));
          out.push(list.node);
          index = list.next > index ? list.next : index + 1;
          continue;
        }

        const paragraph = [];
        while (index < lines.length && !/^\s*$/.test(lines[index]) && (paragraph.length === 0 || !isBlockStart(lines[index]))) {
          paragraph.push(lines[index]);
          index += 1;
        }
        out.push(h('p', { key: nextKey('p') }, renderInline(paragraph.join('\n'), nextKey('pi'))));
      }

      return out;
    }

    /* ------------------------------------------------------------------ *
     * Components
     * ------------------------------------------------------------------ */

    function translate(props) {
      return typeof props.t === 'function' ? props.t : (key) => key;
    }

    /** Markdown preview panel above the composer card. */
    function ComposerMarkdownPreview(props) {
      const t = translate(props);
      const draft = props.input !== undefined && typeof props.input.draft === 'string' ? props.input.draft : '';
      const enabled = useEnabled();
      const visible = enabled && draft.trim() !== '';
      const nodes = React.useMemo(
        () => (visible ? renderBlocks(draft, 'cm') : null),
        [visible, draft],
      );
      if (!visible || nodes === null) return null;
      return h(
        'section',
        { className: 'cm-md-panel', 'data-composer-markdown-preview': '' },
        h(
          'div',
          { className: 'cm-md-head' },
          h('span', { className: 'cm-md-badge', 'aria-hidden': true }, 'MD'),
          h('span', { className: 'cm-md-title' }, t('preview.title')),
          h(
            'button',
            {
              type: 'button',
              className: 'cm-md-hide',
              title: t('preview.hide'),
              'aria-label': t('preview.hide'),
              onMouseDown: (event) => event.preventDefault(),
              onClick: () => setEnabled(false),
            },
            '×',
          ),
        ),
        h('div', { className: 'cm-md-body' }, nodes),
      );
    }

    /** Compact on/off control in the composer tool row. */
    function ComposerMarkdownToggle(props) {
      const t = translate(props);
      const enabled = useEnabled();
      return h(
        'button',
        {
          type: 'button',
          className: 'cm-md-toggle',
          'aria-pressed': enabled ? 'true' : 'false',
          title: enabled ? t('toggle.on') : t('toggle.off'),
          'aria-label': enabled ? t('toggle.on') : t('toggle.off'),
          onMouseDown: (event) => event.preventDefault(),
          onClick: () => setEnabled(!isEnabled()),
        },
        h('span', { 'aria-hidden': true }, 'M'),
        h('span', { className: 'cm-md-toggle-arrow', 'aria-hidden': true }, '↓'),
      );
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = `
.cm-md-panel{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - 4 * var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));display:flex;flex-direction:column;flex:none;margin:0 auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);box-shadow:var(--dsw-elevation-panel);overflow:hidden}
.cm-md-head{display:flex;align-items:center;gap:8px;padding:4px 8px 4px 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}
.cm-md-badge{border-radius:4px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:10px;font-weight:600;letter-spacing:.04em;padding:0 4px;line-height:16px}
.cm-md-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-md-hide{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:0 0;color:inherit;font-size:15px;line-height:1;cursor:pointer;flex:none}
.cm-md-hide:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.cm-md-hide:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.cm-md-body{max-height:32vh;overflow-y:auto;padding:2px 14px 12px;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,13px);line-height:1.65;overflow-wrap:anywhere;border-top:.5px solid var(--dsw-alias-border-l1);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.cm-md-body>*:first-child{margin-top:8px}
.cm-md-body>*:last-child{margin-bottom:0}
.cm-md-body p{margin:0 0 .55em}
.cm-md-body h1,.cm-md-body h2,.cm-md-body h3,.cm-md-body h4,.cm-md-body h5,.cm-md-body h6{margin:.85em 0 .4em;font-weight:600;line-height:1.35}
.cm-md-body h1{font-size:1.45em}
.cm-md-body h2{font-size:1.28em}
.cm-md-body h3{font-size:1.14em}
.cm-md-body h4,.cm-md-body h5,.cm-md-body h6{font-size:1em;color:var(--dsw-alias-label-secondary)}
.cm-md-body ul,.cm-md-body ol{margin:0 0 .55em;padding-left:1.45em}
.cm-md-body li{margin:.12em 0}
.cm-md-body li>p{margin:0}
.cm-md-body li.cm-md-task{list-style:none;margin-left:-1.2em}
.cm-md-check{margin-right:.35em}
.cm-md-body blockquote{margin:0 0 .6em;padding:.1em .9em;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.cm-md-body code{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.92em;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:.1em .35em}
.cm-md-body pre{margin:0 0 .6em;padding:8px 10px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);overflow-x:auto}
.cm-md-body pre code{background:0 0;padding:0;font-size:.9em;white-space:pre}
.cm-md-body a{color:var(--dsw-alias-state-business-primary);text-decoration:none}
.cm-md-body a:hover{text-decoration:underline}
.cm-md-body .cm-md-nolink{color:var(--dsw-alias-label-secondary)}
.cm-md-body .cm-md-image{color:var(--dsw-alias-label-tertiary);font-size:.95em}
.cm-md-body hr{margin:.8em 0;border:0;border-top:1px solid var(--dsw-alias-border-l1)}
.cm-md-tablewrap{margin:0 0 .6em;overflow-x:auto}
.cm-md-body table{border-collapse:collapse;font-size:.95em}
.cm-md-body th,.cm-md-body td{border:1px solid var(--dsw-alias-border-l1);padding:3px 8px;text-align:left}
.cm-md-body th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.cm-md-toggle{display:inline-flex;align-items:center;justify-content:center;gap:1px;height:28px;min-width:34px;padding:0 7px;border:0;border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;font-weight:600;line-height:1;cursor:pointer;flex:none}
.cm-md-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.cm-md-toggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.cm-md-toggle[aria-pressed="true"]{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.cm-md-toggle-arrow{font-size:9px;font-weight:600;transform:translateY(1px)}
`;

    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const selector = `style[data-plugin-css="${STYLE_TAG_ID}"]`;
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = '@xyz2zyx/composer-markdown';
      tag.dataset.pluginCss = STYLE_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => installStyles());

        ctx.effect(() =>
          ctx.locale.register(NS, {
            en: {
              'preview.title': 'Markdown preview',
              'preview.hide': 'Hide markdown preview',
              'toggle.on': 'Markdown preview: on',
              'toggle.off': 'Markdown preview: off',
            },
            zh: {
              'preview.title': 'Markdown 预览',
              'preview.hide': '隐藏 Markdown 预览',
              'toggle.on': 'Markdown 预览已开启',
              'toggle.off': 'Markdown 预览已关闭',
            },
          }),
        );

        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.dock',
              id: 'markdown-preview',
              order: 30,
              locale: NS,
            },
            ComposerMarkdownPreview,
          ),
        );

        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: 'markdown-preview',
              order: 0,
              locale: NS,
            },
            ComposerMarkdownToggle,
          ),
        );
      },
    };
  },
});
