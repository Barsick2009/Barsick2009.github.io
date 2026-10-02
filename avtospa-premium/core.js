// core.js — общий слой данных и расчёт слотов (клиент + кабинет)
import { svcInfo } from './svcinfo.js';
export const CFG = window.APP_CONFIG || {};
export const HAS_DB = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

// ---------- время в часовом поясе бизнеса (offset в минутах, в РФ нет перехода на летнее) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const hm = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
export const minToHM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export function localNow(off) { return new Date(Date.now() + off * 60000); }          // UTC-геттеры = местное время бизнеса
export function todayStr(off) { const d = localNow(off); return d.toISOString().slice(0, 10); }
export function addDays(dayStr, n) { const d = new Date(dayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function toUTC(dayStr, minutes, off) { const [y, mo, d] = dayStr.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d, 0, minutes) - off * 60000); }
export function localParts(date, off) { const d = new Date(new Date(date).getTime() + off * 60000); return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() }; }
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function dayLabel(dayStr, off) {
  const t = todayStr(off); if (dayStr === t) return 'Сегодня'; if (dayStr === addDays(t, 1)) return 'Завтра';
  const d = new Date(dayStr + 'T00:00:00Z'); return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function dayShort(dayStr) { const d = new Date(dayStr + 'T00:00:00Z'); return { dow: DOW[d.getUTCDay()], num: d.getUTCDate(), mon: MON[d.getUTCMonth()] }; }
export function fmtWhen(iso, off) { const p = localParts(iso, off); return `${dayLabel(p.day, off)}, ${minToHM(p.min)}`; }
export const rub = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const plural = (n, one, few, many) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many; };
// «40 минут», «1 час», «1,5 часа», «2 ч 20 мин» — для клиента, чтобы было ясно, что это время работы
export function durHuman(m) {
  if (m < 60) return `${m} ${plural(m, 'минута', 'минуты', 'минут')}`;
  if (m % 60 === 0) { const h = m / 60; return `${h} ${plural(h, 'час', 'часа', 'часов')}`; }
  if (m % 30 === 0) return `${String(m / 60).replace('.', ',')} часа`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}
const CLOCK = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
export const durTag = (m) => `<span class="dur" title="Сколько длится работа">${CLOCK}${durHuman(m)} работы</span>`;
export const durLabel =(m) => m < 60 ? `${m} мин` : (m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

// Цена по типу кузова: service.prices = {sedan, crossover, suv}; без них — одна цена
export const BODIES = [['sedan', 'Седан'], ['crossover', 'Кроссовер'], ['suv', 'Внедорожник']];
export const hasBodies = (s) => !!(s && s.prices && BODIES.some(([k]) => +s.prices[k] > 0));
export function bodyPrice(s, body) {
  if (hasBodies(s) && +s.prices[body] > 0) return { price: +s.prices[body], label: BODIES.find(([k]) => k === body)[1].toLowerCase() };
  return { price: s.price, label: '' };
}
export const minPrice = (s) => hasBodies(s) ? Math.min(...BODIES.map(([k]) => +s.prices[k] || Infinity)) : s.price;

// Выходные: days_off — дни недели по ISO (1 = пн … 7 = вс)
export const DOW_FULL = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const isoDow = (dayStr) => new Date(dayStr + 'T00:00:00Z').getUTCDay() || 7;
export const isDayOff = (biz, dayStr) => (biz.days_off || []).includes(isoDow(dayStr));
export function workDaysLabel(biz) {
  const off = (biz.days_off || []).slice().sort();
  return off.length ? 'Выходной: ' + off.map((d) => DOW_FULL[d - 1].toLowerCase()).join(', ') : 'Ежедневно';
}

// Свободные слоты на день: старт подходит, если хотя бы один бокс свободен на всю длительность
export function freeSlots(biz, service, dayStr, busy) {
  if (isDayOff(biz, dayStr)) return [];
  const off = biz.utc_offset ?? 180, open = hm(biz.open_time), close = hm(biz.close_time), step = biz.slot_step || 30;
  const dur = service.duration_min, minStart = Date.now() + 20 * 60000, res = [];
  for (let m = open; m + dur <= close; m += step) {
    const s = toUTC(dayStr, m, off).getTime(), e = s + dur * 60000;
    if (s < minStart) continue;
    let ok = false;
    for (let box = 1; box <= biz.boxes && !ok; box++) {
      ok = !busy.some((b) => b.box === box && new Date(b.starts_at).getTime() < e && new Date(b.ends_at).getTime() > s);
    }
    if (ok) res.push({ min: m, start: new Date(s).toISOString() });
  }
  return res;
}

// ---------- Мессенджеры студии: из ссылки, @ника или номера делаем ссылку ----------
const digits = (v) => String(v).replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7');
const http = (v) => /^https?:\/\//.test(v);
const nick = (v) => String(v).replace(/^@/, '');
const PIN = '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>';
// kind: chat — кнопка под «Записаться» + карточка; social/map/site — карточка в «Контактах»
const MSGR = [
  { k: 'whatsapp', name: 'WhatsApp', color: '#25D366', kind: 'chat', ph: '+7 900 000-00-00', mk: (v) => http(v) ? v : 'https://wa.me/' + digits(v),
    svg: '<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .9-.6 1.7-1.6 1.8-.6.1-1.4 0-2.9-.6-2-.9-3.5-3-3.7-3.3-.4-.6-.9-1.6-.6-2.7z" fill="currentColor" stroke="none"/>' },
  { k: 'telegram', name: 'Telegram', color: '#2AABEE', kind: 'chat', ph: '@ник или ссылка', mk: (v) => http(v) ? v : /^\+?\d[\d\s()-]{8,}$/.test(v) ? 'https://t.me/+' + digits(v) : 'https://t.me/' + nick(v),
    svg: '<path d="M21.5 4.5 2.8 11.7c-.8.3-.8 1.5.1 1.7l4.6 1.4 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6l3.2-14.8c.2-.9-.6-1.6-1.4-1.2z"/><path d="m7.5 14.8 9.5-6.3-6.9 7.4"/>' },
  { k: 'max', name: 'MAX', color: '#7B5CFF', kind: 'chat', ph: 'ссылка на профиль в MAX', mk: (v) => http(v) ? v : 'https://max.ru/' + nick(v),
    svg: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M8.5 15V9.5l3.5 3.5 3.5-3.5V15"/>' },
  { k: 'viber', name: 'Viber', color: '#7360F2', kind: 'chat', ph: '+7 900 000-00-00', mk: (v) => http(v) || /^viber:/.test(v) ? v : 'viber://chat?number=%2B' + digits(v),
    svg: '<path d="M12 3c5 0 8 2.5 8 7.5S17 18 12 18l-3 3v-3.3C5.5 17 4 14.5 4 10.5 4 5.5 7 3 12 3z"/><path d="M9.5 8.2c.3-.4.8-.4 1 0l.6 1c.1.3 0 .5-.2.7l-.3.3c.4.9 1.1 1.6 2 2l.3-.3c.2-.2.5-.3.7-.2l1 .6c.4.2.4.7 0 1-.6.6-1.5.8-2.3.4a7 7 0 0 1-3.2-3.2c-.4-.8-.2-1.7.4-2.3z" fill="currentColor" stroke="none"/>' },
  { k: 'vk', name: 'ВКонтакте', color: '#0077FF', kind: 'social', sub: 'Наша группа', ph: 'vk.com/…', mk: (v) => http(v) ? v : 'https://vk.com/' + nick(v).replace(/^vk\.com\//, ''),
    svg: '<path d="M3 7h3.2c.3 2.9 1.9 5.4 3.3 5.8V7h3v3.8c1.5-.2 3-1.9 3.6-3.8H19c-.5 2.5-2.3 4.4-3.6 5.2 1.3.6 3.4 2.2 4.2 4.8h-3.4c-.7-1.9-2.3-3.4-3.7-3.6V17h-.4C6.5 17 3.4 13.4 3 7z" fill="currentColor" stroke="none"/>' },
  { k: 'ok', name: 'Одноклассники', color: '#EE8208', kind: 'social', sub: 'Наша группа', ph: 'ok.ru/…', mk: (v) => http(v) ? v : 'https://ok.ru/' + nick(v).replace(/^ok\.ru\//, ''),
    svg: '<circle cx="12" cy="7.5" r="3.5"/><path d="M7.5 12.5c2.7 1.8 6.3 1.8 9 0M12 15v0M8.5 20.5 12 16l3.5 4.5"/>' },
  { k: 'youtube', name: 'YouTube', color: '#FF3D3D', kind: 'social', sub: 'Наш канал', ph: 'ссылка на канал', mk: (v) => http(v) ? v : 'https://youtube.com/@' + nick(v),
    svg: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>' },
  { k: 'rutube', name: 'Rutube', color: '#3D7BFF', kind: 'social', sub: 'Наш канал', ph: 'ссылка на канал', mk: (v) => http(v) ? v : 'https://rutube.ru/channel/' + nick(v),
    svg: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>' },
  { k: 'avito', name: 'Авито', color: '#00AAFF', kind: 'social', sub: 'Наш профиль', ph: 'ссылка на профиль', mk: (v) => http(v) ? v : 'https://www.avito.ru/' + nick(v),
    svg: '<circle cx="8" cy="8" r="3.3" fill="currentColor" stroke="none"/><circle cx="16.5" cy="8.5" r="2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="16.5" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="3.6" fill="currentColor" stroke="none"/>' },
  { k: 'gis', name: '2ГИС', color: '#19AA1E', kind: 'map', sub: 'Отзывы и маршрут', ph: 'ссылка на карточку в 2ГИС', mk: (v) => http(v) ? v : 'https://2gis.ru/search/' + encodeURIComponent(v), svg: PIN },
  { k: 'yandex', name: 'Яндекс Карты', color: '#FC3F1D', kind: 'map', sub: 'Отзывы и маршрут', ph: 'ссылка на карточку в Яндекс Картах', mk: (v) => http(v) ? v : 'https://yandex.ru/maps/?text=' + encodeURIComponent(v), svg: PIN },
];
// [{key, name, color, kind, sub, href, svg}] — только заполненные
export const messengers = (biz) => MSGR.filter((m) => String(biz?.socials?.[m.k] || '').trim())
  .map((m) => ({ key: m.k, name: m.name, color: m.color, kind: m.kind, sub: m.sub || 'Написать нам', href: m.mk(String(biz.socials[m.k]).trim()), svg: `<svg class="i" viewBox="0 0 24 24">${m.svg}</svg>` }));
export const MSGR_FIELDS = MSGR.map((m) => ({ key: m.k, name: m.name, kind: m.kind, ph: m.ph }));

// ---------- Логотип студии: картинка из настроек или инициалы ----------
export function paintLogo(el, biz, fallback) {
  const src = biz?.logo || CFG.business?.logo, bg = biz?.logo_bg || CFG.business?.logo_bg;
  if (!src) { el.textContent = fallback; return; }
  el.textContent = ''; el.classList.add('img'); if (bg) el.style.background = bg;
  const im = new Image(); im.alt = biz?.name || ''; im.src = src;
  im.onload = () => el.classList.toggle('wide', im.naturalWidth / Math.max(1, im.naturalHeight) > 1.35);
  im.onerror = () => { el.classList.remove('img', 'wide'); el.style.background = ''; el.textContent = fallback; };
  el.append(im);
}

// ---------- безопасный localStorage ----------
export const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- Supabase-хранилище ----------
let _sb;
async function sb() {
  if (!_sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    _sb = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { storageKey: 'boxapp-' + CFG.slug } });
  }
  return _sb;
}
const ERR = {
  slot_taken: 'Это время только что заняли. Выберите другое.', outside_hours: 'Время вне часов работы.',
  in_past: 'Это время уже прошло.', bad_contacts: 'Проверьте имя и телефон.', too_many: 'На этот номер уже есть 3 активные записи.',
  service_not_found: 'Услуга недоступна.', business_not_found: 'Сервис не найден.', day_off: 'В этот день сервис не работает.',
  rate_limited: 'Слишком много записей подряд. Попробуйте позже или позвоните нам.', too_far: 'Запись открыта только на 60 дней вперёд.',
  tg_not_configured: 'Бот для уведомлений ещё не настроен.', not_owner: 'Нет доступа.',
};
const humanErr = (e) => { const m = e?.message || String(e); for (const k in ERR) if (m.includes(k)) return new Error(ERR[k]); return new Error(m); };

// Мгновенный первый показ: данные с прошлого визита или встроенные в приложение; свежие из БД подтянутся следом
const CACHE = () => `boxapp:${CFG.slug}:cache`;
export function quickBusiness() {
  const c = HAS_DB ? ls.get(CACHE(), null) : null;
  if (c && c.business && c.services) return c;
  return { business: normBiz({ utc_offset: 180, open_time: '09:00', close_time: '21:00', boxes: 2, slot_step: 30, accent: '#3b82f6', ...CFG.business }), services: (CFG.services || []).filter((s) => s.active !== false) };
}

const SupaStore = {
  mode: 'db',
  async loadBusiness() {
    const c = await sb();
    const { data: b, error } = await c.from('businesses').select('*').eq('slug', CFG.slug).maybeSingle();
    if (error || !b) return DemoStore.loadBusiness(); // ещё не залит seed — показываем встроенные данные
    const { data: s } = await c.from('services').select('*').eq('business_id', b.id).eq('active', true).order('sort');
    const res = { business: normBiz(b), services: s || [] };
    ls.set(CACHE(), res);
    return res;
  },
  async getBusy(from, to) {
    const c = await sb(); const { data, error } = await c.rpc('get_busy', { p_slug: CFG.slug, p_from: from, p_to: to });
    if (error) throw humanErr(error); return data || [];
  },
  async createBooking(p) {
    const c = await sb();
    const { data, error } = await c.rpc('create_booking', { p_slug: CFG.slug, p_service_id: p.service_id, p_start: p.start, p_name: p.name, p_phone: p.phone, p_car: p.car || '', p_comment: p.comment || '', p_source: p.source || 'app', p_body: p.body || '' });
    if (error) throw humanErr(error); return data;
  },
  // --- кабинет ---
  async session() { const c = await sb(); const { data } = await c.auth.getSession(); return data.session; },
  async signIn(email, password) { const c = await sb(); const { error } = await c.auth.signInWithPassword({ email, password }); if (error) throw new Error('Неверный email или пароль'); },
  async signOut() { const c = await sb(); await c.auth.signOut(); },
  async myBusiness() {
    const c = await sb(); const { data: { user } } = await c.auth.getUser();
    const { data: b } = await c.from('businesses').select('*').eq('slug', CFG.slug).eq('owner_id', user.id).maybeSingle();
    if (!b) throw new Error('Этот аккаунт не привязан к сервису «' + (CFG.business?.name || CFG.slug) + '»');
    const { data: s } = await c.from('services').select('*').eq('business_id', b.id).order('sort');
    return { business: normBiz(b), services: s || [] };
  },
  async listBookings(bizId, from, to) {
    const c = await sb(); const { data, error } = await c.from('bookings').select('*').eq('business_id', bizId).lt('starts_at', to).gt('ends_at', from).order('starts_at');
    if (error) throw humanErr(error); return data;
  },
  async addBookingOwner(bizId, p) {
    const c = await sb(); const { error } = await c.from('bookings').insert({ ...p, business_id: bizId, source: 'owner', status: 'confirmed' });
    if (error) throw (error.code === '23P01' ? new Error('Бокс в это время занят') : humanErr(error));
  },
  async updateBooking(id, patch) { const c = await sb(); const { error } = await c.from('bookings').update(patch).eq('id', id); if (error) throw (error.code === '23P01' ? new Error('Бокс в это время занят') : humanErr(error)); },
  async saveBusiness(id, patch) { const c = await sb(); const { error } = await c.from('businesses').update(patch).eq('id', id); if (error) throw humanErr(error); },
  async saveService(bizId, s) {
    const c = await sb(); const row = { business_id: bizId, name: s.name, description: s.description || '', price: +s.price || 0, prices: s.prices || null, duration_min: +s.duration_min || 60, sort: +s.sort || 0, active: s.active !== false };
    const q = s.id && !String(s.id).startsWith('new') ? c.from('services').update(row).eq('id', s.id).select().single() : c.from('services').insert(row).select().single();
    const { data, error } = await q; if (error) throw humanErr(error); return data;
  },
  async deleteService(id) { const c = await sb(); const { error } = await c.from('services').update({ active: false }).eq('id', id); if (error) throw humanErr(error); },
  async uploadPhoto(bizId, file) {
    const c = await sb(); const path = `${bizId}/${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`;
    const { error } = await c.storage.from('photos').upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw humanErr(error); return c.storage.from('photos').getPublicUrl(path).data.publicUrl;
  },
  async tgStatus(bizId) { const c = await sb(); const { data, error } = await c.rpc('tg_status', { p_business: bizId }); if (error) throw humanErr(error); return data; },
  async tgLink(bizId) { const c = await sb(); const { data, error } = await c.rpc('tg_link', { p_business: bizId }); if (error) throw humanErr(error); return data.url; },
  async tgUnlink(bizId) { const c = await sb(); const { error } = await c.rpc('tg_unlink', { p_business: bizId }); if (error) throw humanErr(error); },
};

function normBiz(b) { return { ...b, open_time: String(b.open_time).slice(0, 5), close_time: String(b.close_time).slice(0, 5), photos: b.photos || [], socials: b.socials || {}, days_off: b.days_off || [], reviews: b.reviews || [], before_after: b.before_after || [], rating: b.rating || null }; }

// ---------- Демо-хранилище (без БД: всё в браузере) ----------
const DK = (k) => `boxapp:${CFG.slug}:${k}`;
const DemoStore = {
  mode: 'demo',
  async loadBusiness() {
    const b = { id: 'demo', slug: CFG.slug, utc_offset: 180, open_time: '09:00', close_time: '21:00', boxes: 2, slot_step: 30, accent: '#3b82f6', photos: [], socials: {}, ai_enabled: true, ...CFG.business, ...ls.get(DK('biz'), {}) };
    const services = ls.get(DK('services'), null) || (CFG.services || []);
    return { business: normBiz(b), services: services.filter((s) => s.active !== false) };
  },
  _bookings() {
    let list = ls.get(DK('bookings'), null);
    if (!list) { // пара примеров, чтобы кабинет не был пустым
      const b = { utc_offset: 180, ...CFG.business }, off = b.utc_offset, t = todayStr(off), s = CFG.services || [];
      list = s.length ? [
        { id: 'd1', service_id: s[0].id, service_name: s[0].name, price: s[0].price, box: 1, starts_at: toUTC(addDays(t, 1), 11 * 60, off).toISOString(), ends_at: toUTC(addDays(t, 1), 11 * 60 + s[0].duration_min, off).toISOString(), client_name: 'Алексей (пример)', client_phone: '+7 900 000-00-01', car: 'Kia Rio, белый', comment: '', source: 'app', status: 'new', created_at: new Date().toISOString() },
        { id: 'd2', service_id: s[s.length - 1].id, service_name: s[s.length - 1].name, price: s[s.length - 1].price, box: 2, starts_at: toUTC(addDays(t, 1), 14 * 60, off).toISOString(), ends_at: toUTC(addDays(t, 1), 14 * 60 + s[s.length - 1].duration_min, off).toISOString(), client_name: 'Марина (пример)', client_phone: '+7 900 000-00-02', car: 'Toyota Camry', comment: 'Записалась через ассистента', source: 'assistant', status: 'confirmed', created_at: new Date().toISOString() },
      ] : [];
      ls.set(DK('bookings'), list);
    }
    return list;
  },
  async getBusy(from, to) {
    const f = +new Date(from), t = +new Date(to);
    return this._bookings().filter((b) => b.status !== 'cancelled' && +new Date(b.starts_at) < t && +new Date(b.ends_at) > f).map(({ box, starts_at, ends_at }) => ({ box, starts_at, ends_at }));
  },
  async createBooking(p) {
    const { business: biz, services } = await this.loadBusiness(); const s = services.find((x) => x.id === p.service_id);
    if (!s) throw new Error(ERR.service_not_found);
    if ((p.name || '').trim().length < 2 || (p.phone || '').replace(/\D/g, '').length < 10) throw new Error(ERR.bad_contacts);
    const st = +new Date(p.start), en = st + s.duration_min * 60000, list = this._bookings();
    for (let box = 1; box <= biz.boxes; box++) {
      if (!list.some((b) => b.status !== 'cancelled' && b.box === box && +new Date(b.starts_at) < en && +new Date(b.ends_at) > st)) {
        const bp = bodyPrice(s, p.body);
        const row = { id: 'b' + Date.now(), service_id: s.id, service_name: s.name + (bp.label ? ' · ' + bp.label : ''), price: bp.price, box, starts_at: new Date(st).toISOString(), ends_at: new Date(en).toISOString(), client_name: p.name, client_phone: p.phone, car: p.car || '', comment: p.comment || '', source: p.source || 'app', status: 'new', created_at: new Date().toISOString() };
        list.push(row); ls.set(DK('bookings'), list); return row;
      }
    }
    throw new Error(ERR.slot_taken);
  },
  async session() { return ls.get(DK('session'), null); },
  async signIn() { ls.set(DK('session'), { demo: true }); },
  async signOut() { ls.set(DK('session'), null); },
  async myBusiness() { const { business } = await this.loadBusiness(); return { business, services: ls.get(DK('services'), null) || (CFG.services || []) }; },
  async listBookings(_id, from, to) { const f = +new Date(from), t = +new Date(to); return this._bookings().filter((b) => +new Date(b.starts_at) < t && +new Date(b.ends_at) > f).sort((a, b) => a.starts_at.localeCompare(b.starts_at)); },
  async addBookingOwner(_id, p) {
    const list = this._bookings(), st = +new Date(p.starts_at), en = +new Date(p.ends_at);
    if (list.some((b) => b.status !== 'cancelled' && b.box === p.box && +new Date(b.starts_at) < en && +new Date(b.ends_at) > st)) throw new Error('Бокс в это время занят');
    list.push({ ...p, id: 'b' + Date.now(), source: 'owner', status: 'confirmed', created_at: new Date().toISOString() }); ls.set(DK('bookings'), list);
  },
  async updateBooking(id, patch) { const list = this._bookings(); const i = list.findIndex((b) => b.id === id); if (i >= 0) Object.assign(list[i], patch); ls.set(DK('bookings'), list); },
  async saveBusiness(_id, patch) { ls.set(DK('biz'), { ...ls.get(DK('biz'), {}), ...patch }); },
  async saveService(_id, s) {
    const list = ls.get(DK('services'), null) || [...(CFG.services || [])];
    const row = { ...s, price: +s.price || 0, duration_min: +s.duration_min || 60 };
    if (!row.id || String(row.id).startsWith('new')) row.id = 's' + Date.now();
    const i = list.findIndex((x) => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row);
    ls.set(DK('services'), list); return row;
  },
  async deleteService(id) { const list = (ls.get(DK('services'), null) || [...(CFG.services || [])]).map((s) => s.id === id ? { ...s, active: false } : s); ls.set(DK('services'), list); },
  async uploadPhoto(_id, file) { return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); },
};

export const store = HAS_DB ? SupaStore : DemoStore;

// ---------- AI-ассистент ----------
// В режиме БД — Edge Function (ключ нейронки хранится на сервере). Если она недоступна — локальный разбор фразы.
export async function askAssistant(messages, ctx) {
  const url = CFG.assistantUrl || (HAS_DB ? `${CFG.supabaseUrl}/functions/v1/assistant` : '');
  if (url && ctx.business.ai_enabled !== false) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(CFG.supabaseAnonKey ? { Authorization: 'Bearer ' + CFG.supabaseAnonKey, apikey: CFG.supabaseAnonKey } : {}) }, body: JSON.stringify({ slug: CFG.slug, messages: messages.slice(-12) }) });
      if (r.ok) { const j = await r.json(); if (j.reply) return j; }
    } catch {}
  }
  return ruleAssistant(messages[messages.length - 1].content, ctx, messages);
}

const SYN = [
  [/химчист|салон|сидень|чехл/i, /химчист|салон/i], [/полир/i, /полир/i], [/керамик|защит|покрыт/i, /керами|защит/i],
  [/воск|комплекс|полн/i, /комплекс|воск/i], [/двигат|мотор/i, /двигат|мотор/i], [/кузов|помыть|мойк|грязн|помой/i, /мойк|кузов|экспресс/i],
  [/дитейл|детейл|под ключ/i, /дитейл|детейл|комплекс/i], [/шин|колес/i, /шин|колес/i], [/тонир|затемн/i, /тонир/i], [/дожд/i, /дожд/i],
];
// Ищем услугу по совпадению основ слов: «полировку кузова» → «Полировка кузова», а не «Полировка фар».
const words = (s) => s.toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z]{3,}/g) || [];
const stem = (w) => w.slice(0, Math.max(3, Math.min(6, w.length - 2)));
function matchServices(t, services) {
  const tw = words(t); let top = 0, best = [];
  for (const s of services) {
    const sw = words(s.name).filter((w) => !['для', 'или', 'под'].includes(w)); if (!sw.length) continue;
    const hit = sw.filter((w) => tw.some((x) => x.startsWith(stem(w)))).length, sc = hit / sw.length;
    if (!hit) continue;
    if (sc > top) { top = sc; best = [s]; } else if (sc === top) best.push(s);
  }
  return { top, best };
}
export function parseRequest(text, ctx) {
  const t = text.toLowerCase(), off = ctx.business.utc_offset ?? 180, today = todayStr(off);
  let service = ctx.services.find((s) => t.includes(s.name.toLowerCase())), options = null;
  if (!service) {
    const m = matchServices(t, ctx.services);
    if (m.best.length === 1) service = m.best[0];
    else if (m.best.length > 1 && m.top === 1) service = m.best.sort((a, b) => words(b.name).length - words(a.name).length)[0];
    else if (m.best.length > 1) options = m.best.slice(0, 4);
  }
  if (!service && !options) for (const [re, sre] of SYN) if (re.test(t)) { service = ctx.services.find((s) => sre.test(s.name)); if (service) break; }
  let day = null;
  if (/послезавтра/.test(t)) day = addDays(today, 2); else if (/завтра/.test(t)) day = addDays(today, 1); else if (/сегодня|сейчас|побыстрее|скорее/.test(t)) day = today;
  const wd = [/воскрес/, /понедел/, /вторник/, /сред[ау]/, /четверг/, /пятниц/, /суббот/];
  wd.forEach((re, i) => { if (!day && re.test(t)) { const cur = localNow(off).getUTCDay(); day = addDays(today, ((i - cur + 7) % 7) || 7); } });
  if (!day && /выходн/.test(t)) { const cur = localNow(off).getUTCDay(); day = cur === 6 || cur === 0 ? today : addDays(today, 6 - cur); }
  const dm = t.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?![\d:])/); if (!day && dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[1] >= 1 && +dm[1] <= 31 && !/(?:^|\s)(?:в|после|с|к|до|около)\s*$/.test(t.slice(0, dm.index + 1))) { const y = today.slice(0, 4); day = `${y}-${pad(dm[2])}-${pad(dm[1])}`; if (day < today) day = `${+y + 1}-${pad(dm[2])}-${pad(dm[1])}`; }
  // время: «на 15:00», «в 15», «к 3 часам», «15:30», «после 6», «до 12»
  const openH = Math.floor(hm(ctx.business.open_time) / 60), closeH = Math.ceil(hm(ctx.business.close_time) / 60);
  const toMin = (h, mm) => { h = +h; if (h < openH && h + 12 <= closeH && !/утр/.test(t)) h += 12; return h * 60 + (+mm || 0); };
  let after = null, before = null, target = null;
  const aft = t.match(/(?:^|\s)(?:после|позже)\s*(\d{1,2})(?:[:.](\d{2}))?/);
  const bef = t.match(/(?:^|\s)(?:до|не позже)\s*(\d{1,2})(?:[:.](\d{2}))?(?!\s*(?:числа|[./]\d))/);
  const at = t.match(/(?:^|\s)(?:на|в|во|к|около|часов в)\s*(\d{1,2})(?:[:.](\d{2}))?(?!\d|[./]\d|\s*(?:числа|октяб|ноябр|декаб|январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентяб))/)
    || t.match(/(?:^|\s)(\d{1,2}):(\d{2})/);
  if (aft) after = toMin(aft[1], aft[2]);
  if (bef) before = toMin(bef[1], bef[2]);
  if (at && !aft && !bef && +at[1] <= 23) target = toMin(at[1], at[2]);
  if (after == null && before == null && target == null) { if (/утр/.test(t)) before = 12 * 60; else if (/днём|днем|обед/.test(t)) { after = 12 * 60; before = 17 * 60; } else if (/вечер/.test(t)) after = 17 * 60; }
  return { service, options, day, after, before, target };
}

const priceText = (s) => hasBodies(s)
  ? BODIES.filter(([k]) => +s.prices[k] > 0).map(([k, n]) => `${n.toLowerCase()} — ${rub(+s.prices[k])}`).join(', ')
  : s.price ? `от ${rub(s.price)}` : 'цена по запросу';
// подпись кнопки-подсказки, которую ассистент сам же потом разберёт: «Завтра в 16:00», «05.10 в 11:30»
const chipDay = (d, off) => { const t = todayStr(off); return d === t ? 'Сегодня' : d === addDays(t, 1) ? 'Завтра' : `${d.slice(8, 10)}.${d.slice(5, 7)}`; };
const svcLine = (s) => `• ${s.name} — ${priceText(s)}, ${durHuman(s.duration_min)}`;

async function ruleAssistant(text, ctx, messages = []) {
  const B = ctx.business, q = parseRequest(text, ctx), off = B.utc_offset ?? 180, t = text.toLowerCase();
  const today = todayStr(off), nowMin = localParts(new Date(), off).min;
  // услуга и день могли прозвучать раньше в диалоге: «полировку кузова» → «а на 16:00?»
  const prev = [...messages].reverse().filter((m) => m.role === 'user' && m.content !== text).map((m) => parseRequest(m.content, ctx));
  if (!q.service && !q.options) q.service = prev.find((p) => p.service)?.service;
  if (!q.day && (q.target != null || q.after != null || q.before != null)) q.day = prev.find((p) => p.day)?.day || null;
  // ответ на уточнение («Комплексная мойка») — берём день и время из прошлой фразы
  const last = prev[0], noWhen = (p) => p.day == null && p.target == null && p.after == null && p.before == null;
  if (q.service && noWhen(q)) for (const p of prev) { if (p.service) break; if (!noWhen(p)) { ({ day: q.day, target: q.target, after: q.after, before: q.before } = p); break; } }
  // просто «мойка» — берём самую простую (дешёвую), остальные предлагаем кнопками
  let alt = null;
  if (q.options && q.options.every((s) => /мойк/i.test(s.name)) && !/детейл|комплекс|экспресс/.test(t)) {
    const sorted = [...q.options].sort((a, b) => minPrice(a) - minPrice(b)); q.service = sorted[0]; alt = sorted.slice(1); q.options = null;
  }

  if (/^(привет|здравств|добрый|хай|hello)/.test(t)) return { reply: `Здравствуйте! Помогу записаться в «${B.name}». Что нужно сделать с машиной и когда удобно?`, chips: ctx.services.slice(0, 3).map((s) => s.name) };
  if (/спасиб|благодар/.test(t)) return { reply: 'Пожалуйста! Ждём вас 🙂' };
  if (/отмен|перенес|перенос/.test(t)) return { reply: `Чтобы отменить или перенести запись, позвоните нам: ${B.phone}. Так мы точно освободим время для других.` };
  if (/адрес|где вы|как доех|находит|куда ехать/.test(t)) return { reply: `Мы находимся: ${[B.city, B.address].filter(Boolean).join(', ')}. Телефон: ${B.phone}.` };
  if (/до скольки|режим|часы работ|работаете|во сколько открыва|выходн(ой|ые) у вас/.test(t)) return { reply: `${workDaysLabel(B)}, с ${B.open_time} до ${B.close_time}.` };
  if (!q.service && !q.options && last?.options) q.options = last.options;   // ещё не выбрали из предложенных
  if (q.options) return { reply: 'Уточните, пожалуйста, какая именно услуга:', chips: q.options.map((s) => s.name) };

  const asksPrice = /цен|сколько стоит|стоимост|прайс|почём|почем/.test(t), asksWhat = /что входит|что делает|что включ|из чего|расскаж|зачем|что даст|чем полез|что такое/.test(t);
  const asksTime = /сколько (по )?времен|как долго|сколько длит|сколько ждать/.test(t);
  if (!q.service && (asksPrice || /услуг|что вы делает/.test(t))) return { reply: 'Наши услуги:\n' + ctx.services.map(svcLine).join('\n') + '\n\nНапишите, что и когда удобно — подберу время.' };
  if (!q.service) return { reply: 'Подскажите, какая услуга нужна?', chips: ctx.services.slice(0, 5).map((s) => s.name) };
  const S = q.service;
  if (asksWhat) {
    const inf = svcInfo(S.name);
    return { reply: `${S.name}:\n${inf.inc.map((x) => '✓ ' + x).join('\n')}\n\n${inf.plus.map((x) => '+ ' + x).join('\n')}\n\n${priceText(S)}, ${durHuman(S.duration_min)} работы. Подобрать время?`, chips: ['Завтра', 'В выходные', 'Ближайшее свободное'] };
  }
  if ((asksPrice || asksTime) && !q.day && q.target == null) return { reply: `${S.name}: ${priceText(S)}, по времени — ${durHuman(S.duration_min)}.${S.description ? ' ' + S.description + '.' : ''} Подобрать удобное время?`, chips: ['Завтра', 'В выходные', 'Ближайшее свободное'] };

  const open = hm(B.open_time), close = hm(B.close_time), lastStart = close - S.duration_min;
  const head = `${S.name} (${priceText(S)}, ${durHuman(S.duration_min)})`;
  const altNote = alt?.length ? `\nЕсли нужна ${alt.map((s) => s.name.toLowerCase()).join(' или ')} — напишите.` : '';
  const offer = (d, s, pre = '') => ({ reply: `${pre}${head} — ${dayLabel(d, off).toLowerCase()} в ${minToHM(s.min)}. Записать вас?${altNote}`, suggestion: { service_id: S.id, start: s.start } });
  const slotsOn = async (d) => freeSlots(B, S, d, await store.getBusy(toUTC(d, 0, off).toISOString(), toUTC(d, 1440, off).toISOString()));
  if (lastStart < open) return { reply: `${S.name} длится ${durHuman(S.duration_min)} — больше рабочего дня. Позвоните, договоримся: ${B.phone}.` };

  // конкретное время: «на 15:00»
  if (q.target != null) {
    let d = q.day || (q.target > nowMin + 20 ? today : addDays(today, 1)), pre = '';
    if (q.target < open || q.target > lastStart) {
      pre = q.target > lastStart && q.target < close
        ? `${S.name} длится ${durHuman(S.duration_min)}, а мы работаем до ${B.close_time} — начать можно не позже ${minToHM(lastStart)}. `
        : `Мы работаем с ${B.open_time} до ${B.close_time}. `;
    }
    for (let i = 0; i < 14; i++, d = addDays(d, 1)) {
      if (isDayOff(B, d)) { if (i === 0 && q.day) pre += `${dayLabel(d, off)} у нас выходной. `; continue; }
      const sl = await slotsOn(d); if (!sl.length) { if (i === 0 && q.day) pre += `На ${dayLabel(d, off).toLowerCase()} свободных окон нет. `; continue; }
      const exact = sl.find((s) => s.min === q.target);
      if (exact) return offer(d, exact, pre ? pre : 'Свободно! ');
      const near = [...sl].sort((a, b) => Math.abs(a.min - q.target) - Math.abs(b.min - q.target)).slice(0, 3).sort((a, b) => a.min - b.min);
      if (!pre && i === 0) pre = `На ${minToHM(q.target)} уже занято. `;
      const r = offer(d, near.reduce((a, b) => Math.abs(a.min - q.target) <= Math.abs(b.min - q.target) ? a : b), pre + 'Ближайшее: ');
      if (near.length > 1) r.chips = near.map((s) => `${chipDay(d, off)} в ${minToHM(s.min)}`);
      return r;
    }
    return { reply: 'В ближайшие две недели свободных окон не нашёл. Позвоните нам: ' + B.phone };
  }

  // интервал или просто «ближайшее»
  const start = q.day || today;
  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i); if (isDayOff(B, d)) continue;
    const fit = (await slotsOn(d)).filter((s) => (q.after == null || s.min >= q.after) && (q.before == null || s.min <= q.before));
    if (fit.length) {
      const moved = q.day && d !== q.day ? (isDayOff(B, q.day) ? `${dayLabel(q.day, off)} у нас выходной. ` : `На ${dayLabel(q.day, off).toLowerCase()} подходящего окна нет. `) : '';
      const r = offer(d, fit[0], moved + 'Ближайшее свободное: ');
      if (fit.length > 1) r.chips = fit.slice(0, 4).map((s) => `${chipDay(d, off)} в ${minToHM(s.min)}`);
      return r;
    }
  }
  return { reply: 'В ближайшие две недели свободных окон не нашёл. Позвоните нам: ' + B.phone };
}
