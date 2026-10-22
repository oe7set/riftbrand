import { useEffect, useRef, useState } from 'preact/hooks';
import { boonById, boonDescParams } from '../../content/boons';
import { BEINGS } from '../../content/boons/beings';
import type { BoonSlot, RoomType } from '../../content/schema';
import { type TranslationKey, t } from '../../shared/i18n';
import type { MapNode } from '../../sim/run/map';
import {
  type BoonOffer,
  type BoonOption,
  rewardBeing,
  rewardRarityBonus,
} from '../../sim/run/rewards';
import { availableNodes, type RunState } from '../../sim/run/run-state';
import { NodeIcon } from './icons';

const MAP_ROW_PX = 92;
const MAP_PAD_PX = 56;

export type Screen =
  | { kind: 'none' }
  | {
      kind: 'title';
      canContinue: boolean;
      version: string;
      onContinue(): void;
      onNewRun(): void;
      onArena(): void;
    }
  | { kind: 'map'; run: RunState; onEnter(nodeId: number): void }
  | { kind: 'rest'; run: RunState; healAmount: number; onRest(): void }
  | { kind: 'victory'; run: RunState; onTitle(): void }
  | { kind: 'boon'; offer: BoonOffer; onPick(option: BoonOption): void };

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
            onClick={props.onNewRun}
          >
            {t('title.new_run')}
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
  altar: 'node.altar.name',
  combat: 'node.combat.name',
  elite: 'node.elite.name',
  horde: 'node.horde.name',
  rest: 'node.rest.name',
  boss: 'node.boss.name',
};

const NODE_DESC_KEYS: Record<RoomType, TranslationKey> = {
  altar: 'node.altar.desc',
  combat: 'node.combat.desc',
  elite: 'node.elite.desc',
  horde: 'node.horde.desc',
  rest: 'node.rest.desc',
  boss: 'node.boss.desc',
};

function MapScreen({ run, onEnter }: Extract<Screen, { kind: 'map' }>) {
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
        <div class="rb-map-title">{t('biome.ember_wastes.name')}</div>
        <div class="rb-map-hp">
          <div class="rb-hpbar">
            <div class="rb-hpbar-fill" style={{ width: `${(run.hp / run.maxHp) * 100}%` }} />
          </div>
          <span>
            {Math.ceil(run.hp)}/{run.maxHp}
          </span>
        </div>
      </header>
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
                class={`rb-node ${state} type-${n.type} ${selected === n.id ? 'selected' : ''}`}
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
                {rewardRarityBonus(n.type) !== null && (
                  <span
                    class="rb-node-reward"
                    style={{ background: BEINGS[rewardBeing(run.seed, n.id)].css }}
                  />
                )}
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

/** Compact list of owned boons, coloured by being. */
function BoonChips({ run }: { run: RunState }) {
  if (run.boons.length === 0)
    return <div class="rb-chips rb-chips-empty">{t('map.boons_none')}</div>;
  return (
    <div class="rb-chips">
      {run.boons.map((b) => {
        const def = boonById(b.id);
        if (!def) return null;
        return (
          <span
            class={`rb-chip rarity-${b.rarity}`}
            style={{ borderColor: BEINGS[def.being].css }}
            key={b.id}
          >
            {t(`boon.${b.id}.name` as TranslationKey)}
          </span>
        );
      })}
    </div>
  );
}

const SLOT_KEYS: Record<BoonSlot, TranslationKey> = {
  attack: 'slot.attack',
  special: 'slot.special',
  dash: 'slot.dash',
  passive: 'slot.passive',
};

/** Three boon cards from one rift being (GDD §7.1). */
function BoonScreen({ offer, onPick }: Extract<Screen, { kind: 'boon' }>) {
  const being = BEINGS[offer.being];
  return (
    <div class="rb-screen rb-center rb-boon-screen" style={{ '--being': being.css }}>
      <div class="rb-being">
        <div class="rb-being-name">{t(`being.${offer.being}.name` as TranslationKey)}</div>
        <div class="rb-being-title">{t(`being.${offer.being}.title` as TranslationKey)}</div>
        <div class="rb-being-quote">„{t(`being.${offer.being}.quote` as TranslationKey)}“</div>
      </div>
      <div class="rb-overlay-hint">{t('reward.choose')}</div>
      <Autofocus wide>
        <div class="rb-cards">
          {offer.options.map((o, i) => {
            const def = boonById(o.id);
            if (!def) return null;
            const replaced = o.replaces ? t(`boon.${o.replaces}.name` as TranslationKey) : null;
            return (
              <button
                type="button"
                class={`rb-card rarity-${o.rarity}`}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onPick(o)}
                key={o.id}
              >
                <div class="rb-card-head">
                  <span class="rb-card-slot">{t(SLOT_KEYS[def.slot])}</span>
                  <span class="rb-card-rarity">{t(`rarity.${o.rarity}` as TranslationKey)}</span>
                </div>
                <div class="rb-card-name">{t(`boon.${o.id}.name` as TranslationKey)}</div>
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
    </div>
  );
}

function RestScreen({ run, healAmount, onRest }: Extract<Screen, { kind: 'rest' }>) {
  return (
    <div class="rb-screen rb-center">
      <div class="rb-rest-icon">
        <NodeIcon type="rest" />
      </div>
      <div class="rb-overlay-title">{t('rest.title')}</div>
      <div class="rb-overlay-hint">{t('rest.desc')}</div>
      <Autofocus>
        <button type="button" class="rb-button rb-primary" data-autofocus onClick={onRest}>
          {t('rest.heal', {
            amount: healAmount,
            hp: Math.min(run.maxHp, Math.ceil(run.hp + healAmount)),
            max: run.maxHp,
          })}
        </button>
      </Autofocus>
    </div>
  );
}

function VictoryScreen({ run, onTitle }: Extract<Screen, { kind: 'victory' }>) {
  return (
    <div class="rb-screen rb-center rb-victory">
      <div class="rb-overlay-title">{t('victory.title')}</div>
      <div class="rb-overlay-hint">{t('victory.desc')}</div>
      <div class="rb-stats">
        <div>{t('stats.rooms', { n: run.roomsCleared })}</div>
        <div>{t('stats.kills', { n: run.kills })}</div>
        <div>{t('stats.time', { time: formatTime(run.playTimeSec) })}</div>
      </div>
      <Autofocus>
        <button type="button" class="rb-button rb-primary" data-autofocus onClick={onTitle}>
          {t('victory.to_title')}
        </button>
      </Autofocus>
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
    case 'victory':
      return <VictoryScreen {...screen} />;
    case 'boon':
      return <BoonScreen {...screen} />;
    case 'none':
      return null;
  }
}
