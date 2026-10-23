/**
 * Enemies in encounters are stored as one number: type in the low byte, elite modifier in the
 * next. Keeps wave lists flat, numeric and deterministic.
 */
export function packEnemy(type: number, eliteMod = 0): number {
  return (type & 0xff) | ((eliteMod & 0xff) << 8);
}

export function enemyTypeFromCode(code: number): number {
  return code & 0xff;
}

export function eliteFromCode(code: number): number {
  return (code >> 8) & 0xff;
}
