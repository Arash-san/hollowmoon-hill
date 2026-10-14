// The full map: the illustrated relief (mapart.js) plus live layers: place names with icons, NPCs, landmarks,
// other players, you, the quest you picked with a dashed route to it, live boss fights and a compass rose.
import { ZONES, NPCS, GAME_TITLE, QUESTS, BOSSES, PHOTO_BOOTH } from '../../shared/world.js';
import { NPC_ICON, esc } from './ui.js';
import { iconImage } from './icons.js';
import { mapArt, toArt, ART, SPAN } from './mapart.js';

const PLACE_ICON = { plaza: 'plaza', graveyard: 'graveyard', arena: 'arena', circle: 'circle', patch: 'patch', cottage: 'cottage', woods: 'woods', market: 'market', dance: 'dance', lake: 'lake' };

// focus: a quest id to point out (from tapping it on the checklist)
export function showMap(ui, game, focus = null) {
  const fq = focus && QUESTS.find((q) => q.id === focus);
  const caption = fq
    ? `<p class="map-cap">📍 <b>${esc(fq.title)}</b>: ${esc(fq.hint)}</p>`
    : '<p class="map-cap">Tap a quest on the checklist to see where it is. The pink camera is the Photo Booth.</p>';
  let raf = 0;
  const body = ui.modal(`<h2>🗺️ ${GAME_TITLE}</h2>${caption}<canvas id="map-canvas" width="1100" height="1100"></canvas>`, { onClose: () => cancelAnimationFrame(raf), wide: true });
  const c = body.querySelector('#map-canvas');
  const x = c.getContext('2d');
  const S = c.width, K = S / ART; // canvas px per art px
  const art = mapArt(game.world);
  const P = (wx, wz) => [toArt(wx) * K, toArt(wz) * K];
  const M = S / SPAN; // canvas px per metre
  const ic = (name, px, py, size) => {
    const im = iconImage(name);
    if (im?.complete) x.drawImage(im, px - size / 2, py - size / 2, size, size);
  };
  const label = (text, px, py, color = '#fff4e3', size = 21) => {
    x.font = `700 ${size}px Fredoka, sans-serif`;
    x.textAlign = 'center';
    x.lineJoin = 'round';
    x.lineWidth = 7;
    x.strokeStyle = 'rgba(20,10,36,.92)';
    x.strokeText(text, px, py);
    x.fillStyle = color;
    x.fillText(text, px, py);
  };

  const draw = (now) => {
    x.clearRect(0, 0, S, S);
    x.drawImage(art, 0, 0, S, S);
    // places: an icon on a dark disc, and the name
    for (const [k, z] of Object.entries(ZONES)) {
      const [px, py] = P(z.x, z.z);
      x.fillStyle = 'rgba(20,10,36,.55)';
      x.beginPath();
      x.arc(px, py, 26, 0, Math.PI * 2);
      x.fill();
      ic(PLACE_ICON[k], px, py, 46);
      label(z.name, px, py + 44);
    }
    // landmarks on their hills
    for (const l of game.world.features.landmarks) {
      const [px, py] = P(l.x, l.z);
      ic(l.icon, px, py, 52);
      label(l.name, px, py + 42, '#ffe2b0', 19);
    }
    // the photo booth, labelled so nobody has to hunt for it
    {
      const [px, py] = P(PHOTO_BOOTH.x, PHOTO_BOOTH.z);
      x.fillStyle = '#ff4f8b';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(px - 46, py + 22, 20, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      ic('camera', px - 46, py + 22, 30);
      label('Photo Booth', px - 46, py + 58, '#ffb3cf', 17);
    }
    // NPCs (the mayor is missing while his giant self is loose)
    for (const [id, n] of Object.entries(NPCS)) {
      if (id === 'mayor' && game.finaleState?.state && !['idle', 'defeated'].includes(game.finaleState.state)) continue;
      const [px, py] = P(n.x, n.z);
      ic(NPC_ICON[id], px, py - 4, 34);
    }
    // live boss fights: a pulsing red ring
    for (const [id, st] of [['king', game.bossState?.state], ['mayor', game.finaleState?.state]]) {
      if (!st || st === 'idle' || st === 'defeated') continue;
      const A = BOSSES[id].center;
      const [px, py] = P(A.x, A.z);
      x.strokeStyle = '#ff4f2a';
      x.lineWidth = 7;
      x.beginPath();
      x.arc(px, py, A.r * M + 10 + Math.sin(now / 200) * 7, 0, Math.PI * 2);
      x.stroke();
    }
    // other players (red when they are a pumpkin and need a revive)
    for (const o of game.others.values()) {
      const [px, py] = P(o.pos.x, o.pos.z);
      x.fillStyle = o.down ? '#ff4f6b' : o.teamColor || '#9ef0ff';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(px, py, 8, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
    // the quest you picked: a dashed route from you, then a pulsing pin
    const tq = fq || game.trackedQuest?.();
    const tgt = tq && game.questTarget(tq.id);
    if (tgt && game.me) {
      const [mx, my] = P(game.me.pos.x, game.me.pos.z);
      const [tx, ty] = P(tgt.x, tgt.z);
      const len = Math.hypot(tx - mx, ty - my);
      if (len > 50) {
        const ux = (tx - mx) / len, uy = (ty - my) / len;
        const ax = mx + ux * 20, ay = my + uy * 20, bx = tx - ux * 30, by = ty - uy * 30;
        x.save();
        x.lineCap = 'round';
        x.setLineDash([18, 14]);
        x.lineDashOffset = -now / 40;
        x.strokeStyle = '#1c0f2b';
        x.lineWidth = 12;
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(bx, by);
        x.stroke();
        x.strokeStyle = '#ffd23f';
        x.lineWidth = 6;
        x.stroke();
        x.setLineDash([]);
        x.fillStyle = '#ffd23f';
        x.lineWidth = 4;
        x.strokeStyle = '#1c0f2b';
        x.beginPath();
        x.moveTo(bx + ux * 16, by + uy * 16);
        x.lineTo(bx - uy * 12, by + ux * 12);
        x.lineTo(bx + uy * 12, by - ux * 12);
        x.closePath();
        x.fill();
        x.stroke();
        const dist = Math.round(Math.hypot(tgt.x - game.me.pos.x, tgt.z - game.me.pos.z));
        label(`${dist} m`, (ax + bx) / 2, (ay + by) / 2 - 14, '#ffd23f', 24);
        x.restore();
      }
      const k = (now / 900) % 1;
      x.strokeStyle = `rgba(255,210,63,${1 - k})`;
      x.lineWidth = 6;
      x.beginPath();
      x.arc(tx, ty, 20 + k * 64, 0, Math.PI * 2);
      x.stroke();
      ic('pin', tx, ty - 26, 56);
      ic(tq.id, tx, ty - 33, 26);
    }
    // you: an arrow pointing where you face
    if (game.me) {
      const [px, py] = P(game.me.pos.x, game.me.pos.z);
      x.save();
      x.translate(px, py);
      x.rotate(Math.PI - game.me.yaw);
      x.fillStyle = '#ffd23f';
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(0, -18);
      x.lineTo(13, 13);
      x.lineTo(0, 6);
      x.lineTo(-13, 13);
      x.closePath();
      x.fill();
      x.stroke();
      x.restore();
      label('You', px, py - 26, '#ffd23f', 20);
    }
    // compass rose
    {
      const cx = S - 80, cy = 80;
      x.fillStyle = 'rgba(20,10,36,.75)';
      x.beginPath();
      x.arc(cx, cy, 52, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#ffcf8a';
      x.lineWidth = 3;
      x.stroke();
      for (let i = 0; i < 4; i++) {
        x.save();
        x.translate(cx, cy);
        x.rotate((i * Math.PI) / 2);
        x.fillStyle = i ? '#cdbcf2' : '#ff7a1a';
        x.beginPath();
        x.moveTo(0, -40);
        x.lineTo(8, 0);
        x.lineTo(-8, 0);
        x.closePath();
        x.fill();
        x.restore();
      }
      label('N', cx, cy - 46, '#ff7a1a', 20);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
}
