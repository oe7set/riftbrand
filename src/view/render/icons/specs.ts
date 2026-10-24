import { armorById } from '../../../content/armor';
import { boonById } from '../../../content/boons';
import { BEINGS } from '../../../content/boons/beings';
import { relicById } from '../../../content/relics';
import type { Glyph, Rarity } from '../../../content/schema';
import { SPELLS, spellById } from '../../../content/spells';
import { STATUSES } from '../../../content/statuses';
import { cssColor, type IconSpec } from './icon-svg';

/** Rarity colours (GDD §7.2), matching the card colours in styles.css. */
export const RARITY_COLORS: Record<Rarity | 'curse', string> = {
  common: '#e6e2ff',
  rare: '#6bff9a',
  epic: '#c88bff',
  heroic: '#ffd36b',
  curse: '#ff6b81',
};

const FALLBACK: IconSpec = { frame: 'relic', glyph: 'spark', color: RARITY_COLORS.common };

/** Boons: circle in the being's colour; rarer boons get a rim in the rarity colour. */
export function boonIcon(id: string, rarity?: Rarity): IconSpec {
  const def = boonById(id);
  if (!def) return FALLBACK;
  return {
    frame: 'boon',
    glyph: def.icon.glyph,
    color: BEINGS[def.being].css,
    rim: rarity && rarity !== 'common' ? RARITY_COLORS[rarity] : undefined,
  };
}

/** Relics: hexagon in the rarity colour. */
export function relicIcon(id: string): IconSpec {
  const def = relicById(id);
  if (!def) return FALLBACK;
  return { frame: 'relic', glyph: def.icon.glyph, color: RARITY_COLORS[def.rarity] };
}

/** Armour (ROADMAP M5.4): hexagon in the colour the piece shows on Vesper. */
export function armorIcon(id: string): IconSpec {
  const def = armorById(id);
  if (!def) return FALLBACK;
  const shape = def.look.shapes[0];
  const paint = shape?.stroke ?? shape?.fill;
  const color = typeof paint === 'number' ? cssColor(paint) : RARITY_COLORS.common;
  return { frame: 'relic', glyph: def.icon.glyph, color };
}

/** Spells: diamond in the school colour; auras get a ring around it. */
export function spellIcon(id: string): IconSpec {
  const def = spellById(id);
  if (!def) return FALLBACK;
  return {
    frame: def.kind === 'aura' ? 'aura' : 'spell',
    glyph: def.visual.glyph,
    color: cssColor(def.visual.color),
  };
}

/** Rift shot glyph and colour, for its upgrade icons. */
const RIFT_SHOT_GLYPH: Glyph = 'shot';
const RIFT_SHOT_COLOR = '#c7b8ff';

/** Upgrades (Runenfragment): the target's glyph under a double chevron. */
export function upgradeIcon(target: 'active' | 'aura' | 'cast', spellId?: string): IconSpec {
  if (target === 'cast' || !spellId) {
    return { frame: 'upgrade', glyph: RIFT_SHOT_GLYPH, color: RIFT_SHOT_COLOR };
  }
  const spell = spellIcon(spellId);
  return { frame: 'upgrade', glyph: spell.glyph, color: spell.color };
}

/** Statuses: small circle in the status colour, indexed like STATUSES. */
export function statusIcon(index: number): IconSpec {
  const def = STATUSES[index];
  if (!def) return FALLBACK;
  return { frame: 'status', glyph: def.visual.glyph, color: cssColor(def.visual.color) };
}

/** Every icon the game view needs as a texture (HUD and status overlay). */
export function gameIconSpecs(): { spells: IconSpec[]; statuses: IconSpec[] } {
  return {
    spells: SPELLS.map((s) => spellIcon(s.id)),
    statuses: STATUSES.map((_, i) => statusIcon(i)),
  };
}
