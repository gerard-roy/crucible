import * as THREE from 'three';
import { EMBER, FROST, SLAG } from '../rules';
import { slotX, slotY } from './rack';

export interface Medal {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  col: number;
  row: number;
  piece: number;
  /** Extra glow, 0 to 1: an open line of three, or the winning seam. */
  hot: number;
  hotTarget: number;
  /** Overall fire, 1 normal, 0 gone cold. */
  fire: number;
  fireTarget: number;
  born: number;
}

const GLOW: Record<number, number> = { [EMBER]: 0xff6a12, [FROST]: 0x58c8ff, [SLAG]: 0xff2a08 };
const LIGHT: Record<number, number> = { [EMBER]: 0xff7a1a, [FROST]: 0x6fd6ff };

function hammer(g: CanvasRenderingContext2D, s: number): void {
  g.save();
  g.translate(s / 2, s / 2);
  g.rotate(-Math.PI / 4);
  g.fillRect(-s * 0.035, -s * 0.1, s * 0.07, s * 0.36);
  g.fillRect(-s * 0.19, -s * 0.24, s * 0.38, s * 0.17);
  g.restore();
}

function star(g: CanvasRenderingContext2D, s: number): void {
  g.save();
  g.translate(s / 2, s / 2);
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? s * 0.055 : i % 4 === 0 ? s * 0.27 : s * 0.15;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** Face textures: `glow` is the light from within, `bump` raises the sigil and rim. */
function faceTextures(piece: number): { glow: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 256;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const gc = mk();
  const g = gc.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const bc = mk();
  const b = bc.getContext('2d')!;
  b.fillStyle = '#404040';
  b.fillRect(0, 0, S, S);
  if (piece === SLAG) {
    // Cracks with a dying red in them.
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [ctx, col, w] of [[g, 'rgba(255,255,255,0.9)', 3], [b, '#000', 7]] as const) {
      seed = 11;
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        let x = S / 2 + (rnd() - 0.5) * 50;
        let y = S / 2 + (rnd() - 0.5) * 50;
        let a = rnd() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          a += (rnd() - 0.5) * 1.3;
          x += Math.cos(a) * 26;
          y += Math.sin(a) * 26;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < 500; i++) {
      const v = Math.floor(rnd() * 120);
      b.fillStyle = `rgba(${v},${v},${v},0.5)`;
      b.fillRect(rnd() * S, rnd() * S, 4, 4);
    }
  } else {
    // Heat from within: brightest at the heart, with the sigil cut bright.
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.5);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    grd.addColorStop(0.8, 'rgba(255,255,255,0.1)');
    grd.addColorStop(1, 'rgba(255,255,255,0.3)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = S * 0.02;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 10;
    (piece === EMBER ? hammer : star)(g, S);
    b.strokeStyle = '#c0c0c0';
    b.lineWidth = S * 0.05;
    b.beginPath();
    b.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
    b.stroke();
    b.fillStyle = '#fff';
    (piece === EMBER ? hammer : star)(b, S);
  }
  const glow = new THREE.CanvasTexture(gc);
  glow.colorSpace = THREE.SRGBColorSpace;
  glow.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bc);
  return { glow, bump };
}

/** Cast medallions: thick bevelled discs with a raised, glowing sigil. */
export class Medallions {
  readonly group = new THREE.Group();
  readonly list: Medal[] = [];
  /** How many of the newest medallions cast real light. */
  lightCount = 6;
  private geo: THREE.BufferGeometry;
  private tex: Record<number, { glow: THREE.CanvasTexture; bump: THREE.CanvasTexture }>;
  private lights: THREE.PointLight[] = [];
  private clock = 0;

  constructor() {
    // Disc 0.86 across and 0.18 deep, bevelled, axis along z.
    const r = 0.43;
    const h = 0.09;
    const prof = [
      new THREE.Vector2(0, -h), new THREE.Vector2(r - 0.035, -h), new THREE.Vector2(r, -h + 0.035),
      new THREE.Vector2(r, h - 0.035), new THREE.Vector2(r - 0.035, h), new THREE.Vector2(0, h),
    ];
    const geo = new THREE.LatheGeometry(prof, 40);
    geo.rotateX(Math.PI / 2);
    // Planar UVs so both faces carry the sigil the right way round.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const front = pos.getZ(i) >= 0;
      uv.setXY(i, 0.5 + ((front ? 1 : -1) * pos.getX(i)) / (r * 2), 0.5 + pos.getY(i) / (r * 2));
    }
    geo.computeVertexNormals();
    this.geo = geo;
    this.tex = { [EMBER]: faceTextures(EMBER), [FROST]: faceTextures(FROST), [SLAG]: faceTextures(SLAG) };
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 3.6, 1.6);
      this.lights.push(l);
      this.group.add(l);
    }
  }

  material(piece: number): THREE.MeshStandardMaterial {
    const t = this.tex[piece];
    return new THREE.MeshStandardMaterial({
      color: piece === SLAG ? 0x4b4743 : piece === EMBER ? 0x3a2416 : 0x1c2a33,
      metalness: piece === SLAG ? 0.3 : 0.75,
      roughness: piece === SLAG ? 0.9 : 0.42,
      emissive: GLOW[piece],
      emissiveMap: t.glow,
      emissiveIntensity: piece === SLAG ? 0.5 : 2.2,
      bumpMap: t.bump,
      bumpScale: piece === SLAG ? 3 : 2.5,
    });
  }

  /** A loose medallion, not on the rack (the crane's, or one in flight). */
  make(piece: number): THREE.Mesh {
    return new THREE.Mesh(this.geo, this.material(piece));
  }

  spawn(col: number, row: number, piece: number): Medal {
    const mesh = this.make(piece);
    mesh.position.set(slotX(col), slotY(row), 0);
    this.group.add(mesh);
    const m: Medal = { mesh, mat: mesh.material as THREE.MeshStandardMaterial, col, row, piece, hot: 0, hotTarget: 0, fire: 1, fireTarget: 1, born: this.clock };
    this.list.push(m);
    return m;
  }

  at(col: number, row: number): Medal | undefined {
    return this.list.find((m) => m.col === col && m.row === row);
  }

  /** Turns a medallion to slag in place. */
  toSlag(m: Medal): void {
    m.piece = SLAG;
    m.mat.dispose();
    m.mat = this.material(SLAG);
    m.mesh.material = m.mat;
    m.hot = m.hotTarget = 0;
  }

  remove(m: Medal): void {
    this.group.remove(m.mesh);
    m.mat.dispose();
    const i = this.list.indexOf(m);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear(): void {
    for (const m of this.list.slice()) this.remove(m);
  }

  update(dt: number): void {
    this.clock += dt;
    const k = 1 - Math.exp(-dt * 6);
    for (const m of this.list) {
      m.hot += (m.hotTarget - m.hot) * k;
      m.fire += (m.fireTarget - m.fire) * k;
      if (m.piece === SLAG) {
        m.mat.emissiveIntensity = 0.35 + 0.2 * Math.sin(this.clock * 1.3 + m.col * 2 + m.row);
        continue;
      }
      const pulse = m.hot > 0.02 ? 0.5 + 0.5 * Math.sin(this.clock * 5 + m.col) : 0;
      m.mat.emissiveIntensity = m.fire * (2.2 + m.hot * (3.2 + pulse * 1.6));
    }
    // The newest medallions carry the real lights.
    const lit = this.list.filter((m) => m.piece !== SLAG).slice(-this.lightCount).reverse();
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const m = lit[i];
      if (!m) { l.intensity = 0; continue; }
      l.color.setHex(LIGHT[m.piece]);
      l.position.set(m.mesh.position.x, m.mesh.position.y, 0.75);
      l.intensity = m.fire * (2.6 + m.hot * 3);
    }
  }
}
