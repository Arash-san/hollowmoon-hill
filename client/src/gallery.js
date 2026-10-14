// Development page.
//   gallery.html                       avatar lineup (every hair style, costume, pet); ?emote=dance|all, ?walk=1, ?zoom=2
//   gallery.html?world=1&cam=x,y,z&at=x,z   the world from a fixed camera
import { THREE, syncOutlineFog } from './engine/toon.js';
import { Avatar } from './avatar/builder.js';
import { Animator } from './avatar/animator.js';
import { Pet } from './avatar/pets.js';
import { Stage } from './engine/stage.js';
import { World } from './world/world.js';
import { randomAvatar, HAIR_STYLES, COSTUMES, PETS, TOPS, GLASSES, FACIAL_HAIR, EYE_STYLES, SKIN_TONES } from '../../shared/avatar.js';

const q = new URLSearchParams(location.search);

if (q.get('world')) {
  const stage = new Stage(document.body);
  const t0 = performance.now();
  const world = new World(stage.scene, stage.quality);
  window.__world = world;
  window.__buildMs = performance.now() - t0;
  const [cx, cy, cz] = (q.get('cam') || '0,40,70').split(',').map(Number);
  const [ax, az] = (q.get('at') || '0,0').split(',').map(Number);
  stage.camera.position.set(cx, cy, cz);
  stage.camera.lookAt(ax, 0, az);
  let frame = 0;
  const loop = (now) => {
    const t = now / 1000;
    world.update(t, 1 / 60, stage.camera, q.get('party') ? 1 : 0);
    stage.render();
    if (++frame === 10) {
      window.__ready = true;
      window.__info = stage.renderer.info.render;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else if (q.get('specs')) fetch(q.get('specs')).then((r) => r.json()).then((s) => {
  window.__specs = s;
  lineup();
});
else lineup();

function lineup() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1b4a');
  scene.fog = new THREE.FogExp2('#2a1b4a', 0.02);
  syncOutlineFog(scene);
  scene.add(new THREE.HemisphereLight('#b9a6ff', '#3a2a1a', 1.6));
  const moon = new THREE.DirectionalLight('#fff1d6', 2.2);
  moon.position.set(3, 6, 5);
  scene.add(moon);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshToonMaterial({ color: '#3d2f5c' }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);
  // ?specs=<url of a JSON list of avatar specs>: show exactly those (used to check photo booth results)
  const given = window.__specs || null;
  const n = given ? given.length : Number(q.get('n') || 14);
  const cols = Number(q.get('cols') || 7);
  const items = [];
  for (let i = 0; i < n; i++) {
    if (given) {
      const av = new Avatar(given[i]);
      const cols2 = Number(q.get('cols') || 7), row = Math.floor(i / cols2), c = i % cols2;
      av.root.position.set((c - (cols2 - 1) / 2) * 1.6, 0, -row * 2.2);
      scene.add(av.root);
      const anim = new Animator(av);
      const pet = new Pet(given[i].pet);
      scene.add(pet.root);
      items.push({ av, anim, pet });
      continue;
    }
    const spec = randomAvatar('g' + i + (q.get('seed') || ''));
    spec.hair.style = HAIR_STYLES[(i + Number(q.get('off') || 0)) % HAIR_STYLES.length];
    spec.costume = COSTUMES[i % COSTUMES.length];
    spec.pet = PETS[i % PETS.length];
    spec.top.type = TOPS[i % TOPS.length];
    spec.glasses = GLASSES[i % GLASSES.length];
    spec.facialHair = i % 5 === 1 ? FACIAL_HAIR[1 + (i % 4)] : 'none';
    spec.eyes.style = EYE_STYLES[i % EYE_STYLES.length];
    spec.skin = SKIN_TONES[(i * 3) % SKIN_TONES.length];
    if (q.get('spec')) Object.assign(spec, JSON.parse(q.get('spec')));
    const av = new Avatar(spec);
    const row = Math.floor(i / cols), c = i % cols;
    av.root.position.set((c - (cols - 1) / 2) * 1.6, 0, -row * 2.2);
    scene.add(av.root);
    const anim = new Animator(av);
    const pet = new Pet(spec.pet);
    scene.add(pet.root);
    items.push({ av, anim, pet });
  }
  const rows = Math.ceil(n / cols);
  const zoom = Number(q.get('zoom') || 1);
  camera.position.set(0, (2.2 + rows * 0.5) / zoom + 0.9 * (1 - 1 / zoom), (7 + rows * 1.8) / zoom);
  camera.lookAt(0, 0.9, -(rows - 1) * 1.1);

  const emote = q.get('emote') || '';
  const clock = new THREE.Timer();
  let frame = 0;
  function loop() {
    clock.update();
    const dt = Math.min(0.05, clock.getDelta());
    frame++;
    for (const [i, it] of items.entries()) {
      if (emote && !it.anim.emote) it.anim.play(emote === 'all' ? ['wave', 'dance', 'heart', 'laugh', 'cheer', 'clap', 'boo'][i % 7] : emote);
      it.anim.update(dt, { speed: q.get('walk') ? 1 : 0, air: false, vy: 0, dizzy: false });
      it.av.root.rotation.y = Number(q.get('ry') || 0);
      it.pet.update(dt, it.av.root.position, it.av.root.rotation.y, false);
    }
    renderer.render(scene, camera);
    if (frame === 20) window.__ready = true;
    requestAnimationFrame(loop);
  }
  loop();
}
