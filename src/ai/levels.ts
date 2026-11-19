import type { Mode } from '../rules';
import type { SearchOpts } from './search';

export type LevelId = 'apprentice' | 'journeyman' | 'master';

export interface Level {
  id: LevelId;
  name: string;
  blurb: string;
}

export const LEVELS: readonly Level[] = [
  { id: 'apprentice', name: 'Apprentice', blurb: 'Looks two moves ahead and slips now and then.' },
  { id: 'journeyman', name: 'Journeyman', blurb: 'Looks five moves ahead.' },
  { id: 'master', name: 'Master', blurb: 'Thinks for a full second and sees nine moves or more.' },
];

/** Search settings for a level. `fast` shortens Master's clock for the balance script. */
export function levelOpts(id: LevelId, mode: Mode, phone = false, fast = false): SearchOpts {
  switch (id) {
    case 'apprentice': return { depth: 2, randomRate: 1 / 3 };
    case 'journeyman': return { depth: 5 };
    case 'master':
      return { depth: 42, timeMs: fast ? 250 : phone ? 800 : 1200, minDepth: mode === 'standard' ? 9 : 7 };
  }
}
