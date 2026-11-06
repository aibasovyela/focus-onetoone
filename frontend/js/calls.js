// Календарь созвонов: ближайший созвон в хиро маршрута, страница #calls (план ученика) и #host (режим ведущего).
// Время везде Алматы (UTC+5 круглый год): calls[N] приходят строками «YYYY-MM-DD HH:MM» (или «YYYY-MM-DD» — время уточняется).
const CALLS = (() => {
  const TZ = 'Etc/GMT-5'; // фикс. UTC+5: у старых браузеров в базе поясов Asia/Almaty ещё +6 (до 03.2024)
  const MEET_EARLY_MIN = 15;   // Meet активна за 15 минут до начала и до конца созвона
  const DURS = [60, 90, 120, 150];

  let me = null;
  let modules = [];
  let plan = { calls: [], feed: '' };
  let host = null;             // { modules, students } для режима ведущего
  let hostSel = null;          // id выбранного ученика
  let confirmDel = null;       // номер блока, для которого спрашиваем «удалить?»
  let editing = null;          // номер блока в шторке
  let saving = false;

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');

  // ---------- время ----------
  const timed = (c) => c.at.length > 10;
  const startOf = (c) => Date.parse(`${c.at.slice(0, 10)}T${timed(c) ? c.at.slice(11, 16) : '00:00'}:00+05:00`);
  const endOf = (c) => startOf(c) + (timed(c) ? c.dur : 24 * 60) * 60000;
  const fmt = (ms, opts) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...opts }).format(ms);
  const todayAlmaty = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const addDays = (ymd, days) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const daysFromToday = (c) => Math.round((Date.parse(`${c.at.slice(0, 10)}T00:00:00Z`) - Date.parse(`${todayAlmaty()}T00:00:00Z`)) / 86400000);
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const dayLabel = (c) => fmt(startOf(c), { weekday: 'short', day: 'numeric', month: 'long' });
  const durLabel = (min) => (min % 60 ? (min > 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${min} мин`) : `${min / 60} ч`);
  const shortDur = (min) => (min % 30 ? `${min} мин` : `${String(min / 60).replace('.', ',')} ч`);
  const timeLabel = (c) => (timed(c) ? `${c.at.slice(11, 16)}–${fmt(endOf(c), { hour: '2-digit', minute: '2-digit' })}` : 'время уточняется');

  // past — прошёл, live — идёт, soon — начнётся в ближайшие 15 минут, future — позже
  const phase = (c, now = Date.now()) => {
    if (now >= endOf(c)) return 'past';
    if (now >= startOf(c)) return 'live';
    if (timed(c) && now >= startOf(c) - MEET_EARLY_MIN * 60000) return 'soon';
    return 'future';
  };
  const meetOpen = (c) => ['live', 'soon'].includes(phase(c));
  const whenLabel = (c) => {
    const p = phase(c);
    if (p === 'past') return 'Прошёл';
    if (p === 'live') return 'Идёт сейчас';
    if (p === 'soon') return 'Скоро начало';
    const d = daysFromToday(c);
    return d <= 0 ? 'Сегодня' : d === 1 ? 'Завтра' : `Через ${d} ${plural(d, 'день', 'дня', 'дней')}`;
  };
  const titleOf = (c) => c.topic || c.title;

  // ---------- календари ----------
  const stamp = (at, plusMin = 0) => {
    const [d, t = '00:00'] = at.split(' ');
    const x = new Date(Date.parse(`${d}T${t}:00Z`) + plusMin * 60000);
    return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
  };
  const googleUrl = (c) => {
    const dates = timed(c)
      ? `${stamp(c.at)}/${stamp(c.at, c.dur)}`
      : `${stamp(c.at).slice(0, 8)}/${stamp(c.at, 24 * 60).slice(0, 8)}`;
    const details = [`Персональный созвон «Фокус ИИ 1:1», блок ${c.n}: ${c.title}.`, c.meet ? `Google Meet: ${c.meet}` : '', `Кабинет: ${location.origin}${location.pathname}`].filter(Boolean).join('\n');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `Фокус ИИ 1:1 · созвон ${c.n}: ${titleOf(c)}`, dates, ctz: TZ, details });
    if (c.meet) q.set('location', c.meet);
    return `https://calendar.google.com/calendar/render?${q}`;
  };
  const feedUrl = () => (plan.feed ? new URL(plan.feed, location.href) : null);
  const googleFeedUrl = () => {
    const u = feedUrl();
    return u ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://${u.host}${u.pathname}`)}` : '';
  };
  const appleFeedUrl = () => {
    const u = feedUrl();
    return u ? `webcal://${u.host}${u.pathname}` : '';
  };
  // .ics: короткая подписанная ссылка без заголовка сессии — iPhone откроет «Добавить в Календарь», десктоп скачает файл
  const openIcs = async (n, btn) => {
    if (btn) btn.disabled = true;
    try {
      const { url } = await API.icsLink(n);
      location.href = url;
    } catch (e) {
      if (e.message !== 'unauthorized') toast(e.message);
    } finally {
      if (btn) setTimeout(() => { btn.disabled = false; }, 800);
    }
  };

  const toast = (text) => {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  };

  const ICON_CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/></svg>';
  const ICON_G = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  const ICON_APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10M7.5 9.5L12 14l4.5-4.5M5 19.5h14"/></svg>';

  const meetButton = (c, cls = '') => {
    if (!c.meet) return `<span class="cl-meet is-off ${cls}" aria-disabled="true">${ICON_CAM}Ссылка на Meet появится позже</span>`;
    return meetOpen(c)
      ? `<a class="cl-meet is-on ${cls}" href="${esc(c.meet)}" target="_blank" rel="noopener">${ICON_CAM}Войти в Meet</a>`
      : `<span class="cl-meet is-off ${cls}" aria-disabled="true">${ICON_CAM}Войти в Meet</span>`;
  };
  const calButtons = (c) => `
    <div class="cl-cal">
      <a class="cl-cal-btn" href="${esc(googleUrl(c))}" target="_blank" rel="noopener">${ICON_G}Google</a>
      <button class="cl-cal-btn" type="button" data-ics="${c.n}">${ICON_APPLE}Apple · .ics</button>
    </div>`;

  // все блоки с датами и все прошли — программа закончена; иначе следующий созвон ещё назначат
  const allDone = () => plan.calls.length >= modules.length && plan.calls.every(c => phase(c) === 'past');
  const nextCall = () => plan.calls.slice().sort((a, b) => startOf(a) - startOf(b)).find(c => phase(c) !== 'past');

  // ---------- хиро маршрута: ближайший созвон ----------
  const renderHero = () => {
    const box = $('heroCall');
    if (!box) return;
    const c = nextCall();
    if (!c) {
      box.innerHTML = `<a class="call-card is-empty" href="#calls"><span class="cc-kicker">${allDone() ? 'Созвоны' : 'Ближайший созвон'}</span>
        <span class="cc-empty">${allDone() ? 'Все созвоны прошли — материалы и домашки остаются с тобой' : `Дату ${plan.calls.length ? 'следующего' : 'первого'} созвона поставит куратор — она появится здесь`}</span>
        <span class="cc-all">План созвонов →</span></a>`;
      return;
    }
    const p = phase(c);
    box.innerHTML = `
      <div class="call-card is-${p}">
        <div class="cc-top"><span class="cc-kicker">Ближайший созвон · блок ${c.n}</span><span class="cc-when">${esc(whenLabel(c))}</span></div>
        <div class="cc-date">${esc(dayLabel(c))}</div>
        <div class="cc-time">${esc(timeLabel(c))} · Алматы${timed(c) ? ` · ${esc(durLabel(c.dur))}` : ''}</div>
        <div class="cc-topic">${esc(titleOf(c))}</div>
        ${meetButton(c, 'cc-meet')}
        ${c.meet && !meetOpen(c) ? `<div class="cc-hint">Кнопка станет активной за ${MEET_EARLY_MIN} минут до начала</div>` : ''}
        ${calButtons(c)}
        <a class="cc-all" href="#calls">Все созвоны · ${plan.calls.length} →</a>
      </div>`;
  };

  // ---------- страница #calls ----------
  const renderCallsPage = () => {
    const c = nextCall();
    const byN = Object.fromEntries(plan.calls.map(x => [x.n, x]));
    $('callsNext').innerHTML = c ? `
      <div class="cn-card is-${phase(c)}">
        <div class="cn-head"><span class="eyebrow">Ближайший · блок ${c.n}</span><span class="pill ${phase(c) === 'future' ? 'pill-open' : 'pill-accent'}">${esc(whenLabel(c))}</span></div>
        <div class="cn-date">${esc(dayLabel(c))}</div>
        <div class="cn-time">${esc(timeLabel(c))} · Алматы${timed(c) ? ` · ${esc(durLabel(c.dur))}` : ''}</div>
        <div class="cn-topic">${esc(titleOf(c))}</div>
        ${meetButton(c, 'cn-meet')}
        ${c.meet && !meetOpen(c) ? `<div class="cn-hint">Кнопка Meet станет активной за ${MEET_EARLY_MIN} минут до начала и работает до конца созвона</div>` : ''}
        ${calButtons(c)}
      </div>` : `<div class="cn-card is-empty"><div class="cn-topic">${allDone() ? 'Все созвоны прошли' : plan.calls.length ? 'Следующий созвон ещё не назначен' : 'Созвоны ещё не назначены'}</div><p class="cn-hint">${allDone() ? 'Материалы и домашки остаются в кабинете.' : 'Куратор поставит дату — она появится здесь, и её можно будет добавить в календарь.'}</p></div>`;

    $('callsList').innerHTML = modules.map(m => {
      const x = byN[m.number];
      if (!x) {
        return `<li class="cl-item is-none">
          <div class="cl-date"><b>—</b></div>
          <div class="cl-body"><span class="cl-kicker">Блок ${m.number}</span><b class="cl-title">${esc(m.title)}</b><span class="cl-time">Дата уточняется</span></div>
        </li>`;
      }
      const p = phase(x);
      const s = startOf(x);
      return `<li class="cl-item is-${p}">
        <div class="cl-date"><b>${fmt(s, { day: 'numeric' })}</b><span>${esc(fmt(s, { month: 'short' }).replace('.', ''))}</span><small>${esc(fmt(s, { weekday: 'short' }))}</small></div>
        <div class="cl-body">
          <span class="cl-kicker">Блок ${x.n}<i class="cl-when">${esc(whenLabel(x))}</i></span>
          <b class="cl-title">${esc(titleOf(x))}</b>
          <span class="cl-time">${esc(timeLabel(x))}${timed(x) ? ` · ${esc(durLabel(x.dur))}` : ''}</span>
          ${p === 'past' ? '' : `<div class="cl-actions">${meetOpen(x) ? meetButton(x) : ''}${calButtons(x)}</div>`}
        </div>
      </li>`;
    }).join('');

    const upcoming = plan.calls.filter(x => phase(x) !== 'past').length;
    $('callsAll').hidden = !plan.calls.length;
    $('callsAll').innerHTML = `
      <div class="block-head"><h2 class="section-title">Все созвоны сразу</h2><span class="block-meta">${plan.calls.length} в плане${upcoming ? ` · впереди ${upcoming}` : ''}</span></div>
      <p class="ca-sub">Подписка: переносы подтянутся в календарь сами. Файл .ics — разовый импорт всех созвонов.</p>
      <div class="ca-btns">
        <a class="btn btn-primary" href="${esc(googleFeedUrl())}" target="_blank" rel="noopener">${ICON_G}Google Календарь</a>
        <a class="btn btn-dark" href="${esc(appleFeedUrl())}">${ICON_G}Apple Календарь</a>
        <button class="btn btn-ghost" type="button" data-ics="all">${ICON_APPLE}Скачать .ics — все ${plan.calls.length}</button>
      </div>`;
  };

  // ---------- режим ведущего #host ----------
  const hostStudent = () => host?.students.find(s => s.id === hostSel);

  const renderHost = () => {
    if (!host) { $('hostBody').innerHTML = '<p class="label">Загружаю учеников…</p>'; return; }
    $('hostChips').innerHTML = host.students.map(s => {
      const n = Object.values(s.calls).filter(Boolean).length;
      return `<button type="button" class="h-chip${s.id === hostSel ? ' is-on' : ''}" data-host-student="${esc(s.id)}" aria-pressed="${s.id === hostSel}">
        <span class="h-ava" aria-hidden="true">${esc((s.name || '?').trim().charAt(0).toUpperCase())}</span><span>${esc(s.name)}</span><small>${n}/${host.modules.length}</small></button>`;
    }).join('');
    const st = hostStudent();
    HW.renderHost(st);
    if (!st) { $('hostBody').innerHTML = '<p class="h-empty">Выбери ученика — откроется его план созвонов.</p>'; return; }
    $('hostBody').innerHTML = `
      <div class="block-head"><h2 class="section-title">${esc(st.name)}</h2><span class="block-meta">созвоны по блокам · Алматы</span></div>
      <ol class="h-list">${host.modules.map(m => {
        const c = st.calls[m.n] && { ...st.calls[m.n], n: m.n, title: m.title };
        const p = c ? phase(c) : 'none';
        const act = confirmDel === m.n
          ? `<div class="h-confirm" role="group" aria-label="Подтверждение"><span>Удалить созвон ${m.n}?</span><button type="button" class="h-btn is-danger" data-host-del-yes="${m.n}">Удалить</button><button type="button" class="h-btn" data-host-del-no>Нет</button></div>`
          : `<div class="h-act"><button type="button" class="h-btn is-main" data-host-edit="${m.n}">${c ? 'Перенести' : 'Назначить'}</button>${c ? `<button type="button" class="h-btn" data-host-del="${m.n}" aria-label="Удалить созвон ${m.n}">Удалить</button>` : ''}</div>`;
        return `<li class="h-row is-${p}" data-call="${m.n}">
          <span class="h-n">${m.n}</span>
          <div class="h-body">
            <span class="h-kicker">Блок ${m.n} · ${esc(m.title)}</span>
            ${c ? `<b class="h-when">${esc(dayLabel(c))} · ${esc(timeLabel(c))}</b>
              <span class="h-meta">${esc(durLabel(c.dur))}${c.topic ? ` · ${esc(c.topic)}` : ''}${p !== 'future' ? ` · ${esc(whenLabel(c))}` : ''}</span>
              ${c.meet ? `<a class="h-link" href="${esc(c.meet)}" target="_blank" rel="noopener">${esc(c.meet.replace(/^https:\/\//, ''))}</a>` : '<span class="h-meta is-warn">Без ссылки Meet</span>'}`
              : '<b class="h-when is-none">Не назначен</b>'}
          </div>
          ${act}
        </li>`;
      }).join('')}</ol>`;
  };

  const loadHost = async () => {
    try {
      host = await API.hostStudents();
      const want = decodeURIComponent(location.hash.slice(1)).split('/')[1]; // #host/<id> — из уведомления в Telegram
      if (want && host.students.some(s => s.id === want)) hostSel = want;
      if (!hostSel || !hostStudent()) hostSel = (host.students.find(s => s.id !== me.id) || host.students[0])?.id || null;
    } catch (e) {
      if (e.message !== 'unauthorized') $('hostBody').innerHTML = `<p class="h-empty">${esc(e.message)}</p>`;
      return;
    }
    renderHost();
    HW.loadHost(hostStudent());
  };

  // шторка «Созвон · блок N»: дата, время, длительность, тема, Meet, «каждую неделю»
  const openEditor = (n) => {
    const st = hostStudent();
    const m = host.modules.find(x => x.n === n);
    const c = st.calls[n];
    editing = n;
    // по умолчанию — неделя после предыдущего созвона, иначе завтра; время прошлого созвона или 19:00
    const prev = host.modules.filter(x => x.n < n).map(x => st.calls[x.n]).filter(Boolean).pop();
    const date = c ? c.at.slice(0, 10) : prev ? addDays(prev.at.slice(0, 10), 7) : addDays(todayAlmaty(), 1);
    const time = c && c.at.length > 10 ? c.at.slice(11, 16) : prev && prev.at.length > 10 ? prev.at.slice(11, 16) : '19:00';
    const dur = c?.dur || prev?.dur || 120;
    const rest = host.modules.filter(x => x.n > n).length;
    $('csTitle').textContent = `${c ? 'Перенести' : 'Назначить'} созвон ${n}`;
    $('csSub').textContent = `${st.name} · блок ${n}: ${m.title}`;
    $('csDate').value = date;
    $('csTime').value = time;
    $('csTopic').value = c?.topic || '';
    $('csTopic').placeholder = m.title;
    $('csMeet').value = c?.meet || prev?.meet || '';
    $('csDur').innerHTML = DURS.concat(DURS.includes(dur) ? [] : [dur]).map(d =>
      `<button type="button" role="radio" aria-checked="${d === dur}" data-dur="${d}">${esc(shortDur(d))}</button>`).join('');
    $('csWeekly').hidden = !rest;
    $('csWeeklyOn').checked = false;
    $('csWeeklyCount').innerHTML = Array.from({ length: rest }, (_, i) => `<option value="${i + 1}"${i + 1 === rest ? ' selected' : ''}>${i + 1}</option>`).join('');
    $('csError').textContent = '';
    updateWeekly();
    $('callSheet').classList.add('open');
    setTimeout(() => $('csDate').focus({ preventScroll: true }), 50);
  };
  const closeEditor = () => { $('callSheet').classList.remove('open'); editing = null; };
  const durValue = () => Number($('csDur').querySelector('[aria-checked="true"]')?.dataset.dur) || 120;

  const weeklyPlan = () => {
    if ($('csWeekly').hidden || !$('csWeeklyOn').checked || !$('csDate').value) return [];
    const count = Number($('csWeeklyCount').value) || 0;
    return host.modules.filter(x => x.n > editing).slice(0, count).map((x, i) => ({ n: x.n, title: x.title, date: addDays($('csDate').value, 7 * (i + 1)) }));
  };
  const updateWeekly = () => {
    const list = weeklyPlan();
    const st = hostStudent();
    $('csWeeklyCount').disabled = !$('csWeeklyOn').checked;
    $('csWeeklyPreview').innerHTML = list.map(w => {
      const old = st.calls[w.n];
      const at = `${w.date} ${$('csTime').value || '19:00'}`;
      const c = { at, dur: durValue() };
      const changed = old && old.at !== at;
      return `<li><b>${w.n}</b><span>${esc(dayLabel(c))}, ${esc(at.slice(11))}</span>${changed ? `<small>вместо ${esc(dayLabel(old))}</small>` : ''}</li>`;
    }).join('');
  };

  const saveEditor = async () => {
    if (saving) return;
    const date = $('csDate').value;
    const time = $('csTime').value;
    if (!date || !time) { $('csError').textContent = 'Укажи дату и время'; return; }
    const base = { dur: durValue(), meet: $('csMeet').value.trim() };
    const calls = { [editing]: { at: `${date} ${time}`, topic: $('csTopic').value.trim(), ...base } };
    const st = hostStudent();
    for (const w of weeklyPlan()) calls[w.n] = { at: `${w.date} ${time}`, topic: st.calls[w.n]?.topic || '', ...base };
    await patch(calls, `Сохранено: ${Object.keys(calls).length === 1 ? `созвон ${editing}` : `созвоны ${Object.keys(calls).join(', ')}`}`);
  };

  const patch = async (calls, okText) => {
    saving = true;
    $('csSave').disabled = true;
    try {
      await API.hostPatch(hostSel, calls);
      closeEditor();
      confirmDel = null;
      toast(okText);
      await loadHost();
      if (hostSel === me.id) { await loadPlan(); APP.reloadModules(); }
    } catch (e) {
      if (e.message !== 'unauthorized') {
        if ($('callSheet').classList.contains('open')) $('csError').textContent = e.message; else toast(e.message);
      }
    } finally {
      saving = false;
      $('csSave').disabled = false;
    }
  };

  // ---------- данные и события ----------
  const loadPlan = async () => {
    try { plan = await API.getCalls(); } catch { plan = { calls: [], feed: '' }; }
    renderHero();
    if ($('callsView').style.display !== 'none') renderCallsPage();
  };

  const init = async (student, list) => {
    me = student;
    modules = list;
    document.querySelectorAll('[data-host-only]').forEach(el => { el.hidden = !me.host; });
    if (!init.wired) { wire(); init.wired = true; }
    await loadPlan();
  };

  const setModules = (list) => { modules = list; };

  // view: 'calls' | 'host'
  const show = (view) => {
    $('callsView').style.display = view === 'calls' ? 'block' : 'none';
    $('hostView').style.display = view === 'host' ? 'block' : 'none';
    if (view === 'calls') { document.title = `Созвоны · ${APP.title}`; renderCallsPage(); }
    if (view === 'host') { document.title = `Режим ведущего · ${APP.title}`; renderHost(); loadHost(); }
    window.scrollTo(0, 0);
  };
  const hide = () => {
    $('callsView').style.display = 'none';
    $('hostView').style.display = 'none';
    closeEditor();
  };

  const wire = () => {
    document.addEventListener('click', (e) => {
      const ics = e.target.closest('[data-ics]');
      if (ics) { openIcs(ics.dataset.ics === 'all' ? 'all' : Number(ics.dataset.ics), ics); return; }
      const chip = e.target.closest('[data-host-student]');
      if (chip) { hostSel = chip.dataset.hostStudent; confirmDel = null; history.replaceState(history.state, '', `#host/${encodeURIComponent(hostSel)}`); renderHost(); return; }
      const ed = e.target.closest('[data-host-edit]');
      if (ed) { openEditor(Number(ed.dataset.hostEdit)); return; }
      const del = e.target.closest('[data-host-del]');
      if (del) { confirmDel = Number(del.dataset.hostDel); renderHost(); return; }
      if (e.target.closest('[data-host-del-no]')) { confirmDel = null; renderHost(); return; }
      const yes = e.target.closest('[data-host-del-yes]');
      if (yes) { const n = yes.dataset.hostDelYes; patch({ [n]: null }, `Созвон ${n} удалён`); return; }
      const dur = e.target.closest('#csDur [data-dur]');
      if (dur) { $('csDur').querySelectorAll('[data-dur]').forEach(b => b.setAttribute('aria-checked', String(b === dur))); updateWeekly(); }
    });
    ['csDate', 'csTime', 'csWeeklyOn', 'csWeeklyCount'].forEach(id => $(id).addEventListener('input', updateWeekly));
    $('csWeeklyOn').addEventListener('change', updateWeekly);
    $('csCancel').addEventListener('click', closeEditor);
    $('csSave').addEventListener('click', saveEditor);
    $('callSheet').addEventListener('click', (e) => { if (e.target === $('callSheet')) closeEditor(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editing) closeEditor(); });
    $('callsBack').addEventListener('click', () => { location.hash = ''; });
    $('hostBack').addEventListener('click', () => { location.hash = ''; });
    // Meet включается сам по времени: перерисовка раз в 30 секунд, пока вкладка видна
    setInterval(() => {
      if (document.hidden) return;
      renderHero();
      if ($('callsView').style.display !== 'none') renderCallsPage();
    }, 30000);
  };

  return { init, show, hide, setModules, durLabel };
})();
