// Client side of the v3 features: classes and their powers, the Gloom Manor team room (its interior, the colour code
// panel), the carving contest panel, team colours (the lantern button that lights your screen up like an LED) and
// arena duels. main.js owns the game; these helpers take it as `game`.
import { THREE, toonMat, glowMat, col, merge, tf, box, cyl, sphere, torus, cone, glowSprite } from './engine/toon.js';
import { CLASSES, ROOM, PLATES, PLATE_COLORS, ROOM_EXIT, MANOR_DOOR, CONTEST_SECONDS } from '../../shared/features.js';
import { ZONES } from '../../shared/world.js';
import { icon } from './icons.js';
import { esc } from './ui.js';

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- classes
export function classPicker(game, { first = false } = {}) {
  const cur = game.state?.cls;
  const body = game.ui.modal(`<div class="story intro"><h2>✨ Choose your class</h2>
    <p class="hint">${first ? 'Madame Hex looks you over… "Every hero of Hollowmoon Hill has a gift, dearie. Which is yours?"' : 'Madame Hex can change your gift. Which one do you want?'}</p>
    <div class="classes">${Object.entries(CLASSES).map(([id, c]) => `<button data-cls="${id}" class="${cur === id ? 'on' : ''}">${icon(c.icon)}<b>${c.name}</b><small><b>${c.power}</b>: ${esc(c.desc)}</small></button>`).join('')}</div>
    <p class="hint">Dressed up in a real costume? The Photo Booth can pick your class from it!</p></div>`);
  body.querySelector('.classes').onclick = (e) => {
    const b = e.target.closest('[data-cls]');
    if (!b) return;
    game.net.send({ t: 'pickClass', cls: b.dataset.cls });
    game.audio.play('ticket');
    game.ui.closeModal();
  };
}

export function updateClassHud(game) {
  const cls = game.state?.cls, c = CLASSES[cls];
  const btn = $('#act-special'), badge = $('#me-class');
  btn.classList.toggle('hidden', !c);
  badge.classList.toggle('hidden', !c);
  if (!c) return;
  if (btn.dataset.cls !== cls) {
    btn.dataset.cls = cls;
    btn.innerHTML = `${icon(cls === 'witch' ? 'fire' : cls === 'vampire' ? 'bat' : 'zombie')}<span class="cd"></span><span class="lbl">${c.power}</span>`;
    btn.title = `${c.power} (F)`;
    badge.innerHTML = icon(c.icon);
    badge.title = c.name;
  }
}

// cooldown ring on the power button
export function tickClassHud(game, now) {
  const c = CLASSES[game.state?.cls];
  if (!c) return;
  const left = Math.max(0, (game.powerAt || 0) + c.cd * 1000 - now);
  $('#act-special .cd')?.style.setProperty('--cd', `${(left / (c.cd * 1000)) * 100}%`);
}

export function usePower(game) {
  const cls = game.state?.cls, c = CLASSES[cls];
  const now = performance.now();
  if (!c || !game.me || game.downUntil) return;
  if (now - (game.powerAt || 0) < c.cd * 1000) return game.ui.toast(`${c.power} is recharging…`);
  const me = game.me;
  if (cls === 'witch') {
    const target = game.pickTarget(14);
    if (!target) return game.ui.toast('🔥 No target for your fireball. Find a spider or a boss!');
    game.powerAt = now;
    me.yaw = Math.atan2(target.pos().x - me.pos.x, target.pos().z - me.pos.z);
    me.emote('cheer');
    game.audio.play('throw');
    const view = game.viewFor(target);
    view.throwAt(me.pos.clone().setY(me.pos.y + 1.6), target, () => game.net.send({ t: 'special', kind: target.kind, id: target.id, b: view.id }), '🔥');
    game.fx.sparkle(me.pos.clone().setY(me.pos.y + 1.5), '#ff7a1a', 20, 1.4);
    return;
  }
  game.powerAt = now;
  if (cls === 'vampire') {
    // a quick dash in a cloud of bats (and a small heal from the server)
    game.dashUntil = now + 650;
    for (let i = 0; i < 6; i++) game.fx.emoji('🦇', me.pos.clone().setY(me.pos.y + 1 + Math.random()), 1, { size: 0.5 });
    game.audio.play('boo');
  } else if (cls === 'zombie') {
    me.emote('zombie');
    game.fx.ring(me.pos.clone().setY(0.3), '#9ed36a', 7, 0.7);
    game.audio.play('roar');
  }
  game.net.send({ t: 'special' });
}

// ---------------------------------------------------------------- team colours: the lantern lights up your screen
export function teamFlash(game) {
  const el = $('#team-flash');
  const down = !!game.downUntil;
  const color = down ? '#ff2a3a' : game.myColor || '#ff7a1a';
  el.style.background = `radial-gradient(circle, ${color}, ${shade(color, 0.6)})`;
  el.querySelector('b').textContent = down ? 'HELP ME!' : game.myRoom ? 'MY TEAM' : 'FIND ME';
  el.classList.remove('hidden');
  clearTimeout(teamFlash.t);
  teamFlash.t = setTimeout(() => el.classList.add('hidden'), 6000);
  el.onclick = () => el.classList.add('hidden');
}
const shade = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

// ---------------------------------------------------------------- Gloom Manor: the room's 3D interior
export function buildRoom(scene) {
  const geo = [], glow = [];
  const { x: X, z: Z, w: W, d: D } = ROOM;
  // floorboards and a rug
  geo.push(col(tf(new THREE.PlaneGeometry(W, D, 22, 1).rotateX(-Math.PI / 2), { p: [X, 0.02, Z] }), (x) => (Math.floor((x - X + 50) * 1.2) % 2 ? '#5a3a2a' : '#4a2f22'), 0.04, true));
  geo.push(col(tf(new THREE.PlaneGeometry(12, 7).rotateX(-Math.PI / 2), { p: [X, 0.04, Z - 1.5] }), '#5a1a3a'));
  geo.push(col(tf(new THREE.RingGeometry(3.2, 3.5, 40).rotateX(-Math.PI / 2), { p: [X, 0.05, Z - 1.5], s: [1.6, 1, 1] }), '#e0b33a'));
  // low walls (so the camera can see in), with dark wallpaper stripes and a skirting board
  const wall = (w, p, r) => {
    geo.push(col(tf(new THREE.BoxGeometry(w, 3.2, 0.4, Math.ceil(w), 1, 1), { p, r }), (x, y, z) => (Math.floor((x + z) * 1.5) % 2 ? '#3a2550' : '#33204a'), 0, true));
    geo.push(col(tf(box(w, 0.3, 0.5), { p: [p[0], 0.15, p[2]], r }), '#2a1830'));
  };
  wall(W, [X, 1.6, Z - D / 2], [0, 0, 0]);
  wall(D, [X - W / 2, 1.6, Z], [0, Math.PI / 2, 0]);
  wall(D, [X + W / 2, 1.6, Z], [0, Math.PI / 2, 0]);
  // the front wall is only a railing, so the camera can look in
  for (const sx of [-1, 1]) {
    geo.push(col(tf(box(W / 2 - 1.6, 0.9, 0.3), { p: [X + sx * (W / 4 + 0.8), 0.45, Z + D / 2] }), '#33204a'));
    for (let i = 0; i < 5; i++) geo.push(col(tf(cyl(0.08, 0.08, 1.2, 6), { p: [X + sx * (1.8 + i * 1.8), 0.6, Z + D / 2] }), '#2a1830'));
  }
  // the way out: a glowing doormat under an arch
  glow.push(col(tf(new THREE.PlaneGeometry(2.4, 1.4).rotateX(-Math.PI / 2), { p: [ROOM_EXIT.x, 0.06, ROOM_EXIT.z] }), '#9ef0ff'));
  for (const sx of [-1, 1]) geo.push(col(tf(cyl(0.16, 0.2, 2.8, 8), { p: [ROOM_EXIT.x + sx * 1.5, 1.4, Z + D / 2] }), '#2a1830'));
  geo.push(col(tf(torus(1.5, 0.15, 6, 16, Math.PI), { p: [ROOM_EXIT.x, 2.8, Z + D / 2] }), '#2a1830'));
  // portraits with glowing eyes, candelabras, a cobwebbed piano and a ghost statue holding the lock
  for (let i = 0; i < 4; i++) {
    const px = X - 7.5 + i * 5;
    geo.push(col(tf(box(1.6, 2, 0.12), { p: [px, 2.1, Z - D / 2 + 0.28] }), '#e0b33a'));
    geo.push(col(tf(box(1.3, 1.7, 0.1), { p: [px, 2.1, Z - D / 2 + 0.32] }), ['#3a5a6a', '#5a3a6a', '#6a4a3a', '#3a6a4a'][i]));
    for (const sx of [-1, 1]) glow.push(col(tf(sphere(0.06, 6, 4), { p: [px + sx * 0.2, 2.35, Z - D / 2 + 0.4] }), '#ff4f6b'));
  }
  for (const sx of [-1, 1]) {
    geo.push(col(tf(cyl(0.06, 0.18, 2.2, 6), { p: [X + sx * (W / 2 - 1.5), 1.1, Z - D / 2 + 1.5] }), '#e0b33a'));
    for (let k = -1; k <= 1; k++) {
      geo.push(col(tf(cyl(0.05, 0.05, 0.35, 6), { p: [X + sx * (W / 2 - 1.5) + k * 0.35, 2.4, Z - D / 2 + 1.5] }), '#f1e3c2'));
      glow.push(col(tf(sphere(0.07, 6, 4), { p: [X + sx * (W / 2 - 1.5) + k * 0.35, 2.65, Z - D / 2 + 1.5], s: [0.8, 1.5, 0.8] }), '#ffb347'));
    }
  }
  geo.push(col(tf(box(3, 1.1, 1.3), { p: [X + 7, 0.55, Z + 5] }), '#1c1226'));
  geo.push(col(tf(box(3, 0.08, 0.5), { p: [X + 7, 1.12, Z + 4.6] }), '#f2efe6'));
  // the ghost statue: four lamps that light up as the code is entered
  geo.push(col(tf(cyl(0.9, 1.1, 0.6, 12), { p: [X, 0.3, Z - D / 2 + 2] }), '#6d6884'));
  geo.push(col(tf(sphere(0.9, 14, 10), { p: [X, 1.8, Z - D / 2 + 2], s: [1, 1.3, 1] }), '#d8d4ec'));
  const lamps = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(sphere(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#3a2a4a' }));
    m.position.set(X - 1.5 + i, 3.3, Z - D / 2 + 2);
    scene.add(m);
    lamps.push(m);
  }
  // the four plates
  const plates = PLATES.map((p) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 28), new THREE.MeshBasicMaterial({ color: p.hex, transparent: true, opacity: 0.55 }));
    disc.position.set(p.x, 0.08, p.z);
    scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.08, 0.07, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1c0f2b' }));
    ring.position.set(p.x, 0.12, p.z);
    scene.add(ring);
    const s = glowSprite(p.hex, 3.2, 0.25);
    s.position.set(p.x, 0.6, p.z);
    scene.add(s);
    return { ...p, disc, s };
  });
  scene.add(new THREE.Mesh(merge(geo), toonMat));
  scene.add(new THREE.Mesh(merge(glow), glowMat));
  const light = glowSprite('#ffb347', 30, 0.18);
  light.position.set(X, 4, Z);
  scene.add(light);
  return { lamps, plates };
}

// light the statue lamps for the steps done; flash the plate that was stepped on
export function roomStep(game, m) {
  const r = game.roomArt;
  if (!r) return;
  r.lamps.forEach((l, i) => l.material.color.set(i < m.step ? '#ffd23f' : '#3a2a4a'));
  const p = r.plates.find((x) => x.id === m.plate);
  if (p) {
    p.disc.material.opacity = 1;
    setTimeout(() => (p.disc.material.opacity = 0.55), 500);
    game.fx.sparkle(new THREE.Vector3(p.x, 0.6, p.z), m.ok ? p.hex : '#ff2a3a', 20, 1.4);
  }
  game.audio.play(m.ok ? 'pickup' : 'wrong');
  game.room = { ...(game.room || {}), step: m.step };
  renderRoomPanel(game);
}

export function renderRoomPanel(game) {
  const el = $('#room-panel');
  const r = game.room;
  if (!game.myRoom || !r) return el.classList.add('hidden');
  el.classList.remove('hidden');
  const hints = game.roomHints || [];
  const cards = [0, 1, 2, 3].map((i) => {
    const h = hints.find((x) => x.i === i);
    const c = h && PLATE_COLORS.find((p) => p.id === h.color);
    const done = (r.step || 0) > i;
    return c ? `<div class="hint-card" style="background:${c.hex}">${done ? '✓' : i + 1}</div>` : `<div class="hint-card unknown">${done ? '✓' : '?'}</div>`;
  }).join('');
  const team = (r.members || []).map((m) => `<span style="background:${r.color}">${esc(m.name)}</span>`).join('');
  const state = r.state === 'waiting'
    ? `<p>Waiting for your team (${r.members.length}/${r.max}). You need at least ${r.min}.</p><div class="booth-row"><button class="btn orange" data-r="start" ${r.members.length < r.min ? 'disabled' : ''}>Start the Spirit Lock</button><button class="btn" data-r="leave">Leave</button></div>`
    : r.state === 'playing'
      ? `<p>Step on the plates in order. You only know some colours: <b>tell your team!</b></p><div class="hints">${cards}</div><div class="booth-row"><button class="btn" data-r="leave">Give up</button></div>`
      : '<p><b>Solved!</b> Taking you back outside…</p>';
  el.innerHTML = `<h4>${icon('manor')} Gloom Manor · The Spirit Lock</h4><div class="team">${team}</div>${state}`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-r]');
    if (b) game.net.send({ t: b.dataset.r === 'start' ? 'roomStart' : 'leaveRoom' });
  };
}

// ---------------------------------------------------------------- carving contest
export function renderContest(game, m) {
  const el = $('#contest-panel');
  if (m.state === 'on') {
    game.contest = { stencil: m.stencil, until: performance.now() + m.left * 1000, carved: false };
    el.classList.remove('hidden');
    el.innerHTML = `<h4>${icon('carve')} Pumpkin carving contest!</h4><div class="time">--</div><p>Everyone gets the same design. Carve it as closely as you can.</p><button class="btn big orange" data-c="go">Carve now</button>`;
    el.querySelector('[data-c]').onclick = () => game.openContestCarve();
    game.ui.banner('🔪 CARVING CONTEST 🔪');
    game.audio.play('bell');
  } else if (m.state === 'done') {
    game.contest = null;
    el.classList.remove('hidden');
    el.innerHTML = `<h4>${icon('trophy')} Contest results</h4>${m.top.length ? `<ol>${m.top.map((x) => `<li><b>${esc(x.name)}</b> · ${x.score}%</li>`).join('')}</ol>` : '<p>Nobody carved this time!</p>'}<p class="hint">${m.count} carver${m.count === 1 ? '' : 's'} took part.</p>`;
    setTimeout(() => el.classList.add('hidden'), 12000);
  }
}

export function tickContest(game, now) {
  const c = game.contest;
  if (!c) return;
  const left = Math.max(0, Math.ceil((c.until - now) / 1000));
  const t = $('#contest-panel .time');
  if (t) t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- arena duels
export function inDuelZone(pos, game) {
  const A = ZONES.arena;
  return !game.myRoom && Math.hypot(pos.x - A.x, pos.z - A.z) < A.r && game.bossState.state === 'idle';
}

export { MANOR_DOOR, CONTEST_SECONDS };
