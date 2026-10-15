// Renderer, scene, lights, fog and quality scaling (tablets get fewer pixels and no distant outlines).
import { THREE, syncOutlineFog } from './toon.js';

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q) return Number(q);
  const touch = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (touch && cores <= 4) return 0;
  return touch ? 1 : 2;
}

export class Stage {
  constructor(container, quality = detectQuality()) {
    this.quality = quality;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: quality > 0, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.maxRatio = quality === 0 ? 1 : quality === 1 ? 1.5 : 2;
    this.ratio = Math.min(devicePixelRatio || 1, this.maxRatio);
    renderer.setPixelRatio(this.ratio);
    container.appendChild(renderer.domElement);
    renderer.domElement.id = 'game-canvas';

    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.FogExp2('#2b2150', 0.0085);
    syncOutlineFog(scene);
    scene.add(new THREE.HemisphereLight('#9f95ff', '#3a2a22', 1.15));
    const moon = (this.moon = new THREE.DirectionalLight('#ffe8c4', 2.6));
    moon.position.set(-40, 60, -30);
    scene.add(moon);
    const rim = new THREE.DirectionalLight('#ff8a5c', 0.55);
    rim.position.set(30, 10, 40);
    scene.add(rim);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    this.resize();
    addEventListener('resize', () => this.resize());
    this.frameTimes = [];
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // portrait tablets: widen the view a bit so the world does not feel cramped
    this.camera.fov = w < h ? 62 : 50;
    if (this.shift) this.camera.setViewOffset(w, h, this.shift, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  // Drop resolution when frames are slow, raise it again when there is headroom.
  adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let r = this.ratio;
    if (avg > 1 / 40 && r > 0.6) r = Math.max(0.6, r - 0.15);
    else if (avg < 1 / 57 && r < Math.min(devicePixelRatio || 1, this.maxRatio)) r = Math.min(this.maxRatio, r + 0.1);
    if (r !== this.ratio) {
      this.ratio = r;
      this.renderer.setPixelRatio(r);
      this.resize();
    }
  }

  // Slide the picture sideways (px; positive moves the world left) so a side panel does not cover what matters,
  // e.g. you and the character you talk to stay in view next to the NPC dialog.
  setShift(px) {
    this.shiftTarget = px;
  }

  render() {
    const target = this.shiftTarget || 0;
    if (Math.abs((this.shift || 0) - target) > 0.5) {
      this.shift = (this.shift || 0) + (target - (this.shift || 0)) * 0.12;
      if (Math.abs(this.shift) < 0.5) this.shift = 0;
      if (this.shift) this.camera.setViewOffset(innerWidth, innerHeight, this.shift, 0, innerWidth, innerHeight);
      else this.camera.clearViewOffset();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
