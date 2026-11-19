import * as THREE from 'three';
import { EMBER, FROST, SLAG } from '../rules';
import { slotX, slotY } from './rack';

export interface Medal {
  mesh: THREE.Object3D;
  col: number;
  row: number;
  piece: number;
}

const COLOURS: Record<number, number> = { [EMBER]: 0xff7a1a, [FROST]: 0x6fd6ff, [SLAG]: 0x4a4744 };

/** Grey-box medallions: flat-shaded discs. Replaced by cast medallions in milestone 4. */
export class Medallions {
  readonly group = new THREE.Group();
  readonly list: Medal[] = [];
  private geo = new THREE.CylinderGeometry(0.43, 0.43, 0.18, 40).rotateX(Math.PI / 2);

  make(piece: number): THREE.Object3D {
    const c = COLOURS[piece];
    return new THREE.Mesh(
      this.geo,
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: piece === SLAG ? 0 : 0.35, roughness: 0.5, metalness: 0.3 }),
    );
  }

  spawn(col: number, row: number, piece: number): Medal {
    const mesh = this.make(piece);
    mesh.position.set(slotX(col), slotY(row), 0);
    this.group.add(mesh);
    const m: Medal = { mesh, col, row, piece };
    this.list.push(m);
    return m;
  }

  at(col: number, row: number): Medal | undefined {
    return this.list.find((m) => m.col === col && m.row === row);
  }

  remove(m: Medal): void {
    this.group.remove(m.mesh);
    const i = this.list.indexOf(m);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear(): void {
    for (const m of this.list.slice()) this.remove(m);
  }

  update(_dt: number): void {}
}
