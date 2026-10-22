/**
 * ECS benchmark for ADR 0001: own minimal ECS vs bitECS on the same workload
 * (wander AI + movement + broadphase separation). Run: pnpm bench:ecs
 */
import { addComponent, addEntity, createWorld, query } from 'bitecs';
import { TUNING } from '../src/content/tuning';
import { createInputFrame } from '../src/shared/input-frame';
import { clearSpatialHash, insertPoint, queryRect } from '../src/sim/collision/spatial-hash';
import { createRng, nextFloat } from '../src/sim/rng/rng';
import { createSim, spawnDrifters, stepSim } from '../src/sim/sim';
import { TICK_DT_SEC } from '../src/sim/time';

const ENTITY_COUNTS = [300, 500, 1000];
const WARMUP_TICKS = 300;
const MEASURE_TICKS = 2000;

function benchOwn(count: number): number {
  const sim = createSim(1);
  spawnDrifters(sim, count);
  const input = createInputFrame();
  for (let i = 0; i < WARMUP_TICKS; i++) stepSim(sim, input);
  const start = performance.now();
  for (let i = 0; i < MEASURE_TICKS; i++) stepSim(sim, input);
  return (performance.now() - start) / MEASURE_TICKS;
}

function benchBitecs(count: number): number {
  // Same SoA layout and the same spatial hash; only entity storage and queries differ.
  const sim = createSim(1); // reused only for its spatial hash and buffers
  const cap = 4096;
  const Position = { x: new Float64Array(cap), y: new Float64Array(cap) };
  const Velocity = { x: new Float64Array(cap), y: new Float64Array(cap) };
  const Body = { r: new Float64Array(cap) };
  const Wander = { ticks: new Int32Array(cap) };
  const world = createWorld();
  const rng = createRng(2);
  for (let i = 0; i < count; i++) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    addComponent(world, eid, Velocity);
    addComponent(world, eid, Body);
    addComponent(world, eid, Wander);
    Position.x[eid] = nextFloat(rng) * TUNING.arenaWidthPx;
    Position.y[eid] = nextFloat(rng) * TUNING.arenaHeightPx;
    Body.r[eid] = TUNING.drifterRadiusPx;
  }
  const step = () => {
    for (const eid of query(world, [Wander, Velocity])) {
      const t = (Wander.ticks[eid] as number) - 1;
      if (t > 0) {
        Wander.ticks[eid] = t;
        continue;
      }
      const a = nextFloat(rng) * Math.PI * 2;
      Velocity.x[eid] = Math.cos(a) * TUNING.drifterSpeedPxPerSec;
      Velocity.y[eid] = Math.sin(a) * TUNING.drifterSpeedPxPerSec;
      Wander.ticks[eid] = 60;
    }
    for (const eid of query(world, [Position, Velocity])) {
      Position.x[eid] = (Position.x[eid] as number) + (Velocity.x[eid] as number) * TICK_DT_SEC;
      Position.y[eid] = (Position.y[eid] as number) + (Velocity.y[eid] as number) * TICK_DT_SEC;
    }
    const bodies = query(world, [Position, Body]);
    clearSpatialHash(sim.spatial);
    for (const eid of bodies)
      insertPoint(sim.spatial, eid, Position.x[eid] as number, Position.y[eid] as number);
    for (const a of bodies) {
      const ax = Position.x[a] as number;
      const ay = Position.y[a] as number;
      const reach = (Body.r[a] as number) * 2;
      const n = queryRect(
        sim.spatial,
        ax - reach,
        ay - reach,
        ax + reach,
        ay + reach,
        sim.queryBuffer,
      );
      for (let i = 0; i < n; i++) {
        const b = sim.queryBuffer[i] as number;
        if (b === a) continue;
        const dx = ax - (Position.x[b] as number);
        const dy = ay - (Position.y[b] as number);
        const d2 = dx * dx + dy * dy;
        const min = reach;
        if (d2 === 0 || d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        Position.x[a] = (Position.x[a] as number) + (dx / d) * (min - d) * 0.5;
        Position.y[a] = (Position.y[a] as number) + (dy / d) * (min - d) * 0.5;
      }
    }
  };
  for (let i = 0; i < WARMUP_TICKS; i++) step();
  const start = performance.now();
  for (let i = 0; i < MEASURE_TICKS; i++) step();
  return (performance.now() - start) / MEASURE_TICKS;
}

console.log('entities | own ECS ms/tick | bitECS ms/tick');
for (const n of ENTITY_COUNTS) {
  const own = benchOwn(n);
  const bit = benchBitecs(n);
  console.log(
    `${String(n).padStart(8)} | ${own.toFixed(4).padStart(15)} | ${bit.toFixed(4).padStart(14)}`,
  );
}
