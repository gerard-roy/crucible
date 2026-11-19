import * as THREE from 'three';
import { COLS, EMBER } from '../rules';
import { Rack, RACK_H, slotX, slotY } from './rack';
import { Medallions } from './medallions';
import { Crane, Forge, LAVA_Y } from './forge';
import { Embers, Smoke, Sparks } from './effects';
import { CameraRig } from './camera';
import { Post } from './post';

export type Quality = 'high' | 'medium' | 'low';

const QUALITY: Record<Quality, { pixelRatio: number; embers: number; haze: boolean; bloomScale: number; grain: boolean; lights: number }> = {
  high: { pixelRatio: 2, embers: 2000, haze: true, bloomScale: 1, grain: true, lights: 6 },
  medium: { pixelRatio: 1.5, embers: 1000, haze: false, bloomScale: 0.5, grain: true, lights: 6 },
  low: { pixelRatio: 1, embers: 300, haze: false, bloomScale: 0.5, grain: false, lights: 3 },
};

export const EMBER_COLOUR = new THREE.Color(3.2, 1.3, 0.25);
export const FROST_COLOUR = new THREE.Color(0.7, 1.7, 3.0);
export const sparkColour = (piece: number): THREE.Color => (piece === EMBER ? EMBER_COLOUR : FROST_COLOUR);

/** The forge: one real-time scene with the rack, the hall, the particles and the post chain. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly rack = new Rack();
  readonly medals = new Medallions();
  readonly forge: Forge;
  readonly crane: Crane;
  readonly embers = new Embers();
  readonly sparks = new Sparks();
  readonly smoke = new Smoke();
  readonly post: Post;
  quality: Quality = 'medium';
  /** Set while a full-screen panel covers the scene: nothing 3D is drawn. */
  paused = false;
  private ghost: THREE.Mesh;
  private carried: THREE.Mesh | null = null;
  private carriedPiece = 0;
  private flashLight: THREE.PointLight;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private tmp = new THREE.Vector3();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.scene.background = new THREE.Color(0x030202);
    this.scene.fog = new THREE.FogExp2(0x070302, 0.017);

    this.forge = new Forge(this.rack.iron);
    this.crane = new Crane(this.rack.iron);
    this.scene.add(this.forge.group, this.rack.group, this.embers.points, this.smoke.group);
    this.rack.inner.add(this.medals.group);
    // The crane and loose particles live in world space so they do not swing with the rack.
    this.scene.add(this.crane.group, this.sparks.points);

    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.37, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    this.ghost.visible = false;
    this.rack.inner.add(this.ghost);

    this.flashLight = new THREE.PointLight(0xffb060, 0, 9, 1.5);
    this.rack.inner.add(this.flashLight);

    this.post = new Post(this.renderer, this.scene, this.rig.camera);
    this.setQuality('medium');
    window.addEventListener('resize', () => this.resize());
    const start = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.rig.pose('rack', start);
    this.rig.snap(start.pos, start.look);
  }

  get camera(): THREE.PerspectiveCamera { return this.rig.camera; }

  setQuality(q: Quality): void {
    this.quality = q;
    const s = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatio));
    this.embers.setCount(s.embers);
    this.medals.lightCount = s.lights;
    this.post.configure({ haze: s.haze, grain: s.grain, bloomScale: s.bloomScale });
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
    this.post.setSize(w, h);
    // Point sprites are sized in device pixels: keep them the same on every screen.
    const scale = (h * this.renderer.getPixelRatio()) / 900;
    this.embers.setPixelScale(scale);
    this.sparks.setPixelScale(scale);
    this.forge.setPixelScale(scale);
  }

  /** The column under a screen point, or -1. */
  pickColumn(x: number, y: number): number {
    const hit = this.pickPoint(x, y);
    if (!hit || Math.abs(hit.y) > RACK_H / 2 + 2.2) return -1;
    const col = Math.round(hit.x + (COLS - 1) / 2);
    return col >= 0 && col < COLS && Math.abs(hit.x) < COLS / 2 + 0.3 ? col : -1;
  }

  /** The slot under a screen point, or null. */
  pickSlot(x: number, y: number): { col: number; row: number } | null {
    const hit = this.pickPoint(x, y);
    if (!hit) return null;
    const col = Math.round(hit.x + (COLS - 1) / 2);
    const row = Math.round(hit.y + 2.5);
    return col >= 0 && col < COLS && row >= 0 && row < 6 ? { col, row } : null;
  }

  private pickPoint(x: number, y: number): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.rig.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    return this.rack.inner.worldToLocal(hit);
  }

  /** The crane carries the next medallion above a column; a ghost marks where it will land. */
  aim(col: number, row: number, piece: number): void {
    if (col < 0) { this.clearAim(); return; }
    if (!this.carried || this.carriedPiece !== piece) {
      this.dropCarried();
      this.carried = this.medals.make(piece);
      this.carriedPiece = piece;
      this.crane.hold.add(this.carried);
    }
    this.crane.aimAt(col);
    this.crane.openTarget = 0;
    this.ghost.position.set(slotX(col), slotY(row), 0.26);
    (this.ghost.material as THREE.MeshBasicMaterial).color.copy(sparkColour(piece)).multiplyScalar(0.5);
    (this.ghost.material as THREE.MeshBasicMaterial).opacity = 0.55;
    this.ghost.visible = row < 6;
  }

  private dropCarried(): void {
    if (this.carried) {
      this.crane.hold.remove(this.carried);
      (this.carried.material as THREE.Material).dispose();
    }
    this.carried = null;
  }

  /** Releases the carried medallion: the tongs open and the ghost goes. */
  clearAim(): void {
    this.dropCarried();
    this.crane.openTarget = 1;
    this.ghost.visible = false;
  }

  /** A slot's position in world space. */
  slotWorld(col: number, row: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.rack.inner.localToWorld(out.set(slotX(col), slotY(row), 0.3));
  }

  /** Everything a landing does at once: sparks, a warm flash, sway, a lava flare and shake. */
  impact(col: number, row: number, piece: number, strength = 1): void {
    const at = this.slotWorld(col, row - 0.45, this.tmp);
    this.sparks.burst(at, Math.round(120 * Math.min(1.5, strength)), sparkColour(piece), {
      speed: 4.5 * strength, up: 2.2, floorY: this.slotWorld(col, -0.95).y, life: 1.0, size: 0.9,
    });
    this.flashLight.color.copy(sparkColour(piece));
    this.flashLight.position.set(slotX(col), slotY(row) - 0.3, 0.9);
    this.flashLight.intensity = 26 * strength;
    this.rack.sway((col - 3) / 3 + (Math.random() - 0.5) * 0.3, 0.5 * strength);
    this.forge.lava.flare = Math.min(1.5, this.forge.lava.flare + 0.55 * strength);
    this.rig.shake(0.16 * strength);
  }

  update(dt: number): void {
    this.rack.update(dt);
    this.medals.update(dt);
    this.forge.update(dt);
    this.crane.update(dt);
    this.embers.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.flashLight.intensity *= Math.exp(-dt * 9);
    this.rig.update(dt);
    // Where the lava line sits on screen, for the heat haze.
    this.tmp.set(0, LAVA_Y, -4).project(this.rig.camera);
    this.post.setHazeLine(this.tmp.y * 0.5 + 0.5);
  }

  render(dt = 1 / 60): void {
    if (this.paused) return;
    this.post.render(dt);
  }
}
