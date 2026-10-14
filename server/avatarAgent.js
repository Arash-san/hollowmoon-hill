// Photo -> avatar design. Photos never leave this PC and are not kept.
//
// 1. A local vision model (Qwen3-VL 8B instruct) describes the person: hair (style, length, colour in words),
//    skin tone in words, clothing, and every piece of a real costume they are wearing (hat, mask, cape, wings,
//    face paint, skeleton print...), with colours in words, plus boxes around the face, hair and clothes.
// 2. Colour names are turned into colours, then refined with the photo's own pixels: inside each box we keep only
//    the pixels close to the named colour (so a black witch hat cannot turn red hair black, and a mask cannot darken
//    the skin), and take their median.
// 3. The answer is mapped onto the avatar spec (shared/avatar.js) and cleaned, so the browser can always build it.
import sharp from 'sharp';
import { cleanAvatar, COSTUMES, PETS, HAIR_STYLES, TOPS, PATTERNS, FACIAL_HAIR, GLASSES, EYE_STYLES, BACKS, FACE_ITEMS } from '../shared/avatar.js';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11445';
export const VISION_MODEL = process.env.VISION_MODEL || 'qwen3-vl:8b-instruct';

const HEAD_ITEMS = COSTUMES.filter((c) => !['vampire_cape', 'bat_wings'].includes(c));

const PROMPT = `You turn party photos into cute chibi 3D game characters for a Halloween game. Look carefully at the main person.
Copy what they REALLY look like and what they are REALLY wearing. Reply with this JSON only (values from the [options] where given):
{
 "face": [x1,y1,x2,y2] box around their face only (0-1000 scale),
 "hair_box": [x1,y1,x2,y2] box around their visible HAIR only, not a hat (0-1000 scale; [0,0,0,0] if no hair shows),
 "shirt": [x1,y1,x2,y2] box around their main top or costume body (0-1000 scale),
 "hair_style": [${HAIR_STYLES.join(', ')}],
 "hair_color": a simple colour name for the HAIR itself, e.g. "black", "dark brown", "brown", "light brown", "auburn", "ginger", "bright red", "blonde", "platinum blonde", "grey", "white", "bright blue", "pink", "purple", "green",
 "skin_tone": [very light, light, light medium, medium, tan, medium brown, brown, dark brown, deep],
 "facial_hair": [${FACIAL_HAIR.join(', ')}],
 "glasses": [${GLASSES.join(', ')}],
 "eyes": [${EYE_STYLES.join(', ')}] matching their expression,
 "top": [${TOPS.join(', ')}],
 "top_color": colour name of the top, "top_accent": colour name of its second colour (collar, stripes, print),
 "top_pattern": [${PATTERNS.join(', ')}] ("bones" for a skeleton print, "star" for a big emblem, "bandage" for mummy wraps),
 "headwear": [none, cap, beanie] everyday hats only,
 "head_costume": [${HEAD_ITEMS.join(', ')}] the costume piece they wear on their head, "none" if nothing,
 "head_costume_color": colour name of that piece,
 "back": [${BACKS.join(', ')}] a cape or wings they wear,
 "back_color": colour name of the cape/wings outside, "back_lining": colour name of the cape inside/collar,
 "face_item": [${FACE_ITEMS.join(', ')}] mask, eyepatch, painted whiskers, skull face paint or fangs they show,
 "face_item_color": colour name of a mask,
 "costume": short words for their whole costume, e.g. "witch", "vampire", "pirate", "superhero", or "none",
 "pet": [${PETS.join(', ')}] a tiny companion that fits their costume,
 "title": a kind, playful 2 to 4 word nickname that fits their costume, such as "Moonlit Pirate"
}
Rules: "headscarf" if they wear a hijab or head scarf (cat ears or a hat can still go on top as head_costume). "bald" only when no hair shows at all.
Long hair past the shoulders is "long", "long_wavy" or "long_curly"; hair combed straight back is "slicked". Only list costume pieces you can actually see; everyday clothes mean "none".
The title must never mention body, age, race or anything unkind.`;

// colour words -> colours (the pixels then pick the exact shade)
const COLOURS = {
  black: '#16131a', 'jet black': '#0f0d12', 'dark brown': '#3b2416', brown: '#6b4428', 'light brown': '#9a6b43', chestnut: '#7a3f22', auburn: '#8a3324',
  ginger: '#c4622d', red: '#c62f2f', 'bright red': '#d23a2a', copper: '#b8642f', strawberry: '#d98a5a', blonde: '#e3c27a', 'dark blonde': '#b89156', 'golden blonde': '#e0b55a',
  'platinum blonde': '#f1e6c2', platinum: '#f1e6c2', grey: '#9a9aa0', gray: '#9a9aa0', silver: '#c9cbd2', white: '#f2f0ea', 'off white': '#eae4d6', cream: '#efe4c8',
  blue: '#2f6fd6', 'bright blue': '#1f5ef0', 'dark blue': '#1d3a7a', navy: '#1b2550', 'light blue': '#8ec3f0', teal: '#1f9a96', turquoise: '#2ec4b6', cyan: '#3fd0e8',
  green: '#3c9a48', 'dark green': '#1f5a2c', 'light green': '#8bd38a', lime: '#9ad03a', olive: '#6b6b2c', yellow: '#f2cf3a', gold: '#e0b33a', orange: '#ef7a22',
  pink: '#f08cb4', 'hot pink': '#ff4f8b', magenta: '#d0349a', purple: '#7a3fb8', 'dark purple': '#3f1f63', lavender: '#b7a0e8', violet: '#8a4fd8', maroon: '#6a1f2a',
  'dark red': '#8a1f22', crimson: '#b5172e', beige: '#d8c3a0', tan: '#c49a6a', khaki: '#b7a77a', charcoal: '#3a3a40', 'dark grey': '#4a4a52', 'dark gray': '#4a4a52',
};
const SKIN = {
  'very light': '#ffe0c7', light: '#f6cdb0', 'light medium': '#e8b48f', medium: '#d79d74', tan: '#c48a5c', 'medium brown': '#a8704a', brown: '#8a5636', 'dark brown': '#6a3f26', deep: '#4f2f1c',
};

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function nameToHex(name, table = COLOURS) {
  if (typeof name !== 'string') return null;
  const n = name.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  if (table[n]) return table[n];
  // longest known colour phrase inside the answer ("dark brown curly" -> "dark brown")
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  const k = keys.find((key) => n.includes(key));
  return k ? table[k] : null;
}

// Median of the pixels in a box (0-1000 units) that are close to `near` (rgb), within `tol` (sum of channel diffs).
// Falls back to the plain median if too few pixels match.
function sample(px, w, h, box, near, { inset = [0, 0, 1, 1], tol = 140, exclude = null } = {}) {
  if (!Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== 'number')) return null;
  let [x1, y1, x2, y2] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  if (x2 - x1 < 0.01 || y2 - y1 < 0.01) return null;
  const bw = x2 - x1, bh = y2 - y1;
  [x1, x2] = [x1 + bw * inset[0], x1 + bw * inset[2]];
  [y1, y2] = [y1 + bh * inset[1], y1 + bh * inset[3]];
  const ex = Array.isArray(exclude) && exclude.length === 4 ? exclude.map((v) => v / 1000) : null;
  const all = [], close = [];
  for (let y = Math.floor(y1 * h); y < Math.ceil(y2 * h); y += 2)
    for (let x = Math.floor(x1 * w); x < Math.ceil(x2 * w); x += 2) {
      if (ex && x / w > ex[0] && x / w < ex[2] && y / h > ex[1] && y / h < ex[3]) continue;
      const i = (y * w + x) * 3;
      const p = [px[i], px[i + 1], px[i + 2]];
      all.push(p);
      if (near && Math.abs(p[0] - near[0]) + Math.abs(p[1] - near[1]) + Math.abs(p[2] - near[2]) < tol) close.push(p);
    }
  const pool = close.length >= 20 ? close : near ? null : all;
  if (!pool || pool.length < 12) return null;
  const med = (k) => pool.map((p) => p[k]).sort((a, b) => a - b)[pool.length >> 1];
  return [med(0), med(1), med(2)];
}

// Game-friendly colour: phone photos are dim and grey under room lights, so lift and saturate a little.
function stylise(rgb, { lift = 1.12, sat = 1.15, min = 0 } = {}) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0, s = 0, l = (max + mn) / 2;
  if (max !== mn) {
    const d = max - mn;
    s = l > 0.5 ? d / (2 - max - mn) : d / (max + mn);
    hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  s = Math.min(1, s * sat);
  l = Math.max(min, Math.min(0.92, l * lift));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);

// The named colour, nudged toward what the pixels say (the name decides the family, the photo the exact shade).
function colourFrom(px, w, h, box, name, { table = COLOURS, inset, tol = 150, exclude, trust = 0.6, look } = {}) {
  const base = nameToHex(name, table);
  const named = base ? rgbOf(base) : null;
  // black, grey and white only name the family (charcoal is "grey"): if the region really is colourless, trust its
  // brightness from the pixels
  const flat = (c) => Math.max(...c) - Math.min(...c) < 36;
  if (named && flat(named) && table === COLOURS) {
    const whole = sample(px, w, h, box, null, { inset, exclude });
    if (whole && flat(whole)) return hex(stylise(whole, look));
  }
  const seen = sample(px, w, h, box, named, { inset, tol, exclude });
  if (named && seen) return hex(stylise(mix(named, seen, trust), look));
  if (named) return base;
  if (seen) return hex(stylise(seen, look));
  return undefined;
}

function extractJson(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) {
      try {
        return JSON.parse(s.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const lower = (v) => (typeof v === 'string' ? v.toLowerCase().trim().replace(/[\s-]+/g, '_') : v);

export async function designAvatar(photo, seed, { model = VISION_MODEL, timeoutMs = 120000 } = {}) {
  const started = Date.now();
  // Normalise: rotate by EXIF, cap the size (the pixels we sample match what the model saw).
  const img = sharp(photo).rotate().resize(896, 896, { fit: 'inside' });
  const jpeg = await img.clone().jpeg({ quality: 90 }).toBuffer();
  const { data: px, info } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: -1,
      format: 'json',
      options: { temperature: 0.15, num_ctx: 6144, num_predict: 700 },
      messages: [{ role: 'user', content: PROMPT, images: [jpeg.toString('base64')] }],
    }),
  });
  if (!res.ok) throw new Error(`vision model HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const raw = extractJson(body.message?.content) || extractJson(body.message?.thinking);
  if (!raw) throw new Error('vision model gave no JSON');

  const { width: w, height: h } = info;
  let hairStyle = lower(raw.hair_style);
  // "bald" but they named a hair colour: very short or receding hair, which reads better as a buzz cut
  const namedHair = nameToHex(raw.hair_color);
  if (hairStyle === 'bald' && namedHair) hairStyle = 'buzz';
  const headscarf = hairStyle === 'headscarf';
  // skin: the cheeks and nose band, only pixels near the named tone (masks and paint are skipped)
  const skin = colourFrom(px, w, h, raw.face, raw.skin_tone, { table: SKIN, inset: [0.25, 0.42, 0.75, 0.68], tol: 120, trust: 0.55, look: { lift: 1.1, sat: 1.0, min: 0.25 } })
    || colourFrom(px, w, h, raw.face, null, { inset: [0.3, 0.4, 0.7, 0.62], look: { lift: 1.12, sat: 1.0, min: 0.25 } });
  // hair: the hair box minus the face, only pixels near the named hair colour
  const hair = hairStyle === 'bald' ? undefined : colourFrom(px, w, h, raw.hair_box, raw.hair_color, { exclude: raw.face, tol: 150, trust: 0.5, look: { lift: 1.08, sat: 1.15 } });
  const top = colourFrom(px, w, h, raw.shirt, raw.top_color, { inset: [0.25, 0.15, 0.75, 0.85], tol: 140, trust: 0.6 });
  const accent = colourFrom(px, w, h, raw.shirt, raw.top_accent, { tol: 120, trust: 0.4, look: { lift: 1.2 } });
  const headC = nameToHex(raw.head_costume_color);
  const backC = colourFrom(px, w, h, raw.shirt, raw.back_color, { tol: 120, trust: 0.4 });
  const backL = nameToHex(raw.back_lining);
  const faceC = nameToHex(raw.face_item_color);

  let costume = lower(raw.head_costume);
  let back = lower(raw.back);
  // a cape or bat wings worn on the back also fit the old single costume slot
  if (!COSTUMES.includes(costume) || costume === 'vampire_cape' || costume === 'bat_wings') costume = 'none';
  if (!BACKS.includes(back)) back = 'none';
  const spec = {
    skin,
    hair: { style: hairStyle, color: headscarf ? (nameToHex(raw.hair_color) || hair) : hair },
    facialHair: lower(raw.facial_hair),
    eyes: { style: lower(raw.eyes), color: '#2b1a12' },
    glasses: lower(raw.glasses),
    top: { type: lower(raw.top), color: top, accent, pattern: lower(raw.top_pattern) },
    headwear: lower(raw.headwear),
    costume,
    costumeColor: headC || undefined,
    back,
    backColor: backC,
    backLining: backL || undefined,
    face: lower(raw.face_item),
    faceColor: faceC || undefined,
    pet: lower(raw.pet),
    title: raw.title,
  };
  // a print has to stand out from the shirt, or it disappears on the 3D character
  const lum = (h) => (h ? rgbOf(h).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0) / 255 : 0.5);
  const pat = spec.top.pattern;
  if (['bones', 'star', 'stripes', 'bandage', 'dots', 'zigzag'].includes(pat) && Math.abs(lum(spec.top.accent) - lum(spec.top.color)) < 0.3) {
    spec.top.accent = pat === 'bones' || pat === 'bandage' ? '#f2efe6' : pat === 'star' ? '#ffd23f' : lum(spec.top.color) > 0.5 ? '#2a1d33' : '#f2efe6';
  }
  // nothing costume-like at all: give them a fun piece so everyone looks Halloween-ready
  const noCostume = spec.costume === 'none' && spec.back === 'none' && (!spec.face || spec.face === 'none') && !['bones', 'star', 'bandage'].includes(spec.top.pattern);
  if (noCostume) spec.costume = undefined;
  return { avatar: cleanAvatar(spec, seed), raw, ms: Date.now() - started, model };
}
