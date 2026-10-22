/**
 * Turns variable frame times into a whole number of fixed sim ticks (TECH_DESIGN §4).
 * Slow motion scales how fast sim time accumulates, never the tick length, so the sim stays
 * deterministic.
 */
export class FixedStepper {
  timeScale = 1;
  private accumulatorSec = 0;

  constructor(
    readonly tickDtSec: number,
    /** Ticks per frame before dropping time; prevents a death spiral on slow devices. */
    readonly maxTicksPerFrame = 5,
  ) {}

  /** Returns how many ticks to run for this frame. */
  advance(frameDtSec: number): number {
    this.accumulatorSec += Math.max(0, frameDtSec) * this.timeScale;
    let ticks = Math.floor(this.accumulatorSec / this.tickDtSec);
    if (ticks > this.maxTicksPerFrame) {
      ticks = this.maxTicksPerFrame;
      // Drop the backlog; the game briefly runs slower instead of freezing.
      this.accumulatorSec = 0;
      return ticks;
    }
    this.accumulatorSec -= ticks * this.tickDtSec;
    return ticks;
  }

  /** Interpolation factor between the previous and the latest tick, in [0, 1). */
  get alpha(): number {
    return Math.min(this.accumulatorSec / this.tickDtSec, 1);
  }

  reset(): void {
    this.accumulatorSec = 0;
  }
}
