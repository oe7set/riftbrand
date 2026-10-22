import { describe, expect, it } from 'vitest';
import {
  createRoomState,
  loadObstacles,
  overlapsObstacle,
  pushOut,
  pushOutOfObstacles,
} from './room';

describe('room obstacles', () => {
  const room = createRoomState();
  loadObstacles(room, [
    { kind: 'rect', x: 100, y: 100, w: 100, h: 50 },
    { kind: 'circle', x: 400, y: 400, r: 30 },
  ]);

  it('pushes circles out of rect edges', () => {
    pushOutOfObstacles(room, 150, 95, 10);
    expect(pushOut.hit).toBe(true);
    expect(pushOut.y).toBeCloseTo(90);
    expect(pushOut.x).toBeCloseTo(150);
  });

  it('pushes a centre inside a rect through the nearest side', () => {
    pushOutOfObstacles(room, 195, 125, 10);
    expect(pushOut.x).toBeCloseTo(210);
  });

  it('pushes circles out of circles', () => {
    pushOutOfObstacles(room, 400, 360, 15);
    expect(pushOut.y).toBeCloseTo(355);
  });

  it('leaves free space alone', () => {
    pushOutOfObstacles(room, 600, 600, 20);
    expect(pushOut.hit).toBe(false);
    expect(overlapsObstacle(room, 300, 300, 5)).toBe(false);
    expect(overlapsObstacle(room, 410, 410, 5)).toBe(true);
  });
});
