import * as THREE from 'three';
import { COLS, ROWS } from '../rules';

export const slotX = (col: number): number => col - (COLS - 1) / 2;
export const slotY = (row: number): number => row - (ROWS - 1) / 2;
export const RACK_W = 7.6;
export const RACK_H = 6.6;
/** Height above the rack centre where a medallion enters its channel. */
export const ENTRY_Y = RACK_H / 2 + 0.75;

/** Grey-box rack: a plain frame with column dividers. Replaced by the forged rack in milestone 4. */
export class Rack {
  readonly group = new THREE.Group();
  /** Medallions and effects that move with the rack hang here. */
  readonly inner = new THREE.Group();

  constructor() {
    const iron = new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.7, metalness: 0.4 });
    const bar = (w: number, h: number, d: number, x: number, y: number, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iron);
      m.position.set(x, y, z);
      this.group.add(m);
    };
    bar(RACK_W, 0.3, 0.6, 0, -RACK_H / 2, 0);
    bar(0.3, RACK_H, 0.6, -RACK_W / 2, 0, 0);
    bar(0.3, RACK_H, 0.6, RACK_W / 2, 0, 0);
    for (let c = 1; c < COLS; c++) bar(0.06, RACK_H - 0.3, 0.5, slotX(c) - 0.5, 0);
    for (let r = 1; r < ROWS; r++) bar(RACK_W - 0.3, 0.04, 0.08, 0, slotY(r) - 0.5, -0.22);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(RACK_W, RACK_H),
      new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 1 }),
    );
    back.position.z = -0.3;
    this.group.add(back);
    this.group.add(this.inner);
  }

  update(_dt: number): void {}
}
