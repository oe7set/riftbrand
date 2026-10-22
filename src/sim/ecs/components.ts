/** Component bits. Keep below bit 31 (reserved for ALIVE_BIT). */
export const C = {
  Transform: 1 << 0,
  Velocity: 1 << 1,
  Collider: 1 << 2,
  PlayerControl: 1 << 3,
  Drifter: 1 << 4,
  Renderable: 1 << 5,
} as const;

/** What the view should draw for an entity; the sim never references textures. */
export const RenderKind = {
  None: 0,
  Player: 1,
  Drifter: 2,
} as const;

export type RenderKindId = (typeof RenderKind)[keyof typeof RenderKind];

/** Struct-of-arrays component storage, indexed by entity id. */
export interface Components {
  posX: Float64Array;
  posY: Float64Array;
  /** Position at the start of the tick; the view interpolates between prev and pos. */
  prevX: Float64Array;
  prevY: Float64Array;
  velX: Float64Array;
  velY: Float64Array;
  facingX: Float64Array;
  facingY: Float64Array;
  radius: Float64Array;
  renderKind: Uint8Array;
  /** Drifter AI: ticks until a new wander direction is chosen. */
  wanderTicks: Int32Array;
}

export function createComponents(capacity: number): Components {
  return {
    posX: new Float64Array(capacity),
    posY: new Float64Array(capacity),
    prevX: new Float64Array(capacity),
    prevY: new Float64Array(capacity),
    velX: new Float64Array(capacity),
    velY: new Float64Array(capacity),
    facingX: new Float64Array(capacity),
    facingY: new Float64Array(capacity),
    radius: new Float64Array(capacity),
    renderKind: new Uint8Array(capacity),
    wanderTicks: new Int32Array(capacity),
  };
}

/** Zeroes all component data of an entity so reused ids start clean. */
export function resetComponents(c: Components, eid: number): void {
  c.posX[eid] = 0;
  c.posY[eid] = 0;
  c.prevX[eid] = 0;
  c.prevY[eid] = 0;
  c.velX[eid] = 0;
  c.velY[eid] = 0;
  c.facingX[eid] = 1;
  c.facingY[eid] = 0;
  c.radius[eid] = 0;
  c.renderKind[eid] = 0;
  c.wanderTicks[eid] = 0;
}
