import * as THREE from 'three';
import { COLS, ROWS } from '../rules';

export const slotX = (col: number): number => col - (COLS - 1) / 2;
export const slotY = (row: number): number => row - (ROWS - 1) / 2;
export const RACK_W = 7.6;
export const RACK_H = 6.6;
export const ENTRY_Y = RACK_H / 2 + 1.15;
/** Height of the chain anchors above the rack centre. The rack swings from here. */
export const PIVOT_Y = 19;
const WINDOW_R = 0.39;

function noiseCanvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}

/** Scratched, pitted iron: used as bump and roughness. */
export function ironTexture(): THREE.CanvasTexture {
  const c = noiseCanvas(512, (g, s) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.random() * 90;
      g.fillStyle = `rgba(${v},${v},${v},${0.08 + Math.random() * 0.2})`;
      const r = Math.random() * 2.2;
      g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? 40 : 200},${Math.random() < 0.5 ? 40 : 200},60,${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 0.5 + Math.random();
      const x = Math.random() * s;
      const y = Math.random() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90);
      g.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 6 + Math.random() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(30,30,30,0.25)');
      grd.addColorStop(1, 'rgba(30,30,30,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Worn runes for the front plate, laid out in plate coordinates. */
function runeTexture(): THREE.CanvasTexture {
  const W = 1216;
  const H = 1056;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const px = (x: number) => ((x + RACK_W / 2) / RACK_W) * W;
  const py = (y: number) => (1 - (y + RACK_H / 2) / RACK_H) * H;
  const u = W / RACK_W;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const glyph = (x: number, y: number, size: number, alpha: number) => {
    g.save();
    g.translate(px(x), py(y));
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = Math.max(1.5, size * u * 0.13);
    g.lineCap = 'round';
    const s = size * u * 0.5;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(0, s);
    const strokes = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < strokes; i++) {
      const y0 = (rnd() * 2 - 1) * s * 0.7;
      const dir = rnd() < 0.5 ? -1 : 1;
      g.moveTo(0, y0);
      g.lineTo(dir * s * 0.6, y0 + (rnd() < 0.5 ? -1 : 1) * s * 0.5);
    }
    g.stroke();
    g.restore();
  };
  // Small glyphs in the diamonds between four windows.
  for (let c2 = 0; c2 <= COLS; c2++) {
    for (let r = 0; r <= ROWS; r++) {
      const edge = c2 === 0 || c2 === COLS || r === 0 || r === ROWS;
      if (edge && rnd() < 0.25) continue;
      glyph(c2 - COLS / 2 + (edge ? 0 : 0), r - ROWS / 2, edge ? 0.16 : 0.2, 0.55 + rnd() * 0.45);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plateShape(): THREE.Shape {
  const hw = RACK_W / 2;
  const hh = RACK_H / 2;
  const r = 0.18;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  for (let c = 0; c < COLS; c++) {
    for (let row = 0; row < ROWS; row++) {
      const h = new THREE.Path();
      h.absarc(slotX(c), slotY(row), WINDOW_R, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
  }
  return s;
}

/** A hanging chain of alternating links between two points. */
export function makeChain(from: THREE.Vector3, to: THREE.Vector3, mat: THREE.Material, scale = 1): THREE.InstancedMesh {
  const link = new THREE.TorusGeometry(0.2 * scale, 0.065 * scale, 6, 12);
  link.scale(0.72, 1.25, 1);
  const len = from.distanceTo(to);
  const step = 0.36 * scale;
  const n = Math.max(2, Math.floor(len / step));
  const mesh = new THREE.InstancedMesh(link, mat, n);
  const dir = to.clone().sub(from).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const twist = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    p.copy(from).addScaledVector(dir, (i + 0.5) * (len / n));
    twist.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i % 2 ? Math.PI / 2 : 0);
    m.compose(p, q.clone().multiply(twist), one);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** The iron rack: two plates with 42 windows, a frame, rivets, runes, and four chains it swings on. */
export class Rack {
  /** Pivot at the chain anchors. Sway turns this. */
  readonly group = new THREE.Group();
  /** Rack-local space: slot (col,row) is at (slotX, slotY, 0). Upend turns this. */
  readonly inner = new THREE.Group();
  /** Chains and their eyes: they stay put when the rack turns over. */
  readonly hangers = new THREE.Group();
  readonly iron: THREE.MeshStandardMaterial;
  private plateMat: THREE.MeshStandardMaterial;
  private channelGlow: THREE.Mesh[] = [];
  /** Sway state: angle and angular velocity about z (side to side) and x (front to back). */
  private az = 0;
  private vz = 0;
  private ax = 0;
  private vx = 0;
  runes = 0.05;
  comfort = false;

  constructor() {
    this.group.position.y = PIVOT_Y;
    this.inner.position.y = -PIVOT_Y;
    this.group.add(this.inner);
    this.hangers.position.y = -PIVOT_Y;
    this.group.add(this.hangers);

    const tex = ironTexture();
    tex.repeat.set(0.35, 0.35);
    this.iron = new THREE.MeshStandardMaterial({ color: 0x2a2623, metalness: 0.85, roughness: 0.52, bumpMap: tex, bumpScale: 1.4, roughnessMap: tex });
    this.plateMat = this.iron.clone();
    const runes = runeTexture();
    // Extrude UVs are in shape units: map the plate rectangle onto the texture.
    runes.repeat.set(1 / RACK_W, 1 / RACK_H);
    runes.offset.set(0.5, 0.5);
    this.plateMat.emissive = new THREE.Color(0xff8a2a);
    this.plateMat.emissiveMap = runes;
    this.plateMat.emissiveIntensity = this.runes;

    const plateGeo = new THREE.ExtrudeGeometry(plateShape(), { depth: 0.14, bevelEnabled: false, curveSegments: 20 });
    // The window walls are matte so the lava light does not glint in every empty slot.
    const wall = new THREE.MeshStandardMaterial({ color: 0x14110f, metalness: 0.1, roughness: 1 });
    const front = new THREE.Mesh(plateGeo, [this.plateMat, wall]);
    front.position.z = 0.115;
    const back = new THREE.Mesh(plateGeo, [this.iron, wall]);
    back.position.z = -0.205;
    this.inner.add(front, back);

    // Frame: heavy bars round the plates.
    const bar = (w: number, h: number, d: number, x: number, y: number, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.iron);
      m.position.set(x, y, z);
      this.inner.add(m);
      return m;
    };
    const hw = RACK_W / 2;
    const hh = RACK_H / 2;
    bar(0.34, RACK_H + 0.9, 0.62, -hw - 0.12, 0.1);
    bar(0.34, RACK_H + 0.9, 0.62, hw + 0.12, 0.1);
    bar(RACK_W + 0.9, 0.36, 0.7, 0, -hh - 0.14);
    // The top is open between two rails so medallions can drop in.
    bar(RACK_W + 0.9, 0.2, 0.16, 0, hh + 0.12, 0.3);
    bar(RACK_W + 0.9, 0.2, 0.16, 0, hh + 0.12, -0.3);
    // Channel walls between columns.
    for (let c = 1; c < COLS; c++) bar(0.05, RACK_H, 0.24, slotX(c) - 0.5, 0);
    // Corner blocks and chain eyes.
    const eye = new THREE.TorusGeometry(0.26, 0.08, 8, 16);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        bar(0.5, 0.5, 0.3, sx * (hw + 0.12), hh + 0.45, sz * 0.3);
        const e = new THREE.Mesh(eye, this.iron);
        e.position.set(sx * (hw + 0.12), hh + 0.85, sz * 0.3);
        e.rotation.y = Math.PI / 2;
        this.hangers.add(e);
        const chain = makeChain(
          new THREE.Vector3(sx * (hw + 0.12), hh + 1.0, sz * 0.3),
          new THREE.Vector3(sx * (hw + 1.6), PIVOT_Y + 4, sz * 1.4),
          this.iron,
          1.25,
        );
        this.hangers.add(chain);
      }
    }
    // Rivets at every crossing between windows, front and back.
    const rivetGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const pts: THREE.Vector3[] = [];
    for (let c = 0; c <= COLS; c++) {
      for (let r = 0; r <= ROWS; r++) {
        const x = c - COLS / 2;
        const y = r - ROWS / 2;
        const edge = c === 0 || c === COLS || r === 0 || r === ROWS;
        const ox = c === 0 ? 0.14 : c === COLS ? -0.14 : 0;
        const oy = r === 0 ? 0.14 : r === ROWS ? -0.14 : 0;
        if (edge) pts.push(new THREE.Vector3(x + ox, y + oy, 0.235));
        else {
          pts.push(new THREE.Vector3(x - 0.13, y, 0.235), new THREE.Vector3(x + 0.13, y, 0.235));
        }
      }
    }
    const rivets = new THREE.InstancedMesh(rivetGeo, this.iron, pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach((p, i) => rivets.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
    this.inner.add(rivets);

    // One glow strip per channel, used by Quench.
    const stripGeo = new THREE.PlaneGeometry(0.92, RACK_H - 0.1);
    for (let c = 0; c < COLS; c++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const strip = new THREE.Mesh(stripGeo, mat);
      strip.position.set(slotX(c), 0, 0.25);
      strip.visible = false;
      this.inner.add(strip);
      this.channelGlow.push(strip);
    }
  }

  /** Blue glow on a frozen channel, 0 to 1. */
  setFrost(col: number, amount: number): void {
    const s = this.channelGlow[col];
    s.visible = amount > 0.01;
    (s.material as THREE.MeshBasicMaterial).opacity = amount * 0.28;
  }

  /** Kicks the rack: side is sideways push (by column offset), push is front to back. */
  sway(side: number, push = 0.4): void {
    const k = this.comfort ? 0.5 : 1;
    this.vz += side * 0.05 * k;
    this.vx += push * 0.035 * k;
  }

  update(dt: number): void {
    // Damped springs that settle within about a second.
    const w = 7.5;
    const d = 5.2;
    this.vz += (-w * w * this.az - d * this.vz) * dt;
    this.az += this.vz * dt;
    this.vx += (-w * w * this.ax - d * this.vx) * dt;
    this.ax += this.vx * dt;
    this.group.rotation.z = this.az;
    this.group.rotation.x = this.ax;
    this.plateMat.emissiveIntensity = this.runes;
  }
}
