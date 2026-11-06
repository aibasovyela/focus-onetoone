import fs from 'fs';

// Уведомление ведущему о сдаче ДЗ — бот агента fokus. Токен и чат приходят из EnvironmentFile службы
// (/etc/focus-onetoone/tg.env: TG_BOT_TOKEN, TG_CHAT_ID), в коде и репо их нет. NOTIFY_TAG=ТЕСТ — пометка стенда.
// Шлём после ответа ученику: ошибка или таймаут Telegram сдачу не ломают, только пишутся в журнал (без токена).
const TOKEN = process.env.TG_BOT_TOKEN || '';
const CHAT = process.env.TG_CHAT_ID || '';
const TAG = process.env.NOTIFY_TAG || '';
const SITE = process.env.COURSES_URL || 'https://yelumio.kz/courses/';
const TIMEOUT_MS = 20000;
const PHOTO_MAX = 10 * 1024 * 1024; // больше — Telegram не примет как фото, шлём документом

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scrub = (s) => (TOKEN ? String(s).split(TOKEN).join('***') : String(s));
const almaty = (iso) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
}).format(new Date(iso)).replace(',', ' ·');
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const call = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    body,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method}: ${res.status} ${data.description || ''}`.trim());
  return data.result;
};

const sendFile = async (file, path, replyTo, caption) => {
  const photo = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mime) && file.size <= PHOTO_MAX;
  const form = new FormData();
  form.append('chat_id', CHAT);
  form.append('caption', caption);
  if (replyTo) form.append('reply_parameters', JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  form.append(photo ? 'photo' : 'document', new Blob([fs.readFileSync(path)], { type: file.mime }), file.name);
  await call(photo ? 'sendPhoto' : 'sendDocument', form);
};

const text = ({ student, module, hw }) => {
  const lines = [
    `${TAG ? `<b>${esc(TAG)}</b> · ` : ''}<b>Сдано ДЗ</b> — блок ${esc(module.number)} «${esc(module.title)}»`,
    `Ученик: ${esc(student.name || student.id)}`,
    `Время: ${esc(almaty(hw.submittedAt))} (Алматы)`
  ];
  const body = hw.content.replace(/\s+/g, ' ').trim();
  if (body) lines.push('', `<i>${esc(short(body, 300))}</i>`);
  if (hw.link) lines.push('', `Ссылка: ${esc(hw.link)}`);
  if (hw.files?.length) lines.push(`Файлы: ${hw.files.length} — ниже`);
  lines.push('', `<a href="${esc(`${SITE}#host/${encodeURIComponent(student.id)}`)}">Открыть в кабинете</a>`);
  return lines.join('\n');
};

// files: [{ meta, path }]
export const notifyHomework = ({ student, module, hw, files = [] }) => {
  if (!TOKEN || !CHAT) return;
  setImmediate(async () => {
    try {
      const msg = await call('sendMessage', JSON.stringify({
        chat_id: CHAT, text: text({ student, module, hw }), parse_mode: 'HTML', link_preview_options: { is_disabled: !hw.link }
      }));
      let sent = 0;
      for (const [i, f] of files.entries()) {
        try {
          await sendFile(f.meta, f.path, msg.message_id, `${TAG ? `${TAG} · ` : ''}${student.name || student.id} · блок ${module.number} · файл ${i + 1}/${files.length}`);
          sent++;
        } catch (e) {
          console.error(`[notify] hw ${hw.id} файл ${i + 1}: ${scrub(e.message)}`);
        }
      }
      console.log(`[notify] hw ${hw.id}: сообщение ${msg.message_id}, файлов ${sent}/${files.length}`);
    } catch (e) {
      console.error(`[notify] hw ${hw.id}: ${scrub(e.message)}`);
    }
  });
};
