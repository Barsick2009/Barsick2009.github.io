import { CFG, HAS_DB, store, todayStr, addDays, toUTC, localParts, dayLabel, dayShort, minToHM, hm, rub, durLabel, isDayOff, DOW_FULL, paintLogo, MSGR_FIELDS } from './core.js';
import { carPicker } from './cars.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) => String(n || '').replace(/[«»"']/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2600); }
const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Выполнена', cancelled: 'Отменена' };
const SRC = { app: 'приложение', assistant: 'ассистент', owner: 'вручную' };

let B, S, OFF, day, lastIds = null;

async function boot() {
  if (!HAS_DB) $('demoBar').classList.remove('hide');
  const name = CFG.business?.name || 'Сервис';
  paintLogo($('lLogo'), CFG.business, initials(name)); $('lName').textContent = name;
  if (!HAS_DB) { $('lEmail').value = 'demo@demo.ru'; $('lPass').value = 'demo'; }
  if (await store.session()) return start();
  $('login').classList.remove('hide');
}
$('loginForm').onsubmit = async (e) => {
  e.preventDefault(); $('lErr').textContent = '';
  try { await store.signIn($('lEmail').value.trim(), $('lPass').value); $('login').classList.add('hide'); await start(); }
  catch (err) { $('lErr').textContent = err.message; }
};
$('logout').onclick = async () => { await store.signOut(); location.reload(); };

async function start() {
  try { ({ business: B, services: S } = await store.myBusiness()); }
  catch (e) { $('login').classList.remove('hide'); $('lErr').textContent = e.message; await store.signOut(); return; }
  OFF = B.utc_offset ?? 180; day = day || todayStr(OFF);
  document.documentElement.style.setProperty('--accent', B.accent || '#3b82f6');
  paintLogo($('aLogo'), B, initials(B.name)); $('aName').textContent = B.name;
  $('app').classList.remove('hide');
  renderBookings(); renderServices(); renderSettings();
  setInterval(() => renderBookings(true), 30000);  // проверяем новые записи
}

document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  ['book', 'svc', 'set'].forEach((t) => $('tab-' + t).classList.toggle('hide', t !== b.dataset.t));
  scrollTo(0, 0);
});

// ================= ЗАПИСИ =================
async function renderBookings(silent) {
  const el = $('tab-book'), t = todayStr(OFF);
  const from = toUTC(day, 0, OFF).toISOString(), to = toUTC(day, 1440, OFF).toISOString();
  let list = [];
  try { list = await store.listBookings(B.id, from, to); } catch (e) { if (!silent) toast(e.message); return; }
  // уведомление о новых записях (по любому дню — смотрим на неделю вперёд)
  try {
    const wk = await store.listBookings(B.id, new Date().toISOString(), toUTC(addDays(t, 14), 0, OFF).toISOString());
    const ids = new Set(wk.filter((b) => b.status === 'new').map((b) => b.id));
    if (lastIds && [...ids].some((id) => !lastIds.has(id))) { toast('🔔 Новая запись!'); try { navigator.vibrate?.(200); } catch {} }
    lastIds = ids;
    $('aSub').textContent = ids.size ? `Новых записей: ${ids.size}` : 'Кабинет владельца';
  } catch {}
  const active = list.filter((b) => b.status !== 'cancelled');
  const revenue = active.reduce((s, b) => s + (b.price || 0), 0);
  const load = Math.round(active.reduce((s, b) => s + (new Date(b.ends_at) - new Date(b.starts_at)) / 60000, 0) / Math.max(1, (hm(B.close_time) - hm(B.open_time)) * B.boxes) * 100);
  const days = Array.from({ length: 21 }, (_, i) => addDays(t, i - 3));
  el.innerHTML = `
    <div class="days" style="margin-top:12px">${days.map((d) => { const x = dayShort(d), off = isDayOff(B, d); return `<button class="day ${d === day ? 'sel' : ''} ${off ? 'off' : ''}" data-d="${d}"><span>${d === t ? 'сег' : x.dow}</span><b>${x.num}</b><span>${off ? 'вых' : x.mon}</span></button>`; }).join('')}</div>
    <div class="row"><h2 class="sec grow" style="margin:0">${dayLabel(day, OFF)}${isDayOff(B, day) ? ' <span class="badge">выходной</span>' : ''}</h2><button class="btn primary" id="addBtn" style="height:40px">+ Запись</button></div>
    <div class="stats"><div class="card"><b>${active.length}</b><span class="small muted">записей</span></div><div class="card"><b>${rub(revenue)}</b><span class="small muted">выручка</span></div><div class="card"><b>${Math.min(load, 100)}%</b><span class="small muted">загрузка</span></div></div>
    ${list.length ? list.map(card).join('') : '<div class="empty">На этот день записей нет</div>'}`;
  el.querySelectorAll('.day').forEach((d) => d.onclick = () => { day = d.dataset.d; renderBookings(); });
  el.querySelector('.day.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('addBtn').onclick = openAdd;
  el.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
    const [id, status] = [b.dataset.id, b.dataset.act];
    if (status === 'cancelled' && !confirmCancel(b)) return;
    try { await store.updateBooking(id, { status }); toast('Сохранено'); renderBookings(); } catch (e) { toast(e.message); }
  });
}
function confirmCancel(btn) { if (btn.dataset.sure) return true; btn.dataset.sure = 1; btn.textContent = 'Точно отменить?'; btn.style.color = 'var(--bad)'; return false; }
function card(b) {
  const s = localParts(b.starts_at, OFF).min, e = localParts(b.ends_at, OFF).min;
  const tel = String(b.client_phone).replace(/[^\d+]/g, ''), wa = tel.replace(/\D/g, '');
  const acts = { new: [['confirmed', 'Подтвердить'], ['cancelled', 'Отменить']], confirmed: [['done', 'Выполнено'], ['cancelled', 'Отменить']], done: [['confirmed', 'Вернуть']], cancelled: [['new', 'Восстановить']] }[b.status] || [];
  return `<div class="bk ${b.status}">
    <div class="row"><div class="t grow">${minToHM(s)}–${minToHM(e)} · бокс ${b.box}</div><span class="badge ${b.status}">${STATUS[b.status]}</span></div>
    <div style="margin-top:4px"><b>${esc(b.service_name)}</b> · ${rub(b.price || 0)}</div>
    <div class="meta">${esc(b.client_name)} · <a href="tel:${tel}" style="color:var(--accent)">${esc(b.client_phone)}</a>${b.car ? ' · ' + esc(b.car) : ''}</div>
    ${b.comment ? `<div class="meta">💬 ${esc(b.comment)}</div>` : ''}
    <div class="meta small">через ${SRC[b.source] || b.source}</div>
    <div class="acts">${acts.map(([st, l]) => `<button data-id="${esc(b.id)}" data-act="${st}">${l}</button>`).join('')}<a href="https://wa.me/${wa}" target="_blank" rel="noopener"><button>WhatsApp</button></a><a href="tel:${tel}"><button>Позвонить</button></a></div>
  </div>`;
}

// ручное добавление (звонок, «с улицы»)
function openAdd() {
  const act = S.filter((s) => s.active !== false);
  $('addBody').innerHTML = `
    <div class="field"><label>Услуга</label><select id="nSvc">${act.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} — ${rub(s.price)}, ${durLabel(s.duration_min)}</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label>Дата</label><input id="nDay" type="date" value="${day}"></div><div class="field"><label>Время</label><input id="nTime" type="time" step="900" value="${minToHM(Math.max(hm(B.open_time), Math.ceil((localParts(new Date(), OFF).min + 1) / 30) * 30))}"></div></div>
    <div class="field"><label>Бокс</label><select id="nBox">${Array.from({ length: B.boxes }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div>
    <div class="field"><label>Клиент</label><input id="nName" placeholder="Имя"></div>
    <div class="field"><label>Телефон</label><input id="nPhone" type="tel" placeholder="+7"></div>
    <div class="field"><label>Автомобиль</label><input id="nCar" placeholder="Начните вводить марку"></div><div class="err" id="nErr"></div>`;
  carPicker($('nCar'));
  $('bg').classList.add('on'); $('addSheet').classList.add('on');
}
const closeSheet = () => { $('bg').classList.remove('on'); $('addSheet').classList.remove('on'); };
$('bg').onclick = closeSheet; document.querySelector('#addSheet .close').onclick = closeSheet;
$('addSave').onclick = async () => {
  const s = S.find((x) => String(x.id) === $('nSvc').value), d = $('nDay').value, m = hm($('nTime').value);
  if (!s || !d || !$('nTime').value) return ($('nErr').textContent = 'Заполните услугу, дату и время');
  const st = toUTC(d, m, OFF);
  try {
    await store.addBookingOwner(B.id, { service_id: s.id, service_name: s.name, price: s.price, box: +$('nBox').value, starts_at: st.toISOString(), ends_at: new Date(+st + s.duration_min * 60000).toISOString(), client_name: $('nName').value.trim() || 'Клиент', client_phone: $('nPhone').value.trim() || '—', car: $('nCar').value.trim(), comment: '' });
    closeSheet(); day = d; toast('Запись добавлена'); renderBookings();
  } catch (e) { $('nErr').textContent = e.message; }
};

// ================= УСЛУГИ =================
function renderServices() {
  const el = $('tab-svc'), list = S.filter((s) => s.active !== false);
  el.innerHTML = `<h2 class="sec">Услуги и цены <span class="small muted">меняются сразу у клиентов</span></h2>
    ${list.map((s) => svcForm(s)).join('')}
    <button class="btn ghost block" id="svcAdd">+ Добавить услугу</button>`;
  el.querySelectorAll('.svc-edit').forEach(bindSvc);
  $('svcAdd').onclick = () => { $('svcAdd').insertAdjacentHTML('beforebegin', svcForm({ id: 'new' + Date.now(), name: '', price: 0, duration_min: 60, description: '', sort: list.length + 1 })); bindSvc($('svcAdd').previousElementSibling); $('svcAdd').previousElementSibling.querySelector('[name=name]').focus(); };
}
function svcForm(s) {
  return `<form class="svc-edit" data-id="${esc(s.id)}" data-sort="${s.sort || 0}">
    <input name="name" value="${esc(s.name)}" placeholder="Название услуги" required>
    <div class="grid2"><div><label class="small muted">Цена, ₽</label><input name="price" type="number" min="0" step="50" value="${s.price}"></div><div><label class="small muted">Длительность, мин</label><input name="duration_min" type="number" min="10" step="10" value="${s.duration_min}"></div></div>
    <details ${s.prices && Object.values(s.prices).some((v) => +v > 0) ? 'open' : ''}><summary class="small muted" style="cursor:pointer;padding:4px 2px">Цена по типу кузова (необязательно)</summary>
      <div class="grid3" style="margin-top:6px">${[['sedan', 'Седан'], ['crossover', 'Кроссовер'], ['suv', 'Внедорожник']].map(([k, n]) => `<div><label class="small muted">${n}, ₽</label><input name="p_${k}" type="number" min="0" step="50" value="${+(s.prices?.[k]) || ''}" placeholder="—"></div>`).join('')}</div>
    </details>
    <input name="description" value="${esc(s.description || '')}" placeholder="Описание (необязательно)">
    <div class="row"><button class="btn primary grow" style="height:42px">Сохранить</button><button type="button" class="btn" data-del style="height:42px;color:var(--bad)">Удалить</button></div></form>`;
}
function bindSvc(f) {
  f.onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    const prices = {}; ['sedan', 'crossover', 'suv'].forEach((k) => { if (+fd['p_' + k] > 0) prices[k] = +fd['p_' + k]; delete fd['p_' + k]; });
    try {
      const saved = await store.saveService(B.id, { ...fd, prices: Object.keys(prices).length ? prices : null, id: f.dataset.id, sort: +f.dataset.sort, active: true });
      const i = S.findIndex((x) => String(x.id) === f.dataset.id); if (i >= 0) S[i] = saved; else S.push(saved);
      f.dataset.id = saved.id; toast('Цена обновлена — клиенты уже видят');
    } catch (err) { toast(err.message); }
  };
  f.querySelector('[data-del]').onclick = async (e) => {
    if (!confirmCancel(e.target)) return;
    if (!String(f.dataset.id).startsWith('new')) { try { await store.deleteService(f.dataset.id); } catch (err) { return toast(err.message); } }
    S = S.filter((x) => String(x.id) !== f.dataset.id); f.remove(); toast('Услуга удалена');
  };
}

// ================= ПРОФИЛЬ =================
const socField = (f) => `<div class="field"><label>${f.name}</label><input name="soc_${f.key}" value="${esc(B.socials?.[f.key] || '')}" placeholder="${esc(f.ph)}"></div>`;
function renderSettings() {
  const el = $('tab-set');
  const app = new URL('./', location.href).href;
  el.innerHTML = `<h2 class="sec">Профиль сервиса</h2>
    <form id="setForm">
      <div class="field"><label>Название</label><input name="name" value="${esc(B.name)}"></div>
      <div class="grid2"><div class="field"><label>Город</label><input name="city" value="${esc(B.city)}"></div><div class="field"><label>Телефон</label><input name="phone" value="${esc(B.phone)}"></div></div>
      <div class="field"><label>Адрес</label><input name="address" value="${esc(B.address)}"></div>
      <div class="soc-h">Мессенджеры — кнопками под «Записаться»</div>
      <div class="grid2">${MSGR_FIELDS.filter((f) => f.kind === 'chat').map(socField).join('')}</div>
      <div class="soc-h">Соцсети и карты — в «Контактах»</div>
      <div class="grid2">${MSGR_FIELDS.filter((f) => f.kind !== 'chat').map(socField).join('')}</div>
      <div class="small muted" style="margin:-4px 0 12px 4px">Пустое поле — кнопка не показывается. Можно вставить ссылку, @ник или номер.</div>
      <div class="field"><label>О нас</label><textarea name="about" rows="3">${esc(B.about)}</textarea></div>
      <div class="grid2"><div class="field"><label>Открытие</label><input name="open_time" type="time" value="${B.open_time}"></div><div class="field"><label>Закрытие</label><input name="close_time" type="time" value="${B.close_time}"></div></div>
      <div class="grid2"><div class="field"><label>Боксов</label><input name="boxes" type="number" min="1" max="20" value="${B.boxes}"></div><div class="field"><label>Шаг записи</label><select name="slot_step">${[15, 30, 60].map((v) => `<option ${v === B.slot_step ? 'selected' : ''} value="${v}">${v} мин</option>`).join('')}</select></div></div>
      <div class="grid2"><div class="field"><label>Цвет бренда</label><input name="accent" type="color" value="${esc(B.accent || '#3b82f6')}" style="height:48px;padding:4px"></div><div class="field"><label>Часовой пояс</label><select name="utc_offset">${[120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720].map((v) => `<option value="${v}" ${v === OFF ? 'selected' : ''}>UTC+${v / 60}${v === 180 ? ' (МСК)' : ''}</option>`).join('')}</select></div></div>
      <div class="field"><label>Выходные дни</label><div class="dows">${DOW_FULL.map((d, i) => `<label><input type="checkbox" name="off${i + 1}" ${B.days_off.includes(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div><div class="small muted" style="margin:6px 0 0 4px">Отмеченные дни клиенты не смогут выбрать</div></div>
      <label class="switch card"><span>AI-ассистент в приложении</span><input name="ai_enabled" type="checkbox" ${B.ai_enabled !== false ? 'checked' : ''}></label>
      <button class="btn primary block" style="margin-top:12px">Сохранить профиль</button>
    </form>
    <h2 class="sec">Уведомления в Telegram</h2>
    <div class="card tg" id="tgBox"><div class="small muted">Загружаем…</div></div>
    <h2 class="sec">Фото работ</h2>
    <div class="photos" id="photos"></div>
    <h2 class="sec">До и после <span class="small muted">клиент двигает шторку</span></h2>
    <div id="baAdmin"></div>
    <h2 class="sec">Рейтинг на картах</h2>
    <form class="card" id="rateForm" style="display:grid;gap:10px">
      <div class="grid2"><div><label class="small muted">Оценка</label><input name="value" type="number" step="0.1" min="1" max="5" value="${esc(B.rating?.value ?? '')}" placeholder="4.9"></div><div><label class="small muted">Сколько оценок</label><input name="count" type="number" min="0" value="${esc(B.rating?.count ?? '')}" placeholder="120"></div></div>
      <div class="grid2"><div><label class="small muted">Где</label><select name="source">${['2ГИС', 'Яндекс Картах', 'Google', 'Авито'].map((s) => `<option ${B.rating?.source === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label class="small muted">Ссылка на карточку</label><input name="url" value="${esc(B.rating?.url || '')}" placeholder="https://2gis.ru/…"></div></div>
      <button class="btn primary">Сохранить рейтинг</button>
      <div class="small muted">Пустая оценка — рейтинг не показывается.</div>
    </form>
    <h2 class="sec">Отзывы</h2>
    <div id="revAdmin"></div>
    <h2 class="sec">Ссылка на приложение</h2>
    <div class="card"><div class="small muted">Закрепите в шапке профиля ВК/Telegram/2ГИС и в описании Яндекс Карт</div><div class="row" style="margin-top:8px"><input readonly value="${esc(app)}" id="appLink"><button class="btn" id="copyLink">Копировать</button></div></div>
    ${HAS_DB ? `<h2 class="sec">Пароль от кабинета</h2>
    <form class="card" id="passForm" style="display:grid;gap:10px">
      <input id="p1" type="password" placeholder="Новый пароль (не короче 8 символов)" autocomplete="new-password" minlength="8" required>
      <input id="p2" type="password" placeholder="Повторите пароль" autocomplete="new-password" minlength="8" required>
      <div class="err" id="pErr"></div>
      <button class="btn primary">Сменить пароль</button>
    </form>` : ''}`;
  renderPhotos(); renderTg(); renderBA(); renderRevAdmin();
  if ($('passForm')) $('passForm').onsubmit = async (e) => {
    e.preventDefault(); $('pErr').textContent = '';
    const a = $('p1').value, b = $('p2').value;
    if (a.length < 8) return ($('pErr').textContent = 'Пароль должен быть не короче 8 символов');
    if (a !== b) return ($('pErr').textContent = 'Пароли не совпадают');
    try { await store.changePassword(a); e.target.reset(); toast('Пароль изменён — запомните его'); } catch (err) { $('pErr').textContent = err.message; }
  };
  $('rateForm').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    const v = parseFloat(String(fd.value).replace(',', '.'));
    const rating = v >= 1 && v <= 5 ? { value: Math.round(v * 10) / 10, count: +fd.count || 0, source: fd.source, url: fd.url.trim() } : null;
    try { await store.saveBusiness(B.id, { rating }); B.rating = rating; toast(rating ? 'Рейтинг сохранён' : 'Рейтинг скрыт'); } catch (err) { toast(err.message); }
  };
  $('copyLink').onclick = () => { navigator.clipboard?.writeText(app); toast('Ссылка скопирована'); };
  $('setForm').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    const patch = { name: fd.name.trim(), city: fd.city.trim(), phone: fd.phone.trim(), address: fd.address.trim(), about: fd.about.trim(), open_time: fd.open_time, close_time: fd.close_time, boxes: Math.max(1, Math.min(20, +fd.boxes || 1)), slot_step: +fd.slot_step, accent: fd.accent, utc_offset: +fd.utc_offset, ai_enabled: !!fd.ai_enabled, days_off: [1, 2, 3, 4, 5, 6, 7].filter((d) => fd['off' + d]) };
    if (patch.days_off.length === 7) return toast('Нельзя отметить выходными все дни');
    patch.socials = { ...(B.socials || {}) };
    MSGR_FIELDS.forEach(({ key }) => { const v = (fd['soc_' + key] || '').trim(); if (v) patch.socials[key] = v; else delete patch.socials[key]; });
    if (hm(patch.close_time) <= hm(patch.open_time)) return toast('Время закрытия должно быть позже открытия');
    try { await store.saveBusiness(B.id, patch); Object.assign(B, patch); OFF = B.utc_offset; document.documentElement.style.setProperty('--accent', B.accent); $('aName').textContent = B.name; toast('Профиль сохранён'); } catch (err) { toast(err.message); }
  };
}
// ---------- Telegram: подключение уведомлений ----------
let tgPoll;
async function renderTg() {
  const box = $('tgBox');
  if (!HAS_DB) { box.innerHTML = '<div class="small muted">Новые записи будут сразу приходить вам в Telegram. Заработает после подключения к базе.</div>'; return; }
  let st;
  try { st = await store.tgStatus(B.id); } catch (e) { box.innerHTML = `<div class="small muted">${esc(e.message)}</div>`; return; }
  if (!st.configured) { box.innerHTML = '<div class="small muted">Бот для уведомлений ещё не настроен.</div>'; return; }
  box.innerHTML = st.chats
    ? `<div class="st"><span class="dot"></span>Подключено${st.chats > 1 ? ` · чатов: ${st.chats}` : ''}</div>
       <div class="small muted">Каждая новая запись сразу приходит в Telegram: услуга, время, имя, телефон и машина клиента.</div>
       <div class="grid2"><button class="btn" id="tgAdd">+ Ещё чат</button><button class="btn" id="tgOff" style="color:var(--bad)">Отключить</button></div>`
    : `<div class="small muted">Получайте каждую новую запись в Telegram — даже когда вы в боксе и не смотрите в кабинет.</div>
       <button class="btn primary block" id="tgAdd">Подключить Telegram</button>`;
  $('tgAdd').onclick = async () => {
    const w = window.open('', '_blank');           // открываем окно сразу, иначе браузер заблокирует его после await
    try { const url = await store.tgLink(B.id); if (w) w.location.href = url; else location.href = url; }
    catch (e) { w?.close(); return toast(e.message); }
    toast('Нажмите «Старт» в боте');
    const was = st.chats; clearInterval(tgPoll); let n = 0;
    tgPoll = setInterval(async () => {
      if (++n > 40) return clearInterval(tgPoll);
      try { const s = await store.tgStatus(B.id); if (s.chats > was) { clearInterval(tgPoll); toast('✅ Telegram подключён'); renderTg(); } } catch {}
    }, 3000);
  };
  if ($('tgOff')) $('tgOff').onclick = async (e) => {
    if (!confirmCancel(e.target)) return;
    try { await store.tgUnlink(B.id); toast('Уведомления отключены'); renderTg(); } catch (err) { toast(err.message); }
  };
}

// ---------- До / после ----------
function renderBA() {
  const list = B.before_after || [];
  $('baAdmin').innerHTML = list.map((p, i) => `<div class="ba-adm card"><div class="ba-pair"><img src="${esc(p.before)}"><img src="${esc(p.after)}"></div><div class="row"><div class="grow small">${esc(p.title || 'Без подписи')}</div><button class="btn" data-del="${i}" style="height:36px;color:var(--bad)">Удалить</button></div></div>`).join('')
    + `<form class="card ba-new" id="baForm">
        <input name="title" placeholder="Подпись, например «Полировка кузова»">
        <div class="grid2"><label class="add-ph"><input type="file" accept="image/*" name="before" hidden><span>+ Фото ДО</span></label><label class="add-ph"><input type="file" accept="image/*" name="after" hidden><span>+ Фото ПОСЛЕ</span></label></div>
        <button class="btn primary">Добавить пару</button></form>`;
  $('baAdmin').querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
    if (!confirmCancel(e.target)) return;
    await saveBA(list.filter((_, i) => i !== +b.dataset.del), 'Удалено');
  });
  $('baForm').querySelectorAll('.add-ph input').forEach((inp) => inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const span = inp.nextElementSibling;
    span.style.backgroundImage = `url("${URL.createObjectURL(f)}")`; span.classList.add('set');
  });
  $('baForm').onsubmit = async (e) => {
    e.preventDefault(); const fm = e.target, b = fm.before.files[0], a = fm.after.files[0];
    if (!b || !a) return toast('Выберите оба фото: до и после');
    toast('Загружаем…');
    try {
      const [ub, ua] = [await store.uploadPhoto(B.id, await shrink(b)), await store.uploadPhoto(B.id, await shrink(a))];
      await saveBA([...list, { before: ub, after: ua, title: fm.title.value.trim() }], 'Добавлено — клиенты уже видят');
    } catch (err) { toast(err.message); }
  };
}
async function saveBA(list, msg) { try { await store.saveBusiness(B.id, { before_after: list }); B.before_after = list; renderBA(); toast(msg); } catch (e) { toast(e.message); } }

// ---------- Отзывы ----------
function renderRevAdmin() {
  const list = B.reviews || [];
  $('revAdmin').innerHTML = list.map((r, i) => `<div class="card rev-adm"><div class="row"><b class="grow">${esc(r.name)} <span style="color:#fbbf24">${'★'.repeat(r.rating || 0)}</span>${r.src ? ` <span class="small muted" style="font-weight:500">· ${esc(r.src)}</span>` : ''}</b><button class="btn" data-del="${i}" style="height:34px;color:var(--bad)">Удалить</button></div><div class="small muted" style="margin-top:6px">${esc(r.text)}</div></div>`).join('')
    + `<form class="card" id="revForm" style="display:grid;gap:10px">
        <div class="grid2"><input name="name" placeholder="Имя клиента" required><select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)}</option>`).join('')}</select></div>
        <textarea name="text" rows="3" placeholder="Текст отзыва" required></textarea>
        <input name="date" type="date" value="${todayStr(OFF)}">
        <button class="btn primary">Добавить отзыв</button>
        <div class="small muted">Публикуйте настоящие отзывы клиентов — например, перенесите их из 2ГИС или Яндекс Карт.</div></form>`;
  $('revAdmin').querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
    if (!confirmCancel(e.target)) return;
    await saveRev(list.filter((_, i) => i !== +b.dataset.del), 'Отзыв удалён');
  });
  $('revForm').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    await saveRev([{ name: fd.name.trim(), rating: +fd.rating, text: fd.text.trim(), date: fd.date }, ...list], 'Отзыв добавлен');
  };
}
async function saveRev(list, msg) { try { await store.saveBusiness(B.id, { reviews: list }); B.reviews = list; renderRevAdmin(); toast(msg); } catch (e) { toast(e.message); } }

function renderPhotos() {
  const ph = B.photos || [];
  $('photos').innerHTML = ph.map((u, i) => `<div class="p"><img src="${esc(u)}"><button data-i="${i}">✕</button></div>`).join('') + `<label class="add">+ Фото<input type="file" accept="image/*" multiple hidden id="phInput"></label>`;
  $('photos').querySelectorAll('button[data-i]').forEach((b) => b.onclick = async () => { const photos = ph.filter((_, i) => i !== +b.dataset.i); await savePhotos(photos); });
  $('phInput').onchange = async (e) => {
    const files = [...e.target.files].slice(0, 10); if (!files.length) return; toast('Загружаем…');
    try { const urls = []; for (const f of files) urls.push(await store.uploadPhoto(B.id, await shrink(f))); await savePhotos([...ph, ...urls]); } catch (err) { toast(err.message); }
  };
}
async function savePhotos(photos) { try { await store.saveBusiness(B.id, { photos }); B.photos = photos; renderPhotos(); toast('Фото обновлены'); } catch (e) { toast(e.message); } }
// сжимаем фото до 1600px, чтобы не забивать бесплатное хранилище
async function shrink(file) {
  try {
    const img = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}

boot();
