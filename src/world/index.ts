import * as THREE from 'three';
import { COLS } from '../rules';
import { Rack, RACK_H, slotX } from './rack';
import { Medallions } from './medallions';

/** The 3D scene. Grey-box version: a plain rack, discs and one light. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  readonly rack = new Rack();
  readonly medals = new Medallions();
  private ghost: THREE.Object3D;
  private carried: THREE.Object3D | null = null;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.scene.background = new THREE.Color(0x0b0908);
    this.scene.add(new THREE.HemisphereLight(0x6fb8ff, 0xff7a1a, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 8, 10);
    this.scene.add(key);
    this.scene.add(this.rack.group);
    this.rack.inner.add(this.medals.group);
    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.43, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    this.ghost.visible = false;
    this.rack.inner.add(this.ghost);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole rack in view on tall, narrow screens.
    const fit = Math.max(1, (9.4 / 8.4) / this.camera.aspect * (8.4 / 9.4) * 1.35);
    this.camera.position.set(0, 0.4, 12.5 * fit);
    this.camera.lookAt(0, 0.4, 0);
    this.camera.updateProjectionMatrix();
  }

  /** The column under a screen point, or -1. */
  pickColumn(x: number, y: number): number {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return -1;
    this.rack.group.worldToLocal(hit);
    if (Math.abs(hit.y) > RACK_H / 2 + 1.6) return -1;
    const col = Math.round(hit.x + (COLS - 1) / 2);
    return col >= 0 && col < COLS ? col : -1;
  }

  /** Shows the next medallion above a column with a ghost where it will land. */
  aim(col: number, row: number, piece: number): void {
    this.clearAim();
    if (col < 0) return;
    this.carried = this.medals.make(piece);
    this.carried.position.set(slotX(col), RACK_H / 2 + 0.75, 0);
    this.rack.inner.add(this.carried);
    this.ghost.position.set(slotX(col), row - 2.5, 0.1);
    this.ghost.visible = true;
  }

  clearAim(): void {
    if (this.carried) this.rack.inner.remove(this.carried);
    this.carried = null;
    this.ghost.visible = false;
  }

  update(dt: number): void {
    this.rack.update(dt);
    this.medals.update(dt);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
