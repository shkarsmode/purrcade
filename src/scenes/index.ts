import type { SceneDef } from '../game/types';
import { mice } from './mice';
import { birds } from './birds';
import { laser } from './laser';
import { toys } from './toys';

export const SCENES: SceneDef[] = [mice, birds, laser, toys];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
