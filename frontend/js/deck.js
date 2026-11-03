// Плеер «урок-слайды» (docs/DECK_FORMAT.md): ← → / свайп / клавиши, главы-сегменты, позиция в localStorage.
// API: DECK.open({ moduleId, deck, diagrams, start, requestClose, onClose, onHomework }), DECK.goTo(i), DECK.close(),
//      DECK.isOpen(), DECK.progress(moduleId, deck), DECK.flatten(deck)
const DECK = (() => {
  const E = (s) => MD.esc(String(s ?? ''));
  const I = (s) => MD.inline(String(s ?? ''));
  const paras = (s) => String(s ?? '').trim().split(/\n{2,}/).map(p => `<p>${p.split('\n').map(I).join('<br>')}</p>`).join('');
  const safeFile = (f) => (/^[\w.-]+$/.test(String(f || '')) ? f : '');
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '');
  const plural = (n, [one, few, many]) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const slidesWord = (n) => `${n} ${plural(n, ['слайд', 'слайда', 'слайдов'])}`;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const GAP = 14;

  const ICON = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4M11 8.5v5M8.5 11h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>'
  };

  const APPS = {
    chatgpt: { name: 'ChatGPT', cls: 'gpt', logo: `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7">${[0, 60, 120].map(a => `<ellipse cx="12" cy="12" rx="8.6" ry="3.8" transform="rotate(${a} 12 12)"/>`).join('')}</g></svg>` },
    claude: { name: 'Claude', cls: 'claude', logo: `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${Array.from({ length: 10 }, (_, k) => { const a = (k * 36 * Math.PI) / 180; return `<path d="M${(12 + Math.cos(a) * 3).toFixed(1)} ${(12 + Math.sin(a) * 3).toFixed(1)}L${(12 + Math.cos(a) * 9.5).toFixed(1)} ${(12 + Math.sin(a) * 9.5).toFixed(1)}"/>`; }).join('')}</g></svg>` },
    gemini: { name: 'Gemini', cls: 'gemini', logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="gemG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C8DF6"/><stop offset=".55" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path fill="url(#gemG)" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z"/></svg>' }
  };

  const COLORS = { violet: 'var(--violet)', peach: 'var(--peach)', lavender: 'var(--lavender)', deep: 'var(--deep)', ink: 'var(--ink)', mute: 'var(--mute)', green: '#3FA66B', blue: '#4C8DF6', pink: '#E77FB3', yellow: '#E8B634' };
  const CYCLE = ['violet', 'peach', 'lavender', 'deep', 'blue', 'green'];

  // ---------- модель ----------
  const flatten = (deck) => {
    const chapters = [];
    const slides = [];
    (deck?.chapters || []).forEach((c, ci) => {
      const list = (c.slides || []).filter(s => s && typeof s === 'object');
      if (!list.length) return;
      const cover = list.find(s => s.type === 'cover' && safeFile(s.image));
      const ch = { id: String(c.id || `ch${ci + 1}`), title: c.title || `Глава ${chapters.length + 1}`, emoji: c.emoji || '', start: slides.length, count: list.length, n: chapters.length, cover: cover ? safeFile(cover.image) : '' };
      chapters.push(ch);
      list.forEach((s, local) => slides.push({ s, ch, local }));
    });
    return { chapters, slides };
  };

  const KEY = (m) => `focus.deck.${m}`;
  const load = (m) => { try { return JSON.parse(localStorage.getItem(KEY(m))) || {}; } catch { return {}; } };

  const progress = (moduleId, deck) => {
    const { chapters, slides } = flatten(deck);
    const st = load(moduleId);
    const fresh = st.n !== slides.length;
    const seen = new Set(fresh ? [] : (st.seen || []));
    const pos = fresh ? 0 : Math.min(Math.max(0, Number(st.pos) || 0), slides.length - 1);
    return {
      total: slides.length,
      pos,
      started: !fresh && (seen.size > 0),
      done: !fresh && !!st.done,
      chapters: chapters.map(c => {
        const n = Array.from({ length: c.count }, (_, k) => seen.has(c.start + k)).filter(Boolean).length;
        return { ...c, seen: n, done: n === c.count, current: pos >= c.start && pos < c.start + c.count };
      })
    };
  };

  // ---------- DOM ----------
  let root, stage, rail, segs, chTitle, chSub, counter, btnPrev, btnNext, nextLabel, sheet, sheetGrid, zoom, zoomBody, hint;
  let S = null;
  let anim = null;
  let drag = null;
  let suppressClick = false;

  const ensureRoot = () => {
    if (root) return;
    root = document.createElement('div');
    root.className = 'deck';
    root.id = 'deck';
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Урок');
    root.innerHTML = `
      <aside class="deck-rail" aria-label="Оглавление урока">
        <div class="rail-top"><span class="rail-kicker"></span><b class="rail-title"></b>
          <span class="rail-prog" aria-hidden="true"><i></i></span><span class="rail-meta"></span></div>
        <ol class="rail-list"></ol>
      </aside>
      <header class="deck-top">
        <div class="deck-segs" aria-hidden="true"></div>
        <div class="deck-bar">
          <button class="deck-ic" type="button" data-act="close" aria-label="Закрыть урок">${ICON.close}</button>
          <button class="deck-chapter" type="button" data-act="menu" aria-label="Главы урока">
            <span class="deck-ch-sub"></span>
            <span class="deck-ch-title"></span>
          </button>
          <span class="deck-count" aria-live="polite"></span>
          <button class="deck-ic deck-full" type="button" data-act="full" aria-label="Во весь экран">${ICON.full}</button>
          <button class="deck-ic" type="button" data-act="menu" aria-label="Все главы">${ICON.grid}</button>
        </div>
      </header>
      <div class="deck-stage"></div>
      <footer class="deck-foot">
        <div class="deck-hint" aria-hidden="true"></div>
        <button class="deck-prev" type="button" data-act="prev" aria-label="Предыдущий слайд">${ICON.left}</button>
        <button class="deck-next" type="button" data-act="next"><span class="deck-next-label">Дальше</span>${ICON.right}</button>
      </footer>
      <div class="deck-sheet" hidden>
        <div class="deck-sheet-bg" data-act="sheet-close"></div>
        <div class="deck-sheet-panel" role="dialog" aria-label="Главы урока" tabindex="-1">
          <div class="deck-sheet-head">
            <h3>Главы урока</h3>
            <button class="deck-ic" type="button" data-act="sheet-close" aria-label="Закрыть">${ICON.close}</button>
          </div>
          <div class="deck-sheet-grid"></div>
        </div>
      </div>
      <div class="deck-zoom" hidden>
        <button class="deck-ic deck-zoom-x" type="button" data-act="zoom-close" aria-label="Закрыть">${ICON.close}</button>
        <div class="deck-zoom-body"></div>
      </div>`;
    document.body.appendChild(root);
    stage = root.querySelector('.deck-stage');
    rail = root.querySelector('.rail-list');
    segs = root.querySelector('.deck-segs');
    chTitle = root.querySelector('.deck-ch-title');
    chSub = root.querySelector('.deck-ch-sub');
    counter = root.querySelector('.deck-count');
    btnPrev = root.querySelector('.deck-prev');
    btnNext = root.querySelector('.deck-next');
    nextLabel = root.querySelector('.deck-next-label');
    sheet = root.querySelector('.deck-sheet');
    sheetGrid = root.querySelector('.deck-sheet-grid');
    zoom = root.querySelector('.deck-zoom');
    zoomBody = root.querySelector('.deck-zoom-body');
    hint = root.querySelector('.deck-hint');
    if (!document.fullscreenEnabled || matchMedia('(pointer: coarse), (max-width: 760px)').matches) root.querySelector('.deck-full').remove();

    root.addEventListener('click', onClick);
    stage.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
  };

  // ---------- рендер слайдов ----------
  const media = (s) => {
    if (s.diagram) return diagramBox(s.diagram, '');
    const f = safeFile(s.image);
    return f ? `<figure class="s-fig s-img" data-zoom><div class="s-fig-box"><img src="media/${E(S.moduleId)}/${E(f)}" alt="${E(s.title || '')}" decoding="async"></div></figure>` : '';
  };

  const diagramBox = (name, caption) => {
    const svg = S.diagrams[name];
    if (!svg) return '<figure class="s-fig is-missing"><div class="s-fig-box"><span>Схема готовится</span></div></figure>';
    const vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    const ar = vb ? `${vb[1]} / ${vb[2]}` : '3 / 4';
    return `<figure class="s-fig s-svg" data-zoom><div class="s-fig-box" style="--ar:${ar}">${svg}<span class="s-zoom-hint" aria-hidden="true">${ICON.zoom}</span></div>
      ${caption ? `<figcaption>${I(caption)}</figcaption>` : ''}</figure>`;
  };

  const head = (s, fallbackKicker = '') => `
    ${s.kicker || fallbackKicker ? `<div class="s-kicker">${E(s.kicker || fallbackKicker)}</div>` : ''}
    ${s.title ? `<h2 class="s-title">${I(s.title)}</h2>` : ''}`;
  const caption = (t) => (t ? `<p class="s-caption">${I(t)}</p>` : '');
  // две колонки на широком экране (подпись слева, медиа справа); на телефоне — столбик: заголовок → медиа → подпись
  const two = (side, main) => `<div class="s-two"><div class="s-side">${side}</div><div class="s-main">${main}</div></div>`;
  const note = (s) => (s.note ? `<p class="s-note">${I(s.note)}</p>` : '');

  const R = {
    cover: (s, ctx) => {
      const f = safeFile(s.image);
      return `
        ${f ? `<img class="cover-img" src="media/${E(S.moduleId)}/${E(f)}" alt="" decoding="async">` : `<div class="cover-num" aria-hidden="true">${String(ctx.ch.n + 1).padStart(2, '0')}</div>`}
        <div class="cover-shade"></div>
        <div class="cover-text">
          <div class="s-kicker">${E(s.kicker || `Глава ${ctx.ch.n + 1}`)}</div>
          <h2 class="s-title">${I(s.title || ctx.ch.title)}</h2>
          ${s.text ? `<div class="s-text">${paras(s.text)}</div>` : ''}
          <div class="cover-meta">${slidesWord(ctx.ch.count)} · ~${Math.max(1, Math.round(ctx.ch.count * 0.4))} мин</div>
        </div>`;
    },
    text: (s) => {
      const m = media(s);
      return m
        ? `<div class="s-split"><div class="s-copy">${head(s)}<div class="s-text">${paras(s.text)}</div>${note(s)}</div><div class="s-media">${m}</div></div>`
        : `${head(s)}<div class="s-text s-text-lg">${paras(s.text)}</div>${note(s)}`;
    },
    bullets: (s) => {
      const ic = { '✓': 'ok', '→': 'go', '✕': 'no', '×': 'no' }[s.icon] || 'dot';
      return `${head(s)}<ul class="bul bul-${ic}">${(s.items || []).map(t => `<li><span class="bul-i" aria-hidden="true">${ic === 'dot' ? '' : E(s.icon === '×' ? '✕' : s.icon)}</span><span>${I(t)}</span></li>`).join('')}</ul>${note(s)}`;
    },
    diagram: (s) => two(`${head(s)}${caption(s.caption)}${note(s)}`, diagramBox(s.diagram, '')),
    image: (s) => two(`${head(s)}${caption(s.caption)}
      ${s.prompt ? `<button class="s-how" type="button" data-act="how"><span>Промпт этой картинки</span><span class="s-how-ic" aria-hidden="true">${ICON.code}</span></button><template class="s-how-tpl">${E(s.prompt)}</template>` : ''}
      ${note(s)}`, media({ image: s.image, title: s.title }) || '<figure class="s-fig is-missing"><div class="s-fig-box"><span>Картинка готовится</span></div></figure>'),
    chat: (s) => {
      const app = APPS[String(s.app || '').toLowerCase()] || APPS.chatgpt;
      const msgs = (s.messages || []).map((m, k) => {
        const user = m.role === 'user';
        return `<div class="msg ${user ? 'msg-user' : 'msg-ai'}" data-k="${k}">${user ? '' : `<span class="msg-av">${app.logo}</span>`}<div class="msg-text">${paras(m.text)}</div>${user ? '' : '<span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>'}</div>`;
      }).join('');
      return two(`${head(s)}${caption(s.caption)}<button class="s-link s-replay" type="button" data-act="replay">${ICON.replay}Показать ещё раз</button>${note(s)}`, `
        <div class="chat chat-${app.cls}" data-chat>
          <div class="chat-head"><span class="chat-logo">${app.logo}</span><b>${app.name}</b></div>
          <div class="chat-body">${msgs}</div>
          <div class="chat-input" aria-hidden="true"><span>Сообщение</span><i>${ICON.up}</i></div>
        </div>`);
    },
    compare: (s) => {
      const bad = s.bad || {}, good = s.good || {};
      return `${head(s)}
        <div class="cmp" data-cmp>
          <div class="seg" role="tablist">
            <span class="seg-thumb" aria-hidden="true"></span>
            <button type="button" role="tab" aria-selected="true" data-tab="0">✕ ${E(bad.label || 'Было')}</button>
            <button type="button" role="tab" aria-selected="false" data-tab="1">✓ ${E(good.label || 'Стало')}</button>
          </div>
          <div class="cmp-panes">
            <div class="cmp-pane cmp-bad is-on" role="tabpanel"><div class="cmp-label">${E(bad.label || 'Было')}</div>${paras(bad.text)}</div>
            <div class="cmp-pane cmp-good" role="tabpanel"><div class="cmp-label">${E(good.label || 'Стало')}</div>${paras(good.text)}</div>
          </div>
        </div>${caption(s.caption)}${note(s)}`;
    },
    stat: (s) => `
      ${s.kicker ? `<div class="s-kicker">${E(s.kicker)}</div>` : ''}
      <div class="stat"><div class="stat-value" data-count="${E(s.value)}">${E(s.value)}</div>${s.unit ? `<div class="stat-unit">${E(s.unit)}</div>` : ''}</div>
      ${s.title ? `<h2 class="s-title">${I(s.title)}</h2>` : ''}
      ${s.text ? `<div class="s-text">${paras(s.text)}</div>` : ''}${note(s)}`,
    steps: (s) => `${head(s)}<ol class="steps">${(s.items || []).map((it, k) => `<li><span class="steps-n">${k + 1}</span><div><strong>${I(it.title)}</strong>${it.text ? `<span>${I(it.text)}</span>` : ''}</div></li>`).join('')}</ol>${note(s)}`,
    cards: (s) => {
      const items = s.items || [];
      return `${head(s)}
        <div class="flips flips-${Math.min(items.length, 6)}">${items.map(it => `
          <button class="flip" type="button" aria-pressed="false">
            <span class="flip-in"><span class="flip-face flip-front">${I(it.front)}<i>Нажми</i></span><span class="flip-face flip-back"><i>${I(it.front)}</i>${I(it.back)}</span></span>
          </button>`).join('')}</div>
        <p class="s-caption" data-flip-count>Открыто 0 из ${items.length}</p>${note(s)}`;
    },
    quiz: (s) => `
      <div class="s-kicker">${E(s.kicker || 'Проверь себя')}</div>
      <h2 class="s-title">${I(s.title)}</h2>
      <div class="quiz" data-answer="${Number(s.answer) || 0}">${(s.options || []).map((o, k) => `<button class="q-opt" type="button" data-k="${k}"><span class="q-key">${'ABCDEF'[k] || k + 1}</span><span class="q-txt">${I(o)}</span></button>`).join('')}</div>
      <div class="q-explain" hidden><strong></strong>${s.explain ? `<span>${I(s.explain)}</span>` : ''}</div>${note(s)}`,
    builder: (s) => {
      const parts = s.parts || [];
      const col = (p, k) => COLORS[p.color] || COLORS[CYCLE[k % CYCLE.length]];
      return `${head(s)}
        <div class="b-parts">${parts.map((p, k) => `<button class="b-chip" type="button" data-k="${k}" aria-pressed="false" style="--c:${col(p, k)}"><span>＋</span>${E(p.label)}</button>`).join('')}</div>
        <div class="b-out-wrap" data-copy-scope>
          <div class="b-meta"><span class="b-count">0 из ${parts.length}</span><button class="s-link" type="button" data-act="b-all">Собрать всё</button></div>
          <div class="b-out" data-empty="${E(s.caption || 'Тапай части сверху — промпт соберётся здесь')}"></div>
          <button class="s-btn" type="button" data-copy disabled>Скопировать промпт</button>
        </div>${note(s)}`;
    },
    prompt: (s) => `${head(s, 'Промпт')}<div class="s-prompt" data-copy-scope><pre data-copy-body>${E(s.text)}</pre><button class="s-btn s-btn-light" type="button" data-copy>Скопировать</button></div>${caption(s.caption)}${note(s)}`,
    table: (s) => {
      const cols = s.columns || [];
      const rows = s.rows || [];
      const data = cols.slice(1);
      // 3+ колонок данных: на телефоне — переключатель колонок (ChatGPT | Claude | Gemini) и строки списком
      const tabs = data.length >= 3 ? `
        <div class="tbl-tabs" data-col="0">
          <div class="seg" role="tablist" style="--n:${data.length}"><span class="seg-thumb" aria-hidden="true"></span>${data.map((c, k) => `<button type="button" role="tab" aria-selected="${k === 0}" data-col="${k}">${I(c)}</button>`).join('')}</div>
          <dl class="tt">${rows.map(r => `<div class="tt-row"><dt>${I(r[0])}</dt>${r.slice(1).map((c, k) => `<dd data-c="${k}"${k ? ' hidden' : ''}>${I(c)}</dd>`).join('')}</div>`).join('')}</dl>
        </div>` : `
        <div class="tbl-cards">${rows.map(r => `<div class="tc"><div class="tc-h">${I(r[0])}</div>${r.slice(1).map((c, k) => `<div class="tc-r tc-${k}"><span>${I(cols[k + 1] || '')}</span><b>${I(c)}</b></div>`).join('')}</div>`).join('')}</div>`;
      return `${head(s)}
        <div class="tbl">
          <table class="tbl-grid"><thead><tr>${cols.map(c => `<th>${I(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row">${I(c)}</th>` : `<td>${I(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table>
          ${tabs}
        </div>${caption(s.caption)}${note(s)}`;
    },
    checklist: (s, ctx) => {
      const saved = new Set(loadChecks(ctx));
      const items = s.items || [];
      return `${head(s, 'Чек-лист')}
        <ul class="check">${items.map((t, k) => `<li><button type="button" role="checkbox" aria-checked="${saved.has(k)}" data-k="${k}"><span class="check-box">${ICON.check}</span><span>${I(t)}</span></button></li>`).join('')}</ul>
        <div class="check-prog"><div class="progress"><i style="transform:scaleX(${items.length ? saved.size / items.length : 0})"></i></div><span>${saved.size} из ${items.length}</span></div>${note(s)}`;
    },
    links: (s) => `${head(s, 'Ссылки')}<div class="lnks">${(s.items || []).map(it => {
      const url = safeUrl(it.url);
      let host = '';
      try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { /* битая ссылка */ }
      return `<${url ? `a href="${E(url)}" target="_blank" rel="noopener"` : 'div'} class="lnk"><span class="lnk-t"><b>${E(it.label)}</b>${it.text ? `<span>${I(it.text)}</span>` : ''}${host ? `<i>${E(host)}</i>` : ''}</span><span class="lnk-go" aria-hidden="true">↗</span></${url ? 'a' : 'div'}>`;
    }).join('')}</div>${note(s)}`,
    finish: () => `
      <div class="fin">
        <div class="fin-mark">${ICON.check}</div>
        <div class="s-kicker">Финиш</div>
        <h2 class="s-title">Урок пройден</h2>
        <p class="s-text">${S.chapters.length} ${plural(S.chapters.length, ['глава', 'главы', 'глав'])} и ${slidesWord(S.slides.length)} позади. Теперь закрепим на своих задачах — это главное.</p>
        <div class="fin-actions">
          <button class="btn btn-primary" type="button" data-act="homework">Перейти к домашнему заданию</button>
          <button class="btn btn-ghost" type="button" data-act="close">К странице модуля</button>
          <button class="s-link" type="button" data-act="restart">↺ Пройти заново</button>
        </div>
      </div>`
  };

  const CENTERED = new Set(['text', 'bullets', 'stat', 'steps', 'quiz', 'prompt', 'finish', 'checklist', 'links', 'compare', 'chat', 'table', 'cards']);

  const build = (i) => {
    const item = i >= S.slides.length ? { s: { type: 'finish' }, ch: S.chapters[S.chapters.length - 1], local: -1 } : S.slides[i];
    const type = R[item.s.type] ? item.s.type : 'text';
    const el = document.createElement('section');
    el.className = `slide t-${type}${CENTERED.has(type) ? ' is-centered' : ''}`;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'слайд');
    el.setAttribute('aria-label', i >= S.slides.length ? 'Финиш' : `${i + 1} из ${S.slides.length}`);
    el._i = i;
    el._ctx = item;
    const body = R[type](item.s, item);
    el.innerHTML = type === 'cover' ? `<div class="s-cover">${body}</div>` : `<div class="s-scroll"><div class="s-inner">${body}</div></div>`;
    el.querySelectorAll('img').forEach(im => im.addEventListener('error', () => {
      const fig = im.closest('.s-fig');
      if (fig) { fig.classList.add('is-missing'); fig.querySelector('.s-fig-box').innerHTML = '<span>Картинка готовится</span>'; fig.removeAttribute('data-zoom'); }
      else { im.remove(); el.classList.add('no-img'); }
    }, { once: true }));
    if (type === 'chat') setupChat(el);
    if (type === 'stat') el._onFirst = () => countUp(el.querySelector('.stat-value'));
    if (type === 'builder') el._builder = { on: new Set(), parts: item.s.parts || [] };
    return el;
  };

  const slideEl = (i) => {
    if (!S.els.has(i)) S.els.set(i, build(i));
    return S.els.get(i);
  };

  // чат: сообщения появляются по очереди; место под них зарезервировано (visibility), поэтому слайд не прыгает
  const setupChat = (el) => {
    const msgs = [...el.querySelectorAll('.msg[data-k]')];
    let timers = [];
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    const showAll = () => {
      stop();
      msgs.forEach(m => m.classList.remove('is-pending', 'is-typing'));
      el.classList.remove('is-playing');
    };
    const play = () => {
      stop();
      if (reduced()) { showAll(); return; }
      msgs.forEach(m => { m.classList.add('is-pending'); m.classList.remove('is-in', 'is-typing'); });
      el.classList.add('is-playing');
      let t = 250;
      msgs.forEach((m, k) => {
        const ai = m.classList.contains('msg-ai');
        if (ai) {
          timers.push(setTimeout(() => { m.classList.add('is-typing'); }, t));
          t += 700 + Math.min(600, m.textContent.length * 4);
        } else if (k) t += 450;
        timers.push(setTimeout(() => {
          m.classList.remove('is-pending', 'is-typing');
          m.classList.add('is-in');
          if (k === msgs.length - 1) el.classList.remove('is-playing');
        }, t));
      });
    };
    if (!reduced()) msgs.forEach(m => m.classList.add('is-pending'));
    el._onFirst = play;
    el._onHide = showAll;
    el._replay = play;
    el.querySelector('.chat-body').addEventListener('click', () => { if (el.classList.contains('is-playing')) showAll(); });
  };

  // счётчик: «128 000» → 0…128 000, «×3» → ×0…×3; нечисловое оставляем как есть
  const countUp = (node) => {
    const raw = node.dataset.count;
    const m = raw.match(/^(\D*?)(\d[\d\s ]*(?:[.,]\d+)?)(.*)$/);
    if (!m || reduced()) return;
    const [, pre, num, post] = m;
    const dec = (num.split(/[.,]/)[1] || '').length;
    const target = parseFloat(num.replace(/[\s ]/g, '').replace(',', '.'));
    if (!isFinite(target) || target === 0) return;
    const fmt = (v) => v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const t0 = performance.now();
    const dur = 1100;
    node.style.minWidth = `${node.offsetWidth}px`;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      node.textContent = p < 1 ? `${pre}${fmt(target * e)}${post}` : raw;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const checkKey = (ctx) => `${KEY(S.moduleId)}.check.${ctx.ch.id}.${ctx.local}`;
  const loadChecks = (ctx) => { try { return JSON.parse(localStorage.getItem(checkKey(ctx))) || []; } catch { return []; } };

  // ---------- переходы ----------
  const finishAnim = () => { if (anim) anim.complete(); };

  // анимации на WAAPI: interruptible — complete() синхронно доводит состояние до конца
  const run = (list, done) => {
    const anims = list.map(([el, frames, opts]) => el.animate(frames, { easing: EASE, fill: 'none', ...opts }));
    const a = {
      completed: false,
      complete() {
        if (this.completed) return;
        this.completed = true;
        anims.forEach(x => x.cancel());
        if (anim === this) anim = null;
        done();
      }
    };
    anim = a;
    Promise.all(anims.map(x => x.finished)).then(() => a.complete(), () => {});
    return a;
  };

  const detachExcept = (keep) => {
    [...stage.children].forEach(c => {
      if (c !== keep) { c.remove(); c.style.transform = ''; c.style.opacity = ''; }
    });
  };

  const activate = (i) => {
    const el = slideEl(i);
    const prev = S.cur;
    if (prev && prev !== el) {
      prev._onHide?.();
      prev.classList.remove('is-current');
      prev.inert = true;
    }
    if (el.parentNode !== stage) stage.appendChild(el);
    el.inert = false;
    el.classList.add('is-current');
    S.idx = i;
    S.cur = el;
    if (i < S.slides.length) S.seen.add(i); else S.done = true;
    save();
    chrome();
    S.onChange?.(i);
    if (!el._shown) {
      el._shown = true;
      if (!reduced()) {
        el.classList.add('is-enter');
        setTimeout(() => el.classList.remove('is-enter'), 700);
      }
      el._onFirst?.();
    }
    // подгрузить соседей заранее (картинки начнут грузиться)
    [i - 1, i + 1].forEach(k => { if (k >= 0 && k <= S.slides.length) slideEl(k); });
  };

  const show = (i, mode = 'slide') => {
    if (!S) return;
    i = Math.max(0, Math.min(S.slides.length, i));
    finishAnim();
    if (i === S.idx && S.cur?.parentNode === stage) return;
    const from = S.cur;
    const dir = i > S.idx ? 1 : -1;
    activate(i);
    const to = S.cur;
    if (!from || from === to || mode === 'none') { detachExcept(to); return; }
    from.style.pointerEvents = 'none';
    const dx = reduced() ? 0 : 40;
    run([
      [from, [{ opacity: 1, transform: 'translate3d(0,0,0)' }, { opacity: 0, transform: `translate3d(${-dir * dx}px,0,0)` }], { duration: 220 }],
      [to, [{ opacity: 0, transform: `translate3d(${dir * dx}px,0,0)` }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 260 }]
    ], () => { from.style.pointerEvents = ''; detachExcept(S?.cur); });
  };

  const go = (d) => {
    if (!S) return;
    hideHint();
    show(S.idx + d);
  };

  // ---------- свайп: слайд идёт за пальцем, на краях — резинка ----------
  const rubber = (x, w) => Math.sign(x) * (1 - 1 / ((Math.abs(x) * 0.55) / w + 1)) * w * 0.5;

  const onDown = (e) => {
    if (!S || drag || !e.isPrimary || e.pointerType === 'mouse' || e.button > 0) return;
    if (e.target.closest('[data-noswipe]')) return; // горизонтально прокручиваемые блоки
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, axis: null, pts: [] };
  };

  const placeDrag = (dx) => {
    const { step, prev, next } = drag;
    const has = dx < 0 ? next : prev;
    const x = has ? dx : rubber(dx, step);
    S.cur.style.transform = `translate3d(${x}px,0,0)`;
    if (next) next.style.transform = `translate3d(${x + step}px,0,0)`;
    if (prev) prev.style.transform = `translate3d(${x - step}px,0,0)`;
    drag.x = x;
  };

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      finishAnim();
      hideHint();
      try { stage.setPointerCapture(e.pointerId); } catch { /* ок */ }
      drag.step = S.cur.offsetWidth + GAP;
      drag.next = S.idx < S.slides.length ? slideEl(S.idx + 1) : null;
      drag.prev = S.idx > 0 ? slideEl(S.idx - 1) : null;
      [drag.next, drag.prev].forEach(n => { if (n) { n.style.opacity = ''; n.inert = true; if (n.parentNode !== stage) stage.appendChild(n); } });
      root.classList.add('is-dragging');
      drag.x0 = e.clientX; // старт без скачка на 8px
    }
    drag.dx = e.clientX - drag.x0;
    drag.pts.push([e.timeStamp, drag.dx]);
    while (drag.pts.length > 2 && e.timeStamp - drag.pts[0][0] > 100) drag.pts.shift();
    placeDrag(drag.dx);
  };

  const settle = (d) => {
    const { step, prev, next, x } = d;
    root.classList.remove('is-dragging');
    const [t0, x0] = d.pts[0] || [0, 0];
    const [t1, x1] = d.pts[d.pts.length - 1] || [0, 0];
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0; // px/ms
    let dir = 0;
    if ((d.dx < -step * 0.22 || v < -0.35) && next && v < 0.2) dir = 1;
    else if ((d.dx > step * 0.22 || v > 0.35) && prev && v > -0.2) dir = -1;
    const target = -dir * step;
    const dur = Math.max(160, Math.min(300, (Math.abs(target - x) / Math.max(0.6, Math.abs(v))) || 260));
    const cur = S.cur;
    const list = [[cur, [{ transform: `translate3d(${x}px,0,0)` }, { transform: `translate3d(${target}px,0,0)` }], { duration: dur }]];
    if (next) list.push([next, [{ transform: `translate3d(${x + step}px,0,0)` }, { transform: `translate3d(${target + step}px,0,0)` }], { duration: dur }]);
    if (prev) list.push([prev, [{ transform: `translate3d(${x - step}px,0,0)` }, { transform: `translate3d(${target - step}px,0,0)` }], { duration: dur }]);
    [cur, next, prev].forEach(n => { if (n) n.style.transform = ''; });
    // держим финальные позиции до конца анимации, чтобы не мигало
    list.forEach(item => { item[2].fill = 'forwards'; });
    run(list, () => {
      [cur, next, prev].forEach(n => { if (n) n.style.transform = ''; });
      if (!S) return;
      if (dir) activate(S.idx + dir);
      detachExcept(S.cur);
    });
  };

  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis !== 'x') return;
    suppressClick = Math.abs(d.dx) > 4;
    setTimeout(() => { suppressClick = false; }, 0);
    settle(d);
  };

  const onCancel = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis === 'x') settle({ ...d, dx: 0, pts: [] });
  };

  // ---------- хром: сегменты, глава, счётчик, кнопки ----------
  const chrome = () => {
    const { idx, slides, chapters } = S;
    const total = slides.length;
    const fin = idx >= total;
    const item = fin ? null : slides[idx];
    [...segs.children].forEach((seg, k) => {
      const c = chapters[k];
      const f = fin || idx >= c.start + c.count ? 1 : idx < c.start ? 0 : (idx - c.start + 1) / c.count;
      seg.firstChild.style.transform = `scaleX(${f})`;
      seg.classList.toggle('is-on', !fin && item?.ch === c);
    });
    chSub.textContent = fin ? 'Финиш' : `Глава ${item.ch.n + 1} из ${chapters.length}`;
    chTitle.textContent = fin ? 'Урок пройден' : item.ch.title;
    counter.textContent = `${Math.min(idx + 1, total)} / ${total}`;
    btnPrev.disabled = idx === 0;
    root.classList.toggle('is-fin', fin);
    let label = 'Дальше';
    let wide = false;
    if (!fin) {
      if (idx === total - 1) { label = 'Завершить урок'; wide = true; }
      else if (item.local === item.ch.count - 1) { const nc = chapters[item.ch.n + 1]; label = `Глава ${nc.n + 1}: ${nc.title}`; wide = true; }
    }
    nextLabel.textContent = label;
    btnNext.classList.toggle('is-chapter', wide);
    btnNext.setAttribute('aria-label', label);
    updateRail();
  };

  const save = () => {
    try {
      localStorage.setItem(KEY(S.moduleId), JSON.stringify({ pos: Math.min(S.idx, S.slides.length - 1), seen: [...S.seen], done: S.done, n: S.slides.length }));
    } catch { /* приватный режим */ }
  };

  const hideHint = () => { root.classList.remove('show-hint'); };

  // ---------- оглавление-рельс (десктоп): главы, внутри текущей — список слайдов ----------
  const plain = (t) => String(t ?? '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const slideName = (it) => {
    const s = it.s;
    if (s.type === 'cover') return 'Обложка главы';
    if (s.type === 'quiz') return `Вопрос: ${plain(s.title)}`;
    return plain(s.title || s.kicker || it.ch.title);
  };

  const renderRail = () => {
    root.querySelector('.rail-kicker').textContent = `Урок · ${slidesWord(S.slides.length)}`;
    root.querySelector('.rail-title').textContent = S.title || 'Урок';
    rail.innerHTML = S.chapters.map((c, k) => `
      <li class="rc" data-chn="${k}">
        <button type="button" class="rc-btn" data-ch="${k}">
          <span class="rc-thumb">${c.cover ? `<img src="media/${E(S.moduleId)}/${E(c.cover)}" alt="" loading="lazy">` : ''}<span>${k + 1}</span></span>
          <span class="rc-t"><b>${E(c.title)}</b><small></small></span>
        </button>
        <div class="rc-fold"><ol class="rc-slides">${S.slides.slice(c.start, c.start + c.count).map((it, j) => `
          <li><button type="button" class="rs" data-go="${c.start + j}"><span class="rs-n">${j + 1}</span><span class="rs-t">${E(slideName(it))}</span></button></li>`).join('')}
        </ol></div>
      </li>`).join('');
    rail.querySelectorAll('img').forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
  };

  const updateRail = () => {
    if (!rail || !rail.children.length) return;
    const { idx, slides, chapters, seen } = S;
    const fin = idx >= slides.length;
    const curCh = fin ? -1 : slides[idx].ch.n;
    chapters.forEach((c, k) => {
      const li = rail.children[k];
      let n = 0;
      for (let i = c.start; i < c.start + c.count; i++) if (seen.has(i)) n++;
      li.classList.toggle('is-current', k === curCh);
      li.classList.toggle('is-done', n === c.count);
      li.querySelector('small').textContent = n === c.count ? `${slidesWord(c.count)} · пройдена` : n ? `${n} из ${c.count}` : slidesWord(c.count);
    });
    rail.querySelectorAll('.rs').forEach(b => {
      const i = Number(b.dataset.go);
      b.classList.toggle('is-current', i === idx);
      b.classList.toggle('is-seen', seen.has(i));
      if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    const total = slides.length;
    root.querySelector('.rail-prog i').style.transform = `scaleX(${fin ? 1 : seen.size / total})`;
    root.querySelector('.rail-meta').textContent = fin ? 'Урок пройден' : `${Math.round((seen.size / total) * 100)}% просмотрено · осталось ~${Math.max(1, Math.round((total - idx) * 0.4))} мин`;
    // текущий слайд — в зону видимости рельса (только скролл самого списка)
    const cur = rail.querySelector('.rs.is-current') || rail.querySelector('.rc.is-current');
    if (cur && rail.offsetParent) {
      requestAnimationFrame(() => {
        const r = rail.getBoundingClientRect();
        const b = cur.getBoundingClientRect();
        if (b.top < r.top + 8 || b.bottom > r.bottom - 8) rail.scrollTo({ top: rail.scrollTop + (b.top - r.top) - r.height / 3, behavior: reduced() ? 'auto' : 'smooth' });
      });
    }
  };

  // ---------- шторка глав ----------
  const openSheet = () => {
    const p = progress(S.moduleId, S.deck);
    const curCh = S.idx < S.slides.length ? S.slides[S.idx].ch.n : -1;
    sheetGrid.innerHTML = p.chapters.map((c, k) => `
      <button class="ch-card${k === curCh ? ' is-current' : ''}${c.done ? ' is-done' : ''}" type="button" data-ch="${k}">
        <span class="ch-cover">${c.cover ? `<img src="media/${E(S.moduleId)}/${E(c.cover)}" alt="" loading="lazy">` : ''}<span class="ch-num">${k + 1}</span>${c.done ? `<span class="ch-done">${ICON.check}</span>` : ''}</span>
        <span class="ch-meta">Глава ${k + 1} · ${slidesWord(c.count)}</span>
        <span class="ch-title">${E(c.title)}</span>
        ${k === curCh ? '<span class="ch-now">Ты здесь</span>' : ''}
      </button>`).join('');
    sheetGrid.querySelectorAll('img').forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
    sheet.hidden = false;
    sheet.getBoundingClientRect();
    sheet.classList.add('is-open');
    sheetGrid.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
    sheet.querySelector('.deck-sheet-panel').focus?.();
  };

  const closeSheet = () => {
    if (sheet.hidden) return;
    sheet.classList.remove('is-open');
    setTimeout(() => { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, 260);
  };

  // ---------- зум схем и картинок ----------
  const openPanel = (html, cls = 'is-panel') => {
    zoom.className = `deck-zoom ${cls}`;
    zoomBody.innerHTML = html;
    zoom.hidden = false;
    zoom.getBoundingClientRect();
    zoom.classList.add('is-open');
  };
  const openZoom = (fig) => {
    const box = fig.querySelector('.s-fig-box');
    zoom.className = `deck-zoom ${fig.classList.contains('s-img') ? 'is-img' : 'is-svg'}`;
    zoomBody.innerHTML = box.innerHTML;
    zoom.hidden = false;
    zoom.getBoundingClientRect();
    zoom.classList.add('is-open');
  };
  const closeZoom = () => {
    if (zoom.hidden) return;
    zoom.classList.remove('is-open');
    setTimeout(() => { if (!zoom.classList.contains('is-open')) { zoom.hidden = true; zoomBody.innerHTML = ''; } }, 200);
  };

  // ---------- копирование ----------
  const copyText = async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* нет доступа */ }
      ta.remove();
    }
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.textContent = 'Скопировано ✓';
    btn.classList.add('is-done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.innerHTML = btn.dataset.label; btn.classList.remove('is-done'); }, 1600);
  };

  // ---------- интерактив слайдов ----------
  const updateBuilder = (slide) => {
    const b = slide._builder;
    const order = b.parts.map((_, k) => k).filter(k => b.on.has(k));
    const out = slide.querySelector('.b-out');
    out.innerHTML = order.map(k => {
      const chip = slide.querySelector(`.b-chip[data-k="${k}"]`);
      return `<span class="b-piece" style="--c:${chip.style.getPropertyValue('--c')}"><em>${E(b.parts[k].label)}</em>${E(b.parts[k].text)}</span>`;
    }).join('');
    slide.querySelector('.b-count').textContent = `${order.length} из ${b.parts.length}`;
    slide.querySelector('.b-out-wrap [data-copy]').disabled = !order.length;
    slide.querySelector('[data-act="b-all"]').textContent = order.length === b.parts.length ? 'Очистить' : 'Собрать всё';
    slide.querySelector('.b-out-wrap')._copyText = () => order.map(k => b.parts[k].text).join('\n');
  };

  const onClick = (e) => {
    const t = e.target;
    const act = t.closest('[data-act]')?.dataset.act;
    const slide = t.closest('.slide');

    if (act === 'close') { (S?.requestClose || close)(); return; }
    if (act === 'prev') { go(-1); return; }
    if (act === 'next') { go(1); return; }
    if (act === 'menu') { openSheet(); return; }
    if (act === 'sheet-close') { closeSheet(); return; }
    if (act === 'zoom-close' || t === zoom || t === zoomBody) { closeZoom(); return; }
    if (!zoom.hidden && !t.closest('[data-copy]')) return;
    if (act === 'full') {
      if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {});
      return;
    }
    if (act === 'restart') { show(0); return; }
    if (act === 'homework') { S.onHomework?.(); (S.requestClose || close)(); return; }
    if (act === 'replay' && slide?._replay) { slide._replay(); return; }
    if (act === 'how' && slide) {
      const tpl = slide.querySelector('.s-how-tpl');
      openPanel(`<div class="how" data-copy-scope><div class="s-kicker">Промпт этой картинки</div><pre data-copy-body>${tpl.innerHTML}</pre><button class="s-btn" type="button" data-copy>${ICON.copy}Скопировать промпт</button></div>`);
      return;
    }

    const ch = t.closest('[data-ch]');
    if (ch) { closeSheet(); show(S.chapters[Number(ch.dataset.ch)].start); return; }
    const goEl = t.closest('[data-go]');
    if (goEl) { show(Number(goEl.dataset.go)); return; }

    const copyBtn = t.closest('[data-copy]');
    if (copyBtn) {
      const scope = copyBtn.closest('[data-copy-scope]');
      const text = scope._copyText ? scope._copyText() : scope.querySelector('[data-copy-body]').textContent;
      copyText(text, copyBtn);
      return;
    }

    const fig = t.closest('.s-fig[data-zoom]');
    if (fig) { openZoom(fig); return; }

    const tab = t.closest('.cmp [data-tab]');
    if (tab) {
      const cmp = tab.closest('.cmp');
      const k = Number(tab.dataset.tab);
      cmp.classList.toggle('is-good', k === 1);
      cmp.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.tab) === k)));
      cmp.querySelectorAll('.cmp-pane').forEach((p, n) => p.classList.toggle('is-on', n === k));
      return;
    }

    const colBtn = t.closest('.tbl-tabs [data-col]');
    if (colBtn && colBtn.tagName === 'BUTTON') {
      const box = colBtn.closest('.tbl-tabs');
      const k = Number(colBtn.dataset.col);
      box.dataset.col = k;
      box.querySelectorAll('button[data-col]').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.col) === k)));
      box.querySelector('.seg-thumb').style.transform = `translateX(${k * 100}%)`;
      box.querySelectorAll('dd[data-c]').forEach(d => { d.hidden = Number(d.dataset.c) !== k; });
      return;
    }

    const flip = t.closest('.flip');
    if (flip) {
      flip.setAttribute('aria-pressed', String(flip.getAttribute('aria-pressed') !== 'true'));
      flip.classList.add('was-flipped');
      const all = slide.querySelectorAll('.flip');
      const open = slide.querySelectorAll('.flip.was-flipped').length;
      slide.querySelector('[data-flip-count]').textContent = open === all.length ? 'Все карточки открыты ✓' : `Открыто ${open} из ${all.length}`;
      return;
    }

    const opt = t.closest('.q-opt');
    if (opt) {
      const quiz = opt.closest('.quiz');
      if (quiz.classList.contains('is-answered')) return;
      const ans = Number(quiz.dataset.answer);
      const k = Number(opt.dataset.k);
      quiz.classList.add('is-answered');
      quiz.querySelectorAll('.q-opt').forEach(b => {
        const n = Number(b.dataset.k);
        b.classList.toggle('is-right', n === ans);
        b.classList.toggle('is-wrong', n === k && n !== ans);
        b.classList.toggle('is-picked', n === k);
        b.setAttribute('aria-disabled', 'true');
      });
      const ex = slide.querySelector('.q-explain');
      ex.querySelector('strong').textContent = k === ans ? 'Верно!' : 'Не совсем.';
      ex.classList.toggle('is-right', k === ans);
      ex.hidden = false;
      return;
    }

    const chip = t.closest('.b-chip');
    if (chip) {
      const b = slide._builder;
      const k = Number(chip.dataset.k);
      b.on.has(k) ? b.on.delete(k) : b.on.add(k);
      chip.setAttribute('aria-pressed', String(b.on.has(k)));
      updateBuilder(slide);
      return;
    }
    if (act === 'b-all') {
      const b = slide._builder;
      const full = b.on.size === b.parts.length;
      b.parts.forEach((_, k) => (full ? b.on.delete(k) : b.on.add(k)));
      slide.querySelectorAll('.b-chip').forEach(c => c.setAttribute('aria-pressed', String(!full)));
      updateBuilder(slide);
      return;
    }

    const box = t.closest('.check [role="checkbox"]');
    if (box) {
      const on = box.getAttribute('aria-checked') !== 'true';
      box.setAttribute('aria-checked', String(on));
      const list = [...slide.querySelectorAll('.check [role="checkbox"]')];
      const done = list.filter(b => b.getAttribute('aria-checked') === 'true');
      try { localStorage.setItem(checkKey(slide._ctx), JSON.stringify(done.map(b => Number(b.dataset.k)))); } catch { /* ок */ }
      slide.querySelector('.check-prog i').style.transform = `scaleX(${done.length / list.length})`;
      slide.querySelector('.check-prog span').textContent = `${done.length} из ${list.length}`;
    }
  };

  const onKey = (e) => {
    if (!S || root.hidden) return;
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    if (e.key === 'Escape') {
      if (!zoom.hidden) closeZoom();
      else if (!sheet.hidden) closeSheet();
      else (S.requestClose || close)();
      e.preventDefault();
      return;
    }
    if (!sheet.hidden || !zoom.hidden || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); hideHint(); show(S.idx + 1, e.repeat ? 'none' : 'slide'); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); hideHint(); show(S.idx - 1, e.repeat ? 'none' : 'slide'); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, 'none'); }
    else if (e.key === 'End') { e.preventDefault(); show(S.slides.length - 1, 'none'); }
  };

  // ---------- открыть / закрыть ----------
  let closing = null;

  const open = (opts) => {
    ensureRoot();
    if (closing) { clearTimeout(closing); closing = null; }
    if (S) { goTo(opts.start ?? S.idx); return; }
    const { chapters, slides } = flatten(opts.deck);
    if (!slides.length) return;
    const st = load(opts.moduleId);
    const fresh = st.n !== slides.length;
    S = {
      ...opts,
      diagrams: opts.diagrams || {},
      chapters,
      slides,
      els: new Map(),
      seen: new Set(fresh ? [] : st.seen || []),
      done: !fresh && !!st.done,
      idx: -1,
      cur: null
    };
    segs.innerHTML = chapters.map(c => `<span class="deck-seg" style="flex:${c.count} 1 0"><i></i></span>`).join('');
    renderRail();
    stage.innerHTML = '';
    root.hidden = false;
    root.classList.remove('is-closing');
    document.documentElement.classList.add('deck-open');
    const start = opts.start ?? (fresh ? 0 : Number(st.pos) || 0);
    show(start, 'none');
    if (fresh) {
      hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Листай свайпом ← →' : 'Листай стрелками ← → на клавиатуре';
      root.classList.add('show-hint');
      setTimeout(hideHint, 3200);
    }
    if (!reduced()) root.animate([{ opacity: 0, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
    root.focus({ preventScroll: true });
  };

  const goTo = (i) => { if (S && i !== S.idx) show(i, 'none'); };

  const close = () => {
    if (!S) return;
    finishAnim();
    drag = null;
    S.cur?._onHide?.();
    const cb = S.onClose;
    S = null;
    if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
    closeSheet();
    closeZoom();
    document.documentElement.classList.remove('deck-open');
    const finish = () => { root.hidden = true; stage.innerHTML = ''; closing = null; };
    if (reduced()) finish();
    else {
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
      closing = setTimeout(finish, 160);
    }
    cb?.();
  };

  return { open, close, goTo, isOpen: () => !!S, progress, flatten, slidesWord, plural };
})();
