// The beat queue: every change on the rack is shown by a timed beat.
// A beat has a length, a start (t = 0), per-frame updates and an end (t = 1).

export type BeatFn = (t: number, dt: number) => void;

interface Running {
  dur: number;
  elapsed: number;
  fn?: BeatFn;
  fixed: boolean;
  resolve: () => void;
}

export class Beats {
  /** 2 while Space is held. Beats marked fixed ignore it. */
  speed = 1;
  /** Slow motion for the winning drop. */
  timeScale = 1;
  private running: Running[] = [];

  /** Plays one beat and resolves when it ends. */
  run(seconds: number, fn?: BeatFn, fixed = false): Promise<void> {
    return new Promise((resolve) => {
      fn?.(0, 0);
      this.running.push({ dur: Math.max(seconds, 0.0001), elapsed: 0, fn, fixed, resolve });
    });
  }

  wait(seconds: number, fixed = false): Promise<void> {
    return this.run(seconds, undefined, fixed);
  }

  get busy(): boolean {
    return this.running.length > 0;
  }

  update(dt: number): void {
    const list = this.running.slice();
    for (const b of list) {
      const step = dt * this.timeScale * (b.fixed ? 1 : this.speed);
      b.elapsed += step;
      const t = Math.min(1, b.elapsed / b.dur);
      b.fn?.(t, step);
      if (t >= 1) {
        const i = this.running.indexOf(b);
        if (i >= 0) this.running.splice(i, 1);
        b.resolve();
      }
    }
  }

  /** Ends every running beat at once (used when leaving a game). */
  flush(): void {
    const list = this.running;
    this.running = [];
    for (const b of list) { b.fn?.(1, 0); b.resolve(); }
  }
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;
export const easeIn = (t: number): number => t * t * t;
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const smooth = (t: number): number => t * t * (3 - 2 * t);
