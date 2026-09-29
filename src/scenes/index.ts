import type { SceneDef } from '../game/types';
import { mice } from './mice';
import { birds } from './birds';
import { laser } from './laser';
import { toys } from './toys';
import { koi } from './koi';
import { aquarium } from './aquarium';
import { beachScene } from './beach';
import { butterflies } from './butterflies';
import { fireflies } from './fireflies';
import { bugs } from './bugs';

export const SCENES: SceneDef[] = [mice, birds, laser, toys, koi, aquarium, beachScene, butterflies, fireflies, bugs];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
