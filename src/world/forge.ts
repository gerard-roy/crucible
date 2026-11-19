import * as THREE from 'three';
import { ENTRY_Y, RACK_H, RACK_W, makeChain, slotX } from './rack';

export const LAVA_Y = -7.2;

const NOISE = /* glsl */ `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
`;

/** The lava river: two scrolling noise layers, dark crust plates, bright cracks and bubbles. */
export class Lava {
  readonly mesh: THREE.Mesh;
  readonly uniforms = { uTime: { value: 0 }, uFlare: { value: 0 } };
  flare = 0;

  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uFlare; varying vec3 vW;
        ${NOISE}
        void main(){
          vec2 p = vW.xz * 0.11;
          float t = uTime;
          // The river runs left to right; the two layers slide at different speeds.
          vec2 flow = vec2(t * 0.045, 0.0);
          float warp = fbm(p * 0.8 - flow * 0.6);
          float n1 = fbm(p * 1.3 - flow + warp * 0.9);
          float n2 = fbm(p * 2.9 - flow * 1.8 + vec2(0.0, t * 0.012) - warp * 0.5);
          float ridge = 1.0 - abs(2.0 * n1 - 1.0);
          float cracks = pow(ridge, 7.0) * 1.6 + pow(1.0 - abs(2.0 * n2 - 1.0), 12.0) * 0.6;
          float crust = smoothstep(0.26, 0.5, n1 * 0.7 + n2 * 0.45);
          float heat = cracks * (0.35 + 0.65 * (1.0 - crust)) + (1.0 - crust) * 0.5;
          // Bubbles: a ring that swells and bursts, here and there.
          vec2 g = p * 1.6 - flow * 1.6; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          float r = hash(id); float ph = fract(t * (0.12 + r * 0.1) + r * 9.0);
          float on = step(0.8, r) * step(ph, 0.4);
          float rad = ph * 0.9;
          vec2 o = (vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5) * 0.4;
          float d = length(f - o);
          heat += on * (smoothstep(0.06, 0.0, abs(d - rad * 0.45)) * (1.0 - ph * 2.5) * 1.6 + smoothstep(rad * 0.45, 0.0, d) * 0.35);
          heat *= 1.0 + uFlare * 0.9;
          heat += uFlare * 0.12;
          vec3 c = vec3(0.022, 0.008, 0.005);
          c = mix(c, vec3(0.75, 0.07, 0.0), smoothstep(0.05, 0.5, heat));
          c = mix(c, vec3(1.1, 0.26, 0.02), smoothstep(0.4, 1.0, heat));
          c = mix(c, vec3(1.9, 0.95, 0.22), smoothstep(0.95, 1.7, heat));
          // Fade into the dark of the cavern.
          float far = smoothstep(18.0, 70.0, length(vW.xz - vec2(0.0, 6.0)));
          c *= 1.0 - far * 0.88;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(220, 120).rotateX(-Math.PI / 2), mat);
    this.mesh.position.set(0, LAVA_Y, -20);
  }

  update(dt: number): void {
    this.uniforms.uTime.value += dt;
    this.flare *= Math.exp(-dt * 3.2);
    this.uniforms.uFlare.value = this.flare;
  }
}

function anvilShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.6, 0);
  s.lineTo(2.6, 0);
  s.lineTo(2.3, 1.0);
  s.lineTo(1.2, 1.5);
  s.lineTo(1.0, 3.0);
  s.lineTo(2.0, 3.6);
  s.lineTo(3.2, 3.8);
  s.lineTo(3.2, 5.2);
  s.lineTo(-2.4, 5.2);
  s.lineTo(-5.4, 4.7);
  s.lineTo(-2.6, 3.9);
  s.lineTo(-1.2, 3.2);
  s.lineTo(-1.2, 1.5);
  s.lineTo(-2.3, 1.0);
  s.closePath();
  return s;
}

function cogShape(r: number, teeth: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r * 0.84;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, r * 0.2, 0, Math.PI * 2, true);
  s.holes.push(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.16, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

/** The hall: rock, anvils, cogs, bellows, hanging chains, the roof shaft and the lights. */
export class Forge {
  readonly group = new THREE.Group();
  readonly lava = new Lava();
  readonly lavaLight: THREE.PointLight;
  readonly shaftLight: THREE.SpotLight;
  private cogs: { mesh: THREE.Mesh; speed: number }[] = [];
  private bellows: THREE.Mesh[] = [];
  private bellowsTop!: THREE.Mesh;
  private shaftMat: THREE.ShaderMaterial;
  private ash: THREE.Points;
  private t = 0;
  /** 1 normal. The loss scene dims it, the win flares it. */
  warmth = 1;

  constructor(iron: THREE.MeshStandardMaterial) {
    const g = this.group;
    g.add(this.lava.mesh);

    const rock = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.95, metalness: 0.05, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 0.7, metalness: 0.6 });

    // Cavern: a rough shell behind and beside the river, and banks at its edges.
    const lump = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, seed = 1) => {
      const geo = new THREE.IcosahedronGeometry(r, 3);
      const p = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = Math.sin(v.x * 1.7 + seed) * Math.cos(v.y * 2.1 + seed * 2) * Math.sin(v.z * 1.3 + seed * 3) + 0.5 * Math.sin(v.x * 4.3 + v.y * 3.7 + seed);
        v.multiplyScalar(1 + n * 0.16);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rock);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      g.add(m);
      return m;
    };
    lump(16, -30, 2, -22, 1, 2.2, 1.2, 1);
    lump(16, 31, 0, -24, 1, 2.4, 1.2, 2);
    lump(13, -19, -13, -10, 1.5, 0.6, 1, 3);
    lump(13, 20, -13.4, -11, 1.5, 0.6, 1, 4);
    lump(20, 0, 4, -62, 3.2, 2.2, 0.6, 5);
    lump(14, -14, 30, -18, 2.2, 0.7, 1.6, 6);
    lump(14, 20, 31, -16, 2.2, 0.7, 1.6, 7);
    lump(5, -12, -8.6, 2, 1.6, 0.5, 1, 8);
    lump(5, 12.5, -8.8, 1, 1.6, 0.5, 1, 9);
    // Stalactites.
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.8 + (i % 3) * 0.5, 5 + (i % 4) * 2.2, 6), rock);
      s.position.set(-22 + i * 5.6 + (i % 2) * 1.5, 20 - (i % 3) * 1.5, -14 - (i % 4) * 5);
      s.rotation.x = Math.PI;
      g.add(s);
    }

    // Two giant anvils on the banks.
    const anvilGeo = new THREE.ExtrudeGeometry(anvilShape(), { depth: 3.4, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 1 });
    const a1 = new THREE.Mesh(anvilGeo, dark);
    a1.position.set(-16.5, -6.6, -11);
    a1.rotation.y = 0.5;
    a1.scale.setScalar(1.45);
    const a2 = new THREE.Mesh(anvilGeo, dark);
    a2.position.set(17.5, -6.9, -13);
    a2.rotation.y = Math.PI - 0.45;
    a2.scale.setScalar(1.7);
    g.add(a1, a2);

    // Slow cog wheels on the left wall.
    const cog = (r: number, teeth: number, x: number, y: number, z: number, speed: number) => {
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(cogShape(r, teeth), { depth: 0.7, bevelEnabled: false }), dark);
      m.position.set(x, y, z);
      m.rotation.y = 0.35;
      g.add(m);
      this.cogs.push({ mesh: m, speed });
    };
    cog(4.6, 14, -17.5, 7.5, -17, 0.12);
    cog(2.6, 8, -11.3, 11.6, -16.4, -0.21);
    cog(3.4, 10, 19, 12.5, -19, 0.16);

    // A bellows pumping on the right bank.
    const bx = 14.5;
    const by = -5.2;
    const bz = -7.5;
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 3.4), dark);
    base.position.set(bx, by, bz);
    g.add(base);
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(4.6 - (i % 2) * 0.7, 0.34, 3.1 - (i % 2) * 0.5), i % 2 ? rock : dark);
      rib.position.set(bx, by + 0.4 + i * 0.36, bz);
      g.add(rib);
      this.bellows.push(rib);
    }
    this.bellowsTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 3.4), dark);
    this.bellowsTop.position.set(bx, by + 2.8, bz);
    g.add(this.bellowsTop);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 3.2, 8), dark);
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(bx - 4, by + 0.5, bz);
    g.add(nozzle);

    // Chains hanging in the dark for depth.
    const hang: [number, number, number, number][] = [[-9, -1, -9, 1.6], [-13.5, 3, -5, 1.4], [10.5, 1, -8, 1.6], [15, 4, -4, 1.3], [-5.5, 8, -15, 1.8], [6.5, 7, -17, 1.8], [-21, 0, -8, 1.5], [22, -1, -10, 1.5]];
    for (const [x, y, z, s] of hang) g.add(makeChain(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 0.4, 26, z - 0.5), iron, s));

    // The overhead rail the crane runs on.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.34, 0.5), iron);
    rail.position.set(0, RACK_H / 2 + 3.5, 0);
    g.add(rail);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.8), iron);
    rail2.position.set(0, RACK_H / 2 + 3.3, 0);
    g.add(rail2);

    // Light. The lava is the key, warm and from below.
    this.lavaLight = new THREE.PointLight(0xff7a1a, 120, 60, 1.7);
    this.lavaLight.position.set(0, LAVA_Y + 2.2, 5.5);
    g.add(this.lavaLight);
    const side1 = new THREE.PointLight(0xff5a10, 130, 80, 1.7);
    side1.position.set(-17, LAVA_Y + 2.5, -9);
    const side2 = new THREE.PointLight(0xff5a10, 160, 80, 1.7);
    side2.position.set(18, LAVA_Y + 2.5, -12);
    const deep = new THREE.PointLight(0xff4a08, 380, 120, 1.6);
    deep.position.set(0, LAVA_Y + 5, -38);
    g.add(side1, side2, deep);
    this.sideLights = [side1, side2, deep];
    this.hemi = new THREE.HemisphereLight(0x0c1626, 0x6a2406, 0.35);
    g.add(this.hemi);

    // The roof shaft: a cold rim from the top left.
    this.shaftLight = new THREE.SpotLight(0x6fb8ff, 520, 70, 0.3, 0.6, 1.4);
    this.shaftLight.position.set(-11, 22, 7);
    this.shaftLight.target.position.set(0.5, 0.5, 0);
    g.add(this.shaftLight, this.shaftLight.target);

    this.shaftMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        ${NOISE}
        void main(){
          float rim = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
          float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, 1.0 - vUv.y * 0.9);
          float streak = 0.6 + 0.4 * noise(vec2(vUv.x * 26.0, uTime * 0.05));
          float dust = 0.8 + 0.2 * fbm(vec2(vUv.x * 8.0, vUv.y * 5.0 - uTime * 0.03));
          float a = rim * along * streak * dust * 0.11 * uPower * (0.25 + vUv.y * 0.75);
          gl_FragColor = vec4(vec3(0.44, 0.72, 1.0) * a, 1.0);
        }`,
    });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 6.5, 34, 28, 1, true), this.shaftMat);
    const from = new THREE.Vector3(-11.5, 23, -2);
    const to = new THREE.Vector3(-1.5, -6, -2.5);
    cone.position.copy(from).add(to).multiplyScalar(0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
    g.add(cone);
    // The crack the shaft comes through.
    const crack = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.5, 2.4) }));
    crack.position.copy(from).addScaledVector(from.clone().sub(to).normalize(), -0.5);
    crack.scale.set(1.5, 0.5, 1);
    crack.lookAt(to);
    g.add(crack);

    // Ash drifting down through the shaft.
    const N = 260;
    const ap = new Float32Array(N * 3);
    const as = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      ap[i * 3] = Math.random();
      ap[i * 3 + 1] = Math.random();
      ap[i * 3 + 2] = Math.random();
      as[i] = Math.random();
    }
    const ageo = new THREE.BufferGeometry();
    ageo.setAttribute('position', new THREE.BufferAttribute(ap, 3));
    ageo.setAttribute('aSeed', new THREE.BufferAttribute(as, 1));
    ageo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    this.ash = new THREE.Points(ageo, new THREE.ShaderMaterial({
      uniforms: { uTime: this.shaftMat.uniforms.uTime, uFrom: { value: from }, uTo: { value: to }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uFrom; uniform vec3 uTo; uniform float uScale; attribute float aSeed; varying float vA;
        void main(){
          float life = fract(position.y + uTime * (0.012 + aSeed * 0.012));
          vec3 c = mix(uFrom, uTo, life);
          float rad = mix(1.0, 5.2, life);
          float ang = position.x * 6.283 + uTime * 0.1 * (aSeed - 0.5);
          vec3 p = c + vec3(cos(ang), 0.0, sin(ang)) * rad * sqrt(position.z);
          p.x += sin(uTime * 0.4 + aSeed * 30.0) * 0.3;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (1.5 + aSeed * 2.5) * 22.0 / -mv.z;
          vA = sin(life * 3.1416) * (0.35 + 0.65 * aSeed);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.6, 0.82, 1.0) * smoothstep(0.5, 0.1, d) * vA * 0.7, 1.0); }`,
    }));
    g.add(this.ash);
  }

  private sideLights: THREE.PointLight[];
  private hemi: THREE.HemisphereLight;
  private base = { lava: 120, sides: [130, 160, 380], hemi: 0.35 };

  setPixelScale(s: number): void {
    (this.ash.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  update(dt: number): void {
    this.t += dt;
    this.lava.update(dt);
    this.shaftMat.uniforms.uTime.value = this.t;
    for (const c of this.cogs) c.mesh.rotation.z += c.speed * dt;
    // The bellows breathe every four seconds.
    const b = 0.5 + 0.5 * Math.sin(this.t * 1.55);
    const squeeze = 0.45 + 0.55 * b;
    this.bellows.forEach((rib, i) => { rib.position.y = -5.2 + 0.4 + i * 0.36 * squeeze; });
    this.bellowsTop.position.y = -5.2 + 0.6 + 6 * 0.36 * squeeze;
    // The lava light breathes, and flares on impacts.
    const flick = 1 + 0.06 * Math.sin(this.t * 2.3) + 0.04 * Math.sin(this.t * 5.1 + 1.0);
    const w = this.warmth;
    this.lavaLight.intensity = this.base.lava * flick * w * (1 + this.lava.flare * 1.4);
    this.sideLights.forEach((l, i) => { l.intensity = this.base.sides[i] * flick * w; });
    this.hemi.intensity = this.base.hemi * (0.4 + 0.6 * w);
  }
}

/** The crane: a trolley on the overhead rail with tongs that carry the next medallion. */
export class Crane {
  readonly group = new THREE.Group();
  /** Where the carried medallion hangs, in rack space. */
  readonly hold = new THREE.Group();
  private x = 0;
  private vx = 0;
  target = 0;
  private jawL: THREE.Mesh;
  private jawR: THREE.Mesh;
  private open = 0;
  openTarget = 0;

  constructor(iron: THREE.Material) {
    const top = RACK_H / 2 + 3.3;
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.9), iron);
    trolley.position.y = top - 0.25;
    const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.0, 12).rotateX(Math.PI / 2);
    for (const sx of [-0.42, 0.42]) {
      const w = new THREE.Mesh(wheelGeo, iron);
      w.position.set(sx, top + 0.02, 0);
      this.group.add(w);
    }
    const drop = top - 0.5 - (ENTRY_Y + 0.62);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, drop, 6), iron);
    rod.position.y = top - 0.5 - drop / 2;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.2), iron);
    yoke.position.y = ENTRY_Y + 0.62;
    this.group.add(trolley, rod, yoke);
    const jawGeo = new THREE.BoxGeometry(0.09, 0.75, 0.16);
    jawGeo.translate(0, -0.34, 0);
    this.jawL = new THREE.Mesh(jawGeo, iron);
    this.jawL.position.set(-0.24, ENTRY_Y + 0.6, 0);
    this.jawR = new THREE.Mesh(jawGeo, iron);
    this.jawR.position.set(0.24, ENTRY_Y + 0.6, 0);
    this.group.add(this.jawL, this.jawR);
    this.hold.position.y = ENTRY_Y;
    this.group.add(this.hold);
    void RACK_W;
  }

  get position(): number { return this.x; }

  aimAt(col: number): void { this.target = slotX(col); }

  update(dt: number): void {
    const w = 13;
    this.vx += (w * w * (this.target - this.x) - 2 * w * 0.8 * this.vx) * dt;
    this.x += this.vx * dt;
    this.group.position.x = this.x;
    // The load swings a little behind the trolley.
    this.hold.rotation.z = THREE.MathUtils.clamp(-this.vx * 0.02, -0.25, 0.25);
    this.open += (this.openTarget - this.open) * (1 - Math.exp(-dt * 14));
    this.jawL.rotation.z = -0.38 - this.open * 0.5;
    this.jawR.rotation.z = 0.38 + this.open * 0.5;
  }
}
