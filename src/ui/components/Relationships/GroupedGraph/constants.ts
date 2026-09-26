// Constants for GroupedGraph component

// ── Layout Constants ───────────────────────────────────────────────

export const GROUP_WIDTH = 260;
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 36;
export const GROUP_PADDING = 8;
export const GROUP_GAP_X = 180;
export const GROUP_GAP_Y = 40;
export const DEFAULT_GROUP_CHILD_NAME = 'base';

// The "Tier N" caption above each tier. Every arranged tier starts at y = 0,
// so the captions form one row just above it.
export const TIER_LABEL_HEIGHT = 26;
export const TIER_LABEL_GAP_Y = 14;
// Own id namespace so a caption node can never collide with a card key, and
// so the places that must ignore captions (saved positions, the arrange undo
// snapshot) have one cheap predicate to test.
export const TIER_LABEL_NODE_PREFIX = 'tier-label:';

// Node-id namespace for a standard group card: `group:<collectionId>::<path>`.
// Scoped by collection for the same reason a wrapper frame is — a bare group
// path is not an identity, and two collections owning `color/brand` used to
// merge into ONE card attributed to whichever collection was seen first.
export const GROUP_NODE_PREFIX = 'group:';

// ── Wrapper (expanded group frame) constants ───────────────────────
// Node-id namespace for a wrapper frame: `wrapper:<collectionId>::<path>`.
export const WRAPPER_NODE_PREFIX = 'wrapper:';
export const WRAPPER_HEADER_HEIGHT = 36;
export const WRAPPER_PADDING = 16;
// The card box's own inner gutter (`p-0.5` on .rf-group-box), the sliver of
// background between the border and the header fill. A leaf card is `h-fit`
// so its DOM absorbs this; a container's height is computed exactly and its
// children are separately-positioned nodes, so the same gutter has to be
// added to the geometry or the two drift apart by 2px.
export const CARD_BOX_PADDING = 2;
// The gap between a container's dashed ring and the card box inside it. A
// container is a normal card with a dashed outline drawn AROUND it, not a
// card whose own border went dashed — so the ring needs room of its own.
export const CONTAINER_OUTLINE_PADDING = 8;
// Everything a container's content sits inside: the dashed ring's gap plus
// the card box's own gutter. Child cards are separately-positioned nodes, so
// this has to exist in the geometry, not only in the markup.
export const CONTAINER_INSET = CONTAINER_OUTLINE_PADDING + CARD_BOX_PADDING;
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
