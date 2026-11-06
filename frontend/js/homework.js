// Сдача ДЗ: форма (текст + ссылка + до 5 файлов), статус последней сдачи у ученика и сдачи в режиме ведущего.
// Файлы грузятся сразу при выборе (POST api/homework/upload), к сдаче привязываются по id. Открываются только
// через API с заголовком сессии — поэтому картинки и скачивание идут через blob, прямых ссылок на файлы нет.
const HW = (() => {
  const MAX_FILES = 5;
  const MAX_SIZE = 20 * 1024 * 1024;
  const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv';

  let moduleId = null;
  let items = [];          // { key, file, name, size, preview, state: 'up'|'ok'|'err', pct, id, error, xhr }
  let sending = false;
  let hostList = null;     // сдачи всех учеников (режим ведущего)
  let hostFor = null;
  const blobs = new Map(); // url → objectURL (картинки и скачивания, пока открыта вкладка)

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t) => APP.toast(t);
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} КБ` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`);
  const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name) || [])[1]?.toUpperCase() || 'ФАЙЛ';
  const almaty = (iso) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const isImage = (f) => f.image ?? (/^image\/(jpeg|png|gif|webp)$/.test(f.mime || ''));
  const linkLabel = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  // ---------- файлы через API ----------
  const fetchBlob = async (url, inline) => {
    const key = url + (inline ? '?inline=1' : '');
    if (blobs.has(key)) return blobs.get(key);
    const r = await fetch(key, { headers: { 'X-Session-Id': AUTH.getSessionId() || '' } });
    if (r.status === 401) { showLogin('Сессия завершена — войдите заново'); throw new Error('unauthorized'); }
    if (!r.ok) throw new Error(r.status === 403 ? 'Нет доступа к файлу' : 'Файл не открылся');
    const obj = URL.createObjectURL(await r.blob());
    blobs.set(key, obj);
    return obj;
  };
  const download = async (url, name) => {
    try {
      const a = Object.assign(document.createElement('a'), { href: await fetchBlob(url), download: name });
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { if (e.message !== 'unauthorized') toast(e.message); }
  };
  // картинки-превью: <img data-hw-img="url"> подгружаются после вставки в DOM
  const hydrate = (root) => root.querySelectorAll('img[data-hw-img]').forEach(async (img) => {
    try { img.src = await fetchBlob(img.dataset.hwImg, true); img.removeAttribute('data-hw-img'); } catch { img.closest('.hw-thumb')?.classList.add('is-broken'); }
  });

  const filesHtml = (files = [], who = '') => files.length ? `<div class="hw-files">${files.map(f => isImage(f)
    ? `<button type="button" class="hw-thumb" data-hw-view="${esc(f.url)}" data-hw-name="${esc(f.name)}" aria-label="Открыть ${esc(f.name)}"><img alt="" data-hw-img="${esc(f.url)}"><span>${esc(f.name)}</span></button>`
    : `<button type="button" class="hw-doc" data-hw-dl="${esc(f.url)}" data-hw-name="${esc(f.name)}"><b>${esc(extOf(f.name))}</b><span>${esc(f.name)}</span><small>${esc(size(f.size))}${who}</small></button>`).join('')}</div>` : '';

  // ---------- форма «Сдать ДЗ» ----------
  const renderItems = () => {
    $('hwFileList').innerHTML = items.map(it => `
      <li class="hw-item is-${it.state}">
        ${it.preview ? `<img class="hw-item-pic" src="${esc(it.preview)}" alt="">` : `<span class="hw-item-pic is-doc">${esc(extOf(it.name))}</span>`}
        <span class="hw-item-txt"><b>${esc(it.name)}</b><small>${it.state === 'err' ? esc(it.error) : it.state === 'up' ? `Загружаю… ${it.pct}%` : esc(size(it.size))}</small></span>
        <button type="button" class="hw-item-x" data-hw-rm="${it.key}" aria-label="Убрать ${esc(it.name)}">${ICON_X}</button>
        ${it.state === 'up' ? `<i class="hw-item-bar" style="transform: scaleX(${it.pct / 100})"></i>` : ''}
      </li>`).join('');
    const live = items.filter(it => it.state !== 'err').length;
    $('hwPick').hidden = live >= MAX_FILES;
    $('hwFilesNote').textContent = live ? `${live} из ${MAX_FILES}` : 'картинки, PDF, документы · до 5 файлов по 20 МБ';
    homeworkSubmitState();
  };
  const homeworkSubmitState = () => {
    const busy = items.some(it => it.state === 'up');
    $('homeworkSubmit').disabled = sending || busy;
    $('homeworkSubmit').textContent = sending ? 'Отправляю…' : busy ? 'Файлы грузятся…' : 'Отправить';
  };

  const upload = (it) => {
    const xhr = new XMLHttpRequest();
    it.xhr = xhr;
    xhr.open('POST', 'api/homework/upload');
    xhr.setRequestHeader('X-Session-Id', AUTH.getSessionId() || '');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(it.name));
    xhr.setRequestHeader('Content-Type', it.file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) { it.pct = Math.round(e.loaded / e.total * 100); renderItems(); } };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* не JSON */ }
      if (xhr.status === 401) { showLogin('Сессия завершена — войдите заново'); return; }
      if (xhr.status === 200 && data.file) Object.assign(it, { state: 'ok', id: data.file.id, name: data.file.name });
      else Object.assign(it, { state: 'err', error: data.error || 'Не загрузилось' });
      renderItems();
    };
    xhr.onerror = () => { Object.assign(it, { state: 'err', error: 'Нет связи — убери и добавь заново' }); renderItems(); };
    xhr.send(it.file);
  };

  const addFiles = (list) => {
    for (const file of list) {
      if (items.filter(it => it.state !== 'err').length >= MAX_FILES) { toast(`Не больше ${MAX_FILES} файлов`); break; }
      const it = { key: Math.random().toString(36).slice(2), file, name: file.name || 'файл', size: file.size, state: 'up', pct: 0 };
      if (/^image\/(jpeg|png|gif|webp)$/.test(file.type)) it.preview = URL.createObjectURL(file);
      if (file.size > MAX_SIZE) Object.assign(it, { state: 'err', error: 'Больше 20 МБ — дай ссылкой на Google Drive' });
      items.push(it);
      if (it.state === 'up') upload(it);
    }
    renderItems();
  };

  const removeItem = (key) => {
    const it = items.find(x => x.key === key);
    if (!it) return;
    it.xhr?.abort();
    if (it.preview) URL.revokeObjectURL(it.preview);
    if (it.id) fetch(`api/homework/upload/${it.id}`, { method: 'DELETE', headers: { 'X-Session-Id': AUTH.getSessionId() || '' } }).catch(() => {});
    items = items.filter(x => x !== it);
    renderItems();
  };

  const resetForm = () => {
    items.forEach(it => { it.xhr?.abort(); if (it.preview) URL.revokeObjectURL(it.preview); });
    items = [];
    $('homeworkTextarea').value = '';
    $('hwLink').value = '';
    $('hwLink').classList.remove('is-bad');
    $('hwLinkErr').hidden = true;
    renderItems();
  };

  const open = (id, title) => {
    moduleId = id;
    $('homeworkModalTitle').textContent = title || '';
    resetForm();
    $('homeworkModal').classList.add('open');
  };
  // закрытие: несданные загрузки остаются на сервере сутки и удаляются сами
  const close = () => { $('homeworkModal').classList.remove('open'); items.forEach(it => it.xhr?.abort()); };

  const linkValue = () => {
    let v = $('hwLink').value.trim();
    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`; // «drive.google.com/…» без протокола — дописываем
    let ok = !v;
    try { const u = new URL(v); ok = ok || (/^https?:$/.test(u.protocol) && u.hostname.includes('.')); } catch { /* ok = false */ }
    $('hwLink').classList.toggle('is-bad', !ok);
    $('hwLinkErr').hidden = ok;
    return ok ? v : null;
  };

  const submit = async (onDone) => {
    const content = $('homeworkTextarea').value.trim();
    const link = linkValue();
    if (link === null) { $('hwLink').focus(); return; }
    if (items.some(it => it.state === 'err')) { toast('Убери файлы с ошибкой'); return; }
    const files = items.filter(it => it.state === 'ok').map(it => it.id);
    if (!content && !link && !files.length) { toast('Напиши, что получилось, или добавь ссылку/файл'); return; }
    sending = true; homeworkSubmitState();
    try {
      await API.submitHomework(moduleId, { content, link, files });
      items.forEach(it => it.preview && URL.revokeObjectURL(it.preview));
      items = [];
      close();
      toast('ДЗ отправлено — куратор посмотрит до созвона');
      onDone?.(moduleId);
    } catch (error) {
      if (error.message !== 'unauthorized') toast('Ошибка отправки: ' + error.message);
    } finally {
      sending = false; homeworkSubmitState();
    }
  };

  // ---------- статус у ученика: последняя сдача ----------
  const renderStatus = (el, submissions = []) => {
    const last = submissions[submissions.length - 1];
    if (!el || !last) return;
    const n = (last.files || []).length;
    el.innerHTML = `<span class="pill pill-done">Отправлено ${esc(almaty(last.submittedAt))}</span>
      ${n || last.link ? `<div class="hw-sent">${last.link ? `<a class="hw-link" href="${esc(last.link)}" target="_blank" rel="noopener noreferrer">${ICON_LINK}<span>${esc(linkLabel(last.link))}</span></a>` : ''}${filesHtml(last.files)}</div>` : ''}
      ${last.feedback ? `<p class="homework-desc">${esc(last.feedback)}</p>` : ''}`;
    hydrate(el);
  };

  // ---------- режим ведущего: сдачи выбранного ученика ----------
  const loadHost = async (student) => {
    hostFor = student;
    const box = $('hostHw');
    if (!box) return;
    if (!hostList) box.innerHTML = '<p class="label">Загружаю ДЗ…</p>';
    try { hostList = (await API.hostHomework()).submissions; } catch (e) {
      if (e.message !== 'unauthorized') box.innerHTML = `<p class="h-empty">${esc(e.message)}</p>`;
      return;
    }
    renderHost(hostFor);
  };
  const renderHost = (student) => {
    hostFor = student;
    const box = $('hostHw');
    if (!box) return;
    if (!student) { box.hidden = true; return; }
    box.hidden = false;
    if (!hostList) { box.innerHTML = '<p class="label">Загружаю ДЗ…</p>'; return; }
    const list = hostList.filter(s => s.studentId === student.id);
    box.innerHTML = `
      <div class="block-head"><h2 class="section-title">Сданные ДЗ</h2><span class="block-meta">${list.length ? `${list.length} · новые сверху` : 'пока нет'}</span></div>
      ${list.length ? `<ol class="hw-feed">${list.map(s => `
        <li class="hw-card">
          <div class="hw-card-top"><span class="h-kicker">Блок ${esc(s.module?.number ?? '?')} · ${esc(s.module?.title || s.moduleId)}</span><time>${esc(almaty(s.submittedAt))}</time></div>
          ${s.content ? `<p class="hw-text">${esc(s.content)}</p>` : ''}
          ${s.link ? `<a class="hw-link" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${ICON_LINK}<span>${esc(linkLabel(s.link))}</span></a>` : ''}
          ${filesHtml(s.files)}
        </li>`).join('')}</ol>` : `<p class="h-empty">${esc(student.name)} ещё ничего не сдавал(а). Когда сдаст — придёт уведомление в Telegram.</p>`}`;
    hydrate(box);
  };

  // ---------- просмотр картинки ----------
  const view = async (url, name) => {
    const v = $('hwViewer');
    $('hwViewerName').textContent = name;
    $('hwViewerImg').removeAttribute('src');
    v.classList.add('open');
    v.dataset.url = url;
    try { $('hwViewerImg').src = await fetchBlob(url, true); } catch (e) { v.classList.remove('open'); if (e.message !== 'unauthorized') toast(e.message); }
  };
  const closeView = () => $('hwViewer').classList.remove('open');

  const wire = (onDone) => {
    $('hwFileInput').accept = ACCEPT;
    $('hwPick').addEventListener('click', () => $('hwFileInput').click());
    $('hwFileInput').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
    $('hwLink').addEventListener('blur', () => { if ($('hwLink').value.trim()) linkValue(); });
    $('hwLink').addEventListener('input', () => { if (!$('hwLinkErr').hidden) linkValue(); });
    $('homeworkSubmit').addEventListener('click', () => submit(onDone));
    $('homeworkCancel').addEventListener('click', close);
    $('homeworkModal').addEventListener('click', (e) => { if (e.target === $('homeworkModal')) close(); });
    $('hwViewer').addEventListener('click', (e) => {
      if (e.target.closest('#hwViewerDl')) { download($('hwViewer').dataset.url, $('hwViewerName').textContent); return; }
      if (!e.target.closest('img')) closeView();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeView(); if ($('homeworkModal').classList.contains('open')) close(); } });
    document.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-hw-rm]');
      if (rm) { removeItem(rm.dataset.hwRm); return; }
      const v = e.target.closest('[data-hw-view]');
      if (v) { view(v.dataset.hwView, v.dataset.hwName); return; }
      const dl = e.target.closest('[data-hw-dl]');
      if (dl) download(dl.dataset.hwDl, dl.dataset.hwName);
    });
  };

  return { wire, open, close, renderStatus, loadHost, renderHost };
})();
