import type { RoomType } from '../../content/schema';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

/** Map node symbols (GDD §6.2): simple shapes that stay readable at thumb size. */
export function NodeIcon({ type }: { type: RoomType }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      {type === 'combat' && (
        <g {...STROKE}>
          <path d="M5 19 L17 7 M14 5 L19 5 L19 10" />
          <path d="M19 19 L7 7 M10 5 L5 5 L5 10" />
        </g>
      )}
      {type === 'elite' && (
        <g {...STROKE}>
          <path d="M5 9 C5 4 19 4 19 9 L19 14 L15 15 L15 19 L9 19 L9 15 L5 14 Z" />
          <circle cx="9.5" cy="10.5" r="1.4" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="1.4" fill="currentColor" />
        </g>
      )}
      {type === 'horde' && (
        <g {...STROKE}>
          <path d="M3 8 Q6 5 9 8 T15 8 T21 8" />
          <path d="M3 13 Q6 10 9 13 T15 13 T21 13" />
          <path d="M3 18 Q6 15 9 18 T15 18 T21 18" />
        </g>
      )}
      {type === 'rest' && (
        <g {...STROKE}>
          <path d="M12 3 C15 7 17 9 17 13 A5 5 0 0 1 7 13 C7 10 9 9 10 6 C11 8 12 9 12 3 Z" />
          <path d="M5 21 L19 17 M5 17 L19 21" />
        </g>
      )}
      {type === 'altar' && (
        <g {...STROKE}>
          <path d="M12 3 L15 9 L12 13 L9 9 Z" />
          <path d="M6 21 L8 14 L16 14 L18 21 Z" />
          <path d="M4 21 L20 21" />
        </g>
      )}
      {type === 'shop' && (
        <g {...STROKE}>
          <path d="M5 9 L19 9 L18 20 L6 20 Z" />
          <path d="M9 9 C9 4 15 4 15 9" />
        </g>
      )}
      {type === 'event' && (
        <g {...STROKE}>
          <path d="M8.5 9 C8.5 5 15.5 5 15.5 9 C15.5 12 12 12 12 15" />
          <circle cx="12" cy="19" r="1.3" fill="currentColor" />
        </g>
      )}
      {type === 'boss' && (
        <g {...STROKE}>
          <path d="M3 18 L5 7 L9.5 12 L12 5 L14.5 12 L19 7 L21 18 Z" />
          <path d="M4 21 L20 21" />
        </g>
      )}
    </svg>
  );
}
