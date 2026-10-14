// Photo booth for officers: pick a student, take a photo, the server's vision agent designs their avatar, and the
// booth shows the finished 3D character spinning while it pops into the game.
import './officer.css';
import { THREE, syncOutlineFog } from './engine/toon.js';
import { Avatar } from './avatar/builder.js';
import { Animator } from './avatar/animator.js';
import { Pet } from './avatar/pets.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const key = new URLSearchParams(location.search).get('key') || sessionStorage.getItem('booth-key') || '';
if (key) sessionStorage.setItem('booth-key', key);
const api = (p, opts) => fetch(`api/booth/${p}${p.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, opts).then(async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
});

let players = [], selected = null, stream = null, facing = 'user', photoBlob = null;

async function refresh() {
  try {
    const r = await api('queue');
    players = r.players;
    $('#status').textContent = `👥 ${players.filter((p) => p.online).length} online · 📸 ${players.filter((p) => p.photo).length} done`;
    renderList();
  } catch (e) {
    $('#status').textContent = e.message === 'bad key' ? '🔒 Wrong booth key in the link' : '⚠️ Server offline';
  }
}

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const list = players.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  // waiting students first
  list.sort((a, b) => a.photo - b.photo || b.online - a.online);
  $('#list').innerHTML = list.map((p) => `<div class="p ${selected?.pid === p.pid ? 'sel' : ''}" data-pid="${p.pid}"><b><span class="dot ${p.online ? 'on' : ''}"></span>${esc(p.name)}</b><span class="code">${esc(p.code)}</span><small>${p.photo ? `✅ ${esc(p.title)}` : '⏳ waiting for a photo'}</small></div>`).join('') || '<p class="note">No students yet. They appear here as soon as they join the game.</p>';
}

$('#list').onclick = (e) => {
  const el = e.target.closest('.p');
  if (!el) return;
  selected = players.find((p) => p.pid === el.dataset.pid);
  renderList();
  startShoot();
};
$('#search').oninput = renderList;
$('#search').onkeydown = (e) => {
  if (e.key === 'Enter') {
    const q = $('#search').value.trim().toUpperCase();
    const p = players.find((x) => x.code === q) || players.find((x) => x.name.toUpperCase().includes(q));
    if (p) {
      selected = p;
      renderList();
      startShoot();
    }
  }
};

async function startCamera() {
  stopCamera();
  $('#camnote').textContent = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    $('#camnote').textContent = 'Live camera needs https or localhost here. Use 📁 Upload: on a tablet it opens the camera app.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    const v = $('#video');
    v.srcObject = stream;
    v.classList.toggle('mirror', facing === 'user');
  } catch (e) {
    $('#camnote').textContent = `Camera unavailable (${e.name}). Use 📁 Upload instead.`;
  }
}
function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function startShoot() {
  $('#empty').classList.add('hidden');
  $('#result').classList.add('hidden');
  $('#shoot').classList.remove('hidden');
  $('#who').textContent = `${selected.name} · ${selected.code}`;
  showLive();
  startCamera();
}

function showLive() {
  photoBlob = null;
  $('#video').classList.remove('hidden');
  $('#still').classList.add('hidden');
  $('#snap').classList.remove('hidden');
  $('#flip').classList.remove('hidden');
  $('#retake').classList.add('hidden');
  $('#use').classList.add('hidden');
}

function showStill(blob) {
  photoBlob = blob;
  $('#still').src = URL.createObjectURL(blob);
  $('#still').classList.remove('hidden');
  $('#video').classList.add('hidden');
  $('#snap').classList.add('hidden');
  $('#flip').classList.add('hidden');
  $('#retake').classList.remove('hidden');
  $('#use').classList.remove('hidden');
}

$('#snap').onclick = () => {
  const v = $('#video');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const x = c.getContext('2d');
  if (facing === 'user') {
    x.translate(c.width, 0);
    x.scale(-1, 1);
  }
  x.drawImage(v, 0, 0);
  c.toBlob((b) => showStill(b), 'image/jpeg', 0.9);
};
$('#flip').onclick = () => {
  facing = facing === 'user' ? 'environment' : 'user';
  startCamera();
};
$('#file').onchange = (e) => {
  const f = e.target.files[0];
  if (f) showStill(f);
  e.target.value = '';
};
$('#retake').onclick = showLive;
$('#use').onclick = async () => {
  if (!photoBlob || !selected) return;
  $('#busy').classList.remove('hidden');
  $('#use').disabled = true;
  try {
    const r = await api(`photo?pid=${selected.pid}`, { method: 'POST', body: photoBlob, headers: { 'content-type': 'application/octet-stream' } });
    stopCamera();
    showResult(r.avatar, r.ms);
    refresh();
  } catch (e) {
    $('#camnote').textContent = `⚠️ Could not design the avatar: ${e.message}. Try again or use a random look.`;
  } finally {
    $('#busy').classList.add('hidden');
    $('#use').disabled = false;
  }
};

// ---------------------------------------------------------------- 3D preview
let renderer, scene, camera, current, anim, pet, clock;
function preview(spec) {
  const canvas = $('#avatar-canvas');
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#2a1b4a', 0.01);
    syncOutlineFog(scene);
    scene.add(new THREE.HemisphereLight('#b9a6ff', '#3a2a1a', 1.5));
    const moon = new THREE.DirectionalLight('#fff1d6', 2.4);
    moon.position.set(3, 6, 5);
    scene.add(moon);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.35, 4.6);
    camera.lookAt(0, 0.95, 0);
    clock = new THREE.Timer();
    const loop = () => {
      requestAnimationFrame(loop);
      clock.update();
      const dt = Math.min(0.05, clock.getDelta());
      if (current) {
        current.root.rotation.y += dt * 0.6;
        if (!anim.emote) anim.play(['wave', 'dance', 'heart', 'cheer', 'laugh'][Math.floor(Math.random() * 5)]);
        anim.update(dt, { speed: 0, air: false, vy: 0, dizzy: false });
        pet.update(dt, current.root.position, current.root.rotation.y, false);
      }
      const w = canvas.clientWidth;
      if (canvas.width !== w * renderer.getPixelRatio()) renderer.setSize(w, w, false);
      renderer.render(scene, camera);
    };
    loop();
  }
  if (current) {
    scene.remove(current.root, pet.root);
    current.dispose();
  }
  current = new Avatar(spec);
  anim = new Animator(current);
  pet = new Pet(spec.pet);
  scene.add(current.root, pet.root);
}

function showResult(spec, ms) {
  $('#shoot').classList.add('hidden');
  $('#result').classList.remove('hidden');
  $('#rtitle').textContent = `✨ ${selected.name} is "${spec.title}"`;
  const dot = (c) => `<i style="background:${c}"></i>`;
  $('#traits').innerHTML = [
    `${dot(spec.skin)}skin`, `${dot(spec.hair.color)}${spec.hair.style} hair`, spec.facialHair !== 'none' ? spec.facialHair : '', spec.glasses !== 'none' ? `${spec.glasses} glasses` : '',
    `${dot(spec.top.color)}${spec.top.type}`, spec.top.pattern !== 'plain' ? spec.top.pattern : '', spec.headwear !== 'none' ? spec.headwear : '',
    `🎃 ${spec.costume.replace(/_/g, ' ')}`, `🐾 ${spec.pet.replace(/_/g, ' ')}`, ms ? `⚡ ${(ms / 1000).toFixed(1)} s` : '',
  ].filter(Boolean).map((t) => `<span>${t}</span>`).join('');
  preview(spec);
}

$('#again').onclick = () => startShoot();
$('#next').onclick = () => {
  selected = null;
  $('#result').classList.add('hidden');
  $('#empty').classList.remove('hidden');
  renderList();
  $('#search').value = '';
  $('#search').focus();
};
$('#random').onclick = async () => {
  if (!selected) return;
  await api(`reset?pid=${selected.pid}`, { method: 'POST' });
  refresh();
  $('#next').click();
};

refresh();
setInterval(refresh, 4000);
window.__ready = true;
