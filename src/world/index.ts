import type { LocationDef } from '../game/types';
import { kitchen, livingroom, attic } from './indoor';
import { garden, park, meadow, forest, winter } from './outdoor';
import { koiPond } from './water';

export const LOCATIONS: LocationDef[] = [kitchen, livingroom, attic, garden, park, meadow, forest, winter, koiPond];

export function locationById(id: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.id === id);
}
