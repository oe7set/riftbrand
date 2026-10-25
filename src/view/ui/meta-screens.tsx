import { useEffect, useRef, useState } from 'preact/hooks';
import { ARMOR, ARMOR_SETS, ARMOR_SLOTS, armorById, armorDescParams } from '../../content/armor';
import { ENEMIES } from '../../content/enemies';
import { buildingById, DECORATIONS } from '../../content/hub/buildings';
import { COSMETICS, cosmeticById, tradeById } from '../../content/hub/market';
import { MATERIALS, materialById } from '../../content/materials';
import { EMBER_TREE, treeNodeById } from '../../content/meta/ember-tree';
import { questById } from '../../content/quests';
import { RELICS, relicDescParams } from '../../content/relics';
import type {
  CostDef,
  QuestDef,
  QuestObjective,
  QuestReward,
  Speaker,
  WorldDef,
} from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { WORLDS, worldById } from '../../content/worlds';
import { type TranslationKey, t } from '../../shared/i18n';
import {
  armorLevel,
  canForge,
  equippedArmor,
  forgeMaxLevel,
  nextArmorCost,
} from '../../sim/meta/forge';
import {
  canBuyCosmetic,
  canTrade,
  ownsCosmetic,
  tradesLeft,
  weeklyOffer,
} from '../../sim/meta/market';
import {
  canBuyRank,
  canUnlockSpell,
  type LastRun,
  nextGoal,
  type Profile,
  spellUnlockCost,
  treeRank,
} from '../../sim/meta/profile';
import { objectiveHave, objectiveNeed, questStatus } from '../../sim/meta/quests';
import {
  buildingLevel,
  canBuyDecoration,
  canUpgradeBuilding,
  hasUnlock,
  nextBuildingCost,
} from '../../sim/meta/refuge';
import {
  isWorldPlayable,
  isWorldUnlocked,
  worldDuelCount,
  worldProgress,
} from '../../sim/meta/worlds';
import { armorIcon, relicIcon, spellIcon } from '../render/icons/specs';
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
      speaker: Speaker | null;
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
      /** A building site (ROADMAP M5.3): level, next step, cost. */
      kind: 'build';
      profile: Profile;
      building: string;
      onBuild(): void;
      onBack(): void;
    }
  | { kind: 'decorations'; profile: Profile; onBuy(id: string): void; onBack(): void }
  | {
      /** One quest (ROADMAP M5.6): the giver's words, objectives, reward and what you can do. */
      kind: 'quest';
      profile: Profile;
      questId: string;
      onAccept(): void;
      onClaim(): void;
      onTrack(): void;
      onBack(): void;
    }
  | { kind: 'questLog'; profile: Profile; onTrack(questId: string): void; onBack(): void }
  | {
      /** Nix's market (ROADMAP M5.5): this week's trades and capes, plus the wardrobe. */
      kind: 'market';
      profile: Profile;
      week: number;
      daysLeft: number;
      onTrade(id: string): void;
      onBuyCape(id: string): void;
      onWearCape(id: string): void;
      onBack(): void;
    }
  | {
      /** Toll's forge (ROADMAP M5.4): craft, improve and equip armour for the next run. */
      kind: 'forge';
      profile: Profile;
      onForge(id: string): void;
      onEquip(id: string): void;
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

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

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
      <MaterialChips materials={profile.materials} />
    </div>
  );
}

const materialName = (id: string) => t(`material.${id}.name` as TranslationKey);

/** Materials as small coloured chips (ROADMAP M5.3); only kinds you have. */
export function MaterialChips({ materials }: { materials: Readonly<Record<string, number>> }) {
  return (
    <>
      {MATERIALS.map((m) => {
        const n = materials[m.id] ?? 0;
        if (n <= 0) return null;
        return (
          <span key={m.id} class="rb-material" style={{ '--mat': hex(m.color) }}>
            ● {n} {materialName(m.id)}
          </span>
        );
      })}
    </>
  );
}

/** One cost line per currency, marked when you don't have enough. */
function CostList({ profile, cost }: { profile: Profile; cost: CostDef }) {
  return (
    <ul class="rb-cost">
      {cost.dust > 0 && (
        <li class={profile.dust < cost.dust ? 'is-short' : ''}>
          ✧ {t('construct.cost_dust', { n: cost.dust, have: profile.dust })}
        </li>
      )}
      {Object.entries(cost.materials).map(([id, n]) => {
        const have = profile.materials[id] ?? 0;
        const color = materialById(id)?.color ?? 0xffffff;
        return (
          <li key={id} class={have < n ? 'is-short' : ''} style={{ '--mat': hex(color) }}>
            <span class="rb-material-dot">●</span>{' '}
            {t('construct.cost_material', { n, have, name: materialName(id) })}
          </li>
        );
      })}
    </ul>
  );
}

function Speech({ speaker, line }: { speaker: Speaker; line: string | null }) {
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
          {hasUnlock(profile, 'world_intel') && world.biome && (
            <div class="rb-world-intel">
              {t('worldmap.intel', {
                names: world.biome.enemyPool
                  .map((e) => t(`enemy.${ENEMIES[e]?.id ?? ''}.name` as TranslationKey))
                  .join(', '),
              })}
            </div>
          )}
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

const LEVEL_KEYS: readonly TranslationKey[] = [
  'construct.level0',
  'construct.level1',
  'construct.level2',
];

export function BuildScreen({
  profile,
  building,
  onBuild,
  onBack,
}: Extract<MetaScreen, { kind: 'build' }>) {
  const def = buildingById(building);
  const level = buildingLevel(profile, building);
  const cost = nextBuildingCost(profile, building);
  const check = canUpgradeBuilding(profile, building);
  const levelName =
    level === 0 && def?.ruin ? t('construct.ruin') : t(LEVEL_KEYS[level] ?? 'construct.level2');
  return (
    <div class="rb-screen rb-center rb-construct">
      <div class="rb-overlay-title">{t(`building.${building}.name` as TranslationKey)}</div>
      <Currencies profile={profile} />
      <div class="rb-world-info rb-construct-info">
        <div class="rb-construct-level">
          {t('construct.state', { level: levelName })}
          <span class="rb-construct-pips">
            {[1, 2].map((n) => (
              <span key={n} class={n <= level ? 'is-on' : ''} />
            ))}
          </span>
        </div>
        <div class="rb-world-desc">{t(`building.${building}.desc` as TranslationKey)}</div>
        {cost ? (
          <>
            <div class="rb-construct-next">
              {t('construct.next', { level: t(LEVEL_KEYS[level + 1] ?? 'construct.level2') })}{' '}
              {t(`building.${building}.level${level + 1}` as TranslationKey)}
            </div>
            <CostList profile={profile} cost={cost} />
          </>
        ) : (
          <div class="rb-construct-next">{t('construct.maxed')}</div>
        )}
      </div>
      <Focus>
        <div class="rb-menu">
          {cost && (
            <button
              type="button"
              class="rb-button rb-primary"
              data-autofocus
              disabled={check !== 'ok'}
              onClick={onBuild}
            >
              {check === 'ok'
                ? t(level === 0 && def?.ruin ? 'construct.rebuild' : 'construct.upgrade')
                : t('construct.missing')}
            </button>
          )}
          <button
            type="button"
            class="rb-button"
            data-autofocus={cost ? undefined : true}
            onClick={onBack}
          >
            {t('common.back')}
          </button>
        </div>
      </Focus>
      {!cost && <div class="rb-version rb-station-footer">{t('construct.hint')}</div>}
    </div>
  );
}

export function DecorationsScreen({
  profile,
  onBuy,
  onBack,
}: Extract<MetaScreen, { kind: 'decorations' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#ffd36b' }}>
      <div class="rb-being-name">{t('decor.title')}</div>
      <div class="rb-being-quote">{t('decor.hint')}</div>
      <Currencies profile={profile} />
      <Focus wide>
        <div class="rb-cards">
          {DECORATIONS.map((d, i) => {
            const check = canBuyDecoration(profile, d.id);
            const owned = check === 'owned';
            return (
              <button
                type="button"
                key={d.id}
                class={`rb-card rb-shop-item ${owned ? 'is-sold' : ''}`}
                disabled={check !== 'ok'}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onBuy(d.id)}
                style={{ '--mat': hex(d.color) }}
              >
                <div class="rb-card-head">
                  <span class="rb-card-rarity">{owned ? t('decor.owned') : t('decor.buy')}</span>
                </div>
                <div class="rb-card-name">{t(`decor.${d.id}.name` as TranslationKey)}</div>
                {!owned && <CostList profile={profile} cost={d.cost} />}
              </button>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}

/** One objective as a sentence, e.g. "Defeat 30 burning enemies". */
function objectiveText(o: QuestObjective): string {
  switch (o.kind) {
    case 'collect':
      return t('quest.obj.collect', { n: o.count, name: materialName(o.material) });
    case 'deliver':
      return t('quest.obj.deliver', { n: o.count, name: materialName(o.material) });
    case 'statusKills':
      return t('quest.obj.status_kills', {
        n: o.count,
        status: t(`quest.status.${o.status}` as TranslationKey),
      });
    case 'defeat':
      return t('quest.obj.defeat', { name: t(`enemy.${o.enemy}.name` as TranslationKey) });
    case 'flawless':
      return t('quest.obj.flawless', { n: o.count });
    case 'reachBoss':
      return t('quest.obj.reach_boss', { world: worldName(o.world) });
    case 'findItem':
      return t('quest.obj.find_item', {
        name: t(`quest_item.${o.item}.name` as TranslationKey),
        world: worldName(o.world),
      });
    case 'build':
      return t(o.level > 1 ? 'quest.obj.expand' : 'quest.obj.build', {
        name: t(`building.${o.building}.name` as TranslationKey),
      });
  }
}

function rewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.ember > 0) parts.push(`✦ ${t('hub.ember', { n: r.ember })}`);
  if (r.dust > 0) parts.push(`✧ ${t('hub.dust', { n: r.dust })}`);
  for (const [id, n] of Object.entries(r.materials)) parts.push(`● ${n} ${materialName(id)}`);
  if (r.spell)
    parts.push(t('quest.reward_spell', { name: t(`spell.${r.spell}.name` as TranslationKey) }));
  return parts.join(' · ');
}

function QuestProgress({ profile, quest }: { profile: Profile; quest: QuestDef }) {
  return (
    <ul class="rb-quest-objectives">
      {quest.objectives.map((o, i) => {
        const need = objectiveNeed(o);
        const have = objectiveHave(profile, quest, i);
        const active = profile.quests.active.includes(quest.id);
        return (
          <li key={`${quest.id}-${i}`} class={have >= need ? 'is-done' : ''}>
            <span>{have >= need ? '✓' : '○'}</span> {objectiveText(o)}
            {active && need > 1 && (
              <span class="rb-quest-count">
                {' '}
                {have}/{need}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function QuestScreen(s: Extract<MetaScreen, { kind: 'quest' }>) {
  const quest = questById(s.questId);
  if (!quest) return null;
  const status = questStatus(s.profile, quest.id);
  const line =
    status === 'ready'
      ? 'done'
      : status === 'available'
        ? 'offer'
        : status === 'done'
          ? 'done'
          : 'desc';
  const tracked = s.profile.quests.tracked === quest.id;
  return (
    <div class="rb-screen rb-center rb-station rb-quest">
      <div class="rb-overlay-title">{t(`quest.${quest.id}.name` as TranslationKey)}</div>
      <div class="rb-quest-kind">
        {t(quest.kind === 'story' ? 'quest.kind_story' : 'quest.kind_errand')} ·{' '}
        {t(`speaker.${quest.giver}` as TranslationKey)}
      </div>
      <div class="rb-speeches">
        <div class={`rb-speech speaker-${quest.giver}`}>
          <div class="rb-speech-name">{t(`speaker.${quest.giver}` as TranslationKey)}</div>
          <div class="rb-speech-text">„{t(`quest.${quest.id}.${line}` as TranslationKey)}“</div>
        </div>
      </div>
      <div class="rb-world-info rb-quest-info">
        <QuestProgress profile={s.profile} quest={quest} />
        <div class="rb-quest-reward">{t('quest.reward', { reward: rewardText(quest.reward) })}</div>
      </div>
      <Focus>
        <div class="rb-menu">
          {status === 'available' && (
            <button type="button" class="rb-button rb-primary" data-autofocus onClick={s.onAccept}>
              {t('quest.accept')}
            </button>
          )}
          {status === 'ready' && (
            <button type="button" class="rb-button rb-primary" data-autofocus onClick={s.onClaim}>
              {t('quest.claim')}
            </button>
          )}
          {status === 'active' && !tracked && (
            <button type="button" class="rb-button" data-autofocus onClick={s.onTrack}>
              {t('quest.track')}
            </button>
          )}
          <button
            type="button"
            class="rb-button"
            data-autofocus={
              status === 'done' || (status === 'active' && tracked) ? true : undefined
            }
            onClick={s.onBack}
          >
            {t('common.back')}
          </button>
        </div>
      </Focus>
    </div>
  );
}

export function QuestLogScreen({
  profile,
  onTrack,
  onBack,
}: Extract<MetaScreen, { kind: 'questLog' }>) {
  const active = profile.quests.active
    .map((id) => questById(id))
    .filter((q): q is QuestDef => q !== undefined);
  return (
    <div class="rb-screen rb-center rb-boon-screen rb-quest-log" style={{ '--being': '#ffd36b' }}>
      <div class="rb-being-name">{t('quest.log')}</div>
      <div class="rb-being-quote">
        {active.length === 0 ? t('quest.log_empty') : t('quest.log_hint')}
      </div>
      <Focus wide>
        <div class="rb-cards">
          {active.map((q, i) => {
            const tracked = profile.quests.tracked === q.id;
            const ready = questStatus(profile, q.id) === 'ready';
            return (
              <button
                type="button"
                key={q.id}
                class={`rb-card rb-quest-card ${tracked ? 'is-tracked' : ''}`}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onTrack(q.id)}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">
                    {t(q.kind === 'story' ? 'quest.kind_story' : 'quest.kind_errand')}
                  </span>
                  <span class="rb-card-rarity">
                    {ready ? t('quest.ready') : tracked ? t('quest.tracked') : t('quest.track')}
                  </span>
                </div>
                <div class="rb-card-name">{t(`quest.${q.id}.name` as TranslationKey)}</div>
                <QuestProgress profile={profile} quest={q} />
              </button>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}

/** "4 Slag iron + 1 Rift dust" as text, for a trade's sides. */
function goods(cost: CostDef): string {
  const parts = Object.entries(cost.materials).map(([id, n]) => `${n} ${materialName(id)}`);
  if (cost.dust > 0) parts.push(t('market.dust', { n: cost.dust }));
  return parts.join(' + ');
}

function CapeSwatch({ color }: { color: number }) {
  return <span class="rb-cape-swatch" style={{ '--cape': hex(color) }} />;
}

export function MarketScreen(s: Extract<MetaScreen, { kind: 'market' }>) {
  const offer = weeklyOffer(s.week);
  const owned = COSMETICS.filter((c) => ownsCosmetic(s.profile, c.id));
  let first = true;
  const autofocus = () => {
    const was = first;
    first = false;
    return was ? true : undefined;
  };
  return (
    <div class="rb-screen rb-center rb-boon-screen rb-market" style={{ '--being': '#c46bff' }}>
      <div class="rb-being-name">{t('market.title')}</div>
      <div class="rb-being-quote">
        {s.daysLeft === 1 ? t('market.hint_one') : t('market.hint', { n: s.daysLeft })}
      </div>
      <Currencies profile={s.profile} />
      <Focus wide>
        <div class="rb-market-body">
          <div class="rb-market-heading">{t('market.trades')}</div>
          <div class="rb-cards">
            {offer.trades.map((id) => {
              const def = tradeById(id);
              if (!def) return null;
              const check = canTrade(s.profile, id, s.week);
              const left = s.profile.market.week === s.week ? tradesLeft(s.profile, id) : def.stock;
              return (
                <button
                  type="button"
                  key={id}
                  class={`rb-card rb-shop-item rb-market-card ${left === 0 ? 'is-sold' : ''}`}
                  disabled={check !== 'ok'}
                  data-autofocus={autofocus()}
                  onClick={() => s.onTrade(id)}
                >
                  <div class="rb-card-head">
                    <span class="rb-card-slot">{t('market.trade')}</span>
                    <span class="rb-card-rarity">
                      {t('market.left', { n: left, max: def.stock })}
                    </span>
                  </div>
                  <div class="rb-market-trade">
                    <span>{goods(def.give)}</span>
                    <span class="rb-market-arrow">➜</span>
                    <span>{goods(def.get)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div class="rb-market-heading">{t('market.capes')}</div>
          <div class="rb-cards">
            {offer.capes.map((id) => {
              const def = cosmeticById(id);
              if (!def) return null;
              const check = canBuyCosmetic(s.profile, id, s.week);
              return (
                <button
                  type="button"
                  key={id}
                  class={`rb-card rb-shop-item rb-market-card ${check === 'owned' ? 'is-sold' : ''}`}
                  disabled={check !== 'ok'}
                  data-autofocus={autofocus()}
                  onClick={() => s.onBuyCape(id)}
                >
                  <div class="rb-card-head">
                    <span class="rb-card-slot">{t('market.cape')}</span>
                    <span class="rb-card-rarity">
                      {check === 'owned' ? t('market.owned') : `✦ ${def.ember}`}
                    </span>
                  </div>
                  <div class="rb-card-title">
                    <CapeSwatch color={def.color} />
                    <div class="rb-card-name">{t(`cosmetic.${id}.name` as TranslationKey)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div class="rb-market-heading">{t('market.wardrobe')}</div>
          <div class="rb-wardrobe">
            {owned.map((c) => (
              <button
                type="button"
                key={c.id}
                class={`rb-button rb-small-button ${s.profile.cape === c.id ? 'rb-primary' : ''}`}
                data-autofocus={autofocus()}
                onClick={() => s.onWearCape(c.id)}
              >
                <CapeSwatch color={c.color} /> {t(`cosmetic.${c.id}.name` as TranslationKey)}
              </button>
            ))}
          </div>
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={s.onBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}

function SetBonuses({ profile }: { profile: Profile }) {
  const worn = equippedArmor(profile);
  return (
    <div class="rb-forge-sets">
      {ARMOR_SETS.map((set) => {
        const count = worn.filter((a) => armorById(a.id)?.set === set.id).length;
        return (
          <div key={set.id} class="rb-world-info rb-forge-set" style={{ '--world': '#ff7a2e' }}>
            <div class="rb-world-name">
              {t(`armor_set.${set.id}.name` as TranslationKey)} · {count}/4
            </div>
            <div class={count >= 2 ? 'is-on' : 'is-off'}>
              (2) {t(`armor_set.${set.id}.bonus2` as TranslationKey)}
            </div>
            <div class={count >= 4 ? 'is-on' : 'is-off'}>
              (4) {t(`armor_set.${set.id}.bonus4` as TranslationKey)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ForgeScreen({
  profile,
  onForge,
  onEquip,
  onBack,
}: Extract<MetaScreen, { kind: 'forge' }>) {
  const maxLevel = forgeMaxLevel(profile);
  const pieces = [...ARMOR].sort(
    (a, b) => ARMOR_SLOTS.indexOf(a.slot) - ARMOR_SLOTS.indexOf(b.slot),
  );
  return (
    <div class="rb-screen rb-center rb-boon-screen rb-forge" style={{ '--being': '#ff9a5a' }}>
      <div class="rb-being-name">{t('forge.title')}</div>
      <div class="rb-being-quote">{t('forge.hint', { max: maxLevel })}</div>
      <Currencies profile={profile} />
      <SetBonuses profile={profile} />
      <Focus wide>
        <div class="rb-cards">
          {pieces.map((a, i) => {
            const level = armorLevel(profile, a.id);
            const worn = profile.equipped[a.slot] === a.id;
            const check = canForge(profile, a.id);
            const cost = nextArmorCost(profile, a.id);
            const shown = Math.max(1, level);
            return (
              <div key={a.id} class={`rb-card rb-armor ${worn ? 'is-worn' : ''}`}>
                <div class="rb-card-head">
                  <span class="rb-card-slot">{t(`armor_slot.${a.slot}` as TranslationKey)}</span>
                  <span class="rb-card-rarity">
                    {level === 0 ? t('forge.not_owned') : t('forge.level', { n: level })}
                  </span>
                </div>
                <CardTitle
                  spec={armorIcon(a.id)}
                  name={t(`armor.${a.id}.name` as TranslationKey)}
                />
                <div class="rb-card-desc">
                  {t(`armor.${a.id}.desc` as TranslationKey, armorDescParams(a, shown))}
                </div>
                {a.set && (
                  <div class="rb-armor-set">{t(`armor_set.${a.set}.name` as TranslationKey)}</div>
                )}
                {cost && check !== 'maxed' && check !== 'locked' && (
                  <CostList profile={profile} cost={cost} />
                )}
                <div class="rb-armor-actions">
                  {check !== 'maxed' && (
                    <button
                      type="button"
                      class="rb-button rb-small-button"
                      disabled={check !== 'ok'}
                      data-autofocus={i === 0 ? true : undefined}
                      onClick={() => onForge(a.id)}
                    >
                      {check === 'locked'
                        ? t('forge.needs_forge')
                        : level === 0
                          ? t('forge.craft')
                          : t('forge.improve', { n: level + 1 })}
                    </button>
                  )}
                  {level > 0 && (
                    <button
                      type="button"
                      class={`rb-button rb-small-button ${worn ? 'rb-primary' : ''}`}
                      onClick={() => onEquip(a.id)}
                    >
                      {worn ? t('forge.unequip') : t('forge.equip')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Focus>
      <div class="rb-menu">
        <button type="button" class="rb-button rb-primary" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
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
      {Object.keys(last.materials).length > 0 && (
        <div class="rb-currencies rb-result-materials">
          <MaterialChips materials={last.materials} />
        </div>
      )}
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
