import { useEffect, useRef, useState } from 'preact/hooks';
import { RIFT_SHOT_UPGRADES } from '../../content/abilities';
import { boonById, boonDescParams } from '../../content/boons';
import { BEINGS } from '../../content/boons/beings';
import { evolutionById } from '../../content/evolutions';
import { relicById, relicDescParams } from '../../content/relics';
import type { BoonSlot, EventDef, RoomType, SpellDef, UpgradeBranch } from '../../content/schema';
import { spellById } from '../../content/spells';
import { TUNING } from '../../content/tuning';
import { type TranslationKey, t } from '../../shared/i18n';
import type { OwnedRelic } from '../../sim/effects/build';
import { nodeReward, relicStacks, type ShopItem } from '../../sim/run/economy';
import type { MapNode } from '../../sim/run/map';
import type { BoonOffer, BoonOption } from '../../sim/run/rewards';
import { availableNodes, type RunState, type SpellSlots } from '../../sim/run/run-state';
import { branchTier, type UpgradeOption } from '../../sim/run/upgrades';
import type { IconSpec } from '../render/icons/icon-svg';
import { boonIcon, relicIcon, spellIcon, upgradeIcon } from '../render/icons/specs';
import { CardTitle, Icon, NodeIcon } from './icons';
import { LayoutEditor, type LayoutEditorScreen } from './layout-editor';
import {
  BuildScreen,
  DecorationsScreen,
  ForgeScreen,
  HubWalkScreen,
  MarketScreen,
  MaterialChips,
  type MetaScreen,
  ProfileScreen,
  QuestLogScreen,
  QuestScreen,
  ResultScreen,
  SpellTowerScreen,
  StationScreen,
  TreeScreen,
  WaresScreen,
  WorldMapScreen,
} from './meta-screens';
import { SceneScreen, type SceneScreenProps } from './scene-screen';

const MAP_ROW_PX = 92;
const MAP_PAD_PX = 56;

export type Screen =
  | MetaScreen
  | LayoutEditorScreen
  | SceneScreenProps
  | { kind: 'none' }
  | {
      kind: 'title';
      canContinue: boolean;
      version: string;
      onContinue(): void;
      /** Enters the refuge (hub); new runs start from there. */
      onRefuge(): void;
      onArena(): void;
    }
  | {
      kind: 'map';
      run: RunState;
      /** The tracked quest (ROADMAP M5.6): a line in the header and a symbol on its nodes. */
      quest: { text: string; nodeTypes: readonly RoomType[] } | null;
      onEnter(nodeId: number): void;
    }
  | {
      kind: 'rest';
      run: RunState;
      healAmount: number;
      onRest(): void;
      /** An evolution the player may take instead of healing (GDD §4.9), or null. */
      evolution: string | null;
      onEvolve(): void;
    }
  | { kind: 'evolution'; id: string; onAccept(): void; onLater(): void }
  | {
      kind: 'boon';
      offer: BoonOffer;
      /** The being's line, reacting to the build (ROADMAP M5.7). */
      comment: string;
      onPick(option: BoonOption): void;
      /** Rerolls left (Ember Tree "Second Choice"); the button shows only when > 0. */
      rerolls: number;
      onReroll(): void;
    }
  | { kind: 'relic'; options: string[]; owned: OwnedRelic[]; onPick(id: string): void }
  | { kind: 'upgrade'; run: RunState; options: UpgradeOption[]; onPick(o: UpgradeOption): void }
  | {
      kind: 'spell';
      options: string[];
      current: SpellSlots;
      onPick(id: string): void;
      onSkip(): void;
    }
  | { kind: 'notice'; title: string; text: string; onContinue(): void }
  | {
      kind: 'shop';
      run: RunState;
      stock: ShopItem[];
      onBuy(index: number): void;
      onLeave(): void;
    }
  | {
      kind: 'event';
      run: RunState;
      event: EventDef;
      /** Result lines after a choice; null while choosing. */
      results: string[] | null;
      onChoose(optionId: string): void;
      onContinue(): void;
    };

function Autofocus({ children, wide }: { children: preact.ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus the default action so keyboard/gamepad users can confirm immediately.
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} class={wide ? 'rb-wide' : undefined}>
      {children}
    </div>
  );
}

function TitleScreen(props: Extract<Screen, { kind: 'title' }>) {
  return (
    <div class="rb-screen rb-title">
      <div class="rb-logo">RIFTBRAND</div>
      <div class="rb-tagline">{t('title.tagline')}</div>
      <Autofocus>
        <div class="rb-menu">
          {props.canContinue && (
            <button
              type="button"
              class="rb-button rb-primary"
              data-autofocus
              onClick={props.onContinue}
            >
              {t('title.continue')}
            </button>
          )}
          <button
            type="button"
            class={`rb-button ${props.canContinue ? '' : 'rb-primary'}`}
            data-autofocus={props.canContinue ? undefined : true}
            onClick={props.onRefuge}
          >
            {t('title.refuge')}
          </button>
          <button type="button" class="rb-button" onClick={props.onArena}>
            {t('title.arena')}
          </button>
        </div>
      </Autofocus>
      <div class="rb-version">{props.version}</div>
    </div>
  );
}

function nodeState(run: RunState, node: MapNode, available: Set<number>): string {
  if (node.id === run.currentNodeId) return 'current';
  if (run.visited.includes(node.id)) return 'visited';
  if (available.has(node.id)) return 'available';
  return 'locked';
}

const NODE_NAME_KEYS: Record<RoomType, TranslationKey> = {
  shop: 'node.shop.name',
  event: 'node.event.name',
  altar: 'node.altar.name',
  combat: 'node.combat.name',
  elite: 'node.elite.name',
  horde: 'node.horde.name',
  rest: 'node.rest.name',
  boss: 'node.boss.name',
  duel: 'node.duel.name',
  puzzle: 'node.puzzle.name',
};

const NODE_DESC_KEYS: Record<RoomType, TranslationKey> = {
  shop: 'node.shop.desc',
  event: 'node.event.desc',
  altar: 'node.altar.desc',
  combat: 'node.combat.desc',
  elite: 'node.elite.desc',
  horde: 'node.horde.desc',
  rest: 'node.rest.desc',
  boss: 'node.boss.desc',
  duel: 'node.duel.desc',
  puzzle: 'node.puzzle.desc',
};

function MapScreen({ run, quest, onEnter }: Extract<Screen, { kind: 'map' }>) {
  const available = availableNodes(run);
  const availableIds = new Set(available.map((n) => n.id));
  const [selected, setSelected] = useState<number>(available[0]?.id ?? -1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = run.map.layers.length;
  const height = (layers - 1) * MAP_ROW_PX + MAP_PAD_PX * 2;
  const yOf = (layer: number) => MAP_PAD_PX + (layers - 1 - layer) * MAP_ROW_PX;

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('.rb-node.available');
    el?.scrollIntoView({ block: 'center' });
    el?.focus({ preventScroll: true });
  }, [run.currentNodeId]);

  const selectedNode = run.map.nodes[selected];
  // Whether the node was already selected when the finger/mouse went down. Focus (which
  // selects) fires before click, so the click alone can't tell a first tap from a second.
  const selectedOnPointerDown = useRef(-1);
  const choose = (node: MapNode, viaPointer: boolean) => {
    // Touch/mouse: first tap selects, second enters (no irreversible mis-taps on phones).
    // Keyboard/gamepad: the player already navigated here deliberately, so confirm enters.
    const alreadySelected = viaPointer ? selectedOnPointerDown.current === node.id : true;
    if (alreadySelected) onEnter(node.id);
    else setSelected(node.id);
  };

  return (
    <div class="rb-screen rb-map">
      <header class="rb-map-header">
        <div class="rb-map-title">{t(`world.${run.worldId}.name` as TranslationKey)}</div>
        <div class="rb-shards">◆ {t('map.shards', { n: run.shards })}</div>
        {Object.keys(run.materials).length > 0 && (
          <div class="rb-map-materials">
            <MaterialChips materials={run.materials} />
          </div>
        )}
        <div class="rb-map-hp">
          <div class="rb-hpbar">
            <div class="rb-hpbar-fill" style={{ width: `${(run.hp / run.maxHp) * 100}%` }} />
          </div>
          <span>
            {Math.ceil(run.hp)}/{run.maxHp}
          </span>
        </div>
      </header>
      {quest && <div class="rb-map-quest">{quest.text}</div>}
      <BoonChips run={run} />
      <div class="rb-map-scroll" ref={scrollRef}>
        <div class="rb-map-canvas" style={{ height: `${height}px` }}>
          <svg
            class="rb-map-edges"
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {run.map.nodes.flatMap((n) =>
              n.next.map((to) => {
                const target = run.map.nodes[to];
                if (!target) return null;
                const walked = run.visited.includes(n.id) && run.visited.includes(to);
                const open = n.id === run.currentNodeId && availableIds.has(to);
                return (
                  <line
                    key={`${n.id}-${to}`}
                    x1={n.x * 100}
                    y1={yOf(n.layer)}
                    x2={target.x * 100}
                    y2={yOf(target.layer)}
                    class={walked ? 'walked' : open ? 'open' : ''}
                    vector-effect="non-scaling-stroke"
                  />
                );
              }),
            )}
          </svg>
          {run.map.nodes.map((n) => {
            const state = nodeState(run, n, availableIds);
            return (
              <button
                type="button"
                key={n.id}
                class={`rb-node ${state} type-${n.type} ${selected === n.id ? 'selected' : ''} ${quest?.nodeTypes.includes(n.type) && state !== 'visited' ? 'quest' : ''}`}
                style={{ left: `${n.x * 100}%`, top: `${yOf(n.layer)}px` }}
                disabled={state !== 'available'}
                aria-label={t(NODE_NAME_KEYS[n.type])}
                onPointerDown={() => {
                  selectedOnPointerDown.current = selected;
                }}
                onClick={(e) => {
                  const viaPointer = (e as MouseEvent).detail > 0;
                  choose(n, viaPointer);
                  selectedOnPointerDown.current = -1;
                }}
                onFocus={() => state === 'available' && setSelected(n.id)}
              >
                <NodeIcon type={n.type} />
                <RewardMarker run={run} node={n} />
              </button>
            );
          })}
        </div>
      </div>
      <footer class="rb-map-footer">
        {selectedNode && availableIds.has(selectedNode.id) ? (
          <>
            <div class="rb-map-info">
              <strong>{t(NODE_NAME_KEYS[selectedNode.type])}</strong>
              <span>{t(NODE_DESC_KEYS[selectedNode.type])}</span>
            </div>
            <button
              type="button"
              class="rb-button rb-primary"
              onClick={() => onEnter(selectedNode.id)}
            >
              {t('map.enter')}
            </button>
          </>
        ) : (
          <div class="rb-map-info">{t('map.choose')}</div>
        )}
      </footer>
    </div>
  );
}

/** Small dot on a map node telling which reward its fight grants (GDD §6.2: shown in advance). */
function RewardMarker({ run, node }: { run: RunState; node: MapNode }) {
  const reward = nodeReward(run.seed, node);
  if (!reward) return null;
  if (reward.kind === 'boon') {
    return <span class="rb-node-reward" style={{ background: BEINGS[reward.being].css }} />;
  }
  const cls =
    reward.kind === 'relic'
      ? 'is-relic'
      : reward.kind === 'spell'
        ? 'is-spell'
        : reward.kind === 'upgrade'
          ? 'is-upgrade'
          : 'is-shards';
  return <span class={`rb-node-reward ${cls}`} />;
}

/** Compact list of owned boons (coloured by being) and evolutions. */
function BoonChips({ run }: { run: RunState }) {
  if (run.boons.length === 0 && run.evolutions.length === 0)
    return <div class="rb-chips rb-chips-empty">{t('map.boons_none')}</div>;
  return (
    <div class="rb-chips">
      {run.evolutions.map((id) => (
        <span class="rb-chip rb-chip-evolution" key={id}>
          {t(`evolution.${id}.name` as TranslationKey)}
        </span>
      ))}
      {run.boons.map((b) => {
        const def = boonById(b.id);
        if (!def) return null;
        return (
          <span
            class={`rb-chip rarity-${b.rarity}`}
            style={{
              borderColor: BEINGS[def.being].css,
              // Duos show both beings: the second colour as an outer ring.
              boxShadow: def.partner ? `0 0 0 2px ${BEINGS[def.partner].css}` : undefined,
            }}
            key={b.id}
          >
            <Icon spec={boonIcon(b.id)} size={18} class="rb-chip-icon" />
            {t(`boon.${b.id}.name` as TranslationKey)}
          </span>
        );
      })}
    </div>
  );
}

/** "Searing Strike + Spark Ring": the combination that unlocked an evolution. */
export function evolutionRecipe(id: string): string {
  const def = evolutionById(id);
  if (!def) return '';
  return [
    ...def.requires.boons.map((b) => t(`boon.${b}.name` as TranslationKey)),
    ...def.requires.relics.map((r) => t(`relic.${r}.name` as TranslationKey)),
  ].join(' + ');
}

function EvolutionScreen({ id, onAccept, onLater }: Extract<Screen, { kind: 'evolution' }>) {
  return (
    <div class="rb-screen rb-center rb-evolution">
      <div class="rb-overlay-hint">{t('evolution.title')}</div>
      <div class="rb-overlay-title">{t(`evolution.${id}.name` as TranslationKey)}</div>
      <div class="rb-overlay-hint">{t('evolution.ready')}</div>
      <div class="rb-card rb-evolution-card">
        <div class="rb-card-head">
          <span class="rb-card-slot">{evolutionRecipe(id)}</span>
        </div>
        <div class="rb-card-desc">{t(`evolution.${id}.desc` as TranslationKey)}</div>
      </div>
      <Autofocus>
        <div class="rb-menu">
          <button type="button" class="rb-button rb-primary" data-autofocus onClick={onAccept}>
            {t('evolution.accept')}
          </button>
          <button type="button" class="rb-button" onClick={onLater}>
            {t('evolution.later')}
          </button>
        </div>
      </Autofocus>
    </div>
  );
}

const SLOT_KEYS: Record<BoonSlot, TranslationKey> = {
  attack: 'slot.attack',
  special: 'slot.special',
  cast: 'slot.cast',
  dash: 'slot.dash',
  passive: 'slot.passive',
};

/** Three boon cards from one rift being (GDD §7.1). */
function BoonScreen({
  offer,
  comment,
  onPick,
  rerolls,
  onReroll,
}: Extract<Screen, { kind: 'boon' }>) {
  const being = BEINGS[offer.being];
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': being.css }}>
      <div class="rb-being">
        <div class="rb-being-name">{t(`being.${offer.being}.name` as TranslationKey)}</div>
        <div class="rb-being-title">{t(`being.${offer.being}.title` as TranslationKey)}</div>
        <div class="rb-being-quote">„{comment}“</div>
      </div>
      <div class="rb-overlay-hint">{t('reward.choose')}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {offer.options.map((o, i) => {
            const def = boonById(o.id);
            if (!def) return null;
            const replaced = o.replaces ? t(`boon.${o.replaces}.name` as TranslationKey) : null;
            const partner = def.partner ? BEINGS[def.partner].css : null;
            return (
              <button
                type="button"
                class={`rb-card rarity-${o.rarity} ${partner ? 'rb-duo' : ''}`}
                style={
                  partner ? { '--being': BEINGS[def.being].css, '--partner': partner } : undefined
                }
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onPick(o)}
                key={o.id}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">{t(SLOT_KEYS[def.slot])}</span>
                  <span class="rb-card-rarity">
                    {partner ? t('reward.duo') : t(`rarity.${o.rarity}` as TranslationKey)}
                  </span>
                </div>
                <CardTitle
                  spec={boonIcon(o.id, o.rarity)}
                  name={t(`boon.${o.id}.name` as TranslationKey)}
                />
                <div class="rb-card-desc">
                  {t(`boon.${o.id}.desc` as TranslationKey, boonDescParams(def, o.rarity))}
                </div>
                {replaced && (
                  <div class="rb-card-replaces">{t('reward.replaces', { name: replaced })}</div>
                )}
              </button>
            );
          })}
        </div>
      </Autofocus>
      {rerolls > 0 && (
        <button type="button" class="rb-button rb-reroll" onClick={onReroll}>
          {t('reward.reroll', { n: rerolls })}
        </button>
      )}
    </div>
  );
}

function RelicCard({
  id,
  stacks,
  onClick,
  autofocus,
}: {
  id: string;
  stacks: number;
  onClick(): void;
  autofocus?: boolean;
}) {
  const def = relicById(id);
  if (!def) return null;
  return (
    <button
      type="button"
      class={`rb-card rb-relic relic-${def.rarity}`}
      data-autofocus={autofocus ? true : undefined}
      onClick={onClick}
    >
      <div class="rb-card-head">
        <span class="rb-card-slot">{t('reward.relic_title')}</span>
        <span class="rb-card-rarity">{t(`relic_rarity.${def.rarity}` as TranslationKey)}</span>
      </div>
      <CardTitle spec={relicIcon(id)} name={t(`relic.${id}.name` as TranslationKey)} />
      <div class="rb-card-desc">
        {t(`relic.${id}.desc` as TranslationKey, relicDescParams(def, stacks + 1))}
      </div>
      {stacks > 0 && (
        <div class="rb-card-replaces">{t('reward.stack', { n: stacks, m: stacks + 1 })}</div>
      )}
    </button>
  );
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** One line on what the spell costs: its cooldown, or how often the aura pulses. */
function spellTiming(def: SpellDef): string {
  return def.kind === 'active'
    ? t('spell.cooldown', { n: def.cooldownSec })
    : t('spell.pulse', { n: def.pulseSec });
}

function SpellCard({
  def,
  replaces,
  onClick,
  autofocus,
  price,
}: {
  def: SpellDef;
  replaces: string | null;
  onClick(): void;
  autofocus?: boolean;
  price?: { amount: number; sold: boolean; affordable: boolean };
}) {
  return (
    <button
      type="button"
      class={`rb-card rb-spell spell-${def.kind} ${price?.sold ? 'is-sold' : ''}`}
      style={{ '--being': cssColor(def.visual.color) }}
      data-autofocus={autofocus ? true : undefined}
      disabled={price ? price.sold || !price.affordable : undefined}
      onClick={onClick}
    >
      <div class="rb-card-head">
        <span class="rb-card-slot">{t(`spell.kind.${def.kind}` as TranslationKey)}</span>
        <span class="rb-card-rarity">
          {price
            ? price.sold
              ? t('shop.sold')
              : `◆ ${t('shop.buy', { price: price.amount })}`
            : t(`spell.school.${def.school}` as TranslationKey)}
        </span>
      </div>
      <CardTitle spec={spellIcon(def.id)} name={t(`spell.${def.id}.name` as TranslationKey)} />
      <div class="rb-card-desc">{t(`spell.${def.id}.desc` as TranslationKey)}</div>
      <div class="rb-card-desc rb-spell-timing">{spellTiming(def)}</div>
      {replaces && (
        <div class="rb-card-replaces">
          {t('reward.replaces', { name: t(`spell.${replaces}.name` as TranslationKey) })}
        </div>
      )}
    </button>
  );
}

function replacedSpell(current: SpellSlots, def: SpellDef): string | null {
  return (def.kind === 'active' ? current.active?.id : current.aura?.id) ?? null;
}

function SpellScreen({ options, current, onPick, onSkip }: Extract<Screen, { kind: 'spell' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#b8a6ff' }}>
      <div class="rb-being-name">{t('reward.spell_title')}</div>
      <div class="rb-overlay-hint">{t('reward.choose_spell')}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {options.map((id, i) => {
            const def = spellById(id);
            if (!def) return null;
            return (
              <SpellCard
                key={id}
                def={def}
                replaces={replacedSpell(current, def)}
                autofocus={i === 0}
                onClick={() => onPick(id)}
              />
            );
          })}
        </div>
      </Autofocus>
      <button type="button" class="rb-button" onClick={onSkip}>
        {t('reward.skip')}
      </button>
    </div>
  );
}

const PCT = (v: number) => `${Math.round(v * 100)}%`;

/** The branch an upgrade option picks, if it is a branch level. */
function optionBranch(run: RunState, o: UpgradeOption): UpgradeBranch | null {
  if (o.kind !== 'level' || o.branch === null) return null;
  const tier = branchTier(o.level);
  if (!tier) return null;
  const tree =
    o.target === 'cast'
      ? RIFT_SHOT_UPGRADES
      : spellById((o.target === 'active' ? run.spells.active : run.spells.aura)?.id ?? '')
          ?.upgrades;
  return tree ? tree[tier][o.branch === 1 ? 1 : 0] : null;
}

function UpgradeCard({
  run,
  option,
  autofocus,
  onClick,
}: {
  run: RunState;
  option: UpgradeOption;
  autofocus: boolean;
  onClick(): void;
}) {
  let name: string;
  let kindLabel: string;
  let desc: string;
  let color = '#b8a6ff';
  let spec = upgradeIcon('cast');
  if (option.kind === 'boon') {
    const owned = run.boons.find((b) => b.id === option.boonId);
    const def = boonById(option.boonId);
    name = t(`boon.${option.boonId}.name` as TranslationKey);
    kindLabel = t('upgrade.kind.boon');
    desc = def
      ? t(
          `boon.${option.boonId}.desc` as TranslationKey,
          boonDescParams(def, owned?.rarity ?? 'common', option.level),
        )
      : '';
    if (def) color = BEINGS[def.being].css;
    spec = { ...boonIcon(option.boonId, owned?.rarity), frame: 'upgrade' };
  } else {
    const slot = option.target === 'active' ? run.spells.active : run.spells.aura;
    const spell = option.target === 'cast' ? undefined : spellById(slot?.id ?? '');
    name = spell ? t(`spell.${spell.id}.name` as TranslationKey) : t('upgrade.cast_name');
    kindLabel = t(`upgrade.kind.${option.target}` as TranslationKey);
    if (spell) color = cssColor(spell.visual.color);
    spec = upgradeIcon(option.target, spell?.id);
    const branch = optionBranch(run, option);
    desc = branch
      ? `${t(`upgrade.${branch.id}.name` as TranslationKey)}: ${t(`upgrade.${branch.id}.desc` as TranslationKey)}`
      : t(option.target === 'cast' ? 'upgrade.generic_cast' : 'upgrade.generic', {
          damage: PCT(TUNING.upgradeLevelDamage),
          radius: PCT(TUNING.upgradeLevelRadius),
          cooldown: PCT(TUNING.upgradeLevelCooldown),
        });
  }
  return (
    <button
      type="button"
      class="rb-card rb-upgrade"
      style={{ '--being': color }}
      data-autofocus={autofocus ? true : undefined}
      onClick={onClick}
    >
      <div class="rb-card-head">
        <span class="rb-card-slot">{kindLabel}</span>
        <span class="rb-card-rarity">
          {t('upgrade.level', { from: option.level - 1, to: option.level })}
        </span>
      </div>
      <CardTitle spec={spec} name={name} />
      <div class="rb-card-desc">{desc}</div>
    </button>
  );
}

function UpgradeScreen({ run, options, onPick }: Extract<Screen, { kind: 'upgrade' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#b8a6ff' }}>
      <div class="rb-being-name">{t('upgrade.title')}</div>
      <div class="rb-overlay-hint">{t('upgrade.choose')}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {options.map((o, i) => (
            <UpgradeCard
              key={`${o.kind}-${o.kind === 'boon' ? o.boonId : `${o.target}-${o.branch}`}`}
              run={run}
              option={o}
              autofocus={i === 0}
              onClick={() => onPick(o)}
            />
          ))}
        </div>
      </Autofocus>
    </div>
  );
}

function RelicScreen({ options, owned, onPick }: Extract<Screen, { kind: 'relic' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#ffe6b0' }}>
      <div class="rb-being-name">{t('reward.relic_title')}</div>
      <div class="rb-overlay-hint">{t('reward.choose_relic')}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {options.map((id, i) => (
            <RelicCard
              key={id}
              id={id}
              stacks={relicStacks(owned, id)}
              autofocus={i === 0}
              onClick={() => onPick(id)}
            />
          ))}
        </div>
      </Autofocus>
    </div>
  );
}

function NoticeScreen({ title, text, onContinue }: Extract<Screen, { kind: 'notice' }>) {
  return (
    <div class="rb-screen rb-center">
      <div class="rb-overlay-title">{title}</div>
      <div class="rb-overlay-hint">{text}</div>
      <Autofocus>
        <button type="button" class="rb-button rb-primary" data-autofocus onClick={onContinue}>
          {t('common.continue')}
        </button>
      </Autofocus>
    </div>
  );
}

/** Healing in the shop: a consumable, so the square frame. */
const HEAL_ICON: IconSpec = { frame: 'material', glyph: 'heart', color: '#6bff9a' };

function ShopScreen({ run, stock, onBuy, onLeave }: Extract<Screen, { kind: 'shop' }>) {
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': '#c46bff' }}>
      <div class="rb-being-name">{t('shop.title')}</div>
      <div class="rb-being-quote">„{t('shop.greeting')}“</div>
      <div class="rb-shards rb-shards-big">◆ {t('map.shards', { n: run.shards })}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {stock.map((item, i) => {
            const sold = run.shopBought.includes(i);
            const affordable = run.shards >= item.price;
            if (item.kind === 'spell') {
              const def = spellById(item.id);
              if (!def) return null;
              return (
                <SpellCard
                  key={`spell-${i}`}
                  def={def}
                  replaces={replacedSpell(run.spells, def)}
                  autofocus={i === 0}
                  price={{ amount: item.price, sold, affordable }}
                  onClick={() => onBuy(i)}
                />
              );
            }
            let name: string;
            let desc: string;
            let tag: string;
            let spec: IconSpec;
            if (item.kind === 'relic') {
              spec = relicIcon(item.id);
              const def = relicById(item.id);
              name = t(`relic.${item.id}.name` as TranslationKey);
              desc = def
                ? t(
                    `relic.${item.id}.desc` as TranslationKey,
                    relicDescParams(def, relicStacks(run.relics, item.id) + 1),
                  )
                : '';
              tag = def ? t(`relic_rarity.${def.rarity}` as TranslationKey) : '';
            } else if (item.kind === 'boon') {
              spec = boonIcon(item.option.id, item.option.rarity);
              const def = boonById(item.option.id);
              name = t(`boon.${item.option.id}.name` as TranslationKey);
              desc = def
                ? t(
                    `boon.${item.option.id}.desc` as TranslationKey,
                    boonDescParams(def, item.option.rarity),
                  )
                : '';
              tag = t('shop.boon_from', { being: t(`being.${item.being}.name` as TranslationKey) });
            } else {
              spec = HEAL_ICON;
              name = t('shop.heal');
              desc = t('shop.heal_desc', { amount: Math.round(run.maxHp * item.fraction) });
              tag = '';
            }
            const curse = item.kind === 'relic' && relicById(item.id)?.rarity === 'curse';
            return (
              <button
                type="button"
                key={`${item.kind}-${i}`}
                class={`rb-card rb-shop-item ${curse ? 'relic-curse' : ''} ${sold ? 'is-sold' : ''}`}
                disabled={sold || !affordable}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onBuy(i)}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">{tag}</span>
                  <span class="rb-card-rarity">
                    {sold ? t('shop.sold') : `◆ ${t('shop.buy', { price: item.price })}`}
                  </span>
                </div>
                <CardTitle spec={spec} name={name} />
                <div class="rb-card-desc">{desc}</div>
              </button>
            );
          })}
        </div>
      </Autofocus>
      <button type="button" class="rb-button" onClick={onLeave}>
        {t('shop.leave')}
      </button>
    </div>
  );
}

function EventScreen({
  run,
  event,
  results,
  onChoose,
  onContinue,
}: Extract<Screen, { kind: 'event' }>) {
  return (
    <div class="rb-screen rb-center rb-event">
      <div class="rb-overlay-title">{t(`event.${event.id}.title` as TranslationKey)}</div>
      <div class="rb-event-text">{t(`event.${event.id}.text` as TranslationKey)}</div>
      <Autofocus key={results ? 'results' : 'choices'}>
        {results ? (
          <div class="rb-menu">
            {results.map((line) => (
              <div class="rb-event-result" key={line}>
                {line}
              </div>
            ))}
            <button type="button" class="rb-button rb-primary" data-autofocus onClick={onContinue}>
              {t('common.continue')}
            </button>
          </div>
        ) : (
          <div class="rb-menu rb-event-options">
            {event.options.map((o, i) => {
              const needsShards = o.requiresShards !== undefined && run.shards < o.requiresShards;
              const needsHp = o.requiresHpAbove !== undefined && run.hp <= o.requiresHpAbove;
              return (
                <button
                  type="button"
                  key={o.id}
                  class="rb-button rb-event-option"
                  disabled={needsShards || needsHp}
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => onChoose(o.id)}
                >
                  {t(`event.${event.id}.${o.id}` as TranslationKey)}
                  {needsShards && (
                    <small>{t('event.requires_shards', { n: o.requiresShards ?? 0 })}</small>
                  )}
                  {needsHp && (
                    <small>{t('event.requires_hp', { n: o.requiresHpAbove ?? 0 })}</small>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Autofocus>
    </div>
  );
}

function RestScreen({
  run,
  healAmount,
  onRest,
  evolution,
  onEvolve,
}: Extract<Screen, { kind: 'rest' }>) {
  return (
    <div class="rb-screen rb-center">
      <div class="rb-rest-icon">
        <NodeIcon type="rest" />
      </div>
      <div class="rb-overlay-title">{t('rest.title')}</div>
      <div class="rb-overlay-hint">{t('rest.desc')}</div>
      <Autofocus>
        <div class="rb-menu">
          <button type="button" class="rb-button rb-primary" data-autofocus onClick={onRest}>
            {t('rest.heal', {
              amount: healAmount,
              hp: Math.min(run.maxHp, Math.ceil(run.hp + healAmount)),
              max: run.maxHp,
            })}
          </button>
          {evolution && (
            <button type="button" class="rb-button rb-evolve" onClick={onEvolve}>
              {t('rest.evolve', { name: t(`evolution.${evolution}.name` as TranslationKey) })}
            </button>
          )}
        </div>
      </Autofocus>
      {evolution && (
        <div class="rb-overlay-hint rb-evolve-hint">
          {t(`evolution.${evolution}.desc` as TranslationKey)}
        </div>
      )}
    </div>
  );
}

export function UiRoot({ screen }: { screen: Screen }) {
  switch (screen.kind) {
    case 'title':
      return <TitleScreen {...screen} />;
    case 'map':
      return <MapScreen {...screen} />;
    case 'rest':
      return <RestScreen {...screen} />;
    case 'evolution':
      return <EvolutionScreen {...screen} />;
    case 'boon':
      return <BoonScreen {...screen} />;
    case 'relic':
      return <RelicScreen {...screen} />;
    case 'spell':
      return <SpellScreen {...screen} />;
    case 'upgrade':
      return <UpgradeScreen {...screen} />;
    case 'notice':
      return <NoticeScreen {...screen} />;
    case 'shop':
      return <ShopScreen {...screen} />;
    case 'event':
      return <EventScreen {...screen} />;
    case 'layout':
      return <LayoutEditor {...screen} />;
    case 'hubWalk':
      return <HubWalkScreen {...screen} />;
    case 'station':
      return <StationScreen {...screen} />;
    case 'worldMap':
      return <WorldMapScreen {...screen} />;
    case 'build':
      return <BuildScreen {...screen} />;
    case 'decorations':
      return <DecorationsScreen {...screen} />;
    case 'forge':
      return <ForgeScreen {...screen} />;
    case 'market':
      return <MarketScreen {...screen} />;
    case 'quest':
      return <QuestScreen {...screen} />;
    case 'scene':
      return <SceneScreen {...screen} />;
    case 'questLog':
      return <QuestLogScreen {...screen} />;
    case 'tree':
      return <TreeScreen {...screen} />;
    case 'wares':
      return <WaresScreen {...screen} />;
    case 'spells':
      return <SpellTowerScreen {...screen} />;
    case 'profile':
      return <ProfileScreen {...screen} />;
    case 'result':
      return <ResultScreen {...screen} />;
    case 'none':
      return null;
  }
}
