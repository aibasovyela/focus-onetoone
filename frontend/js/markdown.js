// Мини-рендер markdown → HTML для уроков и шпаргалок.
// Поддержка: заголовки, списки, код, цитаты, ссылки, жирный/курсив, таблицы,
// спец-блоки :::lead / :::tip|warn|example|note / :::diagram / :::steps / :::prompt (см. docs/LESSON_FORMAT.md)
const MD = (() => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const inline = (s) => {
    const codes = [];
    s = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(«])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  };

  const slug = (text, used) => {
    let base = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'razdel';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const CALLOUT = { tip: 'Совет', warn: 'Важно', example: 'Пример', note: 'Заметка' };

  const copyBlock = (code, title = '') => `
    <div class="md-code${title ? ' md-prompt' : ''}">
      ${title ? `<div class="md-prompt-title">${inline(title)}</div>` : ''}
      <pre><code>${esc(code)}</code></pre>
      <button class="md-copy" type="button">Копировать</button>
    </div>`;

  const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  // opts.diagrams: { name: '<svg…>' }; возвращает { html, toc: [{ id, title }] }
  const render = (src, opts = {}) => {
    const lines = src.replace(/\r/g, '').split('\n');
    const out = [];
    const toc = [];
    const used = new Set();
    let list = null;
    let para = [];

    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const flush = () => { flushPara(); flushList(); };

    // собрать строки до закрывающего :::
    const takeBlock = (i) => {
      const buf = [];
      while (++i < lines.length && lines[i].trim() !== ':::') buf.push(lines[i]);
      return [buf, i];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;

      if (/^```/.test(line)) {
        flush();
        const buf = [];
        while (++i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i]);
        out.push(copyBlock(buf.join('\n')));
        continue;
      }

      if ((m = line.match(/^:::(\w+)\s*(.*)$/))) {
        flush();
        const [kind, rest] = [m[1], m[2].trim()];
        let buf;
        [buf, i] = takeBlock(i);
        if (kind === 'lead') {
          out.push(`<p class="md-lead">${inline(buf.join(' ').trim())}</p>`);
        } else if (CALLOUT[kind]) {
          out.push(`<aside class="md-callout md-${kind}"><div class="md-callout-title">${inline(rest || CALLOUT[kind])}</div>${render(buf.join('\n')).html}</aside>`);
        } else if (kind === 'diagram') {
          const [name, ...cap] = rest.split(/\s+/);
          const svg = opts.diagrams?.[name];
          if (svg) {
            out.push(`<figure class="md-diagram" id="diagram-${esc(name)}">${svg}${cap.length ? `<figcaption>${inline(cap.join(' '))}</figcaption>` : ''}</figure>`);
          }
        } else if (kind === 'steps') {
          const items = buf.filter(l => /^\s*\d+[.)]\s+/.test(l)).map(l => l.replace(/^\s*\d+[.)]\s+/, ''));
          out.push(`<ol class="md-steps">${items.map(t => {
            const [head, ...tail] = t.split(/\s+—\s+/);
            return `<li><strong>${inline(head)}</strong>${tail.length ? `<span>${inline(tail.join(' — '))}</span>` : ''}</li>`;
          }).join('')}</ol>`);
        } else if (kind === 'prompt') {
          out.push(copyBlock(buf.join('\n').trim(), rest || 'Промпт'));
        } else {
          out.push(render(buf.join('\n'), opts).html);
        }
        continue;
      }

      // таблица: строка с | и разделитель |---|
      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        flush();
        const head = splitRow(line);
        i++;
        const rows = [];
        while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(splitRow(lines[++i]));
        out.push(`<div class="md-table"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${
          rows.map(r => `<tr>${r.map((c, k) => `<td data-label="${esc(head[k] || '')}">${inline(c)}</td>`).join('')}</tr>`).join('')
        }</tbody></table></div>`);
        continue;
      }

      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flush();
        const level = Math.max(2, Math.min(m[1].length, 4)); // # и ## → h2: заголовок страницы уже h1
        if (level === 2) {
          const id = slug(m[2], used);
          toc.push({ id, title: m[2].replace(/[*`]/g, '') });
          out.push(`<h2 id="${id}">${inline(m[2])}</h2>`);
        } else {
          out.push(`<h${level}>${inline(m[2])}</h${level}>`);
        }
      } else if ((m = line.match(/^\s*[-*]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        const type = /^\s*\d/.test(line) ? 'ol' : 'ul';
        if (list !== type) { flushList(); out.push(`<${type}>`); list = type; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flush();
        const buf = [m[1]];
        while (i + 1 < lines.length && /^>/.test(lines[i + 1])) buf.push(lines[++i].replace(/^>\s?/, ''));
        out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flush();
        out.push('<hr>');
      } else if (!line.trim()) {
        flush();
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flush();
    return { html: out.join('\n'), toc };
  };

  return { render, inline, esc };
})();
