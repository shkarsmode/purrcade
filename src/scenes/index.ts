import type { SceneDef } from '../game/types';
import { mice } from './mice';
import { birds } from './birds';
import { laser } from './laser';
import { toys } from './toys';
import { koi } from './koi';
import { aquarium } from './aquarium';
import { beachScene } from './beach';
import { squirrel } from './squirrel';
import { moles } from './moles';
import { robot } from './robot';
import { wand } from './wand';
import { bubbles } from './bubbles';
import { sunspots } from './sunspots';
import { butterflies } from './butterflies';
import { fireflies } from './fireflies';
import { bugs } from './bugs';

export const SCENES: SceneDef[] = [mice, birds, laser, wand, toys, robot, koi, aquarium, beachScene, squirrel, moles, bubbles, sunspots, butterflies, fireflies, bugs];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
