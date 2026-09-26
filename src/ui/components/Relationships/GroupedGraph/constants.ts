// Constants for GroupedGraph component

// ── Layout Constants ───────────────────────────────────────────────

export const GROUP_WIDTH = 260;
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 36;
export const GROUP_PADDING = 8;
export const GROUP_GAP_X = 180;
export const GROUP_GAP_Y = 40;
// Arrange Grid: how tall one stacked column of cards may grow before the tier
// wraps into a second sub-column beside it. A tier holding ~60 cards is a
// 20,000px ribbon otherwise. Overridable per user in Grid Settings.
export const GRID_MAX_COLUMN_HEIGHT = 2400;
export const DEFAULT_GROUP_CHILD_NAME = 'base';

// ── Arrange Grid: tier vs. sub-column separation ───────────────────
// A tier that exceeds GRID_MAX_COLUMN_HEIGHT wraps into side-by-side
// sub-columns. Those breaks used to be spaced exactly like a real tier
// boundary (both GROUP_WIDTH + gapX), so a single tier of ~29 literal-valued
// cards wrapped over four sub-columns read as four dependency levels. The gap
// BETWEEN tiers is this multiple of gapX; the gap between a tier's own
// sub-columns stays gapX. Derived from gapX rather than being a fourth Grid
// Setting, so it scales when the user tunes gapX.
export const TIER_GAP_MULTIPLIER = 3;

// The "Tier N" caption above each tier. Every arranged tier starts at y = 0,
// so the captions form one row just above it.
export const TIER_LABEL_HEIGHT = 26;
export const TIER_LABEL_GAP_Y = 14;
// Own id namespace so a caption node can never collide with a card key, and
// so the places that must ignore captions (saved positions, the arrange undo
// snapshot) have one cheap predicate to test.
export const TIER_LABEL_NODE_PREFIX = 'tier-label:';

// ── Wrapper (expanded group frame) constants ───────────────────────
export const WRAPPER_HEADER_HEIGHT = 36;
export const WRAPPER_PADDING = 16;
export const WRAPPER_GAP = 28;

// ── Color Constants ────────────────────────────────────────────────

export const GENERATED_CONNECTION_COLOR = 'var(--color-secondary)';
export const REFERENCE_CONNECTION_COLOR = 'var(--color-primary)';
// Path-highlight accent (pink) — used when tracing a connected chain
export const HIGHLIGHT_COLOR = '#EC4899';
export const IDLE_HANDLE_BORDER_COLOR = 'var(--color-border)';
export const IDLE_HANDLE_FILL_COLOR = 'var(--color-base)';
export const STANDARD_GROUP_HEADER_FILL = 'var(--color-base-2)';
export const SHADER_GROUP_HEADER_FILL = 'var(--color-base-3)';
