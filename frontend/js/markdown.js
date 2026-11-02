// Мини-рендер markdown → HTML для шпаргалок (заголовки, списки, код, цитаты, ссылки, жирный)
const MD = (() => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const inline = (s) => {
    const codes = [];
    s = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  };

  const render = (src) => {
    const lines = src.replace(/\r/g, '').split('\n');
    const out = [];
    let list = null;
    let para = [];

    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const flush = () => { flushPara(); flushList(); };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^```/.test(line)) {
        flush();
        const buf = [];
        while (++i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i]);
        out.push(`<div class="md-code"><pre><code>${esc(buf.join('\n'))}</code></pre><button class="md-copy" type="button">Копировать</button></div>`);
        continue;
      }

      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flush();
        const level = Math.max(2, Math.min(m[1].length, 4)); // # и ## → h2: заголовок страницы уже h1
        out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      } else if ((m = line.match(/^\s*[-*]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        const type = /^\s*\d/.test(line) ? 'ol' : 'ul';
        if (list !== type) { flushList(); out.push(`<${type}>`); list = type; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flush();
        out.push(`<blockquote>${inline(m[1])}</blockquote>`);
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
    return out.join('\n');
  };

  return { render };
})();
