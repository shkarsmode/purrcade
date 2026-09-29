import type { LocationDef } from '../game/types';
import { kitchen, livingroom, attic } from './indoor';
import { garden, park, meadow, forest, winter } from './outdoor';
import { koiPond, aquarium } from './water';
import { beach } from './coast';
import { arcade } from './arcade';

export const LOCATIONS: LocationDef[] = [kitchen, livingroom, attic, garden, park, meadow, forest, winter, koiPond, aquarium, beach, arcade];

export function locationById(id: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.id === id);
}
