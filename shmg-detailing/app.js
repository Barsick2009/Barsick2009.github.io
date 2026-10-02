import { CFG, HAS_DB, store, freeSlots, todayStr, addDays, toUTC, localParts, dayLabel, dayShort, minToHM, hm, rub, durLabel, fmtWhen, askAssistant, ls, isDayOff, workDaysLabel, BODIES, hasBodies, bodyPrice, minPrice, durTag, durHuman, paintLogo, messengers, quickBusiness, inkFor } from './core.js';
import { carPicker } from './cars.js';
import { svcIcon } from './icons.js';
import { svcInfo } from './svcinfo.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let B, S, OFF;                                 // бизнес, услуги, смещение
const st = { step: 0, service: null, day: null, slot: null, source: 'app', body: ls.get('boxapp:body', 'sedan') };
const MY = `boxapp:${CFG.slug}:my`, ME = 'boxapp:me';

function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2600); }
const initials = (n) => n.replace(/[«»"']/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const price = (p) => (p ? rub(p) : 'по запросу');
const telHref =(p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
const mapHref = () => 'https://yandex.ru/maps/?text=' + encodeURIComponent(`${B.city || ''} ${B.address || B.name}`.trim());

async function init() {
  if (!HAS_DB) $('demoBar').classList.remove('hide');
  // сразу рисуем из встроенных/сохранённых данных, затем тихо обновляем из базы
  ({ business: B, services: S } = quickBusiness());
  paint(); setupInstall(); setupMotion();
  requestAnimationFrame(() => document.body.classList.add('ready'));
  if (HAS_DB) {
    try {
      const fresh = await store.loadBusiness();
      if (fresh && JSON.stringify(fresh) !== JSON.stringify({ business: B, services: S })) { ({ business: B, services: S } = fresh); document.body.classList.add('repaint'); paint(); }
    } catch {}
  }
}

let coverSrc = '';
function paint() {
  OFF = B.utc_offset ?? 180;
  // пока студия не купила приложение — предупреждаем случайных посетителей (отметка live в базе или в сборке)
  const live = B.live === true || CFG.business?.live === true;
  $('previewBar').classList.toggle('hide', !HAS_DB || live);
  $('previewPhone').textContent = B.phone || ''; $('previewPhone').href = 'tel:' + String(B.phone || '').replace(/[^\d+]/g, '');
  document.documentElement.style.setProperty('--accent', B.accent || '#3b82f6');
  document.documentElement.style.setProperty('--accent-ink', inkFor(B.accent || '#3b82f6'));
  paintLogo($('logo'), B, initials(B.name)); paintLogo($('chatLogo'), B, initials(B.name)); paintLogo($('tbLogo'), B, initials(B.name)); $('tbName').textContent = B.name;
  // обложка проявляется плавно, когда фото загрузилось
  const src = B.photos && B.photos.length ? B.photos[0] : '';
  if (src && src !== coverSrc) {
    coverSrc = src; $('cover').classList.add('photo');
    const im = new Image(); im.onload = () => { $('coverImg').style.backgroundImage = `url("${encodeURI(src)}")`; $('coverImg').classList.add('on'); }; im.src = src;
  }
  $('bizName').textContent = B.name;
  $('bizAddr').textContent = [B.city, B.address].filter(Boolean).join(', ');
  $('bizAbout').textContent = B.about || '';
  $('callBtn').href = $('infoPhone').href = telHref(B.phone);
  $('infoPhoneT').textContent = B.phone;
  $('mapBtn').href = $('infoMap').href = mapHref();
  $('infoAddr').textContent = B.address || B.city;
  $('infoHours').textContent = `${B.open_time} – ${B.close_time}`;
  $('infoBoxes').textContent = B.boxes;
  // мессенджеры: кнопки под «Записаться» и карточки в «Контактах»
  const ms = messengers(B);
  $('msgrRow').innerHTML = ms.filter((m) => m.kind === 'chat' || (m.key === 'vk' && ms.filter((x) => x.kind === 'chat').length < 3)).slice(0, 4)
    .map((m) => `<a class="msgr-btn" href="${esc(m.href)}" target="_blank" rel="noopener" style="--mc:${m.color}">${m.svg}${m.name}</a>`).join('');
  document.querySelectorAll('.msgr-card').forEach((e) => e.remove());
  $('infoPhone').insertAdjacentHTML('afterend', ms.map((m) => `<a class="card msgr-card" href="${esc(m.href)}" target="_blank" rel="noopener" style="--mc:${m.color}">${m.svg}<div><div>${m.kind === 'site' ? esc(m.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) : m.name}</div><div class="small muted">${m.sub}</div></div></a>`).join(''));
  $('infoDays').textContent = workDaysLabel(B);
  const nowMin = localParts(new Date(), OFF).min, dayOff = isDayOff(B, todayStr(OFF));
  const open = !dayOff && nowMin >= hm(B.open_time) && nowMin < hm(B.close_time);
  $('openDot').classList.toggle('off', !open);
  $('openText').textContent = open ? `Открыто до ${B.close_time}` : dayOff ? 'Сегодня выходной' : `Закрыто · откроемся в ${B.open_time}`;
  $('chatBtn').classList.toggle('hide', B.ai_enabled === false);
  renderServices(); renderGallery(); renderMine(); renderBeforeAfter(); renderReviews();
}

// ---------- До / после: шторка, которую тянут пальцем ----------
function renderBeforeAfter() {
  const list = (B.before_after || []).filter((p) => p.before && p.after);
  $('baBox').classList.toggle('hide', !list.length);
  $('baList').innerHTML = list.map((p) => `<figure class="ba" style="--p:50%">
      <img src="${esc(p.after)}" alt="После" loading="lazy" draggable="false">
      <img class="ba-before" src="${esc(p.before)}" alt="До" loading="lazy" draggable="false">
      <span class="ba-line"><i><svg class="i" viewBox="0 0 24 24"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></i></span>
      <span class="ba-tag l">До</span><span class="ba-tag r">После</span>
      ${p.title ? `<figcaption>${esc(p.title)}</figcaption>` : ''}</figure>`).join('');
  $('baList').querySelectorAll('.ba').forEach((f) => {
    const set = (x) => { const r = f.getBoundingClientRect(); f.style.setProperty('--p', Math.max(0, Math.min(100, (x - r.left) / r.width * 100)) + '%'); };
    let on = false, sx = 0, sy = 0, dir = '';
    f.addEventListener('pointerdown', (e) => { on = true; sx = e.clientX; sy = e.clientY; dir = e.pointerType === 'mouse' ? 'x' : ''; if (dir) { f.setPointerCapture(e.pointerId); set(e.clientX); } });
    f.addEventListener('pointermove', (e) => {
      if (!on) return;
      if (!dir) { const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy); if (dx + dy < 6) return; dir = dx > dy ? 'x' : 'y'; if (dir === 'x') f.setPointerCapture(e.pointerId); }
      if (dir === 'x') set(e.clientX);
    });
    const end = () => { on = false; dir = ''; };
    f.addEventListener('pointerup', end); f.addEventListener('pointercancel', end);
  });
}

// ---------- Отзывы и общий рейтинг ----------
const stars = (n) => `<span class="stars" style="--r:${Math.max(0, Math.min(5, +n || 0))}">★★★★★</span>`;
const plural3 = (n, a, b, c) => { const x = n % 100, y = n % 10; return x > 10 && x < 20 ? c : y === 1 ? a : y > 1 && y < 5 ? b : c; };
function renderReviews() {
  const list = (B.reviews || []).filter((r) => r.text && r.name), R = B.rating;
  $('revBox').classList.toggle('hide', !list.length && !(R && R.value));
  const rr = $('revRate');
  if (R && R.value) {
    const v = (+R.value).toFixed(1).replace('.', ',');
    rr.innerHTML = `<b class="rs-num">${v}</b><div class="grow">${stars(R.value).replace('class="stars"', 'class="stars big"')}<div class="small muted">${R.count ? `${R.count} ${plural3(+R.count, 'оценка', 'оценки', 'оценок')}` : 'Рейтинг'}${R.source ? ` в ${esc(R.source)}` : ''}</div></div>${R.url ? '<span class="rs-go">Все отзывы →</span>' : ''}`;
    if (R.url) rr.href = R.url; else rr.removeAttribute('href');
    rr.classList.remove('hide');
  } else rr.classList.add('hide');
  // лента едет сама по кругу: повторяем карточки, чтобы хватило на ширину, и дублируем для бесшовной петли
  const card = (r) => `<div class="rev card">
      <div class="rev-h"><span class="rev-av">${esc(String(r.name).trim()[0] || '?').toUpperCase()}</span><div class="grow"><b>${esc(r.name)}</b>${r.date || r.src ? `<div class="small muted">${[r.date && new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), r.src].filter(Boolean).map(esc).join(' · ')}</div>` : ''}</div>${r.rating ? stars(r.rating) : ''}</div>
      <p>${esc(r.text)}</p></div>`;
  const box = $('revList');
  if (list.length < 2) { box.classList.add('static'); box.innerHTML = list.map(card).join(''); return; }
  box.classList.remove('static');
  let one = list; while (one.length < 5) one = one.concat(list);
  box.innerHTML = `<div class="rev-track" style="--dur:${one.length * 7}s">${one.map(card).join('')}<div class="rev-dup" aria-hidden="true">${one.map(card).join('')}</div></div>`;
  const tr = box.firstElementChild;
  box.ontouchstart = () => tr.classList.add('paused'); box.ontouchend = () => setTimeout(() => tr.classList.remove('paused'), 1500);
}

function renderServices() {
  $('services').innerHTML = S.map((s, i) => `<button class="svc" style="--i:${i}" data-id="${esc(s.id)}">${svcIcon(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div>${s.description ? `<div class="ds">${esc(s.description)}</div>` : ''}<div class="du">${durTag(s.duration_min)}</div></div><div><div class="pr">${minPrice(s) ? 'от ' + rub(minPrice(s)) : 'по запросу'}</div>${hasBodies(s) ? '<div class="du">по кузову</div>' : ''}</div><svg class="i chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>`).join('') || '<div class="empty">Услуги скоро появятся</div>';
  $('services').querySelectorAll('.svc').forEach((el) => el.onclick = () => openInfo(S.find((s) => String(s.id) === el.dataset.id)));
}

// ---------- Подробно об услуге: что входит и зачем ----------
const CHECK = '<svg class="i" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
const PLUS = '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
function openInfo(s) {
  const inf = svcInfo(s.name);
  $('infoIc').innerHTML = svcIcon(s.name); $('infoName').textContent = s.name;
  const prices = hasBodies(s)
    ? `<div class="bodies static">${BODIES.filter(([k]) => +s.prices[k] > 0).map(([k, n]) => `<div><span>${n}</span><b>${rub(+s.prices[k])}</b></div>`).join('')}</div>`
    : `<div class="info-price"><b>${minPrice(s) ? 'от ' + rub(minPrice(s)) : 'Цена по запросу'}</b></div>`;
  $('infoBody').innerHTML = `${prices}
    <div class="info-meta">${durTag(s.duration_min)}</div>
    ${s.description ? `<p class="info-desc">${esc(s.description)}</p>` : ''}
    <h4 class="info-h">Что входит</h4>
    <ul class="info-list inc">${inf.inc.map((t) => `<li>${CHECK}<span>${esc(t)}</span></li>`).join('')}</ul>
    <h4 class="info-h">Почему стоит сделать</h4>
    <ul class="info-list plus">${inf.plus.map((t) => `<li>${PLUS}<span>${esc(t)}</span></li>`).join('')}</ul>
    <p class="small muted" style="margin:14px 0 0">Точный состав работ и цену мастер уточнит, когда увидит машину.</p>`;
  $('infoBook').onclick = () => openBooking(s);
  closeSheets(); openSheet('infoSheet'); $('infoBody').scrollTop = 0;
}
let PH = [];
function renderGallery() {
  // без своих фото блок «Наши работы» не показываем — заглушки выглядят несерьёзно
  $('galBox').classList.toggle('hide', !(B.photos && B.photos.length));
  PH = (B.photos && B.photos.length) ? B.photos : [];
  const g = $('gallery');
  g.innerHTML = PH.map((u, i) => `<img src="${esc(u)}" alt="Работа ${esc(B.name)}" loading="lazy" data-i="${i}">`).join('');
  g.querySelectorAll('img').forEach((im) => im.onclick = () => openLb(+im.dataset.i));
  $('gdots').innerHTML = PH.length > 1 ? PH.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('') : '';
  g.onscroll = () => {
    const w = g.firstElementChild?.getBoundingClientRect().width || 1, i = Math.round(g.scrollLeft / (w + 12));
    $('gdots').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
  };
  if (B.photos && B.photos.length) $('cover').onclick = () => openLb(0);
}

// ---------- Просмотр фото на весь экран ----------
const lb = $('lb'), track = $('lbTrack');
let lbI = 0, lastTap = 0;
function openLb(i) {
  track.innerHTML = PH.map((u) => `<div class="lb-slide"><img src="${esc(u)}" alt="" draggable="false"></div>`).join('');
  lb.classList.add('on'); lb.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  $('lbPrev').hidden = $('lbNext').hidden = PH.length < 2;
  requestAnimationFrame(() => { track.scrollLeft = i * track.clientWidth; setLb(i); });
}
function closeLb() { lb.classList.remove('on'); lb.style.transform = lb.style.opacity = ''; lb.setAttribute('aria-hidden', 'true'); if (!document.querySelector('.sheet.on')) document.body.style.overflow = ''; }
function setLb(i) { lbI = Math.max(0, Math.min(PH.length - 1, i)); $('lbCount').textContent = `${lbI + 1} / ${PH.length}`; }
const goLb = (d) => { unzoom(); track.scrollTo({ left: (lbI + d) * track.clientWidth, behavior: 'smooth' }); };
track.addEventListener('scroll', () => setLb(Math.round(track.scrollLeft / track.clientWidth)), { passive: true });
$('lbClose').onclick = closeLb; $('lbPrev').onclick = () => goLb(-1); $('lbNext').onclick = () => goLb(1);
addEventListener('keydown', (e) => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') goLb(-1); if (e.key === 'ArrowRight') goLb(1); });
function unzoom() { track.querySelectorAll('.lb-slide.zoom').forEach((s) => s.classList.remove('zoom')); track.classList.remove('locked'); }
// двойной тап — приблизить в точку касания, ещё раз — обратно
track.addEventListener('click', (e) => {
  const s = e.target.closest('.lb-slide'); if (!s) return;
  const now = Date.now(); if (now - lastTap > 300) { lastTap = now; if (e.target === s && !s.classList.contains('zoom')) closeLb(); return; }
  lastTap = 0;
  if (s.classList.contains('zoom')) return unzoom();
  const r = s.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  s.classList.add('zoom'); track.classList.add('locked');
  requestAnimationFrame(() => { s.scrollLeft = fx * s.scrollWidth - r.width / 2; s.scrollTop = fy * s.scrollHeight - r.height / 2; });
});
// свайп вниз — закрыть
let sy = null, sx = 0;
lb.addEventListener('touchstart', (e) => { if (track.classList.contains('locked') || e.touches.length > 1) return (sy = null); sy = e.touches[0].clientY; sx = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchmove', (e) => {
  if (sy == null) return; const dy = e.touches[0].clientY - sy, dx = e.touches[0].clientX - sx;
  if (dy > 10 && dy > Math.abs(dx) * 1.3) { lb.style.transform = `translateY(${dy}px)`; lb.style.opacity = String(Math.max(.3, 1 - dy / 500)); }
}, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (sy == null) return; const dy = e.changedTouches[0].clientY - sy; sy = null;
  if (dy > 110 && lb.style.transform) closeLb(); else { lb.style.transform = ''; lb.style.opacity = ''; }
});

// ---------- Живость: появление блоков, шапка при прокрутке ----------
function setupMotion() {
  // то, что уже на экране, показываем сразу; остальное — при прокрутке
  let els = [...document.querySelectorAll('main h2.sec, .gallery, .info .card')].filter((el) => el.getBoundingClientRect().top > innerHeight);
  els.forEach((el) => el.classList.add('reveal'));
  let busy = false;
  const check = () => {
    busy = false;
    els = els.filter((el) => { if (el.getBoundingClientRect().top < innerHeight * 0.92) { el.classList.add('in'); return false; } return true; });
    $('topbar').classList.toggle('on', $('bookBtn').getBoundingClientRect().bottom < 0);
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(check); } }, { passive: true });
  addEventListener('resize', check); addEventListener('load', check); check();
  // вёрстка может сдвинуться без прокрутки (догрузились фото, липкая колонка) — перепроверяем, пока есть скрытые блоки
  const iv = setInterval(() => { check(); if (!els.length) clearInterval(iv); }, 600);
  $('tbBook').onclick = () => openBooking();
}

// шторки закрываются свайпом вниз за шапку
document.querySelectorAll('.sheet').forEach((sh) => {
  let y0 = null, dy = 0;
  const start = (e) => { if (e.target.closest('button,input,textarea,a')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; };
  sh.querySelectorAll('.grab,.hd,.steps').forEach((h) => h.addEventListener('touchstart', start, { passive: true }));
  sh.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transition = sh.style.transform = ''; if (dy > 90) closeSheets(); });
});
function renderMine() {
  const now = Date.now(), list = ls.get(MY, []).filter((b) => +new Date(b.ends_at) > now);
  ls.set(MY, list);
  $('myBookings').innerHTML = list.length ? `<h2 class="sec">Ваши записи</h2>` + list.map((b) => `<div class="card" style="margin-bottom:10px;border-color:var(--accent)"><b>${esc(fmtWhen(b.starts_at, OFF))}</b><div class="small muted">${esc(b.service_name)} · бокс ${b.box}</div></div>`).join('') : '';
}

// ---------- Установка на экран ----------
let deferred;
function setupInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || ls.get('boxapp:installDismiss', 0) > Date.now()) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) { $('installHint').textContent = 'Нажмите «Поделиться» → «На экран Домой»'; $('installBtn').textContent = 'Ок'; $('installBox').classList.remove('hide'); $('installBtn').onclick = () => { ls.set('boxapp:installDismiss', Date.now() + 7 * 864e5); $('installBox').classList.add('hide'); }; }
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBox').classList.remove('hide'); });
  $('installBtn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('installBox').classList.add('hide'); });
}

// ---------- Шторки ----------
function openSheet(id) { $('bg').classList.add('on'); $(id).classList.add('on'); document.body.style.overflow = 'hidden'; }
function closeSheets() { document.querySelectorAll('.sheet,.sheet-bg').forEach((e) => e.classList.remove('on')); document.body.style.overflow = ''; }
$('bg').onclick = closeSheets;
document.querySelectorAll('.sheet .close').forEach((b) => b.onclick = closeSheets);

// ---------- Запись: 0 услуга → 1 время → 2 контакты → 3 готово ----------
function openBooking(service, slot, source = 'app') {
  let day = slot ? localParts(slot.start, OFF).day : (st.day || todayStr(OFF));
  for (let i = 0; i < 7 && !slot && isDayOff(B, day); i++) day = addDays(day, 1);   // не открываем календарь на выходном
  Object.assign(st, { service: service || null, slot: slot || null, source, day });
  st.step = slot ? 2 : service ? 1 : 0;
  closeSheets(); openSheet('bookSheet'); renderStep();
}
$('bookBtn').onclick = () => openBooking();
$('backBtn').onclick = () => { if (st.step > 0 && st.step < 3) { st.step--; renderStep(); } else closeSheets(); };

function setSteps(n) { document.querySelectorAll('#bookSheet .steps i').forEach((el, i) => el.classList.toggle('on', i <= n)); }
async function renderStep() {
  const body = $('stepBody'), foot = $('stepFoot'); setSteps(Math.min(st.step, 2));
  $('backBtn').style.visibility = st.step === 0 || st.step === 3 ? 'hidden' : 'visible';
  if (st.step === 0) {
    $('stepTitle').textContent = 'Выберите услугу';
    body.innerHTML = S.map((s, i) => `<button class="svc ${st.service?.id === s.id ? 'sel' : ''}" style="--i:${i}" data-id="${esc(s.id)}">${svcIcon(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="ds">${durTag(s.duration_min)}</div></div><div class="pr">${hasBodies(s) ? 'от ' : ''}${price(minPrice(s))}</div></button>`).join('');
    body.querySelectorAll('.svc').forEach((el) => el.onclick = () => { st.service = S.find((s) => String(s.id) === el.dataset.id); st.step = 1; st.slot = null; renderStep(); });
    foot.innerHTML = `<div class="small muted center">Не знаете, что выбрать? <a href="#" id="toChat" style="color:var(--accent)">Спросите ассистента</a></div>`;
    $('toChat').onclick = (e) => { e.preventDefault(); openChat(); };
  } else if (st.step === 1) {
    $('stepTitle').textContent = st.service.name;
    const t = todayStr(OFF), days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
    const bodies = hasBodies(st.service) ? `<div class="bodies">${BODIES.filter(([k]) => +st.service.prices[k] > 0).map(([k, n]) => `<button class="${k === st.body ? 'sel' : ''}" data-b="${k}"><span>${n}</span><b>${rub(+st.service.prices[k])}</b></button>`).join('')}</div>` : '';
    if (bodies && !(+st.service.prices[st.body] > 0)) st.body = BODIES.find(([k]) => +st.service.prices[k] > 0)[0];
    body.innerHTML = bodies + `<div class="days">${days.map((d) => { const x = dayShort(d), off = isDayOff(B, d); return `<button class="day ${d === st.day ? 'sel' : ''} ${off ? 'off' : ''}" data-d="${d}"><span>${d === t ? 'сег' : x.dow}</span><b>${x.num}</b><span>${off ? 'вых' : x.mon}</span></button>`; }).join('')}</div><div id="slots"><div class="empty">Загружаем свободное время…</div></div>`;
    body.querySelectorAll('.bodies button').forEach((el) => el.onclick = () => {
      st.body = el.dataset.b; ls.set('boxapp:body', st.body);
      body.querySelectorAll('.bodies button').forEach((x) => x.classList.toggle('sel', x === el));
    });
    body.querySelector('.bodies .sel') || body.querySelector(`.bodies [data-b="${st.body}"]`)?.classList.add('sel');
    if (isDayOff(B, st.day)) {
      $('slots').innerHTML = `<div class="empty">В этот день мы не работаем 🙂<br>Выберите другой день</div>`;
      body.querySelectorAll('.day').forEach((el) => el.onclick = () => { st.day = el.dataset.d; st.slot = null; renderStep(); });
      body.querySelector('.day.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      foot.innerHTML = `<button class="btn primary block" disabled>Далее</button>`;
      return;
    }
    body.querySelectorAll('.day').forEach((el) => el.onclick = () => { st.day = el.dataset.d; st.slot = null; renderStep(); });
    body.querySelector('.day.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    foot.innerHTML = `<button class="btn primary block" id="nextBtn" ${st.slot ? '' : 'disabled'}>Далее</button>`;
    $('nextBtn').onclick = () => { st.step = 2; renderStep(); };
    try {
      const busy = await store.getBusy(toUTC(st.day, 0, OFF).toISOString(), toUTC(st.day, 1440, OFF).toISOString());
      const slots = freeSlots(B, st.service, st.day, busy);
      $('slots').innerHTML = slots.length ? `<div class="small muted" style="margin-bottom:8px">${dayLabel(st.day, OFF)} · свободно ${slots.length}</div><div class="times">${slots.map((s) => `<button class="time ${st.slot?.start === s.start ? 'sel' : ''}" data-s="${s.start}" data-m="${s.min}">${minToHM(s.min)}</button>`).join('')}</div>` : `<div class="empty">На этот день мест нет 😔<br>Выберите другой день</div>`;
      $('slots').querySelectorAll('.time').forEach((el) => el.onclick = () => { st.slot = { start: el.dataset.s, min: +el.dataset.m }; $('slots').querySelectorAll('.time').forEach((x) => x.classList.toggle('sel', x === el)); $('nextBtn').disabled = false; });
    } catch (e) { $('slots').innerHTML = `<div class="empty">Не удалось загрузить время. ${esc(e.message)}</div>`; }
  } else if (st.step === 2) {
    $('stepTitle').textContent = 'Ваши контакты';
    const me = ls.get(ME, {});
    // пришли от ассистента сразу сюда — кузов ещё не выбирали
    const pick = hasBodies(st.service) && st.source === 'assistant' ? `<div class="bodies">${BODIES.filter(([k]) => +st.service.prices[k] > 0).map(([k, n]) => `<button class="${k === st.body ? 'sel' : ''}" data-b="${k}"><span>${n}</span><b>${rub(+st.service.prices[k])}</b></button>`).join('')}</div>` : '';
    body.innerHTML = pick + `<div class="summary"><div><span>Услуга</span><b>${esc(st.service.name)}</b></div><div><span>Когда</span><b>${esc(fmtWhen(st.slot.start, OFF))}</b></div><div><span>Время работы</span><b>${durHuman(st.service.duration_min)}</b></div>${hasBodies(st.service) ? `<div><span>Кузов</span><b>${esc(BODIES.find(([k]) => k === st.body)[1])}</b></div>` : ''}<div><span>Стоимость</span><b>${(() => { const p = bodyPrice(st.service, st.body).price; return p ? 'от ' + rub(p) : 'по запросу'; })()}</b></div></div>
      <div class="field"><label>Имя</label><input id="fName" autocomplete="name" value="${esc(me.name || '')}" placeholder="Как к вам обращаться"></div>
      <div class="field"><label>Телефон</label><input id="fPhone" type="tel" autocomplete="tel" inputmode="tel" value="${esc(me.phone || '')}" placeholder="+7 900 000-00-00"></div>
      <div class="field"><label>Автомобиль</label><input id="fCar" value="${esc(me.car || '')}" placeholder="Начните вводить марку"></div>
      <div class="field"><label>Комментарий</label><textarea id="fComment" rows="2" placeholder="Необязательно"></textarea></div><div class="err" id="fErr"></div>`;
    foot.innerHTML = `<button class="btn primary block" id="confirmBtn">Записаться на ${minToHM(localParts(st.slot.start, OFF).min)}</button><div class="small muted center" style="margin-top:8px">Нажимая, вы соглашаетесь на обработку контактных данных для записи</div>`;
    $('fPhone').addEventListener('input', (e) => { let d = e.target.value.replace(/\D/g, ''); if (d.startsWith('8')) d = '7' + d.slice(1); if (d && !d.startsWith('7')) d = '7' + d; d = d.slice(0, 11); const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)]; e.target.value = d ? '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '') : ''; });
    carPicker($('fCar'));
    body.querySelectorAll('.bodies button').forEach((el) => el.onclick = () => {
      const keep = { n: $('fName').value, p: $('fPhone').value, c: $('fCar').value, m: $('fComment').value };
      st.body = el.dataset.b; ls.set('boxapp:body', st.body); renderStep();
      $('fName').value = keep.n; $('fPhone').value = keep.p; $('fCar').value = keep.c; $('fComment').value = keep.m;
    });
    $('confirmBtn').onclick = submit;
  } else {
    $('stepTitle').textContent = '';
    body.innerHTML = `<div class="done"><div class="ok"><svg class="i" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div><h2 style="margin:0 0 6px">Вы записаны!</h2><div class="muted">${esc(st.service.name)}<br><b style="color:var(--text)">${esc(fmtWhen(st.slot.start, OFF))}</b> · бокс ${st.box}</div><p class="small muted" style="margin-top:14px">${esc(B.address || '')}<br>Если планы изменятся — позвоните: ${esc(B.phone)}</p></div>`;
    foot.innerHTML = (st.remindUrl ? `<a class="btn block remind" href="${esc(st.remindUrl)}" target="_blank" rel="noopener"><svg class="i" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>Напомнить в Telegram за 2 часа</a>` : '')
      + `<div class="grid2"><a class="btn" href="${mapHref()}" target="_blank" rel="noopener">Маршрут</a><button class="btn primary" id="okBtn">Готово</button></div>`;
    $('okBtn').onclick = closeSheets;
  }
}

async function submit() {
  const name = $('fName').value.trim(), phone = $('fPhone').value.trim(), car = $('fCar').value.trim(), comment = $('fComment').value.trim();
  if (name.length < 2) return ($('fErr').textContent = 'Укажите имя');
  if (phone.replace(/\D/g, '').length < 11) return ($('fErr').textContent = 'Укажите телефон полностью');
  const btn = $('confirmBtn'); btn.disabled = true; btn.textContent = 'Записываем…';
  try {
    const r = await store.createBooking({ service_id: st.service.id, start: st.slot.start, name, phone, car, comment, source: st.source, body: hasBodies(st.service) ? st.body : '' });
    ls.set(ME, { name, phone, car });
    st.box = r.box; st.remindUrl = r.remind_url || '';
    ls.set(MY, [...ls.get(MY, []), { id: r.id, starts_at: st.slot.start, ends_at: r.ends_at, box: r.box, service_name: st.service.name }]);
    st.step = 3; renderStep(); renderMine();
  } catch (e) {
    $('fErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Попробовать снова';
    if (/заняли/.test(e.message)) setTimeout(() => { st.step = 1; st.slot = null; renderStep(); }, 1400);
  }
}

// ---------- Ассистент ----------
const history = [];
function addMsg(role, text) { const el = document.createElement('div'); el.className = 'msg ' + (role === 'user' ? 'me' : 'bot'); el.textContent = text; $('chat').append(el); el.scrollIntoView({ block: 'end', behavior: 'smooth' }); return el; }
function openChat() {
  closeSheets(); openSheet('chatSheet');
  if (!history.length) {
    const hi = `Здравствуйте! Я помогу записаться в «${B.name}». Напишите, что нужно и когда удобно — например: «мойка завтра после 6».`;
    history.push({ role: 'assistant', content: hi }); addMsg('assistant', hi);
    chips(['Мойку завтра вечером', 'Сколько стоит химчистка?', 'Ближайшее свободное время']);
  }
  setTimeout(() => $('chatInput').focus(), 300);
}
function chips(list) {
  const el = document.createElement('div'); el.className = 'chips';
  list.forEach((t) => { const c = document.createElement('button'); c.className = 'chip'; c.textContent = t; c.onclick = () => { el.remove(); send(t); }; el.append(c); });
  $('chat').append(el);
}
$('chatBtn').onclick = openChat;
$('chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('chatInput').value.trim(); if (t) { $('chatInput').value = ''; send(t); } };
async function send(text) {
  document.querySelectorAll('#chat .chips').forEach((c) => c.remove());
  history.push({ role: 'user', content: text }); addMsg('user', text);
  const typing = addMsg('assistant', 'печатает…'); typing.classList.add('typing');
  let r; try { r = await askAssistant(history, { business: B, services: S }); } catch { r = { reply: 'Не получилось ответить. Попробуйте записаться через кнопку «Записаться онлайн».' }; }
  typing.remove(); history.push({ role: 'assistant', content: r.reply }); addMsg('assistant', r.reply);
  if (r.suggestion) {
    const s = S.find((x) => String(x.id) === String(r.suggestion.service_id));
    if (s) {
      const card = document.createElement('div'); card.className = 'sugg';
      card.innerHTML = `<div><b>${esc(s.name)}</b><div class="small muted">${esc(fmtWhen(r.suggestion.start, OFF))} · ${price(s.price)}</div></div><button class="btn primary">Записаться</button>`;
      card.querySelector('button').onclick = () => openBooking(s, { start: r.suggestion.start }, 'assistant');
      $('chat').append(card); card.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }
  if (r.chips) chips(r.chips);
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
init().catch((e) => { document.body.classList.add('ready'); document.body.insertAdjacentHTML('afterbegin', `<div class="demo-bar" style="color:#fca5a5">Ошибка загрузки: ${esc(e.message)}</div>`); });
