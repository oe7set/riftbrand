import { describe, expect, it } from 'vitest';
import {
  addComponents,
  createEntity,
  createWorld,
  destroyEntity,
  hasComponents,
  isAlive,
  removeComponents,
} from './world';

describe('ecs world', () => {
  it('creates sequential ids and reuses freed ids', () => {
    const world = createWorld(8);
    const a = createEntity(world);
    const b = createEntity(world);
    expect([a, b]).toEqual([0, 1]);
    destroyEntity(world, a);
    expect(isAlive(world, a)).toBe(false);
    expect(createEntity(world)).toBe(a);
    expect(world.generations[a]).toBe(1);
    expect(world.aliveCount).toBe(2);
  });

  it('returns -1 when full', () => {
    const world = createWorld(2);
    createEntity(world);
    createEntity(world);
    expect(createEntity(world)).toBe(-1);
  });

  it('tracks component membership', () => {
    const world = createWorld(4);
    const e = createEntity(world);
    addComponents(world, e, 0b101);
    expect(hasComponents(world, e, 0b001)).toBe(true);
    expect(hasComponents(world, e, 0b101)).toBe(true);
    expect(hasComponents(world, e, 0b010)).toBe(false);
    removeComponents(world, e, 0b100);
    expect(hasComponents(world, e, 0b100)).toBe(false);
    destroyEntity(world, e);
    expect(hasComponents(world, e, 0b001)).toBe(false);
  });

  it('ignores double destroy', () => {
    const world = createWorld(4);
    const e = createEntity(world);
    destroyEntity(world, e);
    destroyEntity(world, e);
    expect(world.aliveCount).toBe(0);
    expect(world.freeCount).toBe(1);
  });
});
