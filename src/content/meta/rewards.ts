import { registerTunables } from '../tunables';

/**
 * Meta currencies earned per run (GDD §8.1). Glut flows on every run, also on death; Rissstaub
 * only from elites and bosses.
 */
export const META_REWARDS = {
  emberPerRoom: 7,
  emberPerElite: 10,
  emberPerBoss: 25,
  /** One Glut per this many kills. */
  killsPerEmber: 5,
  dustPerElite: 1,
  dustPerBoss: 3,
  /** Bonus for winning, so a victory always feels like a leap. */
  emberWinBonus: 30,
};

registerTunables('meta: rewards', 'src/content/meta/rewards.ts', META_REWARDS);
