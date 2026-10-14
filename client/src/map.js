// A hand-drawn style overview map with zones, NPCs, players and live events.
import { ZONES, NPCS, WORLD_RADIUS, GAME_TITLE, PHOTO_BOOTH, QUESTS, QUEST_ICON } from '../../shared/world.js';
import { NPC_ICON, esc } from './ui.js';
import { ZONE_ICON } from './minimap.js';

// focus: a quest id to point out (from tapping it on the checklist)
export function showMap(ui, game, focus = null) {
  const fq = focus && QUESTS.find((q) => q.id === focus);
  const caption = fq
    ? `<p class="map-cap">📍 <b>${esc(fq.title)}</b>: ${esc(fq.hint)}</p>`
    : '<p class="map-cap">Tap a quest on the checklist to see where it is. 📸 is the Photo Booth.</p>';
  const body = ui.modal(`<h2>🗺️ ${GAME_TITLE}</h2>${caption}<canvas id="map-canvas" width="900" height="900"></canvas>`, { onClose: () => cancelAnimationFrame(raf) });
  const c = body.querySelector('#map-canvas');
  const x = c.getContext('2d');
  const S = 900, scale = S / (WORLD_RADIUS * 2 + 12);
  const P = (wx, wz) => [S / 2 + wx * scale, S / 2 + wz * scale];
  let raf = 0;
  const draw = (now) => {
    x.clearRect(0, 0, S, S);
    const g = x.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#3f5e46');
    g.addColorStop(0.9, '#2c4a3c');
    g.addColorStop(1, '#1a0f2e');
    x.fillStyle = g;
    x.beginPath();
    x.arc(S / 2, S / 2, WORLD_RADIUS * scale + 6, 0, Math.PI * 2);
    x.fill();
    // paths
    x.strokeStyle = 'rgba(125,107,106,.9)';
    x.lineWidth = 2.8 * scale;
    x.lineCap = 'round';
    for (const p of game.world.paths) {
      x.beginPath();
      p.forEach(([px, pz], i) => (i ? x.lineTo(...P(px, pz)) : x.moveTo(...P(px, pz))));
      x.stroke();
    }
    x.textAlign = 'center';
    for (const [k, z] of Object.entries(ZONES)) {
      const [px, py] = P(z.x, z.z);
      x.fillStyle = k === 'lake' ? 'rgba(40,60,140,.85)' : k === 'patch' ? 'rgba(107,74,51,.6)' : 'rgba(255,244,227,.10)';
      x.beginPath();
      x.arc(px, py, z.r * scale, 0, Math.PI * 2);
      x.fill();
      x.font = '34px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      x.fillText(ZONE_ICON[k] || '•', px, py + 4);
      x.font = '600 20px Fredoka, sans-serif';
      x.lineWidth = 6;
      x.strokeStyle = '#1c0f2b';
      x.strokeText(z.name, px, py + 34);
      x.fillStyle = '#fff4e3';
      x.fillText(z.name, px, py + 34);
    }
    // live events
    const boss = game.bossState?.state;
    if (boss && boss !== 'idle' && boss !== 'defeated') {
      const [px, py] = P(ZONES.arena.x, ZONES.arena.z);
      x.strokeStyle = '#ff4f2a';
      x.lineWidth = 6;
      x.beginPath();
      x.arc(px, py, ZONES.arena.r * scale + 8 + Math.sin(now / 200) * 6, 0, Math.PI * 2);
      x.stroke();
    }
    x.font = '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    for (const [id, n] of Object.entries(NPCS)) x.fillText(NPC_ICON[id], ...P(n.x, n.z + 2.5));
    // the photo booth, labelled so nobody has to hunt for it
    {
      const [px, py] = P(PHOTO_BOOTH.x, PHOTO_BOOTH.z);
      x.fillStyle = '#ff4f8b';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(px, py, 22, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.font = '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      x.fillStyle = '#fff';
      x.fillText('📸', px, py + 9);
      x.font = '700 19px Fredoka, sans-serif';
      x.lineWidth = 6;
      x.strokeText('Photo Booth', px - 24, py - 30);
      x.fillStyle = '#ff9ebb';
      x.fillText('Photo Booth', px - 24, py - 30);
    }
    // the quest just tapped (or the tracked one): a pulsing gold pin, and a dashed arrow from you to it
    const tq = fq || game.trackedQuest?.();
    const tgt = tq && game.questTarget(tq.id);
    if (tgt && game.me) {
      const [mx, my] = P(game.me.pos.x, game.me.pos.z);
      const [tx, ty] = P(tgt.x, tgt.z);
      const len = Math.hypot(tx - mx, ty - my);
      if (len > 40) {
        const ux = (tx - mx) / len, uy = (ty - my) / len;
        const ax = mx + ux * 18, ay = my + uy * 18, bx = tx - ux * 26, by = ty - uy * 26;
        x.save();
        x.lineCap = 'round';
        x.strokeStyle = '#1c0f2b';
        x.lineWidth = 11;
        x.setLineDash([16, 14]);
        x.lineDashOffset = -now / 40;
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(bx, by);
        x.stroke();
        x.strokeStyle = '#ffd23f';
        x.lineWidth = 6;
        x.stroke();
        x.setLineDash([]);
        // arrow head
        x.fillStyle = '#ffd23f';
        x.strokeStyle = '#1c0f2b';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(bx + ux * 14, by + uy * 14);
        x.lineTo(bx - uy * 11, by + ux * 11);
        x.lineTo(bx + uy * 11, by - ux * 11);
        x.closePath();
        x.fill();
        x.stroke();
        // distance label half way
        const dist = Math.round(Math.hypot(tgt.x - game.me.pos.x, tgt.z - game.me.pos.z));
        x.font = '700 22px Fredoka, sans-serif';
        x.textAlign = 'center';
        x.lineWidth = 6;
        x.strokeText(`${dist} m`, (ax + bx) / 2, (ay + by) / 2 - 12);
        x.fillText(`${dist} m`, (ax + bx) / 2, (ay + by) / 2 - 12);
        x.restore();
      }
    }
    if (tgt) {
      const [px, py] = P(tgt.x, tgt.z);
      const k = (now / 900) % 1;
      x.strokeStyle = `rgba(255,210,63,${1 - k})`;
      x.lineWidth = 6;
      x.beginPath();
      x.arc(px, py, 18 + k * 60, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = '#ffd23f';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(px, py);
      x.arc(px, py - 34, 19, Math.PI * 0.72, Math.PI * 2.28);
      x.closePath();
      x.fill();
      x.stroke();
      x.font = '21px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      x.fillText(QUEST_ICON[tq.id] || '📍', px, py - 27);
    }
    // players
    for (const p of game.others.values()) {
      const [px, py] = P(p.pos.x, p.pos.z);
      x.fillStyle = '#9ef0ff';
      x.beginPath();
      x.arc(px, py, 7, 0, Math.PI * 2);
      x.fill();
    }
    const me = game.me?.pos;
    if (me) {
      const [px, py] = P(me.x, me.z);
      x.fillStyle = '#ffd23f';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(px, py, 11 + Math.sin(now / 150) * 2, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.font = '700 20px Fredoka, sans-serif';
      x.fillStyle = '#ffd23f';
      x.fillText('You', px, py - 18);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
}
