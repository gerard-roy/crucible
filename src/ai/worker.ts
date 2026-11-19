import type { State } from '../rules';
import { chooseMove, type SearchOpts } from './search';

export interface WorkerRequest { id: number; state: State; opts: SearchOpts }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, state, opts } = e.data;
  const result = chooseMove(state, opts);
  (self as unknown as Worker).postMessage({ id, result });
};
