/**
 * Trauma-based screen shake (Squirrel Eiserloh, "Juicing your cameras with math"): offset =
 * max × trauma², so small hits barely move and big hits really kick. Smooth noise instead of
 * random jitter keeps it readable.
 */
export class ScreenShake {
  trauma = 0;
  /** Player setting 0..1 (GDD §13). */
  intensity = 1;
  offsetX = 0;
  offsetY = 0;
  rotation = 0;
  private time = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dtSec: number, maxOffsetPx: number, maxRotationRad: number, decayPerSec: number): void {
    this.time += dtSec;
    this.trauma = Math.max(0, this.trauma - decayPerSec * dtSec);
    const shake = this.trauma * this.trauma * this.intensity;
    const t = this.time * 30;
    // Sum of incommensurate sines: cheap, smooth pseudo-noise.
    this.offsetX = maxOffsetPx * shake * (Math.sin(t * 1.1) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4);
    this.offsetY =
      maxOffsetPx * shake * (Math.sin(t * 1.3 + 0.5) * 0.6 + Math.sin(t * 2.9 + 2.1) * 0.4);
    this.rotation = maxRotationRad * shake * Math.sin(t * 0.9 + 3.3);
  }
}
