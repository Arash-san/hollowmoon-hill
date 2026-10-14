// Local player movement (camera-relative), jumping, collisions against world circles, and the follow camera.
import { THREE, clamp, damp } from '../engine/toon.js';
import { groundY } from '../world/world.js';
import { WORLD_RADIUS } from '../../../shared/world.js';

const WALK = 3.6, RUN = 7.2, JUMP = 7.4, GRAVITY = 21;

export class PlayerController {
  constructor(character, camera, input, world) {
    this.c = character;
    this.camera = camera;
    this.input = input;
    this.world = world;
    this.vel = new THREE.Vector3();
    this.camYaw = 0; // camera south of the player, looking north at the plaza
    this.camPitch = 0.42;
    this.camDist = 9;
    this.camTarget = new THREE.Vector3();
    this.grounded = true;
    this.frozen = false;
    this.speedBoost = 1;
    this.lockedUntil = 0;
  }

  jump() {
    if (this.grounded && !this.frozen) {
      this.vel.y = JUMP * (this.c.effect?.kind === 'giant' ? 1.15 : 1);
      this.grounded = false;
      this.onJump?.();
      return true;
    }
    return false;
  }

  update(dt) {
    const c = this.c, inp = this.input;
    const cam = inp.consumeCamera();
    this.camYaw -= cam.dx;
    this.camPitch = clamp(this.camPitch + cam.dy, 0.08, 1.25);
    this.camDist = clamp(this.camDist + cam.zoom, 4, 18);

    // movement relative to the camera
    let mx = inp.move.x, mz = inp.move.y;
    if (this.frozen || performance.now() < this.lockedUntil || performance.now() < c.dizzyUntil) mx = mz = 0;
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    const wx = mx * cos + mz * sin, wz = -mx * sin + mz * cos;
    const len = Math.hypot(wx, wz);
    let speed = (inp.walk ? WALK : RUN) * this.speedBoost;
    if (c.effect?.kind === 'speed') speed *= 1.7;
    if (c.effect?.kind === 'tiny') speed *= 0.85;
    if (c.anim.emote === 'zombie') speed *= 0.45;
    const tx = len > 0.01 ? (wx / Math.max(1, len)) * speed : 0;
    const tz = len > 0.01 ? (wz / Math.max(1, len)) * speed : 0;
    const accel = this.grounded ? 14 : 4;
    this.vel.x = damp(this.vel.x, tx, accel, dt);
    this.vel.z = damp(this.vel.z, tz, accel, dt);
    if (len > 0.05) {
      c.yaw = Math.atan2(wx, wz);
      if (c.anim.emote && c.anim.emote !== 'zombie' && c.anim.emote !== 'dance') c.anim.stop();
    }

    // integrate
    const p = c.pos;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    this.vel.y -= GRAVITY * dt;
    p.y += this.vel.y * dt;
    const gy = groundY(p.x, p.z);
    if (p.y <= gy) {
      p.y = gy;
      if (!this.grounded && this.vel.y < -4) this.onLand?.();
      this.vel.y = 0;
      this.grounded = true;
    } else if (p.y > gy + 0.05) this.grounded = false;

    // collisions: push out of circles
    const pr = 0.45 * c.scaleNow;
    for (const col of this.world.colliders) {
      const dx = p.x - col.x, dz = p.z - col.z;
      const min = col.r + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = col.x + (dx / d) * min;
        p.z = col.z + (dz / d) * min;
      }
    }
    for (const col of this.extraColliders || []) {
      const dx = p.x - col.x, dz = p.z - col.z, min = col.r + pr, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = col.x + (dx / d) * min;
        p.z = col.z + (dz / d) * min;
      }
    }
    const r = Math.hypot(p.x, p.z);
    if (r > WORLD_RADIUS) {
      p.x *= WORLD_RADIUS / r;
      p.z *= WORLD_RADIUS / r;
    }

    c.speed = Math.hypot(this.vel.x, this.vel.z) / RUN;
    c.air = !this.grounded;
    c.vy = this.vel.y;

    // camera: orbit behind, eased, never under the ground
    const target = this.camTarget;
    target.set(p.x, p.y + 1.3 * c.scaleNow, p.z);
    const dist = this.camDist * (c.scaleNow > 1.2 ? 1.35 : 1);
    const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    let cy = target.y + Math.sin(this.camPitch) * dist;
    cy = Math.max(cy, groundY(cx, cz) + 0.6);
    const cam3 = this.camera.position;
    const k = this.snapCam ? 1 : 1 - Math.exp(-10 * dt);
    this.snapCam = false;
    cam3.x += (cx - cam3.x) * k;
    cam3.y += (cy - cam3.y) * k;
    cam3.z += (cz - cam3.z) * k;
    this.camera.lookAt(target);
  }

  animState() {
    if (performance.now() < this.c.dizzyUntil) return 'dizzy';
    if (!this.grounded) return 'air';
    return this.c.speed > 0.05 ? 'run' : 'idle';
  }
}
