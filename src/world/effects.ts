import * as THREE from 'three';
import { LAVA_Y } from './forge';

/** Embers rising from the lava. Motion is worked out on the GPU from a seed. */
export class Embers {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  static readonly MAX = 2000;

  constructor() {
    const n = Embers.MAX;
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uLava: { value: LAVA_Y } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScale; uniform float uLava; attribute vec4 aSeed; varying float vA; varying float vHot;
        void main(){
          float speed = 0.035 + aSeed.y * 0.05;
          float life = fract(aSeed.w + uTime * speed);
          vec3 p;
          p.x = (aSeed.x - 0.5) * 46.0;
          p.z = 7.0 - aSeed.z * aSeed.z * 42.0;
          p.y = uLava + 0.2 + life * (10.0 + aSeed.y * 16.0);
          float sw = uTime * (0.5 + aSeed.z) + aSeed.w * 40.0;
          p.x += (sin(sw) + 0.5 * sin(sw * 2.3)) * (0.3 + life * 1.3) + life * 1.5;
          p.z += cos(sw * 0.8) * 0.5 * life;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.6 + 0.4 * sin(uTime * (6.0 + aSeed.x * 9.0) + aSeed.y * 50.0);
          gl_PointSize = uScale * (1.0 + aSeed.x * 2.2) * 34.0 / -mv.z;
          vA = smoothstep(0.0, 0.06, life) * pow(1.0 - life, 1.6) * tw;
          vHot = 1.0 - life;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vHot;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          vec3 c = mix(vec3(1.0, 0.22, 0.03), vec3(2.6, 1.3, 0.35), vHot * vHot);
          gl_FragColor = vec4(c * a * a * vA * 1.5, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  setCount(n: number): void { this.points.geometry.setDrawRange(0, Math.min(n, Embers.MAX)); }
  setPixelScale(s: number): void { this.mat.uniforms.uScale.value = s; }
  update(dt: number): void { this.mat.uniforms.uTime.value += dt; }
}

/** Short-lived particles on the CPU: impact sparks, steam, drips. They fall, bounce once and die. */
export class Sparks {
  readonly points: THREE.Points;
  private static readonly MAX = 1400;
  private pos = new Float32Array(Sparks.MAX * 3);
  private col = new Float32Array(Sparks.MAX * 3);
  private size = new Float32Array(Sparks.MAX);
  private vel = new Float32Array(Sparks.MAX * 3);
  private life = new Float32Array(Sparks.MAX);
  private span = new Float32Array(Sparks.MAX);
  private floor = new Float32Array(Sparks.MAX);
  private grav = new Float32Array(Sparks.MAX);
  private base = new Float32Array(Sparks.MAX * 3);
  private bounced = new Uint8Array(Sparks.MAX);
  private next = 0;
  private mat: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uScale; attribute vec3 aColor; attribute float aSize; varying vec3 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uScale * aSize * 60.0 / -mv.z; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * a, 1.0); }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  setPixelScale(s: number): void { this.mat.uniforms.uScale.value = s; }

  /**
   * Throws `n` particles from a point. `speed` is the launch speed, `up` biases it upward,
   * `floorY` is where they bounce, `gravity` pulls down (negative values rise, for steam).
   */
  burst(at: THREE.Vector3, n: number, color: THREE.Color, o: { speed?: number; up?: number; floorY?: number; gravity?: number; life?: number; size?: number; spread?: number } = {}): void {
    const speed = o.speed ?? 5;
    const up = o.up ?? 1.5;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % Sparks.MAX;
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.3) * Math.PI * 0.9;
      const s = speed * (0.25 + Math.random() * 0.75);
      const sp = o.spread ?? 0.1;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * sp;
      this.vel[i * 3] = Math.cos(a) * Math.cos(el) * s;
      this.vel[i * 3 + 1] = Math.sin(el) * s + up;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * s * 0.7 + s * 0.25;
      this.span[i] = this.life[i] = (o.life ?? 0.9) * (0.5 + Math.random() * 0.5);
      this.floor[i] = o.floorY ?? -1e9;
      this.grav[i] = o.gravity ?? 14;
      this.base[i * 3] = color.r;
      this.base[i * 3 + 1] = color.g;
      this.base[i * 3 + 2] = color.b;
      this.size[i] = (o.size ?? 1) * (0.5 + Math.random() * 0.8);
      this.bounced[i] = 0;
    }
  }

  update(dt: number): void {
    const { pos, vel, life, col, base } = this;
    for (let i = 0; i < Sparks.MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      vel[i * 3 + 1] -= this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < this.floor[i] && vel[i * 3 + 1] < 0) {
        if (this.bounced[i]) { life[i] = 0; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        this.bounced[i] = 1;
        pos[i * 3 + 1] = this.floor[i];
        vel[i * 3 + 1] *= -0.45;
        vel[i * 3] *= 0.7;
        vel[i * 3 + 2] *= 0.7;
      }
      const f = Math.min(1, (life[i] / this.span[i]) * 1.6);
      col[i * 3] = base[i * 3] * f;
      col[i * 3 + 1] = base[i * 3 + 1] * f * f;
      col[i * 3 + 2] = base[i * 3 + 2] * f * f * f;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}

/** Two slow layers of smoke hanging in the hall. */
export class Smoke {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];

  constructor() {
    const layer = (z: number, y: number, w: number, h: number, speed: number, strength: number, tint: THREE.Color) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSpeed: { value: speed }, uStrength: { value: strength }, uTint: { value: tint } },
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uSpeed; uniform float uStrength; uniform vec3 uTint; varying vec2 vUv;
          float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
          float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
          void main(){
            vec2 p = vUv * vec2(5.0, 2.6);
            float n = fbm(p + vec2(uTime * uSpeed, uTime * uSpeed * 0.35) + fbm(p * 0.6 - uTime * uSpeed * 0.5));
            float a = smoothstep(0.38, 0.85, n);
            float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            // Lit warm from below, cold above.
            vec3 c = mix(uTint, vec3(0.012, 0.018, 0.03), smoothstep(0.2, 0.9, vUv.y));
            gl_FragColor = vec4(c, a * edge * uStrength);
          }`,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(0, y, z);
      m.renderOrder = 2;
      this.group.add(m);
      this.mats.push(mat);
    };
    layer(-9, 3, 90, 34, 0.012, 0.5, new THREE.Color(0.11, 0.035, 0.012));
    layer(-3.2, -3.5, 60, 14, -0.02, 0.35, new THREE.Color(0.16, 0.05, 0.015));
  }

  update(dt: number): void { for (const m of this.mats) m.uniforms.uTime.value += dt; }
}
