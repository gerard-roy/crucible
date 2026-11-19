import type { Move, State } from '../rules';
import type { SearchOpts, SearchResult } from './search';

/** Runs searches in a Web Worker so a thinking rival never freezes the scene. */
export class Rival {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private waiting = new Map<number, (r: SearchResult) => void>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<{ id: number; result: SearchResult }>) => {
      const done = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      done?.(e.data.result);
    };
  }

  async choose(state: State, opts: SearchOpts): Promise<Move> {
    const id = this.nextId++;
    const result = await new Promise<SearchResult>((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage({ id, state, opts });
    });
    return result.move;
  }
}
