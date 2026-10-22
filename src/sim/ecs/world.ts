/**
 * Minimal fixed-capacity ECS core. Entities are dense integer ids; component membership is a
 * bitmask per entity; component data lives in struct-of-arrays typed arrays (see components.ts).
 * Iteration is always in ascending id order, which keeps systems deterministic.
 */
export interface World {
  readonly capacity: number;
  /** Component bitmask per entity; 0 means the slot is free. */
  readonly masks: Uint32Array;
  /** Incremented on every destroy so stale handles can be detected. */
  readonly generations: Uint16Array;
  readonly freeIds: Int32Array;
  freeCount: number;
  /** One past the highest id ever handed out; systems iterate [0, highWater). */
  highWater: number;
  aliveCount: number;
}

/** Set on every live entity so that an entity without other components is still "alive". */
export const ALIVE_BIT = 1 << 31;

export function createWorld(capacity: number): World {
  return {
    capacity,
    masks: new Uint32Array(capacity),
    generations: new Uint16Array(capacity),
    freeIds: new Int32Array(capacity),
    freeCount: 0,
    highWater: 0,
    aliveCount: 0,
  };
}

/** Returns the new entity id, or -1 when the world is full. */
export function createEntity(world: World): number {
  let eid: number;
  if (world.freeCount > 0) {
    world.freeCount--;
    eid = world.freeIds[world.freeCount] as number;
  } else if (world.highWater < world.capacity) {
    eid = world.highWater++;
  } else {
    return -1;
  }
  world.masks[eid] = ALIVE_BIT;
  world.aliveCount++;
  return eid;
}

export function destroyEntity(world: World, eid: number): void {
  if (!isAlive(world, eid)) return;
  world.masks[eid] = 0;
  world.generations[eid] = ((world.generations[eid] as number) + 1) & 0xffff;
  world.freeIds[world.freeCount++] = eid;
  world.aliveCount--;
}

export function isAlive(world: World, eid: number): boolean {
  return eid >= 0 && eid < world.highWater && ((world.masks[eid] as number) & ALIVE_BIT) !== 0;
}

export function addComponents(world: World, eid: number, bits: number): void {
  world.masks[eid] = (world.masks[eid] as number) | bits;
}

export function removeComponents(world: World, eid: number, bits: number): void {
  world.masks[eid] = (world.masks[eid] as number) & ~bits;
}

export function hasComponents(world: World, eid: number, bits: number): boolean {
  // `>>> 0` keeps the comparison unsigned; ALIVE_BIT is the sign bit.
  const required = (bits | ALIVE_BIT) >>> 0;
  return ((world.masks[eid] as number) & required) >>> 0 === required;
}

export function destroyAll(world: World): void {
  for (let eid = 0; eid < world.highWater; eid++) destroyEntity(world, eid);
}
