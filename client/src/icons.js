// The game's own icon set (instead of emoji): small SVG drawings in one style, a dark ink outline over flat game
// colours with a soft highlight. Used in the HUD (inline SVG), on the maps and in 3D (rasterised once at boot).
//   icon('candy')            -> '<svg …>' string for HTML
//   iconImage('candy')       -> HTMLImageElement (ready after preloadIcons()) for canvas drawing
//   richText('Got 5 🍬!')    -> escaped HTML with known emoji swapped for inline icons
const INK = '#1c0f2b';
const C = {
  orange: '#ff7a1a', orange2: '#ffa24a', purple: '#7b4dff', purple2: '#9b7bff', teal: '#2ec4b6', gold: '#ffd23f', gold2: '#ffe27a',
  pink: '#ff4f8b', pink2: '#ff8fb8', cream: '#fff4e3', green: '#5d8a2c', green2: '#8bc34a', red: '#ff4f6b', blue: '#4f8bff', blue2: '#9ec5ff',
  grey: '#b8b0c8', dark: '#3a2060', night: '#2a1846', bone: '#f3eee2', brown: '#8a5a33', brown2: '#b07a48', glow: '#ffcf6a',
};

// tiny helpers that return SVG markup
const circle = (cx, cy, r, f, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${extra}/>`;
const rect = (x, y, w, h, rx, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${extra}/>`;
const path = (d, f = 'none', extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
const ell = (cx, cy, rx, ry, f, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`;
const shine = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.2" stroke-linecap="round"/>`;
const noStroke = 'stroke="none"';

const pumpkinBody = (f = C.orange, y = 0) => [
  ell(32, 38 + y, 22, 18, f),
  path(`M24 ${22 + y} Q20 ${38 + y} 24 ${55 + y}`, 'none'),
  path(`M40 ${22 + y} Q44 ${38 + y} 40 ${55 + y}`, 'none'),
  path(`M32 ${21 + y} L33 ${12 + y} Q36 ${9 + y} 39 ${11 + y}`, 'none', `stroke="${C.green}"`),
].join('');
const jack = (y = 0) => [
  path(`M23 ${34 + y} l5 -5 l3 5 z`, INK), path(`M41 ${34 + y} l-5 -5 l-3 5 z`, INK),
  path(`M22 ${42 + y} q10 9 20 0 l-4 0 l-2 3 l-3 -3 l-2 3 l-2 -3 l-3 3 l-2 -3 z`, INK),
].join('');

export const ICONS = {
  // ---------------------------------------------------------------- HUD
  candy: [path('M14 26 L4 18 L6 32 L4 46 L14 38', C.pink2), path('M50 26 L60 18 L58 32 L60 46 L50 38', C.pink2), ell(32, 32, 19, 14, C.pink), path('M22 22 Q30 32 22 43 M33 19 Q41 32 33 45', 'none', `stroke="${C.cream}" stroke-width="3.5"`), shine('M20 25 Q24 21 30 20')].join(''),
  ticket: [path('M8 18 h48 v8 a6 6 0 0 0 0 12 v8 h-48 v-8 a6 6 0 0 0 0 -12 z', C.gold), path('M40 20 v24', 'none', 'stroke-width="2.5" stroke-dasharray="3 3"'), path('M24 23 l2.6 5.4 5.9 0.8 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -0.8 z', C.orange, 'stroke-width="2.5"'), shine('M12 22 h6')].join(''),
  heart: [path('M32 54 C10 40 6 26 14 17 C21 10 29 13 32 20 C35 13 43 10 50 17 C58 26 54 40 32 54 Z', C.red), shine('M16 22 Q18 16 24 16')].join(''),
  potion: [path('M26 8 h12 v14 l12 20 a10 10 0 0 1 -9 14 h-18 a10 10 0 0 1 -9 -14 l12 -20 z', C.cream), path('M16 40 h32 l2 3 a10 10 0 0 1 -9 13 h-18 a10 10 0 0 1 -9 -13 z', C.teal, noStroke), path('M26 8 h12 v14 l12 20 a10 10 0 0 1 -9 14 h-18 a10 10 0 0 1 -9 -14 l12 -20 z', 'none'), rect(23, 4, 18, 7, 3, C.brown2), circle(28, 46, 3, '#fff', noStroke), circle(37, 42, 2, '#fff', noStroke)].join(''),
  revive: [path('M26 8 h12 v14 l12 20 a10 10 0 0 1 -9 14 h-18 a10 10 0 0 1 -9 -14 l12 -20 z', C.pink2), rect(23, 4, 18, 7, 3, C.brown2), path('M32 47 C24 41 23 36 26 33 C28.5 31 31 32 32 34 C33 32 35.5 31 38 33 C41 36 40 41 32 47 Z', C.red)].join(''),
  fire: [path('M32 58 C16 58 12 44 18 34 C20 42 25 42 25 42 C22 30 30 18 34 6 C38 18 52 26 50 42 C48 52 42 58 32 58 Z', C.orange), path('M32 56 C25 56 23 49 26 44 C28 48 31 47 31 47 C30 40 34 36 36 31 C39 37 44 42 42 49 C40 54 37 56 32 56 Z', C.gold, noStroke)].join(''),
  map: [path('M6 14 L22 8 L42 14 L58 8 V50 L42 56 L22 50 L6 56 Z', C.cream), path('M22 8 V50 M42 14 V56', 'none'), path('M12 40 Q20 30 28 36 T50 26', 'none', `stroke="${C.red}" stroke-dasharray="4 4"`), path('M48 20 l4 4 m0 -4 l-4 4', 'none', `stroke="${C.red}"`)].join(''),
  scroll: [rect(14, 10, 36, 44, 4, C.cream), rect(10, 6, 44, 10, 5, C.brown2), rect(10, 48, 44, 10, 5, C.brown2), path('M20 24 h24 M20 31 h24 M20 38 h16', 'none', 'stroke-width="3"')].join(''),
  book: [path('M32 14 C24 8 14 8 6 12 V54 C14 50 24 50 32 56 C40 50 50 50 58 54 V12 C50 8 40 8 32 14 Z', C.purple2), path('M32 14 V56', 'none'), path('M12 20 Q20 17 27 20 M12 28 Q20 25 27 28 M37 20 Q44 17 52 20 M37 28 Q44 25 52 28', 'none', `stroke="${C.cream}" stroke-width="3"`), path('M44 32 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 z', C.gold, 'stroke-width="2.5"')].join(''),
  sound: [path('M8 24 h10 l14 -12 v40 l-14 -12 h-10 z', C.cream), path('M40 22 Q46 32 40 42 M46 16 Q56 32 46 48', 'none')].join(''),
  mute: [path('M8 24 h10 l14 -12 v40 l-14 -12 h-10 z', C.grey), path('M42 24 l14 16 M56 24 l-14 16', 'none', `stroke="${C.red}" stroke-width="5"`)].join(''),
  help: [circle(32, 32, 25, C.purple2), path('M24 25 Q24 15 33 15 Q42 15 42 23 Q42 29 34 32 V38', 'none', `stroke="${C.cream}" stroke-width="6"`), circle(34, 47, 4, C.cream, noStroke)].join(''),
  users: [circle(23, 22, 9, C.blue2), path('M6 52 Q8 34 23 34 Q38 34 40 52 Z', C.blue2), circle(43, 20, 8, C.teal), path('M34 34 Q38 31 43 31 Q57 31 58 48 H42', C.teal)].join(''),
  chat: [path('M8 14 Q8 8 14 8 H50 Q56 8 56 14 V38 Q56 44 50 44 H28 L16 56 V44 H14 Q8 44 8 38 Z', C.cream), circle(22, 26, 3.5, INK, noStroke), circle(32, 26, 3.5, INK, noStroke), circle(42, 26, 3.5, INK, noStroke)].join(''),
  smile: [circle(32, 32, 25, C.gold), ell(24, 26, 3.5, 5, INK, noStroke), ell(40, 26, 3.5, 5, INK, noStroke), path('M20 38 Q32 50 44 38', 'none'), circle(18, 36, 4, C.pink2, `${noStroke} opacity=".7"`), circle(46, 36, 4, C.pink2, `${noStroke} opacity=".7"`)].join(''),
  hand: [path('M20 34 V16 a4 4 0 0 1 8 0 V30 V12 a4 4 0 0 1 8 0 V30 V15 a4 4 0 0 1 8 0 V32 V22 a4 4 0 0 1 8 0 V38 Q52 58 34 58 Q22 58 16 46 L10 36 a4 4 0 0 1 7 -5 z', C.cream)].join(''),
  jump: [path('M32 6 L52 28 H40 V44 H24 V28 H12 Z', C.purple2), rect(18, 50, 28, 7, 3.5, C.purple2)].join(''),
  throw: [ell(30, 34, 15, 11, C.pink), path('M16 30 L8 24 L9 36 L8 46 L16 40 M44 30 L52 24', 'none'), path('M42 12 q8 -4 14 2 M48 22 q6 -2 10 2', 'none', `stroke="${C.gold}"`)].join(''),
  mic: [rect(22, 6, 20, 32, 10, C.cream), path('M14 30 Q14 48 32 48 Q50 48 50 30 M32 48 V58 M22 58 H42', 'none'), path('M28 14 v12', 'none', 'stroke="#fff" stroke-opacity=".7" stroke-width="3"')].join(''),
  keyboard: [rect(4, 16, 56, 34, 6, C.cream), ...[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => rect(10 + c * 9.5, 22 + r * 8, 6, 5, 1.5, C.grey, 'stroke-width="2"'))), rect(18, 40, 28, 5, 2, C.grey, 'stroke-width="2"')].join(''),
  close: [circle(32, 32, 24, C.dark), path('M22 22 L42 42 M42 22 L22 42', 'none', `stroke="${C.cream}" stroke-width="6"`)].join(''),
  camera: [path('M8 22 Q8 16 14 16 H20 L25 9 H39 L44 16 H50 Q56 16 56 22 V48 Q56 54 50 54 H14 Q8 54 8 48 Z', C.pink2), circle(32, 35, 12, C.dark), circle(32, 35, 6, C.blue2, noStroke), circle(48, 24, 3, C.gold, noStroke)].join(''),
  pin: [path('M32 60 C22 44 12 36 12 24 A20 20 0 0 1 52 24 C52 36 42 44 32 60 Z', C.gold), circle(32, 24, 8, C.cream)].join(''),
  lantern: [rect(18, 16, 28, 34, 8, C.glow), path('M24 10 H40 L44 16 H20 Z M22 50 H42 L40 56 H24 Z', C.dark), path('M32 4 V10', 'none'), path('M26 24 V42 M38 24 V42', 'none', `stroke="${C.orange}" stroke-width="3"`)].join(''),
  star: [path('M32 6 L39 23 L58 24 L43 36 L48 55 L32 44 L16 55 L21 36 L6 24 L25 23 Z', C.gold), shine('M28 18 L31 12')].join(''),
  check: [circle(32, 32, 25, C.teal), path('M20 33 L28 41 L45 23', 'none', `stroke="${C.cream}" stroke-width="7"`)].join(''),
  lock: [rect(14, 28, 36, 28, 6, C.gold), path('M22 28 V20 A10 10 0 0 1 42 20 V28', 'none', 'stroke-width="6"'), circle(32, 40, 4, INK, noStroke), path('M32 42 V48', 'none')].join(''),
  crown: [path('M8 46 L12 18 L24 32 L32 12 L40 32 L52 18 L56 46 Z', C.gold), rect(8, 46, 48, 9, 3, C.orange2), circle(32, 36, 4, C.pink, 'stroke-width="2.5"'), circle(20, 38, 3, C.teal, 'stroke-width="2.5"'), circle(44, 38, 3, C.purple2, 'stroke-width="2.5"')].join(''),
  clock: [circle(32, 34, 24, C.cream), path('M32 20 V34 L42 40', 'none'), rect(26, 4, 12, 7, 2, C.grey)].join(''),
  trophy: [path('M18 8 H46 V24 A14 14 0 0 1 18 24 Z', C.gold), path('M18 14 H8 Q8 28 20 30 M46 14 H56 Q56 28 44 30', 'none'), rect(28, 38, 8, 8, 1, C.gold2), rect(20, 46, 24, 10, 3, C.brown2)].join(''),
  gear: [path('M28 4 h8 l2 8 6 3 7 -4 6 6 -4 7 3 6 8 2 v8 l-8 2 -3 6 4 7 -6 6 -7 -4 -6 3 -2 8 h-8 l-2 -8 -6 -3 -7 4 -6 -6 4 -7 -3 -6 -8 -2 v-8 l8 -2 3 -6 -4 -7 6 -6 7 4 6 -3 z', C.grey), circle(32, 32, 9, C.night)].join(''),
  speaker: [path('M6 22 h10 l18 -14 v48 l-18 -14 h-10 z', C.orange2), path('M42 20 Q50 32 42 44 M48 14 Q60 32 48 50', 'none')].join(''),
  shield: [path('M32 6 L54 14 V30 C54 44 44 54 32 58 C20 54 10 44 10 30 V14 Z', C.blue2), path('M32 12 V52', 'none', 'stroke-opacity=".3"')].join(''),
  sword: [path('M46 6 L58 6 L58 18 L28 48 L16 36 Z', C.grey), path('M12 32 L32 52 M18 46 L8 56', 'none', 'stroke-width="5"'), circle(9, 55, 4, C.gold)].join(''),
  sos: [circle(32, 32, 26, C.red), path('M32 16 V36', 'none', `stroke="${C.cream}" stroke-width="8"`), circle(32, 47, 5, C.cream, noStroke)].join(''),
  zzz: [path('M10 14 H26 L10 32 H26 M30 30 H42 L30 44 H42 M44 46 H54 L44 58 H54', 'none', `stroke="${C.blue2}" stroke-width="5"`)].join(''),
  sparkle: [path('M32 4 Q35 29 60 32 Q35 35 32 60 Q29 35 4 32 Q29 29 32 4 Z', C.gold), path('M50 8 Q51 13 56 14 Q51 15 50 20 Q49 15 44 14 Q49 13 50 8 Z', C.cream, 'stroke-width="2"')].join(''),
  note: [path('M24 46 V12 L52 6 V40', 'none', 'stroke-width="5"'), ell(18, 46, 8, 6, C.purple2), ell(46, 40, 8, 6, C.purple2)].join(''),
  bat: [path('M32 24 C28 18 20 18 4 22 C10 26 10 32 8 38 C14 34 20 36 22 42 C26 36 30 36 32 40 C34 36 38 36 42 42 C44 36 50 34 56 38 C54 32 54 26 60 22 C44 18 36 18 32 24 Z', '#6a4a9a'), path('M27 22 L28 14 L31 20 M37 22 L36 14 L33 20', '#6a4a9a'), circle(29, 27, 1.8, C.gold, noStroke), circle(35, 27, 1.8, C.gold, noStroke)].join(''),
  spider: [ell(32, 38, 12, 11, '#5a3a7a'), circle(32, 24, 8, '#5a3a7a'), ...[-1, 1].flatMap((s) => [0, 1, 2, 3].map((i) => path(`M${32 + s * 9} ${32 + i * 4} Q${32 + s * 22} ${22 + i * 8} ${32 + s * 28} ${36 + i * 6}`, 'none'))), circle(29, 23, 2, C.red, noStroke), circle(35, 23, 2, C.red, noStroke), path('M32 4 V16', 'none', 'stroke-width="2"')].join(''),
  ghost: [path('M12 56 V30 A20 20 0 0 1 52 30 V56 L45 50 L38 56 L32 50 L26 56 L19 50 Z', C.cream), ell(25, 30, 3.5, 5, INK, noStroke), ell(39, 30, 3.5, 5, INK, noStroke), ell(32, 41, 4, 3, INK, noStroke), shine('M20 22 Q24 16 30 15')].join(''),
  skull: [path('M14 30 A18 18 0 0 1 50 30 V40 L44 44 V52 H20 V44 L14 40 Z', C.bone), ell(25, 32, 5, 6, INK, noStroke), ell(39, 32, 5, 6, INK, noStroke), path('M32 38 l-3 5 h6 z', INK, noStroke), path('M26 52 V46 M32 52 V46 M38 52 V46', 'none', 'stroke-width="2.5"')].join(''),
  pumpkin: [pumpkinBody(), jack()].join(''),
  wave: [path('M20 34 V16 a4 4 0 0 1 8 0 V30 V12 a4 4 0 0 1 8 0 V30 V15 a4 4 0 0 1 8 0 V32 V22 a4 4 0 0 1 8 0 V38 Q52 58 34 58 Q22 58 16 46 L10 36 a4 4 0 0 1 7 -5 z', C.gold2), path('M6 14 Q4 8 8 4 M10 20 Q4 18 2 22', 'none', 'stroke-width="3"')].join(''),
  laugh: [circle(32, 32, 25, C.gold), path('M20 24 Q24 20 28 26 M36 26 Q40 20 44 24', 'none'), path('M18 36 Q32 56 46 36 Z', INK), path('M24 44 Q32 50 40 44', 'none', `stroke="${C.pink}" stroke-width="3"`), path('M10 26 q-2 6 2 10 M54 26 q2 6 -2 10', 'none', `stroke="${C.blue2}" stroke-width="3.5"`)].join(''),
  clap: [path('M16 40 L28 12 a4 4 0 0 1 7 3 L30 30 L44 10 a4 4 0 0 1 6 4 L36 36 Q30 54 18 50 Z', C.gold2), path('M48 22 L56 18 M50 30 L58 30 M8 12 L14 18', 'none', `stroke="${C.orange}"`)].join(''),
  flip: [circle(32, 14, 7, C.gold2), path('M32 21 V40 M32 26 L18 18 M32 26 L46 18 M32 40 L22 54 M32 40 L42 54', 'none', 'stroke-width="5"'), path('M8 40 A26 26 0 0 0 56 40', 'none', `stroke="${C.purple2}" stroke-dasharray="4 5"`)].join(''),
  zombie: [circle(32, 30, 20, '#9ed36a'), path('M22 26 h6 M36 26 h6', 'none'), path('M24 40 l4 -3 4 3 4 -3 4 3', 'none'), path('M20 48 L8 52 M44 48 L56 52', 'none', 'stroke-width="5"'), path('M40 14 l4 4', 'none', `stroke="${C.red}"`)].join(''),
  spin: [path('M32 8 A24 24 0 1 1 10 40', 'none', `stroke="${C.teal}" stroke-width="7"`), path('M4 34 L10 44 L18 36', 'none', `stroke="${C.teal}" stroke-width="5"`), circle(32, 32, 6, C.purple2)].join(''),
  sit: [rect(14, 30, 36, 8, 3, C.brown2), path('M18 38 V56 M46 38 V56 M18 30 V10 H46 V30', 'none', 'stroke-width="5"'), path('M18 16 H46', 'none', `stroke="${C.brown2}" stroke-width="5"`)].join(''),
  cheer: [path('M14 46 L8 14 a4 4 0 0 1 8 -1 L22 30 M50 46 L56 14 a4 4 0 0 0 -8 -1 L42 30', 'none', 'stroke-width="5"'), circle(32, 40, 12, C.gold2), path('M26 42 Q32 48 38 42', 'none'), path('M30 10 l2 -6 2 6 M20 6 l3 4 M44 6 l-3 4', 'none', `stroke="${C.pink}"`)].join(''),
  sleep: [path('M30 10 A22 22 0 1 0 54 38 A18 18 0 0 1 30 10 Z', C.gold2), path('M40 12 H50 L40 22 H50', 'none', `stroke="${C.blue2}" stroke-width="3.5"`)].join(''),
  boo: [path('M12 56 V30 A20 20 0 0 1 52 30 V56 L45 50 L38 56 L32 50 L26 56 L19 50 Z', C.cream), ell(25, 30, 4, 6, INK, noStroke), ell(39, 30, 4, 6, INK, noStroke), ell(32, 43, 6, 7, INK, noStroke), path('M54 10 l4 -6 M58 16 l5 -2 M4 12 l-2 -6', 'none', `stroke="${C.orange}"`)].join(''),

  // ---------------------------------------------------------------- quests and places
  hello: [pumpkinBody(C.orange, 4), jack(4), rect(18, 4, 28, 16, 3, C.dark), rect(12, 18, 40, 5, 2.5, C.dark), rect(18, 13, 28, 4, 1, C.purple2, 'stroke-width="2"')].join(''),
  photo: null,
  harvest: [pumpkinBody(C.orange2), path('M10 56 H54', 'none', `stroke="${C.brown}"`), path('M48 10 q8 4 6 12 q-6 -2 -6 -12 z', C.green2)].join(''),
  wisps: [rect(16, 18, 32, 38, 8, C.blue2, 'fill-opacity=".55"'), rect(14, 10, 36, 9, 3, C.brown2), circle(32, 38, 9, '#d6f6ff', noStroke), circle(32, 38, 5, '#fff', noStroke), path('M22 26 q4 -3 8 0', 'none', 'stroke="#fff" stroke-width="3"')].join(''),
  candles: [rect(12, 30, 12, 26, 3, C.cream), rect(26, 20, 12, 36, 3, C.cream), rect(40, 34, 12, 22, 3, C.cream), ...[[18, 30], [32, 20], [46, 34]].map(([x, y]) => path(`M${x} ${y - 2} Q${x - 4} ${y - 9} ${x} ${y - 15} Q${x + 4} ${y - 9} ${x} ${y - 2} Z`, C.gold, 'stroke-width="2.5"'))].join(''),
  carve: [pumpkinBody(C.orange, 4), jack(4), path('M46 4 L58 16 L40 34 L34 28 Z', C.grey, 'stroke-width="3"'), path('M34 28 L28 34', 'none', `stroke="${C.brown}" stroke-width="6"`)].join(''),
  riddle: null,
  deal: [path('M4 30 L16 20 L28 24 L36 20 L48 20 L60 30 L46 46 Q40 50 34 46 L22 40 Z', C.gold2), path('M28 24 L22 32 Q26 36 32 30 L40 34 M30 40 L36 44 M24 36 L30 40', 'none', 'stroke-width="3"'), circle(50, 12, 6, C.gold, 'stroke-width="2.5"'), circle(14, 10, 4, C.gold, 'stroke-width="2.5"')].join(''),
  friend: null,
  clues: [circle(26, 26, 17, C.blue2, 'fill-opacity=".6"'), circle(26, 26, 17, 'none', 'stroke-width="5"'), path('M38 38 L56 56', 'none', 'stroke-width="8"'), path('M38 38 L56 56', 'none', `stroke="${C.brown2}" stroke-width="3"`), shine('M18 20 Q20 15 26 14')].join(''),
  ritual: [ell(32, 52, 22, 6, C.purple, 'fill-opacity=".5"'), circle(32, 28, 20, C.purple2), circle(32, 28, 20, 'none'), path('M22 20 Q26 14 34 14', 'none', 'stroke="#fff" stroke-opacity=".7" stroke-width="3"'), rect(20, 46, 24, 8, 3, C.brown2), path('M28 30 l4 -8 4 8 z', C.gold, 'stroke-width="2.5"')].join(''),
  dance: [circle(32, 30, 20, C.grey), ...[0, 1, 2, 3].map((i) => path(`M${14 + i * 0} ${18 + i * 8} H${50}`, 'none', 'stroke-width="2" stroke-opacity=".5"')), path('M20 12 V50 M32 10 V50 M44 12 V50', 'none', 'stroke-width="2" stroke-opacity=".5"'), path('M32 4 V10', 'none'), path('M8 50 l4 4 M56 50 l-4 4 M30 58 h4', 'none', `stroke="${C.pink}"`)].join(''),
  rescue: null,
  boss: null,
  finale: [pumpkinBody('#e8590c', 4), path('M21 32 l8 2 M43 32 l-8 2', 'none'), path('M23 37 l5 -2 1 4 z M41 37 l-5 -2 -1 4 z', C.red, 'stroke-width="2"'), path('M22 46 q10 6 20 0 l-3 -2 -3 3 -2 -3 -2 3 -2 -3 -3 3 z', INK), rect(19, 2, 26, 14, 3, C.dark), rect(12, 14, 40, 5, 2.5, C.dark), rect(19, 10, 26, 3, 1, C.purple2, 'stroke-width="2"'), circle(42, 36, 6, 'none', `stroke="${C.gold}" stroke-width="3"`)].join(''),
  bear: [circle(16, 16, 8, C.brown2), circle(48, 16, 8, C.brown2), circle(32, 34, 22, C.orange), ell(32, 42, 10, 8, C.cream), ell(32, 38, 4, 3, INK, noStroke), path('M23 28 l4 -4 3 4 z M41 28 l-4 -4 -3 4 z', INK)].join(''),

  // ---------------------------------------------------------------- NPCs
  mayor: null,
  hex: [path('M8 46 Q32 52 56 46 L52 40 Q32 44 12 40 Z', C.dark), path('M18 42 L30 6 Q34 4 36 8 L40 18 Q46 18 48 24 L40 22 L46 42 Z', C.dark), rect(20, 34, 26, 6, 2, C.orange, 'stroke-width="2.5"'), rect(29, 33, 7, 8, 1.5, C.gold, 'stroke-width="2"'), path('M16 52 Q32 60 48 52', 'none', `stroke="${C.green2}"`)].join(''),
  count: [circle(32, 30, 17, '#e9e1f2'), path('M15 26 Q20 10 32 18 Q44 10 49 26 Q42 20 32 22 Q22 20 15 26 Z', C.dark), path('M8 58 L14 40 Q32 52 50 40 L56 58', C.red), path('M26 38 l2 6 2 -6 M34 38 l2 6 2 -6', '#fff', 'stroke-width="2"'), ell(26, 30, 2.5, 3, C.red, noStroke), ell(38, 30, 2.5, 3, C.red, noStroke)].join(''),
  bones: null,
  hayley: [path('M6 30 Q32 18 58 30 L50 34 Q32 26 14 34 Z', C.gold2), path('M18 30 Q20 12 32 12 Q44 12 46 30', C.gold2), circle(32, 40, 14, '#f2d38a'), path('M26 38 h2 M36 38 h2', 'none'), path('M27 46 Q32 49 37 46', 'none'), path('M18 50 l-6 8 M46 50 l6 8 M24 54 l-2 8', 'none', `stroke="${C.gold}"`)].join(''),
  wisp: null,
  dj: [path('M12 36 A20 20 0 0 1 52 36', 'none', 'stroke-width="6"'), rect(6, 32, 12, 20, 5, C.purple2), rect(46, 32, 12, 20, 5, C.purple2), circle(32, 38, 12, C.bone), ell(28, 36, 2.5, 3, INK, noStroke), ell(36, 36, 2.5, 3, INK, noStroke), path('M28 44 h8', 'none', 'stroke-width="2.5"')].join(''),

  // ---------------------------------------------------------------- map places
  plaza: [ell(32, 46, 24, 9, C.grey), ell(32, 44, 18, 6, C.blue, 'fill-opacity=".8"'), rect(28, 22, 8, 22, 3, C.grey), circle(32, 18, 9, C.orange), path('M24 30 Q18 36 20 42 M40 30 Q46 36 44 42', 'none', `stroke="${C.blue2}" stroke-width="3"`)].join(''),
  graveyard: [path('M14 56 V26 A18 18 0 0 1 50 26 V56 Z', C.grey), path('M32 22 V44 M24 30 H40', 'none', 'stroke-width="5"'), path('M8 56 H56', 'none', `stroke="${C.green}" stroke-width="5"`)].join(''),
  arena: null,
  circle: [ell(32, 40, 26, 14, C.purple, 'fill-opacity=".45"'), ...[0, 1, 2, 3].map((i) => rect(12 + i * 12, 22 + (i % 2) * 4, 6, 18 - (i % 2) * 4, 2, C.grey, 'stroke-width="3"')), path('M32 20 l3 6 6 1 -4 4 1 6 -6 -3 -6 3 1 -6 -4 -4 6 -1 z', C.purple2, 'stroke-width="2.5"')].join(''),
  patch: null,
  cottage: [path('M8 26 Q8 56 32 56 Q56 56 56 26 Z', C.dark), ell(32, 26, 26, 6, '#3c8a48'), circle(24, 20, 5, '#9ef06a', 'stroke-width="2.5"'), circle(38, 14, 4, '#9ef06a', 'stroke-width="2.5"'), circle(32, 6, 3, '#9ef06a', 'stroke-width="2"'), path('M14 56 L10 62 M50 56 L54 62', 'none')].join(''),
  woods: [path('M32 4 L50 30 H42 L54 48 H10 L22 30 H14 Z', '#3c7a4a'), rect(28, 48, 8, 10, 2, C.brown)].join(''),
  market: [path('M6 24 L12 10 H52 L58 24 Z', C.pink2), path('M6 24 Q11 30 16 24 Q21 30 27 24 Q32 30 37 24 Q42 30 48 24 Q53 30 58 24', C.cream), rect(12, 30, 40, 24, 3, C.brown2), path('M20 10 L18 24 M32 10 V24 M44 10 L46 24', 'none', 'stroke-width="3"')].join(''),
  lake: [ell(32, 40, 26, 14, C.blue), path('M14 40 q6 -4 12 0 t12 0 t12 0', 'none', `stroke="${C.blue2}" stroke-width="3"`), rect(26, 14, 12, 14, 4, C.glow), path('M24 10 H40 L38 14 H26 Z', C.dark)].join(''),
  booth: null,
  windmill: [path('M24 58 L28 26 H36 L40 58 Z', C.cream), path('M24 26 L32 18 L40 26 Z', C.red), path('M32 22 L12 6 M32 22 L54 6 M32 22 L10 38 M32 22 L52 40', 'none', `stroke="${C.brown}" stroke-width="5"`), circle(32, 22, 3.5, C.dark), rect(29, 46, 6, 12, 2, C.brown)].join(''),
  tower: [path('M18 58 L22 22 H42 L46 58', 'none', `stroke="${C.brown}" stroke-width="5"`), path('M20 40 L44 28 M20 28 L44 40', 'none', `stroke="${C.brown}" stroke-width="3"`), rect(14, 16, 36, 8, 2, C.brown2), path('M10 16 L32 2 L54 16 Z', C.dark), rect(28, 16, 8, 6, 1, C.glow, 'stroke-width="2"')].join(''),
  chapel: [path('M10 58 V30 L32 14 L54 30 V58 Z', C.grey), path('M32 14 V2 M27 7 H37', 'none', `stroke="${C.gold}" stroke-width="4"`), path('M26 58 V44 A6 6 0 0 1 38 44 V58', C.brown), circle(32, 30, 5, C.pink2, 'stroke-width="2.5"')].join(''),
  alert: [circle(32, 32, 26, C.orange), rect(28, 13, 8, 25, 4, C.cream), circle(32, 47, 4.5, C.cream)].join(''),
  joystick: [rect(8, 40, 48, 16, 6, C.purple), path('M32 40 V22', 'none', 'stroke-width="6"'), circle(32, 18, 9, C.red), circle(18, 48, 3.5, C.gold, noStroke), shine('M28 14 Q30 11 34 12')].join(''),
  undo: [path('M22 14 L8 26 L22 38 V30 Q42 28 48 40 Q50 24 22 22 Z', C.teal), path('M24 50 Q44 54 52 42', 'none', `stroke="${C.teal}" stroke-width="5"`)].join(''),
  broom: [path('M46 6 L30 34', 'none', `stroke="${C.brown}" stroke-width="6"`), path('M24 30 L38 38 L30 58 Q18 56 10 46 Z', C.gold2), path('M19 44 L28 50 M24 38 L32 44', 'none', 'stroke-width="2.5"')].join(''),
  // potion ingredients
  mushroom: [path('M8 32 Q8 8 32 8 Q56 8 56 32 Z', C.red), circle(22, 20, 4, C.cream, noStroke), circle(38, 16, 3.5, C.cream, noStroke), circle(44, 26, 3, C.cream, noStroke), path('M24 32 L22 54 Q32 58 42 54 L40 32', C.cream)].join(''),
  frog: [ell(32, 40, 24, 16, '#6fcf5a'), circle(20, 22, 8, '#6fcf5a'), circle(44, 22, 8, '#6fcf5a'), circle(20, 22, 3.5, INK, noStroke), circle(44, 22, 3.5, INK, noStroke), path('M20 42 Q32 50 44 42', 'none'), circle(24, 36, 2, C.pink2, noStroke), circle(40, 36, 2, C.pink2, noStroke)].join(''),
  moon: [path('M40 6 A26 26 0 1 0 58 42 A20 20 0 0 1 40 6 Z', C.gold2), circle(26, 30, 3, '#e8c96a', noStroke), circle(32, 44, 4, '#e8c96a', noStroke), path('M52 10 l2 4 4 1 -4 2 -1 4 -2 -4 -4 -1 4 -2 z', C.cream, 'stroke-width="1.5"')].join(''),
  eye: [ell(32, 32, 26, 18, C.cream), circle(32, 32, 11, '#4fb7ff'), circle(32, 32, 5, INK, noStroke), circle(36, 28, 2.5, '#fff', noStroke), path('M10 26 l-4 -4 M14 20 l-2 -5 M54 26 l4 -4', 'none', `stroke="${C.red}" stroke-width="2.5"`)].join(''),
  pepper: [path('M44 14 Q58 24 50 42 Q40 60 16 56 Q8 54 12 50 Q36 46 38 22 Q38 14 44 14 Z', C.red), path('M44 14 Q46 6 52 6', 'none', `stroke="${C.green}" stroke-width="5"`), shine('M42 22 Q46 28 44 36')].join(''),
  manor: [rect(8, 24, 48, 34, 2, '#4a3a6a'), path('M4 26 L32 6 L60 26 Z', C.dark), ...[[14, 32], [28, 32], [42, 32], [14, 44], [42, 44]].map(([x, y]) => rect(x, y, 8, 8, 1, C.glow, 'stroke-width="2"')), path('M28 58 V46 h8 V58', C.brown, 'stroke-width="3"')].join(''),
};
// icons that reuse others
ICONS.photo = ICONS.camera;
ICONS.booth = ICONS.camera;
ICONS.riddle = ICONS.ghost;
ICONS.wisp = ICONS.ghost;
ICONS.friend = ICONS.heart;
ICONS.rescue = ICONS.revive;
ICONS.boss = ICONS.crown;
ICONS.arena = ICONS.crown;
ICONS.bones = ICONS.skull;
ICONS.patch = ICONS.harvest;
ICONS.mayor = ICONS.hello;
ICONS.cauldron = ICONS.cottage;

const svgFor = (name) => {
  const inner = ICONS[name];
  if (!inner) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
};

export function icon(name, cls = '') {
  const s = svgFor(name);
  return s ? s.replace('<svg ', `<svg class="ic ${cls}" aria-hidden="true" `) : '';
}

// ---------------------------------------------------------------- rasterised copies for canvas and 3D
const images = new Map();
export function iconImage(name) {
  if (!ICONS[name]) return null;
  if (!images.has(name)) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFor(name).replace('<svg ', '<svg width="128" height="128" '));
    images.set(name, img);
  }
  return images.get(name);
}
export function preloadIcons() {
  return Promise.all(Object.keys(ICONS).map((n) => {
    const img = iconImage(n);
    return img.complete ? null : new Promise((r) => {
      img.onload = img.onerror = r;
    });
  }));
}

// ---------------------------------------------------------------- emoji in text -> icons
export const EMOJI_ICON = {
  '💰': 'candy', '❗': 'alert', '💨': 'ghost', '🧙‍♀️': 'hex', '🧙': 'hex', '🕹️': 'joystick', '🥄': 'carve', '👀': 'eye', '😁': 'laugh', '🔺': 'pumpkin', '↩️': 'undo', '🧹': 'broom',
  '🍬': 'candy', '🎟️': 'ticket', '🎟': 'ticket', '💜': 'heart', '❤️': 'heart', '🧪': 'potion', '🔥': 'fire', '🗺️': 'map', '📜': 'scroll', '📖': 'book', '🔊': 'sound', '🔇': 'mute',
  '❔': 'help', '👥': 'users', '💬': 'chat', '😄': 'smile', '✋': 'hand', '🎙️': 'mic', '⌨️': 'keyboard', '📸': 'camera', '📍': 'pin', '⭐': 'star', '✅': 'check', '🔒': 'lock',
  '👑': 'crown', '⏰': 'clock', '🏆': 'trophy', '📣': 'speaker', '🛡️': 'shield', '⚔️': 'sword', '🆘': 'sos', '💤': 'zzz', '✨': 'sparkle', '🎵': 'note', '🦇': 'bat', '🕷️': 'spider',
  '👻': 'ghost', '💀': 'skull', '🎃': 'pumpkin', '👋': 'wave', '😂': 'laugh', '👏': 'clap', '🤸': 'flip', '🧟': 'zombie', '🌀': 'spin', '🪑': 'sit', '🙌': 'cheer', '🕺': 'dance',
  '🔍': 'clues', '🔮': 'ritual', '🪩': 'dance', '🎩': 'finale', '🕯️': 'candles', '🔪': 'carve', '🤝': 'deal', '🌾': 'harvest', '🫙': 'wisps', '🧙‍♀️': 'hex', '🧛': 'count', '🎧': 'dj',
  '⛲': 'plaza', '🪦': 'graveyard', '🛍️': 'market', '🏮': 'lake', '🌲': 'woods', '🌕': 'sleep', '💫': 'sparkle', '💥': 'fire', '🐌': 'clock', '🚫': 'lock', '⛲️': 'plaza',
  '🏚️': 'manor', '🚪': 'manor', '🏆': 'trophy', '🎉': 'sparkle', '🔔': 'speaker', '🪄': 'sparkle', '😿': 'ghost', '🦴': 'skull', '🐻': 'bear', '⚡': 'sparkle', '🙏': 'heart', '🍕': 'candy',
};
const EMOJI_RE = new RegExp(Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Escape text, then swap the emoji we know for inline icons (any other emoji is removed).
export function richText(text) {
  return esc(text).replace(EMOJI_RE, (e) => icon(EMOJI_ICON[e], 'inline')).replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s{2,}/g, ' ');
}
// The first emoji in a message, as an icon name (toasts show it big on the left).
export function leadIcon(text) {
  const m = String(text).match(EMOJI_RE);
  return m ? EMOJI_ICON[m[0]] : null;
}
// A message that starts with an emoji: that emoji's icon and the rest (inline emoji stay for richText).
export function splitLead(text) {
  const s = String(text).trimStart();
  const m = s.match(EMOJI_RE);
  if (m && s.startsWith(m[0])) return [EMOJI_ICON[m[0]], s.slice(m[0].length).replace(/^\s*[·:,-]?\s*/, '')];
  return [null, s];
}
export function stripEmoji(text) {
  return String(text).replace(EMOJI_RE, '').replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s{2,}/g, ' ').replace(/^\s*[·:,-]\s*/, '').trim();
}

// For whole HTML templates: known emoji become inline icons, anything else is dropped.
export function iconize(html) {
  return String(html).replace(EMOJI_RE, (e) => icon(EMOJI_ICON[e], 'inline')).replace(/\p{Extended_Pictographic}\uFE0F?/gu, '');
}

// Swap every <i data-ic="name"> placeholder under `root` for its SVG.
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-ic]')) el.outerHTML = icon(el.dataset.ic, el.className);
}
