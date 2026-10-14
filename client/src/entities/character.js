// A character in the world (local player, remote player or NPC): avatar + animator + pet + nameplate + chat bubble,
// plus potion effects, dizzy stars, overdue-loan bats and emote particles.
import { THREE, damp, dampAngle, glowSprite, toonMesh, merge, glowMat } from '../engine/toon.js';
import * as PR from '../world/props.js';
import { Avatar } from '../avatar/builder.js';
import { Animator } from '../avatar/animator.js';
import { Pet } from '../avatar/pets.js';
import { emojiTexture } from '../engine/fx.js';
import { iconImage, stripEmoji } from '../icons.js';
import { groundY } from '../world/world.js';

function plateTexture(name, title, color = '#ffe066', likes = 0) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font1 = '700 40px Fredoka, sans-serif', font2 = '500 26px Fredoka, sans-serif';
  x.font = font1;
  const heart = likes ? `   ${likes}` : '';
  const w1 = x.measureText(name + heart).width;
  x.font = font2;
  const w2 = title ? x.measureText(title).width : 0;
  const w = Math.ceil(Math.max(w1, w2)) + 40;
  c.width = w;
  c.height = title ? 100 : 62;
  x.textAlign = 'center';
  x.lineJoin = 'round';
  x.font = font1;
  x.lineWidth = 10;
  x.strokeStyle = 'rgba(28,12,46,0.92)';
  x.strokeText(name + heart, w / 2, 44);
  x.fillStyle = color;
  x.fillText(name + heart, w / 2, 44);
  if (likes) {
    // the heart icon in front of the like count
    const img = iconImage('heart');
    const nw = x.measureText(name + ' ').width, full = x.measureText(name + heart).width;
    if (img?.complete) x.drawImage(img, w / 2 - full / 2 + nw - 2, 14, 34, 34);
  }
  if (title) {
    x.font = font2;
    x.lineWidth = 8;
    x.strokeText(title, w / 2, 84);
    x.fillStyle = '#d9c9ff';
    x.fillText(title, w / 2, 84);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.aspect = w / c.height;
  return t;
}

function bubbleTexture(text, wide = false) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = '600 30px Fredoka, sans-serif';
  x.font = font;
  // wrap to ~22 chars a line
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > (wide ? 30 : 24) && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4);
  const w = Math.ceil(Math.max(...shown.map((l) => x.measureText(l).width))) + 44;
  const h = shown.length * 38 + 40;
  c.width = w;
  c.height = h + 16;
  x.font = font;
  x.fillStyle = '#fff8ef';
  x.strokeStyle = '#2a1440';
  x.lineWidth = 5;
  roundRect(x, 4, 4, w - 8, h - 8, 22);
  x.fill();
  x.stroke();
  x.beginPath();
  x.moveTo(w / 2 - 12, h - 6);
  x.lineTo(w / 2, h + 12);
  x.lineTo(w / 2 + 12, h - 6);
  x.fill();
  x.stroke();
  x.fillRect(w / 2 - 10, h - 10, 20, 6);
  x.fillStyle = '#2a1440';
  x.textAlign = 'center';
  shown.forEach((l, i) => x.fillText(l, w / 2, 44 + i * 38));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.aspect = w / c.height;
  t.userData.h = c.height;
  return t;
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

const EMOTE_FX = { heart: '💜', note: '🎵', zzz: '💤', laugh: '😂', clap: '👏', cheer: '🎉' };

export class Character {
  constructor(scene, fx, { spec, name = '', title = '', npc = null, plateColor, likes = 0, outline = true } = {}) {
    this.scene = scene;
    this.fx = fx;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.air = false;
    this.vy = 0;
    this.dizzyUntil = 0;
    this.name = name;
    this.title = title;
    this.likes = likes;
    this.plateColor = plateColor;
    this.npc = npc;
    this.outline = outline;
    this.buffer = []; // remote interpolation
    this.effect = null;
    this.scaleNow = 1;
    if (npc) this.setAvatarObject(npc);
    else this.setAvatar(spec);
    this.setPlate();
  }

  setAvatarObject(av) {
    this.avatar = av;
    this.root.add(av.root);
    this.anim = new Animator(av);
    this.anim.onFx = (kind, phase) => this.onEmoteFx(kind, phase);
  }

  setAvatar(spec, { reveal = false } = {}) {
    const old = this.avatar;
    if (old) {
      this.root.remove(old.root);
      old.dispose();
    }
    if (this.pet) {
      this.scene.remove(this.pet.root);
      this.pet.dispose();
    }
    this.spec = spec;
    this.setAvatarObject(new Avatar(spec, { outline: this.outline }));
    this.pet = new Pet(spec.pet, { outline: this.outline });
    this.scene.add(this.pet.root);
    if (this.effect) this.applyEffect(this.effect);
    if (reveal) {
      this.fx.confetti(this.pos.clone().setY(this.pos.y + 1.5), 60, 4);
      this.fx.sparkle(this.pos.clone().setY(this.pos.y + 1), '#ffe680', 24, 1.5);
      this.popScale = 0;
    }
  }

  setPlate() {
    if (this.plate) {
      this.root.remove(this.plate);
      this.plate.material.map.dispose();
    }
    if (!this.name) return;
    const tex = plateTexture(this.name, this.title, this.plateColor || (this.npc ? '#9ef0ff' : '#ffe066'), this.likes);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
    const h = 0.28 * (tex.image.height / 62);
    s.scale.set(h * tex.userData.aspect, h, 1);
    s.position.y = (this.avatar.height || 1.9) + 0.35;
    s.renderOrder = 10;
    this.plate = s;
    this.root.add(s);
  }

  say(text, secs = 5, talk = false) {
    if (!talk) clearTimeout(this.pageTimer);
    if (this.bubble) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose();
    }
    const tex = bubbleTexture(stripEmoji(text) || text, talk);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !talk }));
    const h = 0.0068 * tex.userData.h;
    s.scale.set(h * tex.userData.aspect, h, 1);
    s.center.set(0.5, 0);
    s.position.y = (this.avatar.height || 1.9) + 0.75;
    s.renderOrder = talk ? 20 : 11;
    this.bubble = s;
    this.bubbleUntil = performance.now() + secs * 1000;
    this.root.add(s);
  }

  hideBubble() {
    clearTimeout(this.pageTimer);
    this.bubbleUntil = 0;
    if (this.bubble) this.bubble.visible = false;
  }

  // Conversation line: long replies are split into bubble pages that follow each other, and the bubble stays
  // readable through walls (it is the conversation, there is no chat log).
  speak(text) {
    const sentences = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*\s*/g) || [String(text)];
    const pages = [];
    let cur = '';
    for (const s of sentences) {
      if ((cur + s).length > 110 && cur) {
        pages.push(cur.trim());
        cur = s;
      } else cur += s;
    }
    if (cur.trim()) pages.push(cur.trim());
    // a single sentence longer than a page: cut it on word boundaries
    this.pages = pages.flatMap((p) => {
      if (p.length <= 120) return [p];
      const out = [];
      let line = '';
      for (const w of p.split(' ')) {
        if ((line + ' ' + w).length > 110 && line) out.push(line.trim() + '…'), (line = w);
        else line += ' ' + w;
      }
      if (line.trim()) out.push(line.trim());
      return out;
    });
    clearTimeout(this.pageTimer);
    const show = (i) => {
      if (i >= this.pages.length) return;
      const p = this.pages[i];
      const secs = Math.max(2.6, p.length * 0.065) + (i === this.pages.length - 1 ? 3 : 0);
      this.say(p, secs, true);
      this.pageTimer = setTimeout(() => show(i + 1), (secs - (i === this.pages.length - 1 ? 3 : 0)) * 1000);
    };
    show(0);
  }

  emote(e) {
    this.anim.play(e);
  }

  onEmoteFx(kind, phase) {
    const head = this.pos.clone().setY(this.pos.y + (this.avatar.height || 1.8) * this.scaleNow);
    if (phase === 'start') {
      if (kind === 'boo') this.fx.emoji('👻', head, 2, { size: 0.6 });
      if (kind === 'cheer') this.fx.confetti(head, 25, 3);
      if (kind === 'flip') this.fx.sparkle(this.pos.clone().setY(this.pos.y + 0.8), '#ffe680', 8);
      if (kind === 'wave') this.fx.emoji('👋', head, 1);
      return;
    }
    if (EMOTE_FX[kind]) this.fx.emoji(EMOTE_FX[kind], head, 1);
  }

  dizzy(secs = 2.5) {
    this.dizzyUntil = performance.now() + secs * 1000;
    if (!this.stars) {
      this.stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('⭐'), transparent: true, depthWrite: false }));
        s.scale.setScalar(0.3);
        this.stars.add(s);
      }
      this.root.add(this.stars);
    }
  }

  // Potion effects: giant, tiny, ghost, glow, speed.
  applyEffect(fx) {
    const kind = fx?.kind || null;
    this.effect = fx;
    this.avatar.setGhost?.(kind === 'ghost');
    if (this.glow) {
      this.root.remove(this.glow);
      this.glow = null;
    }
    if (kind === 'glow') {
      this.glow = glowSprite('#ffe680', 3, 0.5);
      this.glow.position.y = 1;
      this.root.add(this.glow);
    }
  }

  // Pumpkin curse (health hit zero): the character turns into a pumpkin. If they carved one, it wears their carving.
  setPumpkin(on, carving = null) {
    if (this.pumpkin) {
      this.root.remove(this.pumpkin);
      this.pumpkin = null;
    }
    this.avatar.root.visible = !on;
    if (this.pet) this.pet.root.visible = !on;
    if (!on) {
      this.popScale = 0;
      this.fx.sparkle(this.pos.clone().setY(this.pos.y + 1), '#b6ff8a', 24, 1.5);
      return;
    }
    const g = new THREE.Group();
    const pk = PR.pumpkin(this.name.length * 13, 1.6, !carving);
    g.add(toonMesh(merge(pk.toon)));
    if (pk.glow.length) g.add(new THREE.Mesh(merge(pk.glow), glowMat));
    if (carving) {
      const tex = new THREE.TextureLoader().load(`carvings/${carving}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.385 * 1.6, 24, 16, Math.PI / 2 - 0.9, 1.8, 0.28 * Math.PI, 0.5 * Math.PI), new THREE.MeshBasicMaterial({ map: tex, color: '#ffcf6a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      face.position.y = 0.29 * 1.6;
      face.scale.y = 0.78;
      g.add(face);
    }
    const glow = glowSprite('#ff8a2a', 2.4, 0.35);
    glow.position.y = 0.6;
    g.add(glow);
    // a red "help me" beacon so friends can find you (the in-game version of the red LED)
    const sos = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('🆘'), transparent: true, depthWrite: false }));
    sos.scale.setScalar(0.7);
    sos.position.y = 2.1;
    g.add(sos);
    this.sos = sos;
    this.pumpkin = g;
    this.root.add(g);
    this.fx.confetti(this.pos.clone().setY(this.pos.y + 1), 30, 3);
  }

  setBats(on) {
    if (on && !this.batRing) {
      this.batRing = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('🦇'), transparent: true, depthWrite: false }));
        s.scale.setScalar(0.45);
        this.batRing.add(s);
      }
      this.root.add(this.batRing);
    } else if (!on && this.batRing) {
      this.root.remove(this.batRing);
      this.batRing = null;
    }
  }

  // Remote players: queue snapshots (server time) and render ~150 ms behind.
  pushState(t, x, y, z, ry, a, e) {
    this.buffer.push({ t, x, y, z, ry, a, e });
    if (this.buffer.length > 30) this.buffer.shift();
  }

  interpolate(renderT) {
    const b = this.buffer;
    if (!b.length) return;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > renderT) i--;
    const p1 = b[i], p0 = b[Math.max(0, i - 1)];
    let k = p1.t === p0.t ? 1 : (renderT - p0.t) / (p1.t - p0.t);
    k = Math.max(0, Math.min(1.2, k));
    const nx = p0.x + (p1.x - p0.x) * k, nz = p0.z + (p1.z - p0.z) * k, ny = p0.y + (p1.y - p0.y) * k;
    const dist = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    if (dist > 8) this.pos.set(nx, ny, nz);
    this.netSpeed = this.netSpeed ?? 0;
    const sp = Math.hypot(p1.x - p0.x, p1.z - p0.z) / Math.max(0.05, p1.t - p0.t);
    this.netSpeed = damp(this.netSpeed, sp, 8, 1 / 60);
    this.pos.set(nx, ny, nz);
    this.yaw = p1.ry;
    this.air = p1.a === 'air';
    this.speed = this.air ? 0 : this.netSpeed / 7;
    const e = p1.e || '';
    if (e && e !== this.anim.emote && (this.lastNetEmote !== e)) this.anim.play(e);
    if (!e && this.lastNetEmote && this.anim.emote === this.lastNetEmote) this.anim.stop();
    this.lastNetEmote = e;
    if (p1.a === 'dizzy' && performance.now() > this.dizzyUntil) this.dizzy(0.5);
  }

  update(dt, t, camera) {
    const dizzy = performance.now() < this.dizzyUntil;
    this.anim.update(dt, { speed: this.speed, air: this.air, vy: this.vy, dizzy });
    const r = this.root;
    r.position.copy(this.pos);
    if (!this.fixedYaw) r.rotation.y = dampAngle(r.rotation.y, this.yaw, 14, dt);
    let target = 1;
    const k = this.effect?.kind;
    if (k === 'giant') target = 1.7;
    if (k === 'tiny') target = 0.55;
    this.scaleNow = damp(this.scaleNow, target, 6, dt);
    let pop = 1;
    if (this.popScale !== undefined) {
      this.popScale = Math.min(1, this.popScale + dt * 1.6);
      pop = 1 + Math.sin(this.popScale * Math.PI) * 0.35;
      if (this.popScale >= 1) delete this.popScale;
    }
    this.avatar.root.scale.setScalar(this.scaleNow * pop);
    // the shadow stays on the ground while jumping
    if (this.avatar.shadow) this.avatar.shadow.position.y = (groundY(this.pos.x, this.pos.z) - this.pos.y) / (this.scaleNow * pop) + 0.03;
    if (this.plate) this.plate.position.y = ((this.avatar.height || 1.9) + 0.35) * this.scaleNow;
    if (this.bubble) {
      this.bubble.position.y = ((this.avatar.height || 1.9) + 0.75) * this.scaleNow;
      if (performance.now() > this.bubbleUntil) {
        this.root.remove(this.bubble);
        this.bubble.material.map.dispose();
        this.bubble = null;
      }
    }
    if (this.pet) this.pet.update(dt, this.pos, r.rotation.y, this.speed > 0.05);
    if (this.stars) {
      this.stars.visible = dizzy;
      this.stars.position.y = (this.avatar.height || 1.8) * this.scaleNow;
      this.stars.children.forEach((s, i) => s.position.set(Math.cos(t * 5 + i * 2.1) * 0.4, Math.sin(t * 7 + i) * 0.05, Math.sin(t * 5 + i * 2.1) * 0.4));
    }
    if (this.pumpkin) {
      this.pumpkin.rotation.z = Math.sin(t * 2) * 0.06;
      this.pumpkin.position.y = Math.abs(Math.sin(t * 2.4)) * 0.05;
      this.sos.material.opacity = 0.55 + Math.sin(t * 6) * 0.45;
    }
    if (this.batRing) this.batRing.children.forEach((s, i) => s.position.set(Math.cos(t * 2.5 + i * 2.1) * 1.1, 1.9 + Math.sin(t * 6 + i) * 0.2, Math.sin(t * 2.5 + i * 2.1) * 1.1));
    if (k === 'glow' && this.glow) {
      this.glow.material.color.setHSL((t * 0.4) % 1, 0.9, 0.65);
      if (Math.random() < dt * 6) this.fx.sparkle(this.pos.clone().setY(this.pos.y + Math.random() * 1.6), this.glow.material.color.getStyle(), 1, 0.4);
    }
    if (k === 'speed' && this.speed > 0.3 && Math.random() < dt * 20) this.fx.sparkle(this.pos.clone().setY(this.pos.y + 0.5), '#9ef0ff', 1, 0.2);
    void camera;
  }

  dispose() {
    this.scene.remove(this.root);
    if (this.pet) {
      this.scene.remove(this.pet.root);
      this.pet.dispose();
    }
    this.avatar.dispose?.();
  }
}
