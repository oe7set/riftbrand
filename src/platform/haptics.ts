/** Vibration feedback (GDD §4.7). Browsers without the Vibration API (iOS Safari) silently skip it. */
export class Haptics {
  intensity = 1;
  private readonly canVibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  constructor(private readonly rumble?: (durationMs: number, strength: number) => void) {}

  pulse(durationMs: number, strength = 1): void {
    if (this.intensity <= 0) return;
    const ms = Math.round(durationMs * this.intensity);
    if (ms <= 0) return;
    if (this.canVibrate) navigator.vibrate(ms);
    this.rumble?.(ms, Math.min(1, strength * this.intensity));
  }
}
