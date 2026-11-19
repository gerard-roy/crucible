import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const HazeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uLine: { value: 0.25 }, uAmount: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uLine; uniform float uAmount; varying vec2 vUv;
    void main(){
      // Heat haze: a shimmer strongest just above the lava line, fading upward.
      float band = smoothstep(uLine + 0.3, uLine, vUv.y) * smoothstep(uLine - 0.22, uLine - 0.02, vUv.y);
      float w = sin(vUv.y * 140.0 - uTime * 5.0 + sin(vUv.x * 30.0 + uTime * 1.3) * 2.0);
      float w2 = sin(vUv.x * 90.0 + uTime * 3.1 + vUv.y * 60.0);
      vec2 off = vec2(w * 0.0016 + w2 * 0.0008, w2 * 0.0012) * band * uAmount;
      gl_FragColor = texture2D(tDiffuse, vUv + off);
    }`,
};

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.04 }, uVignette: { value: 0.4 },
    uExposure: { value: 1.0 }, uFlash: { value: 0 }, uGrey: { value: 0 }, uDim: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette;
    uniform float uExposure; uniform float uFlash; uniform float uGrey; uniform float uDim; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
      c += uFlash * vec3(1.0, 0.93, 0.8);
      c = aces(c);
      // Grade: deep blue shadows, orange highlights.
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += vec3(-0.012, 0.0, 0.03) * (1.0 - smoothstep(0.0, 0.35, l));
      c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), smoothstep(0.45, 1.0, l));
      c = mix(c, vec3(l) * vec3(0.92, 0.97, 1.05), uGrey);
      c *= 1.0 - uDim * 0.55;
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.85)) );
      c += (hash(vUv * 913.0 + fract(uTime) * 71.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/** Post-processing in order: (haze,) bloom, ACES tone mapping, grade, vignette, grain. */
export class Post {
  readonly composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private haze: ShaderPass;
  readonly finish: ShaderPass;
  private bloomScale = 1;
  private w = 1;
  private h = 1;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.haze = new ShaderPass(HazeShader);
    this.composer.addPass(this.haze);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.9);
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);
  }

  configure(o: { haze: boolean; grain: boolean; bloomScale: number }): void {
    this.haze.enabled = o.haze;
    this.finish.uniforms.uGrain.value = o.grain ? 0.04 : 0;
    this.bloomScale = o.bloomScale;
    this.setSize(this.w, this.h);
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.bloom.setSize(Math.max(2, w * pr * this.bloomScale), Math.max(2, h * pr * this.bloomScale));
  }

  /** Where the lava meets the hall on screen, 0 bottom to 1 top. */
  setHazeLine(y: number): void { this.haze.uniforms.uLine.value = y; }

  render(dt: number): void {
    this.haze.uniforms.uTime.value += dt;
    this.finish.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
