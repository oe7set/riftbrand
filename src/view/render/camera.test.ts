import { describe, expect, it } from 'vitest';
import { vec2 } from '../../shared/math/vec2';
import { computeZoom, createCamera, updateCamera, worldToScreen } from './camera';

const base = {
  lookX: 0,
  lookY: 0,
  lookaheadPx: 60,
  sharpness: 10,
  arenaWidth: 4000,
  arenaHeight: 4000,
};

describe('camera', () => {
  it('keeps the visible area constant across orientations', () => {
    const landscape = computeZoom(915, 412, 960, 540);
    const portrait = computeZoom(412, 915, 960, 540);
    expect(landscape).toBeCloseTo(portrait);
    expect((915 / landscape) * (412 / landscape)).toBeCloseTo(960 * 540);
  });

  it('converges to the target independent of frame rate', () => {
    const at60 = createCamera();
    const at120 = createCamera();
    for (const cam of [at60, at120]) {
      cam.viewWidth = 960;
      cam.viewHeight = 540;
      cam.x = 1000;
      cam.y = 1000;
    }
    for (let i = 0; i < 30; i++) {
      updateCamera(at60, { ...base, targetX: 1500, targetY: 1000, dtSec: 1 / 60 });
    }
    for (let i = 0; i < 60; i++) {
      updateCamera(at120, { ...base, targetX: 1500, targetY: 1000, dtSec: 1 / 120 });
    }
    expect(at60.x).toBeCloseTo(at120.x, 6);
    expect(at60.x).toBeGreaterThan(1490);
  });

  it('clamps to arena edges and centers small arenas', () => {
    const cam = createCamera();
    cam.viewWidth = 960;
    cam.viewHeight = 540;
    updateCamera(cam, { ...base, targetX: 0, targetY: 0, dtSec: 10 });
    expect(cam.x).toBeCloseTo(480);
    expect(cam.y).toBeCloseTo(270);
    updateCamera(cam, {
      ...base,
      targetX: 0,
      targetY: 0,
      dtSec: 10,
      arenaWidth: 500,
      arenaHeight: 300,
    });
    expect(cam.x).toBe(250);
    expect(cam.y).toBe(150);
  });

  it('maps world to screen', () => {
    const cam = createCamera();
    cam.viewWidth = 800;
    cam.viewHeight = 600;
    cam.zoom = 2;
    cam.x = 100;
    cam.y = 100;
    expect(worldToScreen(cam, 110, 90, vec2())).toEqual({ x: 420, y: 280 });
  });
});
