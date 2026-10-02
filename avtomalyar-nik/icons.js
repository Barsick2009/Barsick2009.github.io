// Иконка услуги по названию. Порядок важен: более точные правила — выше.
const P = {
  drops: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
  shine: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>',
  seat: '<path d="M7 3h3l1.5 9H17a2 2 0 0 1 2 2v2H8.5z"/><path d="M8.5 16 7.5 21M17 16v5"/>',
  spray: '<path d="M10 7h4v3l2 2v8a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-8l2-2z"/><path d="M10 7V4h3l3 2"/><path d="M19 3h.01M21 5.5h.01M19 8h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  film: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  tint: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18M7 19l7-7M12 19l7-7"/>',
  rain: '<path d="M20 15.5A4.5 4.5 0 0 0 17.5 7a6 6 0 0 0-11.4 1.6A4 4 0 0 0 6 16.5"/><path d="M8 19v2M12 17v2M16 19v2"/>',
  light: '<path d="M10 5a7 7 0 0 0 0 14z"/><path d="M14 8h7M14 12h7M14 16h7"/>',
  glass: '<path d="M4 17 6 7a2 2 0 0 1 2-1.6h8A2 2 0 0 1 18 7l2 10z"/><path d="M10 9l-2 3M14.5 9l-3 5"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/><path d="M12 21a3 3 0 0 1 0-6h2a3 3 0 0 0 3-3"/>',
  brush: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5-1 2-2 2-2 2s4 1 6-1c2-1 2-3 1-6"/>',
};
const RULES = [
  [/двигател|мотор/, 'wrench'],
  [/диск/, 'wheel'],
  [/химчистк\S* кузов|битум|смол/, 'spray'],
  [/жидк\S* стекл|керами|защит|нано/, 'shield'],
  [/пл[её]нк|брон|антиграв|оклейк|винил/, 'film'],
  [/химчистк|салон|кож/, 'seat'],
  [/фар/, 'light'],
  [/тонир/, 'tint'],
  [/стек|стёк|лобов|шлиф/, 'glass'],
  [/антидожд|дожд/, 'rain'],
  [/воск|кварц/, 'gem'],
  [/озон|запах/, 'wind'],
  [/шумо/, 'mute'],
  [/цвет/, 'palette'],
  [/хром|покрас/, 'brush'],
  [/полиров|глянц|блеск/, 'shine'],
  [/мойк|мыт/, 'drops'],
];
export function svcKind(name) {
  const n = String(name || '').toLowerCase();
  return (RULES.find(([re]) => re.test(n)) || [, 'shine'])[1];
}
export function svcIcon(name) {
  return `<span class="svc-ic"><svg class="i" viewBox="0 0 24 24">${P[svcKind(name)]}</svg></span>`;
}
