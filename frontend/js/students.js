// Режим ведущего → «Ученики»: ＋ ученик (PIN выдаётся сам, показывается один раз), доступ к блокам, новый PIN, архив.
// Удалить — только Еламан/Данияр (сессия по ownerPins) и только из архива; удалённые можно вернуть.
// Выбор ученика и созвоны — в calls.js (CALLS), сданные ДЗ — в homework.js (HW). API — /api/students.
const STUDENTS = (() => {
  let data = null;          // { owner, me, modules, students, deleted }
  let current = null;       // id выбранного ученика (из calls.js)
  let confirm = null;       // 'pin' | 'archive' | 'del:<id>' — что сейчас подтверждаем
  let busy = false;
  let sheet = null;         // { mode: 'add'|'rename'|'pin', id?, name?, pin?, open? }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t) => APP.toast(t);
  const day = (iso) => (iso ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Etc/GMT-5', day: 'numeric', month: 'long' }).format(new Date(iso)) : '');
  const byId = (id) => data?.students.find(s => s.id === id);
  const archived = () => (data?.students || []).filter(s => s.archived);
  const siteUrl = () => location.origin + location.pathname;

  const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const req = async (path, method = 'GET', body) => {
    const r = await fetch(`api/students${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': AUTH.getSessionId() || '' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (r.status === 401) { showLogin('Сессия завершена — войдите заново'); throw new Error('unauthorized'); }
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'Ошибка запроса');
    return out;
  };

  const load = async () => {
    try { data = await req(''); } catch (e) { if (e.message !== 'unauthorized') toast(e.message); return; }
    render(current);
  };

  // после правки: свои данные + список учеников ведущего (чипы, созвоны) в calls.js
  const refresh = async (select) => { await load(); await CALLS.reloadHost(select); };

  // ---------- карточка выбранного ученика ----------
  const modRows = (open, attr) => data.modules.map(m => {
    const on = open.includes(m.n);
    return `<li><button type="button" class="st-mod${on ? ' is-on' : ''}" role="switch" aria-checked="${on}" ${attr}="${m.n}">
      <span class="st-mod-n">${m.n}</span><span class="st-mod-t">${esc(m.title)}</span><span class="st-mod-s">${on ? 'Открыт' : 'Закрыт'}</span><i class="st-sw" aria-hidden="true"></i></button></li>`;
  }).join('');

  const render = (id) => {
    if (id !== current) confirm = null;
    current = id;
    const box = $('hostManage');
    if (box) {
      const st = byId(id);
      if (!data || !st) { box.hidden = true; box.innerHTML = ''; }
      else {
        box.hidden = false;
        const isMe = st.id === data.me;
        const lock = st.protected || isMe;
        const act = confirm === 'pin'
          ? `<div class="h-confirm st-confirm"><span>Выдать новый PIN? Старый перестанет работать, ${esc(st.name)} выйдет из кабинета.</span><button type="button" class="h-btn is-main" data-st-pin-yes>Выдать новый</button><button type="button" class="h-btn" data-st-no>Нет</button></div>`
          : confirm === 'archive'
            ? `<div class="h-confirm st-confirm"><span>Убрать ${esc(st.name)} в архив? Вход закроется, созвоны и ДЗ сохранятся. Вернуть можно в любой момент.</span><button type="button" class="h-btn is-danger" data-st-arch-yes>В архив</button><button type="button" class="h-btn" data-st-no>Нет</button></div>`
            : `<div class="st-act">
                <button type="button" class="h-btn" data-st-rename>Переименовать</button>
                ${lock ? '' : `<button type="button" class="h-btn" data-st-pin>Новый PIN</button><button type="button" class="h-btn st-quiet" data-st-arch>В архив</button>`}
              </div>
              ${lock ? '<p class="st-note">Через этот вход заходит ведущий — новый PIN и архив здесь недоступны.</p>' : ''}`;
        box.innerHTML = `
          <div class="block-head"><h2 class="section-title">Доступ к блокам</h2><span class="block-meta">${st.open.length} из ${data.modules.length} открыто</span></div>
          <ul class="st-mods">${modRows(st.open, 'data-st-mod')}</ul>
          ${act}`;
      }
    }
    renderArchive();
  };

  // ---------- архив и удалённые ----------
  const renderArchive = () => {
    const box = $('hostArchive');
    if (!box) return;
    const list = archived();
    const gone = data?.deleted || [];
    if (!data || (!list.length && !gone.length)) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `
      <div class="block-head"><h2 class="section-title">Архив</h2><span class="block-meta">${list.length ? `${list.length} · вход закрыт` : 'пусто'}</span></div>
      ${list.length ? `<ul class="st-arch">${list.map(s => `
        <li class="st-arch-row">
          <span class="h-ava" aria-hidden="true">${esc((s.name || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="st-arch-txt"><b>${esc(s.name)}</b><small>в архиве с ${esc(day(s.archivedAt))}</small></span>
          ${confirm === `del:${s.id}`
            ? `<div class="h-confirm st-confirm"><span>Удалить ${esc(s.name)}? Запись уйдёт в «Удалённые», PIN сотрётся.</span><button type="button" class="h-btn is-danger" data-st-del-yes="${esc(s.id)}">Удалить</button><button type="button" class="h-btn" data-st-no>Нет</button></div>`
            : `<div class="st-arch-act"><button type="button" class="h-btn" data-st-back="${esc(s.id)}">Вернуть</button>${data.owner ? `<button type="button" class="h-btn st-quiet" data-st-del="${esc(s.id)}" aria-label="Удалить ${esc(s.name)}">Удалить</button>` : ''}</div>`}
        </li>`).join('')}</ul>` : ''}
      ${!data.owner && list.length ? '<p class="st-note">Удалить ученика могут только Еламан или Данияр.</p>' : ''}
      ${gone.length ? `<details class="st-gone"><summary>Удалённые · ${gone.length}</summary><ul class="st-arch">${gone.map(s => `
        <li class="st-arch-row is-gone">
          <span class="h-ava" aria-hidden="true">${esc((s.name || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="st-arch-txt"><b>${esc(s.name)}</b><small>удалён ${esc(day(s.deletedAt))}</small></span>
          <div class="st-arch-act"><button type="button" class="h-btn" data-st-undel="${esc(s.id)}">Восстановить</button></div>
        </li>`).join('')}</ul></details>` : ''}`;
  };

  // «＋ Ученик» первым в ряду чипов (на телефоне ряд листается — так кнопка всегда на виду) (calls.js вставляет строку в #hostChips)
  const addChip = () => `<button type="button" class="h-chip st-add" data-st-add>${ICON_PLUS}<span>Ученик</span></button>`;

  // ---------- шторка: новый ученик / имя / PIN один раз ----------
  const openSheet = (s) => {
    sheet = s;
    const add = s.mode === 'add';
    const pin = s.mode === 'pin';
    $('stTitle').textContent = add ? 'Новый ученик' : pin ? `PIN для ${s.name}` : 'Имя ученика';
    $('stSub').textContent = add ? 'PIN придумается сам — покажем его один раз.' : pin ? 'Показываем один раз. Скопируй и отправь ученику сейчас.' : '';
    $('stForm').hidden = pin;
    $('stPinBox').hidden = !pin;
    $('stModsField').hidden = !add;
    $('stCancel').hidden = pin;
    $('stSave').textContent = add ? 'Добавить' : pin ? 'Готово' : 'Сохранить';
    $('stError').textContent = '';
    if (pin) {
      $('stPin').textContent = s.pin;
      $('stInvite').textContent = `Кабинет «Фокус ИИ 1:1»: ${siteUrl()}\nPIN для входа: ${s.pin}`;
    } else {
      $('stName').value = s.name || '';
      if (add) { s.open = data.modules.map(m => m.n); $('stMods').innerHTML = modRows(s.open, 'data-st-new-mod'); }
    }
    $('stSheet').classList.add('open');
    if (!pin) setTimeout(() => { if (sheet === s && !$('stSheet').contains(document.activeElement)) $('stName').focus({ preventScroll: true }); }, 50);
  };
  const closeSheet = () => {
    $('stSheet').classList.remove('open');
    if (sheet?.mode === 'pin') { $('stPin').textContent = ''; $('stInvite').textContent = ''; } // PIN не остаётся в DOM
    sheet = null;
  };

  const copy = async (text, ok) => {
    try { await navigator.clipboard.writeText(text); toast(ok); } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); toast(ok); } catch { toast('Не скопировалось — выдели и скопируй вручную'); }
      t.remove();
    }
  };

  const saveSheet = async () => {
    if (!sheet || busy) return;
    if (sheet.mode === 'pin') { closeSheet(); return; }
    const name = $('stName').value.trim();
    if (!name) { $('stError').textContent = 'Напиши имя'; $('stName').focus(); return; }
    busy = true; $('stSave').disabled = true;
    try {
      if (sheet.mode === 'add') {
        const out = await req('', 'POST', { name, open: sheet.open });
        current = out.student.id;
        await refresh(out.student.id);
        openSheet({ mode: 'pin', name: out.student.name, pin: out.pin });
      } else {
        const id = sheet.id;
        await req(`/${encodeURIComponent(id)}`, 'PATCH', { name });
        closeSheet();
        toast('Имя сохранено');
        await refresh(id);
      }
    } catch (e) {
      if (e.message !== 'unauthorized') $('stError').textContent = e.message;
    } finally { busy = false; $('stSave').disabled = false; }
  };

  // одно действие с ответом сервера → тост и перерисовка
  const run = async (fn, okText, select) => {
    if (busy) return;
    busy = true;
    try { const out = await fn(); confirm = null; if (okText) toast(okText); await refresh(select); return out; } catch (e) {
      if (e.message !== 'unauthorized') toast(e.message);
    } finally { busy = false; }
  };

  const toggleMod = (n) => {
    const st = byId(current);
    if (!st || busy) return;
    const on = st.open.includes(n);
    const open = on ? st.open.filter(x => x !== n) : [...st.open, n];
    st.open = open; render(current); // сразу, не дожидаясь сервера
    run(() => req(`/${encodeURIComponent(st.id)}`, 'PATCH', { open }), `Блок ${n} ${on ? 'закрыт' : 'открыт'} для ${st.name}`, st.id);
  };

  const wire = () => {
    document.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-st-add]')) { openSheet({ mode: 'add' }); return; }
      const mod = t.closest('[data-st-mod]');
      if (mod) { toggleMod(Number(mod.dataset.stMod)); return; }
      const nm = t.closest('[data-st-new-mod]');
      if (nm && sheet?.mode === 'add') {
        const n = Number(nm.dataset.stNewMod);
        sheet.open = sheet.open.includes(n) ? sheet.open.filter(x => x !== n) : [...sheet.open, n].sort((a, b) => a - b);
        $('stMods').innerHTML = modRows(sheet.open, 'data-st-new-mod');
        return;
      }
      if (t.closest('[data-st-rename]')) { const st = byId(current); if (st) openSheet({ mode: 'rename', id: st.id, name: st.name }); return; }
      if (t.closest('[data-st-pin]')) { confirm = 'pin'; render(current); return; }
      if (t.closest('[data-st-arch]')) { confirm = 'archive'; render(current); return; }
      if (t.closest('[data-st-no]')) { confirm = null; render(current); return; }
      if (t.closest('[data-st-pin-yes]')) {
        const st = byId(current);
        const out = await run(() => req(`/${encodeURIComponent(st.id)}/pin`, 'POST'), '', st.id);
        if (out?.pin) openSheet({ mode: 'pin', name: st.name, pin: out.pin });
        return;
      }
      if (t.closest('[data-st-arch-yes]')) { const st = byId(current); run(() => req(`/${encodeURIComponent(st.id)}/archive`, 'POST'), `${st.name} — в архиве`); return; }
      const back = t.closest('[data-st-back]');
      if (back) {
        const st = byId(back.dataset.stBack);
        run(() => req(`/${encodeURIComponent(st.id)}/restore`, 'POST'), st.hasPin ? `${st.name} снова в списке, прежний PIN работает` : `${st.name} снова в списке — выдай новый PIN`, st.id);
        return;
      }
      const del = t.closest('[data-st-del]');
      if (del) { confirm = `del:${del.dataset.stDel}`; renderArchive(); return; }
      const delYes = t.closest('[data-st-del-yes]');
      if (delYes) { const st = byId(delYes.dataset.stDelYes); run(() => req(`/${encodeURIComponent(st.id)}`, 'DELETE'), `${st.name} удалён(а) — можно восстановить в «Удалённых»`); return; }
      const undel = t.closest('[data-st-undel]');
      if (undel) { run(() => req(`/trash/${encodeURIComponent(undel.dataset.stUndel)}/restore`, 'POST'), 'Вернули в архив — для входа выдай новый PIN'); return; }
      if (t.closest('#stCopyPin')) { copy(sheet?.pin || '', 'PIN скопирован'); return; }
      if (t.closest('#stCopyInvite')) { copy($('stInvite').textContent, 'Приглашение скопировано'); }
    });
    $('stSave').addEventListener('click', saveSheet);
    $('stCancel').addEventListener('click', closeSheet);
    $('stName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSheet(); } });
    $('stSheet').addEventListener('click', (e) => { if (e.target === $('stSheet') && sheet?.mode !== 'pin') closeSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet && sheet.mode !== 'pin') closeSheet(); });
  };
  wire();

  return { load, render, addChip, close: closeSheet };
})();
