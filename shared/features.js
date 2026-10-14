// v3 features from the Oct 14 officer meeting: classes, the Gloom Manor team room, the carving contest,
// arena duels, team colours and the Pumpkin Bear. Shared by server and client.

// ---------------------------------------------------------------- classes (picked at the start, or read from a real costume)
export const CLASSES = {
  witch: { name: 'Witch', icon: 'hex', power: 'Fireball', cd: 6, hp: 100, desc: 'Hurl a big fireball (3x damage) every 6 seconds.' },
  vampire: { name: 'Vampire', icon: 'count', power: 'Bat Dash', cd: 8, hp: 100, desc: 'Dash forward in a cloud of bats and heal a little, every 8 seconds.' },
  zombie: { name: 'Zombie', icon: 'zombie', power: 'Groan', cd: 10, hp: 150, desc: 'Tougher (150 health). Groan to scare away spiders and minions around you.' },
};
// words in the photo booth's costume description -> class
export function classFromCostume(words) {
  const w = String(words || '').toLowerCase();
  if (/witch|wizard|sorcer|mage|warlock|fairy|magic/.test(w)) return 'witch';
  if (/vampire|dracula|bat|count/.test(w)) return 'vampire';
  if (/zombie|skelet|mummy|ghoul|undead|corpse|frankenstein|monster/.test(w)) return 'zombie';
  return null;
}

// ---------------------------------------------------------------- Gloom Manor: a team room for 2-4 players
// The room is built far outside the island (players in other rooms are hidden). A colour code of 4 plates must be
// stepped on in order; each player only sees part of the code, so the team has to talk.
export const MANOR_DOOR = { x: 0, z: -73 };
export const ROOM = { x: 420, z: 0, w: 22, d: 18 };
export const ROOM_SPAWN = { x: ROOM.x, z: ROOM.z + 4 };
export const ROOM_MIN = 2, ROOM_MAX = 4;
export const PLATE_COLORS = [
  { id: 'red', name: 'Red', hex: '#ff4f6b' },
  { id: 'green', name: 'Green', hex: '#5ad67a' },
  { id: 'blue', name: 'Blue', hex: '#4f8bff' },
  { id: 'gold', name: 'Gold', hex: '#ffd23f' },
];
export const PLATES = PLATE_COLORS.map((c, i) => ({ ...c, x: ROOM.x - 7.5 + i * 5, z: ROOM.z - 2, r: 1.4 }));
export const ROOM_EXIT = { x: ROOM.x, z: ROOM.z + 8.2 };
export const inRoomArea = (x) => x > 300;

// ---------------------------------------------------------------- team colours (the "LED" on your screen)
export const TEAM_COLORS = ['#ff7a1a', '#7b4dff', '#2ec4b6', '#ff4f8b', '#ffd23f', '#4f8bff', '#8ac926', '#b78bff'];

// ---------------------------------------------------------------- carving contest
export const CONTEST_SECONDS = 60;
export const STENCILS = ['classic', 'cat', 'ghost', 'bat', 'stars', 'grin'];
