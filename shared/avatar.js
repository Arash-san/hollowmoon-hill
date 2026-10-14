// Avatar design spec shared by the server (the photo agent fills it in) and the client (builds the 3D character).
// Every field is an enum or a colour, so a model reply can always be cleaned into something the builder can draw.

export const HAIR_STYLES = ['short', 'buzz', 'slicked', 'spiky', 'wavy', 'curly', 'afro', 'bob', 'long', 'long_wavy', 'long_curly', 'ponytail', 'bun', 'braids', 'mohawk', 'bald', 'headscarf'];
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard'];
export const GLASSES = ['none', 'round', 'square', 'sunglasses'];
export const TOPS = ['tshirt', 'hoodie', 'jacket', 'sweater', 'shirt', 'dress'];
export const PATTERNS = ['plain', 'stripes', 'dots', 'zigzag', 'bones', 'star', 'bandage'];
export const HEADWEAR = ['none', 'cap', 'beanie'];
// Head pieces (the costume slot). 'none' when someone's real costume has nothing on the head.
export const COSTUMES = ['witch_hat', 'wizard_hat', 'cat_ears', 'devil_horns', 'bat_wings', 'vampire_cape', 'pumpkin_crown', 'ghost_veil', 'skull_mask', 'bunny_ears', 'antennae', 'halo',
  'pirate_hat', 'top_hat', 'crown', 'cowboy_hat', 'bow', 'flower_crown', 'none'];
// What a random guest can get (the newer pieces come from real costumes in the booth).
const RANDOM_COSTUMES = COSTUMES.slice(0, 12);
// Worn on the back, and drawn on the face (the booth copies real costumes into these).
export const BACKS = ['none', 'cape', 'bat_wings', 'fairy_wings', 'angel_wings'];
export const FACE_ITEMS = ['none', 'eye_mask', 'eyepatch', 'whiskers', 'skull_paint', 'fangs', 'freckles'];
export const PETS = ['bat', 'ghost', 'pumpkin', 'black_cat', 'spider', 'candle'];
export const EYE_STYLES = ['round', 'happy', 'sleepy', 'sparkle'];

export const SKIN_TONES = ['#ffe0c7', '#f8cfae', '#eab48d', '#d49a6f', '#b97a50', '#96603d', '#714528', '#4f2f1c'];

const HEX = /^#[0-9a-f]{6}$/i;

const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
const colour = (value, fallback) => (typeof value === 'string' && HEX.test(value.trim()) ? value.trim().toLowerCase() : fallback);
const text = (value, max, fallback) => {
  const s = String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : fallback;
};

// Small seeded random so a player's default avatar stays the same between visits.
export function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRIGHT = ['#ff7a1a', '#7b4dff', '#2ec4b6', '#ff4f8b', '#ffd23f', '#3a86ff', '#8ac926', '#e63946', '#1d3557', '#f4a261'];
const HAIR_COLOURS = ['#1b1210', '#3b2416', '#6b3f1f', '#a9652f', '#d9a35b', '#f1d38a', '#b33a2b', '#7b4dff', '#e9e3dc'];

const GUEST_TITLES = ['Pumpkin Rookie', 'Night Wanderer', 'Candy Seeker', 'Moonlight Newbie', 'Lantern Bearer', 'Curious Ghoul', 'Midnight Snacker', 'Spooky Sprout', 'Cobweb Explorer', 'Little Boo'];

// A cute random avatar, used before the photo arrives and when the photo agent fails.
export function randomAvatar(seed) {
  const r = seeded(seed);
  const any = (list) => list[Math.floor(r() * list.length)];
  return cleanAvatar({
    skin: any(SKIN_TONES),
    hair: { style: any(HAIR_STYLES.filter((s) => s !== 'bald' && s !== 'headscarf')), color: any(HAIR_COLOURS) },
    facialHair: 'none',
    eyes: { style: any(EYE_STYLES), color: any(['#2b1a12', '#3d2a1c', '#2f4a6b', '#355e3b']) },
    glasses: r() < 0.25 ? any(['round', 'square']) : 'none',
    top: { type: any(TOPS.filter((t) => t !== 'dress')), color: any(BRIGHT), accent: any(BRIGHT), pattern: any(PATTERNS) },
    bottom: any(['#2b2d42', '#3d405b', '#5c4033', '#264653', '#1d1d1d']),
    shoes: any(['#1d1d1d', '#f1f1f1', '#8d5524', '#e63946']),
    headwear: 'none',
    costume: any(RANDOM_COSTUMES),
    pet: any(PETS),
    title: any(GUEST_TITLES),
  }, seed);
}

// Turn anything (model output, old saves) into a valid spec. Missing pieces come from the seeded default.
export function cleanAvatar(raw, seed = 'x') {
  const a = raw && typeof raw === 'object' ? raw : {};
  const r = seeded(seed + 'clean');
  const any = (list) => list[Math.floor(r() * list.length)];
  const hair = a.hair || {};
  const eyes = a.eyes || {};
  const top = a.top || {};
  return {
    skin: colour(a.skin, any(SKIN_TONES)),
    hair: { style: pick(HAIR_STYLES, hair.style, 'short'), color: colour(hair.color, '#3b2416') },
    facialHair: pick(FACIAL_HAIR, a.facialHair, 'none'),
    eyes: { style: pick(EYE_STYLES, eyes.style, 'round'), color: colour(eyes.color, '#2b1a12') },
    glasses: pick(GLASSES, a.glasses, 'none'),
    top: {
      type: pick(TOPS, top.type, 'tshirt'),
      color: colour(top.color, any(BRIGHT)),
      accent: colour(top.accent, any(BRIGHT)),
      pattern: pick(PATTERNS, top.pattern, 'plain'),
    },
    bottom: colour(a.bottom, '#2b2d42'),
    shoes: colour(a.shoes, '#1d1d1d'),
    headwear: pick(HEADWEAR, a.headwear, 'none'),
    costume: pick(COSTUMES, a.costume, any(RANDOM_COSTUMES)),
    costumeColor: colour(a.costumeColor, null),
    back: pick(BACKS, a.back, 'none'),
    backColor: colour(a.backColor, '#1b0f24'),
    backLining: colour(a.backLining, '#b5172e'),
    face: pick(FACE_ITEMS, a.face, 'none'),
    faceColor: colour(a.faceColor, '#1b1226'),
    pet: pick(PETS, a.pet, any(PETS)),
    title: text(a.title, 28, 'Mystery Guest'),
  };
}

// JSON schema handed to the vision model (Ollama structured output).
export const AVATAR_SCHEMA = {
  type: 'object',
  properties: {
    skin: { type: 'string', enum: SKIN_TONES },
    hair: { type: 'object', properties: { style: { type: 'string', enum: HAIR_STYLES }, color: { type: 'string' } }, required: ['style', 'color'] },
    facialHair: { type: 'string', enum: FACIAL_HAIR },
    eyes: { type: 'object', properties: { style: { type: 'string', enum: EYE_STYLES }, color: { type: 'string' } }, required: ['style', 'color'] },
    glasses: { type: 'string', enum: GLASSES },
    top: {
      type: 'object',
      properties: { type: { type: 'string', enum: TOPS }, color: { type: 'string' }, accent: { type: 'string' }, pattern: { type: 'string', enum: PATTERNS } },
      required: ['type', 'color', 'accent', 'pattern'],
    },
    bottom: { type: 'string' },
    shoes: { type: 'string' },
    headwear: { type: 'string', enum: HEADWEAR },
    costume: { type: 'string', enum: COSTUMES },
    pet: { type: 'string', enum: PETS },
    title: { type: 'string' },
  },
  required: ['skin', 'hair', 'facialHair', 'eyes', 'glasses', 'top', 'bottom', 'shoes', 'headwear', 'costume', 'pet', 'title'],
};
