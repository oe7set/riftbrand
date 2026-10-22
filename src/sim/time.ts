export const TICK_RATE_HZ = 60;
export const TICK_DT_SEC = 1 / TICK_RATE_HZ;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE_HZ);
}
