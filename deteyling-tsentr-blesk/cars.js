// Подсказки марка → модель → цвет для поля «Автомобиль». Свободный ввод тоже работает.
// [марка, синонимы для поиска, модели]
const DATA = [
  ['Lada', 'лада ваз vaz жигули', 'Vesta, Granta, Largus, Niva Legend, Niva Travel, XRAY, Kalina, Priora, Iskra, Aura, 2107, 2110, 2114'],
  ['Kia', 'киа кия', 'Rio, Ceed, Cerato, K5, Optima, Sportage, Sorento, Seltos, Soul, Picanto, Carnival, Mohave, Stinger, Carens'],
  ['Hyundai', 'хендай хундай хёндай хюндай', 'Solaris, Creta, Elantra, Sonata, Tucson, Santa Fe, i30, i40, ix35, Palisade, Getz, Accent, Staria'],
  ['Toyota', 'тойота', 'Camry, Corolla, RAV4, Land Cruiser, Land Cruiser Prado, Highlander, Fortuner, Hilux, C-HR, Yaris, Auris, Avensis, Prius, Alphard'],
  ['Haval', 'хавал хавейл', 'Jolion, F7, F7x, H6, Dargo, M6, H9, H5'],
  ['Chery', 'чери черри', 'Tiggo 4, Tiggo 4 Pro, Tiggo 7 Pro, Tiggo 7 Pro Max, Tiggo 8, Tiggo 8 Pro, Tiggo 8 Pro Max, Tiggo 9, Arrizo 8'],
  ['Geely', 'джили джилли', 'Coolray, Monjaro, Atlas, Atlas Pro, Tugella, Emgrand, Okavango, Preface, Cityray'],
  ['Changan', 'чанган', 'CS35 Plus, CS55 Plus, CS75 Plus, CS95, UNI-K, UNI-V, UNI-S, Eado Plus, Alsvin, Hunter Plus'],
  ['Omoda', 'омода', 'C5, S5, C7'],
  ['Jaecoo', 'джейку джейкоо', 'J7, J8'],
  ['Exeed', 'эксид иксид', 'LX, TXL, VX, RX'],
  ['Tank', 'танк', '300, 400, 500, 700'],
  ['Jetour', 'джетур', 'Dashing, X70, X70 Plus, X90 Plus, T2'],
  ['Volkswagen', 'фольксваген фольц vw', 'Polo, Jetta, Passat, Tiguan, Touareg, Golf, Teramont, Taos, Caddy, Transporter, Multivan, Amarok'],
  ['Skoda', 'шкода skoda', 'Octavia, Rapid, Kodiaq, Karoq, Superb, Fabia, Yeti, Kamiq'],
  ['Renault', 'рено', 'Logan, Sandero, Sandero Stepway, Duster, Kaptur, Arkana, Megane, Fluence, Koleos'],
  ['Nissan', 'ниссан нисан', 'Qashqai, X-Trail, Almera, Terrano, Murano, Juke, Teana, Note, Pathfinder, Patrol, Tiida'],
  ['Mitsubishi', 'мицубиси митсубиси', 'Outlander, ASX, Pajero, Pajero Sport, L200, Lancer, Eclipse Cross'],
  ['Mazda', 'мазда', '3, 6, CX-5, CX-30, CX-9, CX-60, CX-90'],
  ['BMW', 'бмв бэха', '1 серии, 3 серии, 5 серии, 7 серии, X1, X3, X4, X5, X6, X7, M3, M5, iX'],
  ['Mercedes-Benz', 'мерседес мерс бенц', 'A-Class, C-Class, E-Class, S-Class, CLA, GLA, GLB, GLC, GLE, GLS, G-Class, V-Class, Vito, Sprinter'],
  ['Audi', 'ауди', 'A3, A4, A5, A6, A7, A8, Q3, Q5, Q7, Q8, e-tron, RS6'],
  ['Lexus', 'лексус', 'RX, NX, LX, ES, GX, IS, UX, LS'],
  ['Ford', 'форд', 'Focus, Mondeo, Kuga, EcoSport, Explorer, Fiesta, Transit, Ranger'],
  ['Chevrolet', 'шевроле шевролет', 'Cruze, Niva, Lacetti, Aveo, Cobalt, Captiva, Tahoe, Camaro, Spark'],
  ['Honda', 'хонда', 'Civic, Accord, CR-V, Pilot, HR-V, Fit, Odyssey'],
  ['Subaru', 'субару', 'Forester, Outback, XV, Impreza, Legacy, WRX'],
  ['Suzuki', 'сузуки', 'Vitara, Grand Vitara, SX4, Jimny, Swift'],
  ['Volvo', 'вольво', 'XC40, XC60, XC90, S60, S90, V60'],
  ['Land Rover', 'ленд ровер рендж range rover', 'Range Rover, Range Rover Sport, Range Rover Evoque, Range Rover Velar, Discovery, Discovery Sport, Defender'],
  ['Porsche', 'порше', 'Cayenne, Macan, Panamera, 911, Taycan'],
  ['Infiniti', 'инфинити', 'QX50, QX60, QX70, QX80, Q50, FX'],
  ['Peugeot', 'пежо', '208, 308, 408, 3008, 5008, Partner'],
  ['Citroen', 'ситроен', 'C4, C5 Aircross, C3, Berlingo'],
  ['Opel', 'опель', 'Astra, Corsa, Insignia, Mokka, Zafira, Vectra'],
  ['Daewoo', 'дэу деу', 'Nexia, Matiz, Gentra'],
  ['Datsun', 'датсун', 'on-DO, mi-DO'],
  ['Ravon', 'равон', 'R4, Nexia R3, Gentra'],
  ['UAZ', 'уаз', 'Patriot, Хантер, Буханка, Профи'],
  ['ГАЗ', 'газ gaz газель', 'Газель Next, Газель Бизнес, Соболь'],
  ['Москвич', 'москвич moskvich', '3, 3e, 5, 6'],
  ['Tenet', 'тенет', 'T4, T7, T8'],
  ['Belgee', 'белджи', 'X50, X70, S50'],
  ['Solaris', 'солярис', 'HS, KRS'],
  ['Li Auto', 'li lixiang лисян ли сян', 'L6, L7, L8, L9'],
  ['Zeekr', 'зикр зекр', '001, 007, 009, X'],
  ['Voyah', 'воя вояж', 'Free, Dream, Passion'],
  ['Tesla', 'тесла', 'Model 3, Model Y, Model S, Model X'],
  ['BYD', 'бид бyd', 'Song Plus, Han, Tang, Seal, Atto 3, Qin Plus'],
  ['GAC', 'гак', 'GS8, GS3, Emkoo'],
  ['JAC', 'джак', 'JS4, JS6, T8'],
  ['FAW', 'фав', 'Bestune T77, Bestune B70'],
  ['Kaiyi', 'кайи', 'E5, X3 Pro'],
].map(([name, alias, models]) => ({ name, keys: (name + ' ' + alias).toLowerCase().split(/\s+/), models: models.split(', ') }));

const POPULAR = ['Lada', 'Kia', 'Hyundai', 'Toyota', 'Haval', 'Chery', 'Geely', 'Volkswagen', 'Skoda', 'Renault', 'BMW', 'Mercedes-Benz'];
const COLORS = ['белый', 'чёрный', 'серый', 'серебристый', 'синий', 'красный', 'коричневый', 'зелёный', 'бежевый'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function suggest(v) {
  const raw = v.replace(/^\s+/, ''), low = raw.toLowerCase();
  // уже выбрана модель → предлагаем цвет
  if (raw.includes(',')) {
    const color = low.split(',').pop().trim();
    if (COLORS.includes(color)) return null;
    return { kind: 'color', items: COLORS.filter((c) => c.startsWith(color)) };
  }
  const brand = DATA.find((b) => low === b.name.toLowerCase() || low.startsWith(b.name.toLowerCase() + ' '));
  if (brand) {
    const rest = low.slice(brand.name.length).trim();
    const model = brand.models.find((m) => m.toLowerCase() === rest);
    if (model) return { kind: 'color', items: COLORS, brand, model };
    const items = brand.models.filter((m) => !rest || m.toLowerCase().includes(rest));
    return { kind: 'model', items, brand };
  }
  if (!low) return { kind: 'brand', items: POPULAR };
  const items = DATA.filter((b) => b.keys.some((k) => k.startsWith(low)) || b.name.toLowerCase().startsWith(low)).map((b) => b.name);
  return { kind: 'brand', items: items.slice(0, 12) };
}

export function carPicker(input) {
  const box = document.createElement('div'); box.className = 'carpick';
  input.insertAdjacentElement('afterend', box);
  input.setAttribute('autocomplete', 'off');
  const label = { brand: 'Марка', model: 'Модель', color: 'Цвет (необязательно)' };
  function render() {
    const s = suggest(input.value);
    if (!s || !s.items.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="cp-h">${label[s.kind]}</div><div class="chips">${s.items.map((t) => `<button type="button" class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    box.querySelectorAll('.chip').forEach((c) => {
      c.onmousedown = (e) => e.preventDefault();             // не терять фокус поля
      c.onclick = () => {
        const t = c.dataset.v;
        if (s.kind === 'brand') input.value = t + ' ';
        else if (s.kind === 'model') input.value = `${s.brand.name} ${t}`;
        else input.value = input.value.split(',')[0].trim() + ', ' + t;
        input.focus(); render();
      };
    });
  }
  input.addEventListener('focus', render);
  input.addEventListener('input', render);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) box.innerHTML = ''; }, 150));
}
