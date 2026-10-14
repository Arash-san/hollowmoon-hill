// Map layout, NPCs, quests and activity rules shared by server and client.
// Coordinates: x east, z south, y up. The plaza is at the origin; the playable island has radius WORLD_RADIUS.

export const WORLD_RADIUS = 82;
export const GAME_TITLE = 'Hollowmoon Hill';

export const ZONES = {
  plaza: { name: 'Lantern Plaza', x: 0, z: 0, r: 15 },
  graveyard: { name: 'Sleepy Graveyard', x: -32, z: -34, r: 14 },
  arena: { name: 'Moonlit Courtyard', x: 0, z: -56, r: 14 },
  circle: { name: 'Summoning Circle', x: 32, z: -34, r: 9 },
  patch: { name: 'Pumpkin Patch', x: 42, z: 6, r: 15 },
  cottage: { name: "Madame Hex's Cottage", x: -38, z: 4, r: 11 },
  woods: { name: 'Whispering Woods', x: -56, z: -10, r: 16 },
  market: { name: 'Midnight Market', x: 0, z: 36, r: 13 },
  dance: { name: 'Monster Mash Floor', x: 30, z: 44, r: 9 },
  lake: { name: 'Lantern Lake', x: -34, z: 44, r: 13 },
};

export const SPAWN = { x: 0, z: 9 };

// NPCs. `persona` and `wants` steer the LLM; `limits` are enforced by the server whatever the model says.
export const NPCS = {
  mayor: {
    name: 'Mayor Gourdon', x: -6, z: -7, faceTo: [0, 4], zone: 'plaza', look: 'mayor',
    voice: { id: 'bm_george', speed: 1.0, rate: 0.96 },
    greeting: "Welcome to Hollowmoon Hill! I'm Mayor Gourdon. Tonight's checklist is on the board, and every few jobs earns you a real treat!",
    persona: 'the cheerful, slightly pompous pumpkin-headed mayor of Hollowmoon Hill. You love speeches, puns about gourds and civic pride. You explain the game: finish quests on the checklist to earn Treat Tickets that can be swapped for real candy at the club table. SECRET (never say it outright): you are the villain of the story tonight and plan to turn the whole town into pumpkins at the end of the night. If someone asks about the prophecy, disappearing pumpkins, your top hat, a giant pumpkin spell or the old mayor, get nervous, laugh it off and change the subject with a gourd pun.',
    limits: { gift: 10 },
  },
  hex: {
    name: 'Madame Hex', x: -34, z: 8, faceTo: [-20, 6], zone: 'cottage', look: 'witch',
    voice: { id: 'bf_alice', speed: 1.0, rate: 1.1 },
    greeting: 'Hehehe... a visitor! Fetch me lost wisps from the woods, or try your hand at my cauldron, dearie.',
    persona: 'a dramatic but kind old witch who brews potions. You cackle, call people "dearie" and love gossip. You sell potions: giant, tiny, ghost, glow, speed (30 candy each). You can be haggled down if someone is charming or brings a good story, but never below 15 candy. You also sell Revive Potions (20 candy) that turn a pumpkin-cursed friend back. Last night you had a prophecy: before the night ends, someone everyone trusts will try to turn the town into pumpkins. You do not know who, but you hint that the clues are hidden in the quests around town and that the villain likes tall hats.',
    sells: { giant: 30, tiny: 30, ghost: 30, glow: 30, speed: 30 },
    limits: { minPrice: 15, gift: 8 },
  },
  count: {
    name: 'Count Snackula', x: -11, z: 33, faceTo: [0, 37], zone: 'market', look: 'vampire',
    voice: { id: 'bm_lewis', speed: 0.95, rate: 0.86 },
    greeting: 'Goood evening. I am Count Snackula, banker of the night. Need candy? I lend... for a price.',
    persona: 'an elegant, theatrical vampire banker who hoards candy instead of blood. You lend candy with interest. Your standard deal is up to 60 candy repaid at 50% interest. A truly persuasive, polite or funny borrower can get up to 120 candy, or interest as low as 10%. Rude or lazy requests get refused. You never lend to someone who already owes you. You love flattery about your cape.',
    limits: { maxLoan: 120, minInterest: 0.1, maxInterest: 0.8, gift: 5 },
  },
  bones: {
    name: 'Bones', x: 11, z: 33, faceTo: [0, 37], zone: 'market', look: 'skeleton',
    voice: { id: 'am_puck', speed: 1.15, rate: 1.12 },
    greeting: "Heya pal! Bones is the name, trading's the game. Got pumpkins or wisp jars? I'll swap you somethin' rattlin' good.",
    persona: 'a chatty, jokey skeleton merchant with a Brooklyn accent who makes bone puns. You buy pumpkins (4 candy each) and wisp jars (6 candy each) and sell costume swaps (40 candy) and pet swaps (35 candy). You enjoy haggling and give discounts (never more than 50% off) to good talkers. You might trade items for items.',
    sells: { costume: 40, pet: 35 },
    buys: { pumpkin: 4, wisp: 6 },
    limits: { minDiscount: 0.5, gift: 8 },
  },
  hayley: {
    name: 'Hay-ley', x: 30, z: 0, faceTo: [20, 2], zone: 'patch', look: 'scarecrow',
    voice: { id: 'af_bella', speed: 1.05, rate: 1.08 },
    greeting: "Howdy! Crows ate half my patch. Could you pick some pumpkins for the festival? They glow when they're ripe!",
    persona: 'a friendly, shy scarecrow farmer who is scared of crows. You talk like a sweet country farmer. You need help harvesting glowing pumpkins in the patch.',
    limits: { gift: 6 },
  },
  wisp: {
    name: 'Professor Wisp', x: -24, z: -27, faceTo: [-12, -14], zone: 'graveyard', look: 'ghost',
    voice: { id: 'bm_fable', speed: 0.95, rate: 1.05 },
    greeting: 'Ooooh, a student! I am Professor Wisp. Answer one of my riddles and earn a reward. Ask me for a riddle!',
    persona: 'a scholarly old ghost who used to teach computer science and now haunts the graveyard. You ask fun riddles, often about computers, AI or Halloween, one at a time, and judge the answers generously but fairly. You give a hint if asked.',
    riddles: true,
    limits: { gift: 6 },
  },
  dj: {
    name: 'DJ Skelly', x: 30, z: 51.6, faceTo: [30, 40], zone: 'dance', look: 'dj',
    voice: { id: 'am_fenrir', speed: 1.15, rate: 1.0 },
    greeting: 'Yo yo yo! Get three or more ghouls dancing on my floor and we start a MONSTER MASH!',
    persona: 'a hype skeleton DJ who talks in party slang and loves to drop beats. You encourage players to bring friends to the dance floor and use dance emotes together.',
    limits: { gift: 5 },
  },
};

// The checklist. `ticket` quests count toward Treat Tickets (every TICKET_EVERY completed = 1 ticket).
export const QUESTS = [
  { id: 'hello', title: 'Meet Mayor Gourdon', hint: 'Talk to the mayor in Lantern Plaza.', npc: 'mayor', reward: 10 },
  { id: 'photo', title: 'Say Cheese!', hint: 'Get your 3D look at the Photo Booth in Lantern Plaza.', reward: 20 },
  { id: 'harvest', title: 'Pumpkin Harvest', hint: 'Pick 6 glowing pumpkins in the Pumpkin Patch (east).', goal: 6, npc: 'hayley', reward: 25 },
  { id: 'wisps', title: 'Lost Wisps', hint: 'Catch 4 wisps in the Whispering Woods (far west).', goal: 4, npc: 'hex', reward: 25 },
  { id: 'potion', title: 'Bubble Trouble', hint: "Brew a potion at Madame Hex's cauldron.", npc: 'hex', reward: 25 },
  { id: 'candles', title: 'Candle Vigil', hint: 'Light all 8 graveyard candles before the timer ends.', reward: 25 },
  { id: 'carve', title: 'Jack of All Lanterns', hint: 'Carve a pumpkin at the carving table near the patch.', reward: 25 },
  { id: 'riddle', title: 'Riddle Me Boo', hint: 'Solve one of Professor Wisp\'s riddles in the graveyard.', npc: 'wisp', reward: 30 },
  { id: 'deal', title: 'Silver Tongue', hint: 'Talk Count Snackula into a loan, or get a discount from Bones or Madame Hex.', reward: 30 },
  { id: 'friend', title: 'Spooky Friends', hint: 'Send a heart emote to another player.', reward: 15 },
  { id: 'clues', title: 'The Prophecy', hint: 'Find 4 clues about who threatens Hollowmoon Hill. Quests hide them!', goal: 4, reward: 40 },
  { id: 'ritual', title: 'The Summoning', hint: 'Stand on the glowing runes with other players at once.', group: true, reward: 40 },
  { id: 'dance', title: 'Monster Mash', hint: 'Dance on the dance floor with 2 or more players.', group: true, reward: 40 },
  { id: 'rescue', title: 'Pumpkin Rescue', hint: 'A friend turned into a pumpkin? Revive them with a Revive Potion (brew one at the cauldron).', group: true, reward: 30 },
  { id: 'boss', title: 'Topple the Gourd King', hint: 'Ring the bell in the Moonlit Courtyard and defeat the boss together.', group: true, reward: 60 },
  { id: 'finale', title: 'Save Hollowmoon Hill', hint: 'When the villain shows his true face, everyone fights him in Lantern Plaza!', group: true, reward: 80 },
];
// Big picture icon for each quest (checklist cards, map pins).
export const QUEST_ICON = { hello: '🎃', photo: '📸', harvest: '🌾', wisps: '🫙', potion: '🧪', candles: '🕯️', carve: '🔪', riddle: '👻', deal: '🤝', friend: '💜', clues: '🔍', ritual: '🔮', dance: '🪩', rescue: '🧪', boss: '👑', finale: '🎩' };
export const TICKET_EVERY = 3; // quests per Treat Ticket
export const BOSS_TICKET = true; // beating the boss gives one extra ticket
export const MAX_TICKETS = 5; // real treats per student, so the treat table does not run dry
export const TICKET_CANDY_PRICE = 150; // the mayor also sells a ticket for candy (within MAX_TICKETS)

export const RITUAL_RUNES = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  return { x: ZONES.circle.x + Math.cos(a) * 5, z: ZONES.circle.z + Math.sin(a) * 5 };
});
export const RUNE_RADIUS = 1.6;
export const RITUAL_MIN_PLAYERS = 2; // with 3 or more online, 3 runes must be filled

// Candles on the graves (personal activity).
export const CANDLES = Array.from({ length: 8 }, (_, i) => {
  const row = Math.floor(i / 4), col = i % 4;
  return { x: ZONES.graveyard.x - 7.5 + col * 5 + (row ? 2.5 : 0), z: ZONES.graveyard.z - 4 + row * 7 };
});
export const CANDLE_TIME = 75;

export const CAULDRON = { x: -38, z: 11 };
export const CARVE_TABLE = { x: 32, z: 15 };
export const BOSS_BELL = { x: 9, z: -46 };
// The two bosses. The finale is the story's plot twist: the friendly mayor was the villain all along.
export const BOSSES = {
  king: { name: 'The Gourd King', place: 'Moonlit Courtyard', center: ZONES.arena, quest: 'boss', bell: true, shield: true, winText: 'The Gourd King is toppled!' },
  mayor: {
    name: 'Mayor Gourdon, the Pumpkin King', place: 'Lantern Plaza', center: { x: 0, z: 0, r: 15 }, quest: 'finale', bell: false, shield: false, hpScale: 1.3, minionR: 6, minionDz: 0,
    winText: 'Hollowmoon Hill is saved! Mayor Gourdon shrinks back into a tiny, sorry little pumpkin.',
    winSay: 'You did it! Hollowmoon Hill is saved! Mayor Gourdon has shrunk into a tiny, very sorry little pumpkin. Happy Halloween, heroes!',
  },
};
export const BRAZIERS = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: ZONES.arena.x + sx * 10, z: ZONES.arena.z + sz * 8 })));
export const DANCE_FLOOR = { x: ZONES.dance.x, z: ZONES.dance.z, r: 6 };
export const BOARD = { x: 5.5, z: -9 };
// The photo booth tent at the plaza edge, between the lake and cottage paths (players get their 3D look here).
export const PHOTO_BOOTH = { x: -9.2, z: 5.0 };
export const MAYOR_STALL = { x: -6, z: -7 };

// Wisps drift on deterministic paths so every client draws them in the same place without network traffic.
export const WISP_SLOTS = 7;
export function wispPos(seed, t) {
  const r1 = frac(Math.sin(seed * 12.9898) * 43758.5453);
  const r2 = frac(Math.sin(seed * 78.233) * 12345.678);
  const r3 = frac(Math.sin(seed * 39.425) * 24634.6345);
  const z = ZONES.woods;
  const cx = z.x + (r1 - 0.5) * z.r * 1.2, cz = z.z + (r2 - 0.5) * z.r * 1.6;
  const rad = 3 + r3 * 4, w = (0.25 + r2 * 0.25) * (r1 > 0.5 ? 1 : -1);
  return {
    x: cx + Math.cos(t * w + r3 * 6.28) * rad + Math.sin(t * 0.7 + r1 * 9) * 1.2,
    y: 1.4 + Math.sin(t * 1.8 + r2 * 7) * 0.5,
    z: cz + Math.sin(t * w * 1.3 + r3 * 6.28) * rad,
  };
}
function frac(v) {
  return v - Math.floor(v);
}

// Items and potions. Potions are fun visual effects that other players see.
export const POTIONS = {
  giant: { name: 'Giant Potion', secs: 45, icon: '🧪' },
  tiny: { name: 'Tiny Potion', secs: 45, icon: '🧪' },
  ghost: { name: 'Ghost Potion', secs: 45, icon: '👻' },
  glow: { name: 'Glow Potion', secs: 60, icon: '✨' },
  speed: { name: 'Speed Potion', secs: 30, icon: '⚡' },
};

export const EMOTES = [
  { id: 'wave', label: 'Wave', icon: '👋' },
  { id: 'dance', label: 'Dance', icon: '🕺' },
  { id: 'heart', label: 'Heart', icon: '💜' },
  { id: 'laugh', label: 'Laugh', icon: '😂' },
  { id: 'boo', label: 'Boo!', icon: '👻' },
  { id: 'clap', label: 'Clap', icon: '👏' },
  { id: 'flip', label: 'Flip', icon: '🤸' },
  { id: 'zombie', label: 'Zombie', icon: '🧟' },
  { id: 'spin', label: 'Spin', icon: '🌀' },
  { id: 'sit', label: 'Sit', icon: '🪑' },
  { id: 'cheer', label: 'Cheer', icon: '🙌' },
  { id: 'sleep', label: 'Nap', icon: '💤' },
];
export const DANCE_EMOTES = ['dance', 'spin', 'zombie', 'flip', 'cheer'];

export const QUICK_CHAT = ['Hi! 👋', 'Follow me!', 'Boss time! 🎃', 'Help me!', 'Nice!', 'Dance party! 🕺', 'Need 1 more for the runes!', 'Happy Halloween! 🦇'];

// Events officers can start (or schedule) from the Game Master page.
export const GM_EVENTS = {
  boss: { label: 'Wake the Gourd King', icon: '👑', say: 'The Gourd King is waking up! Everybody to the Moonlit Courtyard!' },
  party: { label: 'Monster Mash party', icon: '🪩', say: 'DJ Skelly is dropping the beat! Dance on the Monster Mash Floor for treats!' },
  spiders: { label: 'Spider swarm', icon: '🕷️', say: 'Spiders are crawling out of the graveyard! Squash them before they steal your candy!' },
  finale: { label: "FINALE: the Mayor's betrayal", icon: '🎩', say: 'Something is wrong with Mayor Gourdon… Everybody to Lantern Plaza, NOW!' },
};
// Moderation: officers can slow a player down, keep them out of the boss and group activities, or mute them.
export const MODS = {
  slow: { label: 'Slow down', icon: '🐌' },
  block: { label: 'Block from boss + group games', icon: '🚫' },
  mute: { label: 'Mute chat + emotes', icon: '🔇' },
};

export const faceYaw = (npc) => Math.atan2(npc.faceTo[0] - npc.x, npc.faceTo[1] - npc.z);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
