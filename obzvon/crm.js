// Обзвон: данные в Supabase (таблица crm_leads, видит только владелец), вход — та же почта и пароль, что в кабинет.
const SB_URL = 'https://gbwwbyvukjvguimdhqip.supabase.co';
const SB_KEY = 'sb_publishable__niW67fjhWr1Y10dVTRplg_F-C649q8';

const ST = {
  new:      {name:'Не звонил', c:'--s-new'},
  noanswer: {name:'Не ответил', c:'--s-noanswer'},
  owner:    {name:'Нужен владелец', c:'--s-owner'},
  callback: {name:'Перезвонить', c:'--s-callback'},
  sent:     {name:'Ссылка отправлена', c:'--s-sent'},
  thinking: {name:'Думает', c:'--s-thinking'},
  sold:     {name:'Купил', c:'--s-sold'},
  no:       {name:'Не интересно', c:'--s-no'},
};
const ORDER = ['new','noanswer','owner','callback','sent','thinking','sold','no'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = isoDay(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
const fmtDay = (s) => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}` : '';
const fmtWhen = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const rub = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
$('today').textContent = new Date().toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});

const sb = window.supabase.createClient(SB_URL, SB_KEY, {auth: {storageKey: 'boxapp-crm'}});
let leads = [], filter = 'todo', query = '', openRes = null, editOwner = null;
const waLink = (p) => { const d = String(p).replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7'); return d.length === 11 ? `<a class="btn ghost" href="https://wa.me/${d}" target="_blank" rel="noopener">WhatsApp</a>` : ''; };
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Не удалось скопировать — выделите текст вручную'); }
}

// ---------- сводка ----------
function renderStats() {
  const by = Object.fromEntries(ORDER.map((k) => [k, 0]));
  leads.forEach((l) => by[l.status] = (by[l.status] || 0) + 1);
  const called = leads.filter((l) => l.status !== 'new').length;
  const answered = leads.filter((l) => l.answered).length;
  const link = by.sent + by.thinking + by.sold;
  const sold = leads.filter((l) => l.status === 'sold');
  $('k-called').textContent = `${called}/${leads.length}`;
  $('k-answered').textContent = answered;
  $('k-link').textContent = link;
  $('k-sold').textContent = by.sold;
  $('k-revenue').textContent = rub(sold.reduce((s, l) => s + (+l.amount || 0), 0));
  $('k-monthly').textContent = rub(sold.filter((l) => l.monthly).length * 790);
  const total = leads.length || 1;
  $('funnel').innerHTML = ORDER.filter((k) => by[k]).map((k) => `<i style="width:${by[k] / total * 100}%;background:var(${ST[k].c})" title="${ST[k].name}: ${by[k]}"></i>`).join('');
  $('legend').innerHTML = ORDER.filter((k) => by[k]).map((k) => `<span><i class="dot" style="background:var(${ST[k].c})"></i>${ST[k].name} <b class="num">${by[k]}</b></span>`).join('');
  // главные вкладки — крупно; статусы по отдельности — под «Ещё фильтры»
  const tabs = [['todo', 'К звонку', leads.filter(isTodo).length], ['due', 'Перезвонить сегодня', leads.filter(isDue).length],
    ['link', 'Взяли ссылку', link], ['sold', 'Купили', by.sold], ['all', 'Все', leads.length]];
  const more = ORDER.filter((k) => k !== 'sold').map((k) => [k, ST[k].name, by[k]]);
  const moreOn = more.some(([k]) => k === filter);
  $('chips').innerHTML = `<div class="tabs2">${tabs.map(([k, n, c]) => `<button class="tab2 ${filter === k ? 'on' : ''} ${k === 'due' && c ? 'hot' : ''}" data-f="${k}"><span>${n}</span><b class="num">${c}</b></button>`).join('')}</div>
    <details class="more" ${moreOn ? 'open' : ''}><summary>Ещё фильтры по статусу</summary><div class="chips">${more.map(([k, n, c]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${n} <span class="n">${c}</span></button>`).join('')}</div></details>`;
  $('chips').querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { filter = b.dataset.f; render(); scrollTo({top: $('chips').offsetTop - 8, behavior: 'smooth'}); });
  // плитки сводки — тоже кнопки
  [['k-called', 'all'], ['k-answered', 'answered'], ['k-link', 'link'], ['k-sold', 'sold']].forEach(([id, f]) => {
    const tile = $(id).closest('.kpi'); tile.classList.add('click'); tile.classList.toggle('on', filter === f);
    tile.onclick = () => { filter = f; render(); scrollTo({top: $('chips').offsetTop - 8, behavior: 'smooth'}); };
  });
}
const FILTERS = {
  all: () => true, todo: (l) => isTodo(l), due: (l) => isDue(l),
  link: (l) => ['sent', 'thinking', 'sold'].includes(l.status), answered: (l) => !!l.answered,
};
const isDue = (l) => l.nextCall && l.nextCall <= TODAY && !['sold', 'no'].includes(l.status);
const isTodo = (l) => l.status === 'new' || l.status === 'noanswer' || l.status === 'owner' || isDue(l);

// ---------- список ----------
function sortKey(l) {
  if (isDue(l)) return [0, l.nextCall, l.rank];
  const w = {new:1, noanswer:2, owner:3, callback:3, thinking:4, sent:5, sold:6, no:7}[l.status] ?? 8;
  return [w, '', l.rank];
}
function cmp(a, b) { const x = sortKey(a), y = sortKey(b); for (let i = 0; i < 3; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; }

function render() {
  renderStats();
  const q = query.trim().toLowerCase();
  let list = leads.filter((l) => (FILTERS[filter] || ((x) => x.status === filter))(l));
  if (q) list = list.filter((l) => `${l.name} ${l.address} ${l.phone} ${l.ownerName || ''} ${l.ownerPhone || ''}`.toLowerCase().includes(q));
  list.sort(cmp);
  const EMPTY = {todo: 'Все обзвонены 🎉 Загляните во «Взяли ссылку» и «Перезвонить сегодня».', due: 'На сегодня перезвонов нет.', link: 'Пока никто не взял ссылку — всё впереди.', sold: 'Продаж пока нет. Первая уже близко!'};
  if (!list.length) { $('list').innerHTML = `<div class="empty">${leads.length ? (EMPTY[filter] || 'В этом фильтре пусто.') : 'Студий пока нет.'}</div>`; return; }
  $('list').innerHTML = list.map(card).join('');
  $('list').querySelectorAll('[data-a]').forEach((b) => b.onclick = () => act(b.dataset.id, b.dataset.a));
  $('list').querySelectorAll('textarea.notes').forEach((t) => t.onchange = () => save(t.dataset.id, {notes: t.value}, 'Заметка сохранена'));
}

function card(l) {
  const s = ST[l.status] || ST.new, open = openRes === l.id;
  const due = l.nextCall && !['sold', 'no'].includes(l.status) ? (l.nextCall < TODAY ? `<span class="late">Просрочен перезвон ${fmtDay(l.nextCall)}</span>` : l.nextCall === TODAY ? `<span class="due">Перезвонить сегодня</span>` : `<span>Перезвонить ${fmtDay(l.nextCall)}</span>`) : '';
  return `<article class="card" style="--sc:var(${s.c})">
    <div class="c-top"><span class="rank">${l.rank}</span>
      <div style="min-width:0"><div class="c-name">${esc(l.name)}</div>
        <div class="c-meta">${l.rating ? `<span class="star">★ ${String(l.rating).replace('.', ',')}</span> · ${l.reviews} отз. · ` : ''}${esc(l.address)}</div></div>
      <span class="pill">${s.name}${l.status === 'sold' && l.amount ? ` · ${rub(l.amount)} ₽` : ''}</span></div>
    ${l.ownerPhone || l.ownerName ? `<div class="owner">
      <div class="o-h"><span class="o-label">Владелец</span><b>${esc(l.ownerName || 'имя не записано')}</b>${l.bestTime ? `<span class="o-time">звонить: ${esc(l.bestTime)}</span>` : ''}</div>
      ${l.ownerPhone ? `<div class="phone"><a class="num" href="tel:${esc(String(l.ownerPhone).replace(/[^\d+]/g, ''))}">${esc(l.ownerPhone)}</a><button class="btn ghost" data-a="copyOwner" data-id="${l.id}">Копировать</button>${waLink(l.ownerPhone)}</div>` : ''}
    </div>` : ''}
    <div class="phone">${l.ownerPhone ? '<span class="o-label">Студия</span>' : ''}<a class="num ${l.ownerPhone ? 'small' : ''}" href="tel:${esc(String(l.phone).replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a><button class="btn ghost" data-a="copyPhone" data-id="${l.id}">Копировать номер</button></div>
    ${editOwner === l.id ? `<div class="res owner-form">
      <div class="form"><input id="on-${l.id}" placeholder="Имя владельца" value="${esc(l.ownerName || '')}"><input id="op-${l.id}" type="tel" placeholder="Его номер" value="${esc(l.ownerPhone || '')}"></div>
      <div class="form"><input id="ot-${l.id}" placeholder="Когда удобно звонить (например, после 18)" value="${esc(l.bestTime || '')}" style="flex:1"><button class="btn pri" data-a="saveOwner" data-id="${l.id}">Сохранить</button></div>
    </div>` : `<div><button class="btn ghost" data-a="editOwner" data-id="${l.id}">${l.ownerPhone || l.ownerName ? 'Изменить данные владельца' : '+ Данные владельца'}</button></div>`}
    <div class="links">
      ${l.wa ? `<a class="btn" href="${esc(l.wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${l.tg ? `<a class="btn" href="${esc(l.tg)}" target="_blank" rel="noopener">Telegram</a>` : ''}
      ${l.app ? `<a class="btn" href="${esc(l.app)}" target="_blank" rel="noopener">Их приложение</a>` : ''}
      ${l.gis ? `<a class="btn ghost" href="${esc(l.gis)}" target="_blank" rel="noopener">2ГИС</a>` : ''}
    </div>
    ${['sold', 'no'].includes(l.status) ? '' : msgBlock(l)}
    <div class="acts">
      <button class="btn" data-a="noanswer" data-id="${l.id}">Не ответил</button>
      <button class="btn pri" data-a="toggle" data-id="${l.id}">${open ? 'Скрыть' : 'Ответил →'}</button>
    </div>
    ${open ? `<div class="res">
      <div class="row">
        <button class="btn r" style="--sc:var(--s-owner)" data-a="owner" data-id="${l.id}">Ответил сотрудник</button>
        <button class="btn r" style="--sc:var(--s-sent)" data-a="sent" data-id="${l.id}">Ссылку отправил</button>
        <button class="btn r" style="--sc:var(--s-thinking)" data-a="thinking" data-id="${l.id}">Думает</button>
        <button class="btn r" style="--sc:var(--s-no)" data-a="no" data-id="${l.id}">Не интересно</button>
      </div>
      <div class="form"><label>Перезвонить <input type="date" id="d-${l.id}" value="${l.nextCall || addDays(2)}"></label><button class="btn r" style="--sc:var(--s-callback)" data-a="callback" data-id="${l.id}">Сохранить перезвон</button></div>
      <div class="form"><label>Сумма, ₽ <input type="number" id="a-${l.id}" min="0" step="100" value="${l.amount || 3500}" style="width:110px"></label><label><input type="checkbox" id="m-${l.id}" ${l.status !== 'sold' || l.monthly ? 'checked' : ''}> абонемент 790/мес</label><button class="btn r" style="--sc:var(--s-sold)" data-a="sold" data-id="${l.id}">Купил</button></div>
    </div>` : ''}
    ${l.status === 'sold' ? cabinetBlock(l) : ''}
    <textarea class="notes" data-id="${l.id}" placeholder="Заметки: имя владельца, что сказал…">${esc(l.notes)}</textarea>
    <div class="foot"><span>Звонков: <b class="num">${l.attempts || 0}</b></span>${l.lastCall ? `<span>последний ${fmtWhen(l.lastCall)}</span>` : ''}${due}</div>
  </article>`;
}

// ---------- сообщения: шаблоны с названием и ссылкой студии ----------
const MSG = {
  first: (l) => `Здравствуйте! Я собрал для «${l.name}» приложение онлайн-записи — с вашими услугами, адресом и рейтингом из 2ГИС. Посмотрите, как выглядит: ${l.app}\n\nКлиент сам выбирает услугу и свободное время, а запись сразу прилетает вам в Telegram — даже когда вы в боксе и не можете взять трубку. Цены и фото меняете сами.\n\nЕсли интересно — расскажу подробнее. Если нет, просто не отвечайте, больше не побеспокою 🙂`,
  remind: (l) => `Добрый день! Успели посмотреть приложение для «${l.name}»? ${l.app}\nПервый месяц можно попробовать бесплатно — если записи не пойдут, ничего не платите.`,
  price: () => `Запуск — 3 500 ₽, дальше 790 ₽ в месяц: хостинг, обновления, правки по вашей просьбе. Первый месяц бесплатно. Если ок — подключу за день: дам вход в кабинет, где вы сами меняете цены, фото и часы работы.`,
};
// номер для WhatsApp: из ссылки wa.me, номера владельца или студии (только мобильные +7 9…)
const waNumber = (l) => {
  const from = (v) => { const d = String(v || '').replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7'); return /^79\d{9}$/.test(d) ? d : ''; };
  return from((String(l.wa || '').match(/wa\.me\/(\d+)/) || [])[1]) || from(l.ownerPhone) || from(l.phone);
};
const sentAlready = (l) => !['new', 'noanswer', 'owner'].includes(l.status);
function msgBlock(l) {
  const wa = waNumber(l), first = !sentAlready(l);
  const text = first ? MSG.first(l) : MSG.remind(l);
  return `<div class="msg">
    <div class="m-h">${first ? 'Написать вместо звонка' : 'Напомнить о себе'}</div>
    <div class="row">
      ${wa ? `<a class="btn pri" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" data-a="${first ? 'waFirst' : 'waRemind'}" data-id="${l.id}">WhatsApp с текстом</a>` : ''}
      <button class="btn" data-a="cpFirst" data-id="${l.id}">Скопировать первое</button>
      <button class="btn" data-a="cpRemind" data-id="${l.id}">Скопировать напоминание</button>
      <button class="btn ghost" data-a="cpPrice" data-id="${l.id}">Про цену</button>
      ${l.tg ? `<a class="btn ghost" href="${esc(l.tg)}" target="_blank" rel="noopener">Открыть Telegram</a>` : ''}
    </div>
    <div class="small-note">${wa ? 'WhatsApp откроется с готовым текстом — нажмите «Отправить». ' : ''}Для Telegram и MAX: скопируйте, откройте чат, вставьте.</div>
  </div>`;
}
async function markWritten(l, text) {
  const extra = sentAlready(l) ? { nextCall: addDays(2) } : { status: 'sent', nextCall: addDays(2) };
  return save(l.id, withLog(l, text, { ...extra, attempts: (l.attempts || 0) + 1 }), 'Отмечено: написал · напомню через 2 дня');
}

// ---------- выдача кабинета владельцу (после продажи) ----------
let issueOpen = null, issued = {};   // issued[id] = текст для владельца (пароль показываем один раз, не храним)
const genPass = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(10)); return Array.from(r, (n) => a[n % a.length]).join(''); };
const slugOf = (l) => (String(l.app || '').match(/\/([^/]+)\/?$/) || [, l.id])[1];
function ownerText(l, email, pass) {
  const app = l.app || '', adm = app.replace(/\/?$/, '/') + 'admin.html';
  return `Готово, ваша онлайн-запись работает!\n\nСсылка для клиентов: ${app}\nПоставьте её в шапку ВК, Telegram, 2ГИС и Яндекс Карт.\n\nВаш кабинет: ${adm}\nЛогин: ${email}\nПароль: ${pass}\n\nВ кабинете во вкладке «Профиль» нажмите «Подключить Telegram» — новые записи будут приходить вам сразу. Там же меняются цены, фото, часы работы и пароль.`;
}
function cabinetBlock(l) {
  if (issued[l.id]) return `<div class="res cab"><b>Кабинет выдан ✓</b><textarea class="cabtext" readonly rows="9">${esc(issued[l.id])}</textarea><div class="row"><button class="btn pri" data-a="copyCab" data-id="${l.id}">Скопировать текст для владельца</button></div><div class="small-note">Пароль виден только сейчас — отправьте текст владельцу.</div></div>`;
  if (issueOpen === l.id) return `<div class="res cab">
    <div class="form"><input id="ce-${l.id}" type="email" placeholder="Почта владельца" value="${esc(l.cabinetEmail || '')}" style="flex:1;min-width:180px"><input id="cp-${l.id}" value="${genPass()}" style="width:140px"></div>
    <div class="form"><button class="btn pri" data-a="issue" data-id="${l.id}">Создать вход и передать студию</button><button class="btn ghost" data-a="issueClose" data-id="${l.id}">Отмена</button></div>
    <div class="small-note">Студия перейдёт на владельца, плашка «Демо» исчезнет, твой Telegram от неё отключится.</div></div>`;
  return `<div class="row">${l.cabinetEmail ? `<span class="small-note">Кабинет: ${esc(l.cabinetEmail)}${l.cabinetAt ? ' · ' + fmtWhen(l.cabinetAt) : ''}</span>` : ''}<button class="btn ${l.cabinetEmail ? 'ghost' : 'pri'}" data-a="issueOpen" data-id="${l.id}">${l.cabinetEmail ? 'Выдать заново' : 'Выдать кабинет владельцу'}</button></div>`;
}
async function issueCabinet(l) {
  const email = $('ce-' + l.id).value.trim(), pass = $('cp-' + l.id).value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Проверьте почту владельца');
  if (pass.length < 8) return toast('Пароль — не короче 8 символов');
  const btn = document.querySelector(`[data-a="issue"][data-id="${l.id}"]`); if (btn) { btn.disabled = true; btn.textContent = 'Создаём…'; }
  const { data, error } = await sb.rpc('admin_issue_cabinet', { p_slug: slugOf(l), p_email: email, p_password: pass });
  if (error) {
    const m = error.message || '';
    toast(/not_admin/.test(m) ? 'Нет прав: войдите под своей почтой' : /business_not_found/.test(m) ? 'Студии нет в базе — сначала загрузите её' : 'Не получилось: ' + m);
    if (btn) { btn.disabled = false; btn.textContent = 'Создать вход и передать студию'; }
    return;
  }
  issueOpen = null; issued[l.id] = ownerText(l, email, pass);
  await save(l.id, withLog(l, 'выдан кабинет ' + email, { cabinetEmail: email, cabinetAt: new Date().toISOString() }), data.created ? 'Вход создан, студия передана владельцу' : 'Почта уже была — пароль обновлён, студия передана');
}

// ---------- действия ----------
async function save(id, patch, msg) {
  const i = leads.findIndex((x) => x.id === id); if (i < 0) return;
  const before = leads[i], next = {...before, ...patch};
  leads[i] = next; render();
  const {id: _, ...data} = next;
  const {error} = await sb.from('crm_leads').update({data, updated_at: new Date().toISOString()}).eq('id', id);
  if (error) { leads[i] = before; render(); return toast('Не сохранилось: ' + error.message); }
  if (msg) toast(msg);
}
function withLog(l, text, extra = {}) {
  const now = new Date().toISOString();
  return {...extra, lastCall: now, log: [...(l.log || []), {t: now, a: text}].slice(-15)};
}
async function act(id, a) {
  const l = leads.find((x) => x.id === id); if (!l) return;
  if (a === 'copyPhone') return copy(l.phone, 'Номер скопирован');
  if (a === 'copyOwner') return copy(l.ownerPhone, 'Номер владельца скопирован');
  if (a === 'cpFirst') { await copy(MSG.first(l), 'Первое сообщение скопировано — вставьте в чат'); return markWritten(l, 'написал (первое сообщение)'); }
  if (a === 'cpRemind') { await copy(MSG.remind(l), 'Напоминание скопировано'); return markWritten(l, 'написал напоминание'); }
  if (a === 'cpPrice') return copy(MSG.price(l), 'Текст про цену скопирован');
  if (a === 'waFirst') { setTimeout(() => markWritten(l, 'написал в WhatsApp'), 400); return; }
  if (a === 'waRemind') { setTimeout(() => markWritten(l, 'напомнил в WhatsApp'), 400); return; }
  if (a === 'issueOpen') { issueOpen = id; return render(); }
  if (a === 'issueClose') { issueOpen = null; return render(); }
  if (a === 'issue') return issueCabinet(l);
  if (a === 'copyCab') return copy(issued[id], 'Текст скопирован — отправьте владельцу');
  if (a === 'editOwner') { editOwner = editOwner === id ? null : id; return render(); }
  if (a === 'saveOwner') {
    editOwner = null;
    return save(id, {ownerName: $('on-' + id).value.trim(), ownerPhone: $('op-' + id).value.trim(), bestTime: $('ot-' + id).value.trim()}, 'Данные владельца сохранены');
  }
  if (a === 'copyMsg') return copy(l.message, 'Сообщение скопировано — вставьте в WhatsApp');
  if (a === 'toggle') { openRes = openRes === id ? null : id; return render(); }
  const tries = (l.attempts || 0) + 1;
  if (a === 'noanswer') {
    const next = l.status === 'new' || l.status === 'noanswer' ? {status: 'noanswer', nextCall: addDays(1)} : {nextCall: addDays(1)};
    return save(id, withLog(l, 'не ответил', {...next, attempts: tries}), 'Отмечено: не ответил, перезвон завтра');
  }
  openRes = null;
  if (a === 'owner') { editOwner = id; return save(id, withLog(l, 'ответил сотрудник', {status: 'owner', answered: true, attempts: tries, nextCall: addDays(1)}), 'Запишите, как связаться с владельцем'); }
  if (a === 'sent') return save(id, withLog(l, 'ссылка отправлена', {status: 'sent', answered: true, attempts: tries, nextCall: addDays(2)}), 'Ссылка отправлена · перезвон через 2 дня');
  if (a === 'thinking') return save(id, withLog(l, 'думает', {status: 'thinking', answered: true, attempts: tries, nextCall: addDays(2)}), 'Думает · перезвон через 2 дня');
  if (a === 'no') return save(id, withLog(l, 'не интересно', {status: 'no', answered: true, attempts: tries, nextCall: ''}), 'Отмечено: не интересно');
  if (a === 'callback') { const d = $('d-' + id).value || addDays(2); return save(id, withLog(l, 'перезвонить ' + fmtDay(d), {status: 'callback', answered: true, attempts: tries, nextCall: d}), 'Перезвон ' + fmtDay(d)); }
  if (a === 'sold') {
    const amount = Math.max(0, +$('a-' + id).value || 0), monthly = $('m-' + id).checked;
    return save(id, withLog(l, `купил ${rub(amount)} ₽`, {status: 'sold', answered: true, attempts: tries, amount, monthly, nextCall: ''}), `Продажа ${rub(amount)} ₽ — поздравляю!`);
  }
}
$('q').oninput = (e) => { query = e.target.value; render(); };

// ---------- вход и загрузка ----------
async function load() {
  const {data, error} = await sb.from('crm_leads').select('id,data');
  if (error) { $('list').innerHTML = `<div class="empty">Не удалось загрузить: ${esc(error.message)}</div>`; return; }
  leads = (data || []).map((r) => ({id: r.id, ...r.data}));
  if (!leads.length) $('list').innerHTML = '<div class="empty">Студий нет — проверьте, что вошли под своей почтой.</div>';
  else render();
}
async function start() {
  const {data: {session}} = await sb.auth.getSession();
  $('login').hidden = !!session; $('app').hidden = !session;
  if (session) { $('who').textContent = session.user.email; await load(); }
}
$('login').onsubmit = async (e) => {
  e.preventDefault(); $('lErr').textContent = '';
  const {error} = await sb.auth.signInWithPassword({email: $('lEmail').value.trim(), password: $('lPass').value});
  if (error) { $('lErr').textContent = 'Неверная почта или пароль'; return; }
  start();
};
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
// свежие данные при возвращении на вкладку (например, правки с телефона)
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('app').hidden) load(); });
start();
