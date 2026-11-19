import * as THREE from 'three';

export type View = 'rack' | 'forge';

/** The camera on damped springs, with two views, a drag orbit, scene shots and shake. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  view: View = 'rack';
  comfort = false;
  /** Drag orbit in rack view, radians, at most 30 degrees either way. */
  orbit = 0;
  private pos = new THREE.Vector3(0, 6, 30);
  private look = new THREE.Vector3(0, 6, 0);
  private vPos = new THREE.Vector3();
  private vLook = new THREE.Vector3();
  private goalPos = new THREE.Vector3();
  private goalLook = new THREE.Vector3();
  /** A scene shot overrides the view until cleared. */
  private shot: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private trauma = 0;
  private t = 0;
  private aspect = 1;
  stiffness = 3.2;

  setAspect(a: number): void {
    this.aspect = a;
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  /** Distance that keeps the rack and its surroundings in frame for this aspect. */
  private fit(): number {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.aspect);
    const needW = this.aspect < 1 ? 8.5 : 15.5;
    const needH = this.aspect < 1 ? 15.5 : 12.6;
    return Math.max(needW / 2 / Math.tan(hfov / 2), needH / 2 / Math.tan(vfov / 2));
  }

  /** Points the camera somewhere for a scene. Pass null to return to the view. */
  setShot(pos: THREE.Vector3 | null, look?: THREE.Vector3): void {
    this.shot = pos ? { pos: pos.clone(), look: (look ?? new THREE.Vector3()).clone() } : null;
  }

  /** Jumps straight to a pose, with no easing. */
  snap(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.pos.copy(pos);
    this.look.copy(look);
    this.vPos.set(0, 0, 0);
    this.vLook.set(0, 0, 0);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * (this.comfort ? 0.5 : 1));
  }

  /** The resting pose of a view. */
  pose(view: View, out: { pos: THREE.Vector3; look: THREE.Vector3 }): void {
    const d = this.fit();
    if (view === 'rack') {
      // From the front, slightly below centre and 5 degrees off axis.
      const yaw = (5 * Math.PI) / 180 + this.orbit;
      const portrait = this.aspect < 1;
      out.look.set(0, portrait ? 0.9 : -0.25, 0);
      out.pos.set(Math.sin(yaw) * d, out.look.y - d * 0.085, Math.cos(yaw) * d);
    } else {
      const a = this.t * 0.07;
      const r = d * 1.75;
      out.look.set(0, 1.5, -2);
      out.pos.set(Math.sin(a) * r * 0.55, 3.5 + Math.sin(a * 0.7) * 2.5, 4 + Math.abs(Math.cos(a)) * r * 0.75);
    }
  }

  update(dt: number): void {
    this.t += dt;
    const goal = { pos: this.goalPos, look: this.goalLook };
    if (this.shot) { goal.pos.copy(this.shot.pos); goal.look.copy(this.shot.look); }
    else this.pose(this.view, goal);
    const w = this.stiffness;
    const step = (x: THREE.Vector3, v: THREE.Vector3, g: THREE.Vector3) => {
      // Critically damped spring.
      v.x += (w * w * (g.x - x.x) - 2 * w * v.x) * dt;
      v.y += (w * w * (g.y - x.y) - 2 * w * v.y) * dt;
      v.z += (w * w * (g.z - x.z) - 2 * w * v.z) * dt;
      x.addScaledVector(v, dt);
    };
    step(this.pos, this.vPos, this.goalPos);
    step(this.look, this.vLook, this.goalLook);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    // Shake decays within a second.
    this.trauma = Math.max(0, this.trauma - dt * 1.25);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const f = this.t * 38;
      this.camera.position.x += Math.sin(f * 1.1) * 0.22 * s;
      this.camera.position.y += Math.sin(f * 1.7 + 1.3) * 0.22 * s;
      this.camera.rotation.z += Math.sin(f * 1.3 + 0.7) * 0.02 * s;
    }
  }
}
