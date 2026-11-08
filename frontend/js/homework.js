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
  let fbEdit = null;       // id сдачи, на которую ведущий сейчас пишет ответ
  let fbSaving = false;
  let fbDraft = null;      // набранный текст ответа: не теряется при перерисовке
  const blobs = new Map(); // url → objectURL (картинки и скачивания, пока открыта вкладка)

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t) => APP.toast(t);
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} КБ` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`);
  const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name) || [])[1]?.toUpperCase() || 'ФАЙЛ';
  // фикс. UTC+5, как в calls.js: у старых браузеров Asia/Almaty ещё +6
  const almaty = (iso) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Etc/GMT-5', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
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

  // ответ ведущего — у последней сдачи, на которую он ответил (если после неё сдано ещё — подписываем, к какой он)
  const fbHtml = (submissions) => {
    const last = submissions[submissions.length - 1];
    const fb = [...submissions].reverse().find(h => h.feedback);
    if (!fb) return '';
    return `<div class="hw-fb is-student">
      <span class="hw-fb-head">Ответ ведущего${fb.feedbackAt ? ` · ${esc(almaty(fb.feedbackAt))}` : ''}</span>
      <p class="hw-fb-text">${esc(fb.feedback)}</p>
      ${fb !== last ? `<small class="hw-fb-on">к сдаче ${esc(almaty(fb.submittedAt))}</small>` : ''}
    </div>`;
  };

  // ---------- статус у ученика: последняя сдача ----------
  const renderStatus = (el, submissions = []) => {
    const last = submissions[submissions.length - 1];
    if (!el || !last) return;
    const n = (last.files || []).length;
    el.innerHTML = `<span class="pill pill-done">Отправлено ${esc(almaty(last.submittedAt))}</span>
      ${n || last.link ? `<div class="hw-sent">${last.link ? `<a class="hw-link" href="${esc(last.link)}" target="_blank" rel="noopener noreferrer">${ICON_LINK}<span>${esc(linkLabel(last.link))}</span></a>` : ''}${filesHtml(last.files)}</div>` : ''}
      ${fbHtml(submissions)}`;
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
  // ответ ведущего в карточке сдачи: текст + «Изменить» или поле ввода
  const hostFb = (s) => {
    if (fbEdit === s.id) {
      return `<div class="hw-fb is-edit">
        <label class="cs-field"><span>Ответ ученику</span>
          <textarea id="hwFbText" class="hw-fb-input" maxlength="4000" placeholder="Что получилось хорошо, что поправить к созвону"${fbSaving ? ' readonly' : ''}>${esc(fbDraft ?? s.feedback ?? '')}</textarea></label>
        <div class="h-act hw-fb-act">
          <button type="button" class="h-btn is-main" data-hw-fb-save="${esc(s.id)}"${fbSaving ? ' disabled' : ''}>${fbSaving ? 'Сохраняю…' : 'Отправить ответ'}</button>
          <button type="button" class="h-btn" data-hw-fb-cancel>Отмена</button>
          ${s.feedback ? `<button type="button" class="h-btn hw-fb-clear" data-hw-fb-clear="${esc(s.id)}">Убрать ответ</button>` : ''}
        </div>
      </div>`;
    }
    if (s.feedback) {
      return `<div class="hw-fb">
        <span class="hw-fb-head">Ваш ответ${s.feedbackAt ? ` · ${esc(almaty(s.feedbackAt))}` : ''}</span>
        <p class="hw-fb-text">${esc(s.feedback)}</p>
        <div class="h-act hw-fb-act"><button type="button" class="h-btn" data-hw-fb-edit="${esc(s.id)}">Изменить ответ</button></div>
      </div>`;
    }
    return `<div class="h-act hw-fb-act"><button type="button" class="h-btn is-main" data-hw-fb-edit="${esc(s.id)}">Ответить</button><span class="hw-fb-hint">ученик увидит ответ у своего ДЗ</span></div>`;
  };

  const saveFb = async (id, text) => {
    if (fbSaving) return;
    fbSaving = true;
    renderHost(hostFor);
    try {
      const out = await API.hostFeedback(id, text);
      const s = hostList.find(x => x.id === id);
      if (s) Object.assign(s, { feedback: out.feedback, feedbackAt: out.feedbackAt, status: out.status });
      fbEdit = null;
      fbDraft = null;
      toast(text ? 'Ответ сохранён — ученик увидит его у ДЗ' : 'Ответ убран');
    } catch (e) {
      if (e.message !== 'unauthorized') toast(e.message);
    } finally {
      fbSaving = false;
      renderHost(hostFor);
    }
  };

  const renderHost = (student) => {
    if (student?.id !== hostFor?.id) { fbEdit = null; fbDraft = null; }
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
          ${hostFb(s)}
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
    // десктоп: файлы можно перетащить на шторку
    const sheet = $('homeworkModal').querySelector('.hw-content');
    sheet.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); sheet.classList.add('is-drop'); } });
    sheet.addEventListener('dragleave', (e) => { if (!sheet.contains(e.relatedTarget)) sheet.classList.remove('is-drop'); });
    sheet.addEventListener('drop', (e) => { e.preventDefault(); sheet.classList.remove('is-drop'); addFiles([...e.dataTransfer.files]); });
    document.addEventListener('input', (e) => { if (e.target.id === 'hwFbText') fbDraft = e.target.value; });
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
      if (dl) { download(dl.dataset.hwDl, dl.dataset.hwName); return; }
      const fe = e.target.closest('[data-hw-fb-edit]');
      if (fe) {
        fbEdit = fe.dataset.hwFbEdit; fbDraft = null; renderHost(hostFor);
        const ta = $('hwFbText');
        if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
        return;
      }
      if (e.target.closest('[data-hw-fb-cancel]')) { fbEdit = null; fbDraft = null; renderHost(hostFor); return; }
      const fs = e.target.closest('[data-hw-fb-save]');
      if (fs) {
        const text = ($('hwFbText')?.value || '').trim();
        if (!text) { toast('Напиши ответ'); $('hwFbText')?.focus(); return; }
        saveFb(fs.dataset.hwFbSave, text);
        return;
      }
      const fc = e.target.closest('[data-hw-fb-clear]');
      if (fc) saveFb(fc.dataset.hwFbClear, '');
    });
  };

  return { wire, open, close, renderStatus, loadHost, renderHost };
})();
