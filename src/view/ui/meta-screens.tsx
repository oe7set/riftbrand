import { useEffect, useRef, useState } from 'preact/hooks';
import { ENEMIES } from '../../content/enemies';
import { EMBER_TREE, treeNodeById } from '../../content/meta/ember-tree';
import { RELICS, relicDescParams } from '../../content/relics';
import type { WorldDef } from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { WORLDS, worldById } from '../../content/worlds';
import { type TranslationKey, t } from '../../shared/i18n';
import {
  canBuyRank,
  canUnlockSpell,
  type LastRun,
  nextGoal,
  type Profile,
  spellUnlockCost,
  treeRank,
} from '../../sim/meta/profile';
import {
  isWorldPlayable,
  isWorldUnlocked,
  worldDuelCount,
  worldProgress,
} from '../../sim/meta/worlds';
import { relicIcon, spellIcon } from '../render/icons/specs';
import { CardTitle } from './icons';

/** Screens of the meta layer (GDD §2.3, §8): hub, Ember Tree, Nix, save transfer, results. */
export type MetaScreen =
  | {
      /** Walking in the refuge (ROADMAP M5.1): currencies and the interact hint, no input. */
      kind: 'hubWalk';
      profile: Profile;
      /** e.g. "E · Talk to Maren"; null when nothing is in reach. */
      prompt: string | null;
    }
  | {
      /** A station in the refuge: the figure's line for this visit and what you can do here. */
      kind: 'station';
      profile: Profile;
      title: string;
      speaker: 'maren' | 'nix' | 'sel' | null;
      line: string | null;
      actions: StationAction[];
      /** Text under the actions, e.g. run statistics at the campfire. */
      footer?: string;
      onBack(): void;
    }
  | { kind: 'tree'; profile: Profile; onBuy(id: string): void; onRespec(): void; onBack(): void }
  | { kind: 'wares'; profile: Profile; onUnlock(id: string): void; onBack(): void }
  | {
      kind: 'spells';
      profile: Profile;
      onUnlock(id: string): void;
      onEquip(id: string): void;
      onBack(): void;
    }
  | {
      kind: 'profile';
      exportCode: string | null;
      message: string | null;
      onCopy(): void;
      onImport(code: string): void;
      onBack(): void;
    }
  | {
      /** The portal hall's world map (ROADMAP M5.2): pick the world of the next run. */
      kind: 'worldMap';
      profile: Profile;
      /** World of the saved run in progress; null when there is none. */
      runWorld: string | null;
      /** World highlighted when the map opens. */
      selected: string;
      onDepart(worldId: string): void;
      onContinue(): void;
      onAbandon(): void;
      onBack(): void;
    }
  | { kind: 'result'; last: LastRun; profile: Profile; onContinue(): void };

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function Focus({ children, wide }: { children: preact.ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} class={wide ? 'rb-wide' : undefined}>
      {children}
    </div>
  );
}

function Currencies({ profile }: { profile: Profile }) {
  return (
    <div class="rb-currencies">
      <span class="rb-ember">✦ {t('hub.ember', { n: profile.ember })}</span>
      <span class="rb-dust">✧ {t('hub.dust', { n: profile.dust })}</span>
    </div>
  );
}

function Speech({ speaker, line }: { speaker: 'maren' | 'nix' | 'sel'; line: string | null }) {
  if (!line) return null;
  return (
    <div class={`rb-speech speaker-${speaker}`}>
      <div class="rb-speech-name">{t(`speaker.${speaker}` as TranslationKey)}</div>
      <div class="rb-speech-text">„{t(`dialogue.${line}` as TranslationKey)}“</div>
    </div>
  );
}

export interface StationAction {
  label: string;
  onClick(): void;
  primary?: boolean;
  /** Needs a second press to confirm (e.g. abandoning a run). */
  confirmLabel?: string;
}

export function HubWalkScreen({ profile, prompt }: Extract<MetaScreen, { kind: 'hubWalk' }>) {
  return (
    <div class="rb-hub-walk">
      <Currencies profile={profile} />
      {prompt && <div class="rb-hub-prompt">{prompt}</div>}
    </div>
  );
}

export function StationScreen(s: Extract<MetaScreen, { kind: 'station' }>) {
  const [confirming, setConfirming] = useState<number | null>(null);
  return (
    <div class="rb-screen rb-center rb-station">
      <div class="rb-overlay-title">{s.title}</div>
      <Currencies profile={s.profile} />
      {s.speaker && (
        <div class="rb-speeches">
          <Speech speaker={s.speaker} line={s.line} />
        </div>
      )}
      <Focus>
        <div class="rb-menu">
          {s.actions.map((a, i) => {
            const armed = confirming === i;
            return (
              <button
                type="button"
                key={a.label}
                class={`rb-button ${a.primary ? 'rb-primary' : ''} ${armed ? 'rb-danger' : ''}`}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => {
                  if (a.confirmLabel && !armed) setConfirming(i);
                  else a.onClick();
                }}
              >
                {armed && a.confirmLabel ? a.confirmLabel : a.label}
              </button>
            );
          })}
          <button type="button" class="rb-button" onClick={s.onBack}>
            {t('common.back')}
          </button>
        </div>
      </Focus>
      {s.footer && <div class="rb-version rb-station-footer">{s.footer}</div>}
    </div>
  );
}

const worldName = (id: string) => t(`world.${id}.name` as TranslationKey);
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

type WorldState = 'locked' | 'soon' | 'open' | 'beaten';

function worldState(profile: Profile, world: WorldDef): WorldState {
  if (!isWorldUnlocked(profile, world)) return 'locked';
  if (!isWorldPlayable(profile, world)) return 'soon';
  return worldProgress(profile, world.id).bossKills > 0 ? 'beaten' : 'open';
}

/** What to do next in a world: the boss, then the remaining mini-bosses (quests come in M5.6). */
function worldHint(profile: Profile, world: WorldDef): string {
  const progress = worldProgress(profile, world.id);
  if (progress.bossKills === 0 && world.bossName) {
    return t('worldmap.hint.boss', { name: t(`enemy.${world.bossName}.name` as TranslationKey) });
  }
  if (progress.duelsWon.length < worldDuelCount(world)) return t('worldmap.hint.duels');
  return t('worldmap.hint.done');
}

function WorldDetails({ profile, world }: { profile: Profile; world: WorldDef }) {
  const state = worldState(profile, world);
  const progress = worldProgress(profile, world.id);
  return (
    <div class="rb-world-info" style={{ '--world': hex(world.color) }}>
      <div class="rb-world-name">{worldName(world.id)}</div>
      <div class="rb-world-desc">{t(`world.${world.id}.desc` as TranslationKey)}</div>
      {state === 'locked' && world.unlock.kind === 'boss' && (
        <div class="rb-world-lock">
          🔒 {t('worldmap.unlock_boss', { world: worldName(world.unlock.world) })}
        </div>
      )}
      {state === 'soon' && <div class="rb-world-lock">{t('worldmap.soon')}</div>}
      {(state === 'open' || state === 'beaten') && (
        <>
          <div class="rb-world-stats">
            {world.bossName && (
              <div>
                {t(state === 'beaten' ? 'worldmap.boss_beaten' : 'worldmap.boss_open', {
                  name: t(`enemy.${world.bossName}.name` as TranslationKey),
                })}
              </div>
            )}
            <div>
              {t('worldmap.duels', { n: progress.duelsWon.length, max: worldDuelCount(world) })}
            </div>
            <div>
              {progress.bestTimeSec === null
                ? t('worldmap.best_none')
                : t('worldmap.best', { time: formatTime(progress.bestTimeSec) })}
            </div>
            <div>{t('worldmap.runs', { n: progress.runs })}</div>
          </div>
          <div class="rb-world-hint">➜ {worldHint(profile, world)}</div>
        </>
      )}
    </div>
  );
}

export function WorldMapScreen(s: Extract<MetaScreen, { kind: 'worldMap' }>) {
  const [selected, setSelected] = useState(s.runWorld ?? s.selected);
  const [confirming, setConfirming] = useState(false);
  const world = worldById(selected) ?? (WORLDS[0] as WorldDef);
  const playable = isWorldPlayable(s.profile, world);
  const select = (id: string) => {
    setSelected(id);
    setConfirming(false);
  };
  return (
    <div class="rb-screen rb-center rb-worldmap">
      <div class="rb-overlay-title">{t('worldmap.title')}</div>
      <Currencies profile={s.profile} />
      <Focus>
        <div class="rb-worldmap-board">
          <svg
            class="rb-worldmap-paths"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {WORLDS.map((w) => {
              if (w.unlock.kind !== 'boss') return null;
              const from = worldById(w.unlock.world);
              if (!from) return null;
              const open = isWorldUnlocked(s.profile, w);
              return (
                <line
                  key={w.id}
                  x1={from.mapX * 100}
                  y1={from.mapY * 100}
                  x2={w.mapX * 100}
                  y2={w.mapY * 100}
                  class={open ? 'open' : ''}
                  vector-effect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {WORLDS.map((w) => {
            const state = worldState(s.profile, w);
            const current = s.runWorld === w.id;
            return (
              <button
                type="button"
                key={w.id}
                class={`rb-world ${state} ${selected === w.id ? 'selected' : ''} ${current ? 'current' : ''}`}
                style={{
                  left: `${w.mapX * 100}%`,
                  top: `${w.mapY * 100}%`,
                  '--world': hex(w.color),
                }}
                aria-label={worldName(w.id)}
                onFocus={() => select(w.id)}
                onClick={() => select(w.id)}
              >
                <span class="rb-world-dot">
                  {state === 'locked'
                    ? '🔒'
                    : state === 'beaten'
                      ? '✓'
                      : state === 'open'
                        ? '✦'
                        : '…'}
                </span>
                <span class="rb-world-label">{worldName(w.id)}</span>
              </button>
            );
          })}
        </div>
        <WorldDetails profile={s.profile} world={world} />
        <div class="rb-menu">
          {s.runWorld === null ? (
            <button
              type="button"
              class="rb-button rb-primary"
              data-autofocus
              disabled={!playable}
              onClick={() => s.onDepart(world.id)}
            >
              {playable
                ? t('worldmap.depart', { world: worldName(world.id) })
                : t('worldmap.closed')}
            </button>
          ) : (
            <>
              <button
                type="button"
                class="rb-button rb-primary"
                data-autofocus
                onClick={s.onContinue}
              >
                {t('worldmap.continue', { world: worldName(s.runWorld) })}
              </button>
              <button
                type="button"
                class={`rb-button ${confirming ? 'rb-danger' : ''}`}
                onClick={() => (confirming ? s.onAbandon() : setConfirming(true))}
              >
                {confirming ? t('hub.abandon_confirm') : t('hub.abandon')}
              </button>
            </>
          )}
          <button type="button" class="rb-button" onClick={s.onBack}>
            {t('common.back')}
          </button>
        </div>
      </Focus>
    </div>
  );
}

function treeName(id: string, rank = 0): string {
  const name = t(`tree.${id}.name` as TranslationKey);
  const max = treeNodeById(id)?.ranks.length ?? 1;
  // "Vitality II": the rank you are about to buy; the first rank needs no numeral.
  return max > 1 && rank > 1 ? `${name} ${'I'.repeat(Math.min(rank, 3))}` : name;
}

export function TreeScreen({
  profile,
  onBuy,
  onRespec,
  onBack,
}: Extract<MetaScreen, { kind: 'tree' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen rb-tree" style={{ '--being': '#ffb347' }}>
      <div class="rb-being-name">{t('tree.title')}</div>
      <div class="rb-being-quote">{t('tree.hint')}</div>
      <Currencies profile={profile} />
      <Focus wide>
        <div class="rb-cards">
          {EMBER_TREE.map((node, i) => {
            const rank = treeRank(profile, node.id);
            const check = canBuyRank(profile, node.id);
            const cost = node.ranks[rank];
            const status =
              check === 'maxed'
                ? t('tree.maxed')
                : check === 'locked'
                  ? t('tree.locked', { name: treeName(node.requires ?? '') })
                  : cost && cost.dust > 0
                    ? t('tree.cost_dust', { ember: cost.ember, dust: cost.dust })
                    : t('tree.cost', { ember: cost?.ember ?? 0 });
            return (
              <button
                type="button"
                key={node.id}
                class={`rb-card rb-tree-node ${check === 'maxed' ? 'is-maxed' : ''}`}
                disabled={check !== 'ok'}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onBuy(node.id)}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">
                    {t('tree.rank', { rank, max: node.ranks.length })}
                  </span>
                  <span class="rb-card-rarity">{status}</span>
                </div>
                <div class="rb-card-name">{t(`tree.${node.id}.name` as TranslationKey)}</div>
                <div class="rb-pips">
                  {node.ranks.map((_, r) => (
                    <span key={r} class={r < rank ? 'is-on' : ''} />
                  ))}
                </div>
                <div class="rb-card-desc">{t(`tree.${node.id}.desc` as TranslationKey)}</div>
              </button>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button" onClick={onRespec}>
          {t('tree.respec')}
        </button>
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('tree.back')}
        </button>
      </div>
    </div>
  );
}

export function WaresScreen({ profile, onUnlock, onBack }: Extract<MetaScreen, { kind: 'wares' }>) {
  const wares = RELICS.filter((r) => r.unlockCost !== undefined);
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#c46bff' }}>
      <div class="rb-being-name">{t('wares.title')}</div>
      <div class="rb-being-quote">{t('wares.hint')}</div>
      <Currencies profile={profile} />
      <Focus wide>
        <div class="rb-cards">
          {wares.map((r, i) => {
            const owned = profile.relicsUnlocked.includes(r.id);
            const affordable = profile.dust >= (r.unlockCost ?? 0);
            return (
              <button
                type="button"
                key={r.id}
                class={`rb-card rb-shop-item ${r.rarity === 'curse' ? 'relic-curse' : ''} ${owned ? 'is-sold' : ''}`}
                disabled={owned || !affordable}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onUnlock(r.id)}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">
                    {t(`relic_rarity.${r.rarity}` as TranslationKey)}
                  </span>
                  <span class="rb-card-rarity">
                    {owned
                      ? t('wares.owned')
                      : `✧ ${t('wares.unlock', { cost: r.unlockCost ?? 0 })}`}
                  </span>
                </div>
                <CardTitle
                  spec={relicIcon(r.id)}
                  name={t(`relic.${r.id}.name` as TranslationKey)}
                />
                <div class="rb-card-desc">
                  {t(`relic.${r.id}.desc` as TranslationKey, relicDescParams(r, 1))}
                </div>
              </button>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('tree.back')}
        </button>
      </div>
    </div>
  );
}

function spellColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Sel's rune tower (ROADMAP M3.6): every spell with its state. Unlocked spells are equipped
 * with one tap (into the slot of their kind); locked ones show their price, halved once found
 * in a run.
 */
export function SpellTowerScreen({
  profile,
  onUnlock,
  onEquip,
  onBack,
}: Extract<MetaScreen, { kind: 'spells' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#b8a6ff' }}>
      <div class="rb-being-name">{t('spells.title')}</div>
      <div class="rb-being-quote">{t('spells.hint')}</div>
      <Currencies profile={profile} />
      <Focus wide>
        <div class="rb-cards">
          {SPELLS.map((def, i) => {
            const unlocked = profile.spellsUnlocked.includes(def.id);
            const equipped = profile.loadout.active === def.id || profile.loadout.aura === def.id;
            const check = canUnlockSpell(profile, def.id);
            const cost = spellUnlockCost(profile, def.id);
            const discovered = profile.spellsDiscovered.includes(def.id);
            const status = equipped
              ? t('spells.equipped')
              : unlocked
                ? t('spells.equip')
                : `${discovered ? `${t('spells.discovered')} · ` : ''}${t('tree.cost_dust', cost)}`;
            return (
              <button
                type="button"
                key={def.id}
                class={`rb-card rb-spell ${equipped ? 'is-equipped' : ''}`}
                style={{ '--being': spellColor(def.visual.color) }}
                disabled={equipped || (!unlocked && check !== 'ok')}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => (unlocked ? onEquip(def.id) : onUnlock(def.id))}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">{t(`spell.kind.${def.kind}` as TranslationKey)}</span>
                  <span class="rb-card-rarity">{status}</span>
                </div>
                <CardTitle
                  spec={spellIcon(def.id)}
                  name={t(`spell.${def.id}.name` as TranslationKey)}
                />
                <div class="rb-card-desc">{t(`spell.${def.id}.desc` as TranslationKey)}</div>
              </button>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('tree.back')}
        </button>
      </div>
    </div>
  );
}

export function ProfileScreen(s: Extract<MetaScreen, { kind: 'profile' }>) {
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  return (
    <div class="rb-screen rb-center rb-profile">
      <div class="rb-overlay-title">{t('profile.title')}</div>
      <div class="rb-overlay-hint">{t('profile.hint')}</div>
      <Focus>
        <div class="rb-menu rb-menu-wide">
          <label class="rb-field-label" for="rb-export">
            {t('profile.export')}
          </label>
          <textarea id="rb-export" class="rb-code" readOnly rows={3} value={s.exportCode ?? '…'} />
          <button type="button" class="rb-button" data-autofocus onClick={s.onCopy}>
            {t('profile.copy')}
          </button>
          <label class="rb-field-label" for="rb-import">
            {t('profile.import')}
          </label>
          <textarea
            id="rb-import"
            class="rb-code"
            rows={3}
            value={code}
            onInput={(e) => {
              setCode((e.target as HTMLTextAreaElement).value);
              setConfirming(false);
            }}
          />
          <button
            type="button"
            class={`rb-button ${confirming ? 'rb-danger' : ''}`}
            disabled={code.trim() === ''}
            onClick={() => {
              if (!confirming) setConfirming(true);
              else {
                setConfirming(false);
                s.onImport(code);
              }
            }}
          >
            {confirming ? t('profile.import_confirm') : t('profile.import_button')}
          </button>
          {s.message && <div class="rb-overlay-hint">{s.message}</div>}
          <button type="button" class="rb-button rb-primary" onClick={s.onBack}>
            {t('tree.back')}
          </button>
        </div>
      </Focus>
    </div>
  );
}

export function ResultScreen({
  last,
  profile,
  onContinue,
}: Extract<MetaScreen, { kind: 'result' }>) {
  const goal = nextGoal(profile);
  const goalName = goal ? treeName(goal.nodeId, treeRank(profile, goal.nodeId) + 1) : '';
  const missing = goal ? Math.max(0, goal.ember - profile.ember) : 0;
  const progress = goal ? Math.min(1, profile.ember / Math.max(1, goal.ember)) : 1;
  const killer = last.killedBy ? ENEMIES.find((e) => e.id === last.killedBy) : undefined;
  return (
    <div class={`rb-screen rb-center rb-result ${last.result === 'won' ? 'is-won' : 'is-lost'}`}>
      <div class="rb-overlay-title">{t(last.result === 'won' ? 'result.won' : 'result.lost')}</div>
      <div class="rb-being-quote">{worldName(last.worldId)}</div>
      {last.unlockedWorlds.map((id) => (
        <div key={id} class="rb-world-unlocked">
          {t('result.world_unlocked', { world: worldName(id) })}
        </div>
      ))}
      <div class="rb-stats">
        <div>{t('stats.rooms', { n: last.roomsCleared })}</div>
        <div>{t('stats.kills', { n: last.kills })}</div>
        <div>{t('stats.time', { time: formatTime(last.timeSec) })}</div>
        {killer && (
          <div>
            {t('result.killed_by', { name: t(`enemy.${killer.id}.name` as TranslationKey) })}
          </div>
        )}
      </div>
      <div class="rb-earned">{t('result.earned', { ember: last.ember, dust: last.dust })}</div>
      {/* The "almost there" bar (GDD §8.8): what the next Glut buys. */}
      <div class="rb-goal">
        <div class="rb-goal-bar">
          <div class="rb-goal-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div class="rb-goal-text">
          {!goal
            ? t('result.goal_none')
            : missing > 0
              ? t('result.goal', { n: missing, name: goalName })
              : t('result.goal_ready', { name: goalName })}
        </div>
      </div>
      <Focus>
        <button type="button" class="rb-button rb-primary" data-autofocus onClick={onContinue}>
          {t('result.to_hub')}
        </button>
      </Focus>
    </div>
  );
}
