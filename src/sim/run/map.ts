import type { BiomeDef, RoomType } from '../../content/schema';
import { nextFloat, nextInt, type Rng } from '../rng/rng';

export interface MapNode {
  id: number;
  layer: number;
  /** Horizontal position 0..1 for display; order within a layer matches edge order. */
  x: number;
  type: RoomType;
  /** Ids of nodes in the next layer this node leads to. */
  next: number[];
}

export interface RunMap {
  nodes: MapNode[];
  /** Node ids per layer, left to right. */
  layers: number[][];
}

function pickWeighted(rng: Rng, weights: Array<[RoomType, number]>): RoomType {
  let total = 0;
  for (const [, w] of weights) total += w;
  let roll = nextFloat(rng) * total;
  for (const [type, w] of weights) {
    roll -= w;
    if (roll < 0) return type;
  }
  return weights[0]?.[0] ?? 'combat';
}

/**
 * Slay-the-Spire style layered map (GDD §6.1). Edges map each node to a contiguous range of
 * the next layer, so paths never cross and every node is reachable and has a way forward.
 * Layout: combat start layer → mixed middle layers → guaranteed rest → boss.
 */
export function generateMap(rng: Rng, biome: BiomeDef): RunMap {
  const nodes: MapNode[] = [];
  const layers: number[][] = [];
  const last = biome.layers - 1;
  const restLayer = last - 1;

  let shops = 0;
  for (let layer = 0; layer < biome.layers; layer++) {
    let count: number;
    if (layer === last) count = 1;
    else if (layer === 0) count = Math.min(3, biome.maxNodesPerLayer);
    else count = nextInt(rng, biome.minNodesPerLayer, biome.maxNodesPerLayer + 1);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      let type: RoomType;
      if (layer === last) type = 'boss';
      else if (layer === restLayer) type = 'rest';
      else if (layer === 0) type = 'combat';
      else {
        const weights: Array<[RoomType, number]> = [
          ['combat', biome.typeWeights.combat],
          ['horde', biome.typeWeights.horde],
        ];
        if (layer >= biome.eliteMinLayer) weights.push(['elite', biome.typeWeights.elite]);
        // No rest right before the guaranteed rest layer; that would be a wasted choice.
        if (layer >= biome.restMinLayer && layer < restLayer - 1)
          weights.push(['rest', biome.typeWeights.rest]);
        if (layer >= biome.altarMinLayer) weights.push(['altar', biome.typeWeights.altar]);
        if (layer >= biome.eventMinLayer) weights.push(['event', biome.typeWeights.event]);
        // GDD §6.1: at most two shops per biome.
        if (layer >= biome.shopMinLayer && shops < biome.maxShops) {
          weights.push(['shop', biome.typeWeights.shop]);
        }
        type = pickWeighted(rng, weights);
        if (type === 'shop') shops++;
      }
      const slot = (i + 0.5) / count;
      const jitter = count > 1 ? (nextFloat(rng) - 0.5) * (0.5 / count) : 0;
      const node: MapNode = { id: nodes.length, layer, x: slot + jitter, type, next: [] };
      nodes.push(node);
      ids.push(node.id);
    }
    layers.push(ids);
  }

  for (let layer = 0; layer < last; layer++) {
    const from = layers[layer] ?? [];
    const to = layers[layer + 1] ?? [];
    const a = from.length;
    const b = to.length;
    for (let j = 0; j < a; j++) {
      const lo = Math.floor((j * b) / a);
      const hi = Math.max(lo, Math.ceil(((j + 1) * b) / a) - 1);
      const node = nodes[from[j] as number] as MapNode;
      for (let k = lo; k <= hi; k++) node.next.push(to[k] as number);
    }
  }

  ensureType(rng, nodes, 'horde', 1, restLayer);
  return { nodes, layers };
}

/** Guarantees at least one node of `type` in layers [minLayer, maxLayerExclusive). */
function ensureType(
  rng: Rng,
  nodes: MapNode[],
  type: RoomType,
  minLayer: number,
  maxLayerExclusive: number,
): void {
  if (nodes.some((n) => n.type === type)) return;
  const candidates = nodes.filter(
    (n) => n.type === 'combat' && n.layer >= minLayer && n.layer < maxLayerExclusive,
  );
  const pick = candidates[nextInt(rng, 0, candidates.length)];
  if (pick) pick.type = type;
}

export function nodeById(map: RunMap, id: number): MapNode | undefined {
  return map.nodes[id];
}
