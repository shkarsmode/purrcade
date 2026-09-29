/**
 * What every creature shares: the same ink round the outside, the same dark for eyes, the same
 * white for the glint in them. A creature file only brings its own colours after these.
 */
export const INK = '#2a1f2b';
export const INK_UNDER = '#1a1219';
export const EYE = '#140d16';
export const GLINT = '#ffffff';

/** Palette slots every creature palette starts with. */
export const O = 1, U = 2, E = 3, G = 4;
export const BASE = ['', INK, INK_UNDER, EYE, GLINT];

export type Facing = 1 | -1;
