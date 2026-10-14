// Always-on mini-map in the top-right corner, like GTA: it turns with the camera so "up" is where you are looking.
// Shows paths, places, the photo booth, NPCs, other players, live events and the quest you are tracking.
import { ZONES, NPCS, PHOTO_BOOTH, WORLD_RADIUS } from '../../shared/world.js';
import { NPC_ICON } from './ui.js';

export const ZONE_ICON = { plaza: '⛲', graveyard: '🪦', arena: '👑', circle: '🔮', patch: '🎃', cottage: '🧪', woods: '🌲', market: '🛍️', dance: '🪩', lake: '🏮' };
const RANGE = 42; // metres from the centre to the edge of the mini-map
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export class MiniMap {
  constructor(game, el) {
    this.game = game;
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.at = 0;
  }

  // world offset -> mini-map pixels (camera forward is up)
  project(dx, dz, fx, fz, scale) {
    const rx = -fz, rz = fx; // right of forward
    return [(dx * rx + dz * rz) * scale, -(dx * fx + dz * fz) * scale];
  }

  update(now) {
    const g = this.game;
    if (!g.me || now - this.at < 90) return;
    this.at = now;
    const c = this.canvas, x = this.ctx;
    const S = c.width, H = S / 2, R = H - 6;
    const scale = R / RANGE;
    const me = g.me.pos;
    const yaw = g.ctrl.camYaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const P = (wx, wz) => {
      const [px, py] = this.project(wx - me.x, wz - me.z, fx, fz, scale);
      return [H + px, H + py];
    };
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath();
    x.arc(H, H, R, 0, Math.PI * 2);
    x.clip();
    // ground and the edge of the island
    x.fillStyle = '#1a0f2e';
    x.fillRect(0, 0, S, S);
    const [ox, oy] = P(0, 0);
    x.fillStyle = '#2f4a3c';
    x.beginPath();
    x.arc(ox, oy, WORLD_RADIUS * scale, 0, Math.PI * 2);
    x.fill();
    // paths
    x.strokeStyle = 'rgba(160,140,138,.85)';
    x.lineWidth = Math.max(2, 2.8 * scale);
    x.lineCap = 'round';
    for (const p of g.world.paths) {
      x.beginPath();
      p.forEach(([px, pz], i) => (i ? x.lineTo(...P(px, pz)) : x.moveTo(...P(px, pz))));
      x.stroke();
    }
    // places
    for (const [k, z] of Object.entries(ZONES)) {
      const [px, py] = P(z.x, z.z);
      if (Math.hypot(px - H, py - H) > R + z.r * scale) continue;
      x.fillStyle = k === 'lake' ? 'rgba(50,80,170,.9)' : k === 'patch' ? 'rgba(120,84,56,.75)' : k === 'plaza' ? 'rgba(130,118,135,.75)' : 'rgba(255,244,227,.13)';
      x.beginPath();
      x.arc(px, py, z.r * scale, 0, Math.PI * 2);
      x.fill();
      x.font = `${Math.round(S * 0.085)}px ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(ZONE_ICON[k] || '•', px, py);
    }
    // live boss fight: a pulsing red ring
    const boss = g.bossState?.state;
    if (boss && !['idle', 'defeated'].includes(boss)) {
      const [px, py] = P(ZONES.arena.x, ZONES.arena.z);
      x.strokeStyle = '#ff4f2a';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(px, py, ZONES.arena.r * scale + 4 + Math.sin(now / 180) * 3, 0, Math.PI * 2);
      x.stroke();
    }
    // NPCs and the photo booth
    x.font = `${Math.round(S * 0.07)}px ${EMOJI}`;
    for (const [id, n] of Object.entries(NPCS)) x.fillText(NPC_ICON[id], ...P(n.x, n.z));
    const [bx, by] = P(PHOTO_BOOTH.x, PHOTO_BOOTH.z);
    x.fillStyle = '#ff4f8b';
    x.beginPath();
    x.arc(bx, by, S * 0.055, 0, Math.PI * 2);
    x.fill();
    x.font = `${Math.round(S * 0.07)}px ${EMOJI}`;
    x.fillText('📸', bx, by + 1);
    // other players
    for (const o of g.others.values()) {
      const [px, py] = P(o.pos.x, o.pos.z);
      x.fillStyle = o.teamColor || '#9ef0ff';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, S * 0.025, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
    x.restore();

    // tracked quest: a pin, or an arrow on the rim when it is out of range
    const tgt = g.trackTarget?.();
    if (tgt) {
      let [px, py] = P(tgt.x, tgt.z);
      const d = Math.hypot(px - H, py - H);
      const out = d > R - 12;
      if (out) {
        px = H + ((px - H) / d) * (R - 12);
        py = H + ((py - H) / d) * (R - 12);
      }
      const pulse = 1 + Math.sin(now / 200) * 0.12;
      x.fillStyle = '#ffd23f';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(px, py, S * 0.07 * pulse, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.font = `${Math.round(S * 0.08)}px ${EMOJI}`;
      x.fillText(tgt.icon || '📍', px, py + 1);
    }

    // me: an arrow in the middle pointing where my character faces
    const my = g.me.yaw;
    const [ax, ay] = this.project(Math.sin(my), Math.cos(my), fx, fz, 1);
    const ang = Math.atan2(ax, -ay);
    x.save();
    x.translate(H, H);
    x.rotate(ang);
    x.fillStyle = '#ffd23f';
    x.strokeStyle = '#1c0f2b';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, -S * 0.065);
    x.lineTo(S * 0.045, S * 0.045);
    x.lineTo(0, S * 0.02);
    x.lineTo(-S * 0.045, S * 0.045);
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
    const [nx, ny] = this.project(0, -1, fx, fz, 1);
    const nl = Math.hypot(nx, ny) || 1;
    const kx = H + (nx / nl) * (R - 2), ky = H + (ny / nl) * (R - 2);
    x.fillStyle = '#ff7a1a';
    x.beginPath();
    x.arc(kx, ky, S * 0.055, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.fillStyle = '#1c0f2b';
    x.font = `700 ${Math.round(S * 0.065)}px Fredoka, sans-serif`;
    x.fillText('N', kx, ky + 1);
  }
}
