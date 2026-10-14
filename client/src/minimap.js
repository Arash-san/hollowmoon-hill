// Always-on mini-map in the top-right corner, like GTA: it turns with the camera so "up" is where you are looking.
// It draws the illustrated map (mapart.js) around you, with icons for places, NPCs, the photo booth, live boss
// fights, other players and the quest you are tracking.
import { ZONES, NPCS, PHOTO_BOOTH, BOSSES } from '../../shared/world.js';
import { NPC_ICON } from './ui.js';
import { iconImage } from './icons.js';
import { mapArt, toArt, ART, SPAN } from './mapart.js';

export const ZONE_ICON = { plaza: 'plaza', graveyard: 'graveyard', arena: 'arena', circle: 'circle', patch: 'patch', cottage: 'cottage', woods: 'woods', market: 'market', dance: 'dance', lake: 'lake' };
const RANGE = 44; // metres from the centre to the edge of the mini-map

export class MiniMap {
  constructor(game, el) {
    this.game = game;
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.at = 0;
  }

  update(now) {
    const g = this.game;
    if (!g.me || now - this.at < 80) return;
    this.at = now;
    const c = this.canvas, x = this.ctx;
    const S = c.width, H = S / 2, R = H - 4;
    const ppm = R / RANGE; // pixels per metre
    const me = g.me.pos;
    const yaw = g.ctrl.camYaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // camera forward on the ground
    const rx = -fz, rz = fx; // camera right
    // world offset -> mini-map pixels
    const P = (wx, wz) => {
      const dx = wx - me.x, dz = wz - me.z;
      return [H + (dx * rx + dz * rz) * ppm, H - (dx * fx + dz * fz) * ppm];
    };
    const ic = (name, px, py, size) => {
      const im = iconImage(name);
      if (im?.complete) x.drawImage(im, px - size / 2, py - size / 2, size, size);
    };
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath();
    x.arc(H, H, R, 0, Math.PI * 2);
    x.clip();
    x.fillStyle = '#1a2c24';
    x.fillRect(0, 0, S, S);
    // the map art, rotated and centred on you (art px -> mini-map px)
    const s = ppm * (SPAN / ART);
    const ax = toArt(me.x), az = toArt(me.z);
    const a = rx * s, b = -fx * s, cc = rz * s, d = -fz * s;
    x.setTransform(a, b, cc, d, H - (a * ax + cc * az), H - (b * ax + d * az));
    x.drawImage(mapArt(g.world), 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    // place icons (upright, so they stay readable while the map turns)
    for (const [k, z] of Object.entries(ZONES)) {
      const [px, py] = P(z.x, z.z);
      if (Math.hypot(px - H, py - H) < R + 20) ic(ZONE_ICON[k], px, py, S * 0.13);
    }
    for (const l of g.world.features.landmarks) {
      const [px, py] = P(l.x, l.z);
      if (Math.hypot(px - H, py - H) < R + 20) ic(l.icon, px, py, S * 0.12);
    }
    // live boss fights
    for (const [id, st] of [['king', g.bossState?.state], ['mayor', g.finaleState?.state]]) {
      if (!st || st === 'idle' || st === 'defeated') continue;
      const A = BOSSES[id].center;
      const [px, py] = P(A.x, A.z);
      x.strokeStyle = '#ff4f2a';
      x.lineWidth = 5;
      x.beginPath();
      x.arc(px, py, A.r * ppm + 4 + Math.sin(now / 180) * 3, 0, Math.PI * 2);
      x.stroke();
    }
    for (const [id, n] of Object.entries(NPCS)) {
      if (id === 'mayor' && g.finaleState?.state && !['idle', 'defeated'].includes(g.finaleState.state)) continue;
      ic(NPC_ICON[id], ...P(n.x, n.z), S * 0.1);
    }
    {
      const [px, py] = P(PHOTO_BOOTH.x, PHOTO_BOOTH.z);
      x.fillStyle = '#ff4f8b';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(px, py, S * 0.05, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      ic('camera', px, py, S * 0.07);
    }
    for (const o of g.others.values()) {
      const [px, py] = P(o.pos.x, o.pos.z);
      x.fillStyle = o.down ? '#ff4f6b' : o.teamColor || '#9ef0ff';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 2.5;
      x.beginPath();
      x.arc(px, py, S * 0.024, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
    x.restore();

    // the tracked quest: a pin, or an arrow on the rim when it is out of range
    const tgt = g.trackTarget?.();
    if (tgt) {
      let [px, py] = P(tgt.x, tgt.z);
      const dd = Math.hypot(px - H, py - H);
      if (dd > R - 14) {
        px = H + ((px - H) / dd) * (R - 14);
        py = H + ((py - H) / dd) * (R - 14);
      }
      const pulse = 1 + Math.sin(now / 200) * 0.1;
      ic('pin', px, py - S * 0.03, S * 0.15 * pulse);
    }

    // you: an arrow in the middle pointing where your character faces
    const my = g.me.yaw;
    const vx = Math.sin(my), vz = Math.cos(my);
    const ang = Math.atan2(vx * rx + vz * rz, vx * fx + vz * fz);
    x.save();
    x.translate(H, H);
    x.rotate(ang);
    x.fillStyle = '#ffd23f';
    x.strokeStyle = '#1c0f2b';
    x.lineWidth = 3.5;
    x.beginPath();
    x.moveTo(0, -S * 0.065);
    x.lineTo(S * 0.046, S * 0.046);
    x.lineTo(0, S * 0.02);
    x.lineTo(-S * 0.046, S * 0.046);
    x.closePath();
    x.fill();
    x.stroke();
    x.restore();

    // rim and the north marker
    x.strokeStyle = '#1c0f2b';
    x.lineWidth = 6;
    x.beginPath();
    x.arc(H, H, R, 0, Math.PI * 2);
    x.stroke();
    const nx = -rz, ny = fz; // world north (0,-1) in mini-map pixels: (0*rx + -1*rz, -(0*fx + -1*fz))
    const nl = Math.hypot(nx, ny) || 1;
    const kx = H + (nx / nl) * (R - 4), ky = H + (ny / nl) * (R - 4);
    x.fillStyle = '#ff7a1a';
    x.beginPath();
    x.arc(kx, ky, S * 0.055, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = '#1c0f2b';
    x.font = `700 ${Math.round(S * 0.07)}px Fredoka, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('N', kx, ky + 1);
  }
}
