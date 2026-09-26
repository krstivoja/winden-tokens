// Cmd+K / Ctrl+K quick-search palette for the Relationships graph.
//
// Scoped to the graph on purpose: the component is rendered by
// GroupedGraphInner, so the shortcut only exists while the Relationships view
// is mounted and no global handler is needed in App.tsx.
//
// This module is deliberately dumb about the graph. It takes a flat list of
// already-resolved items and hands one back on activation; everything that
// knows about node ids, absorbed cards and `fitView` stays in GroupedGraph.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalOverlay, ModalContainer } from '../../Modals/Modal';
import { Search } from '../../common/Search';

// ── Targets ────────────────────────────────────────────────────────

/**
 * What activating a result should move the viewport to.
 *
 * `cardKey` is always a CARD key (`group:<cid>::<path>`, `collection:<cid>`,
 * `source:`/`shader:`/`shades:`), never an xyflow node id — a grouped card is
 * absorbed into its container and has no node of its own, so the caller
 * resolves the key through the card→node map before fitting.
 *
 * `container` is the one case that carries a node id: a grouped path that no
 * card sits at draws a frame and nothing else.
 */
export type GraphSearchTarget =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'card'; cardKey: string }
  | { kind: 'container'; nodeId: string }
  | { kind: 'variable'; cardKey: string; varName: string };

export interface GraphSearchItem {
  /** Unique across the whole index; also the React key. */
  id: string;
  /** Primary text — the name the user is looking for. */
  label: string;
  /**
   * Secondary text. Always names the owning collection: a variable, a group
   * and a collection can all be called `test`, and since cards are
   * collection-scoped two collections can own the same group path.
   */
  context: string;
  target: GraphSearchTarget;
  /**
   * Filtered off the canvas right now. Kept in the index rather than dropped
   * so the palette can say how many matches it is withholding.
   */
  hidden: boolean;
}

/** The badge each kind gets, so identical names stay distinguishable. */
const KIND_LABEL: Record<GraphSearchTarget['kind'], string> = {
  collection: 'Collection',
  card: 'Card',
  container: 'Container',
  variable: 'Variable',
};

/** Collections first, then cards/containers, then variables. */
const KIND_ORDER: Record<GraphSearchTarget['kind'], number> = {
  collection: 0,
  card: 1,
  container: 1,
  variable: 2,
};

/** Rendering more than this is scrolling, not searching. */
export const GRAPH_SEARCH_RESULT_LIMIT = 40;

// ── Platform ───────────────────────────────────────────────────────

/**
 * Cmd on macOS, Ctrl everywhere else. `navigator.platform` is deprecated but
 * still the only reliable signal inside Figma's plugin iframe, so it is tried
 * first and the user agent is the fallback.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  const agent = navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/.test(platform || agent);
}

/** True when this keydown is the palette's open/close shortcut. */
export function isQuickSearchShortcut(event: KeyboardEvent): boolean {
  if (event.key !== 'k' && event.key !== 'K') return false;
  if (event.altKey) return false;
  return isMacPlatform()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

// ── Matching ───────────────────────────────────────────────────────

/**
 * 0 exact, 1 prefix, 2 substring of the label, 3 substring of the secondary
 * text (typing a collection name lists what is in it), -1 no match.
 */
function scoreItem(item: GraphSearchItem, query: string): number {
  const label = item.label.toLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  if (item.context.toLowerCase().includes(query)) return 3;
  return -1;
}

export interface GraphSearchMatches {
  results: GraphSearchItem[];
  /** Matches that exist but are filtered off the canvas — see the plan. */
  hiddenCount: number;
  /** True when the list is the empty-query default rather than a search. */
  isDefault: boolean;
}

/**
 * Hidden items never make the list: `fitView` on a hidden node parks the
 * canvas on empty space, so offering one is a dead end. They are counted
 * instead, and the palette prints the count.
 *
 * An empty query lists the COLLECTIONS. There is no recency to fall back on —
 * saved positions carry no timestamps — and a collection is the coarsest,
 * always-meaningful jump.
 */
export function matchGraphSearchItems(
  items: GraphSearchItem[],
  rawQuery: string,
  limit: number = GRAPH_SEARCH_RESULT_LIMIT
): GraphSearchMatches {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    const collections = items.filter(item => item.target.kind === 'collection');
    return {
      results: collections.filter(item => !item.hidden).slice(0, limit),
      hiddenCount: collections.filter(item => item.hidden).length,
      isDefault: true,
    };
  }

  let hiddenCount = 0;
  const scored: Array<{ item: GraphSearchItem; score: number }> = [];
  items.forEach(item => {
    const score = scoreItem(item, query);
    if (score < 0) return;
    if (item.hidden) {
      hiddenCount += 1;
      return;
    }
    scored.push({ item, score });
  });

  scored.sort((a, b) => (
    a.score - b.score
    || KIND_ORDER[a.item.target.kind] - KIND_ORDER[b.item.target.kind]
    || a.item.label.localeCompare(b.item.label)
    || a.item.context.localeCompare(b.item.context)
  ));

  return { results: scored.slice(0, limit).map(entry => entry.item), hiddenCount, isDefault: false };
}

// ── Component ──────────────────────────────────────────────────────

export interface GraphSearchPaletteProps {
  isOpen: boolean;
  items: GraphSearchItem[];
  onClose: () => void;
  onActivate: (target: GraphSearchTarget) => void;
}

export function GraphSearchPalette({ isOpen, items, onClose, onActivate }: GraphSearchPaletteProps) {
  // The query lives HERE, not in GroupedGraphInner: typing must not re-render
  // the graph. The only thing the graph holds is `isOpen`.
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Fresh query every time it opens; the palette unmounts between openings
  // anyway, this covers a re-open without a remount.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected(0);
    }
  }, [isOpen]);

  const { results, hiddenCount, isDefault } = useMemo(
    () => matchGraphSearchItems(items, query),
    [items, query]
  );

  // Clamp rather than reset, so narrowing the query keeps the selection on a
  // real row instead of silently pointing past the end.
  const activeIndex = results.length === 0 ? -1 : Math.min(selected, results.length - 1);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    // Guarded: jsdom has no scrollIntoView, and it is pure polish either way.
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const activate = useCallback((item: GraphSearchItem | undefined) => {
    if (!item) return;
    onActivate(item.target);
  }, [onActivate]);

  // `Search` exposes no onKeyDown, so navigation is handled here and reaches
  // us by bubbling out of the input. Enter is deliberately NOT wired to
  // Search's own `onEnter`, or it would activate twice.
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(prev => (results.length === 0 ? 0 : (Math.min(prev, results.length - 1) + 1) % results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(prev => (results.length === 0 ? 0 : (Math.min(prev, results.length - 1) + results.length - 1) % results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(results[activeIndex]);
    }
  }, [results, activeIndex, activate]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalContainer width={520} className="overflow-hidden">
        {/* The shortcut listener in GroupedGraph uses this marker to tell its
            own input from every other input in the plugin. */}
        <div data-graph-quick-search="" onKeyDown={handleKeyDown}>
          <div className="border-b border-border p-3">
            <Search
              value={query}
              onChange={setQuery}
              // Escape clears the query inside Search and then lands here; the
              // overlay's own Escape listener closes too, so either order ends
              // with the palette shut.
              onClear={onClose}
              placeholder="Jump to a collection, card or variable..."
              count={results.length > 0 ? `${results.length}` : undefined}
              autoFocus
              fullWidth
            />
          </div>

          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-text opacity-60">
              {hiddenCount > 0
                ? `Nothing to jump to — ${hiddenCount} ${hiddenCount === 1 ? 'match is' : 'matches are'} hidden by the current filters.`
                : 'No matches.'}
            </div>
          ) : (
            <div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Graph search results">
              {results.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-2 ${index === activeIndex ? 'bg-base-3' : ''}`}
                  onClick={() => activate(item)}
                >
                  <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase text-text opacity-60">
                    {KIND_LABEL[item.target.kind]}
                  </span>
                  <span className="truncate text-xs text-text">{item.label}</span>
                  <span className="ml-auto shrink-0 truncate text-[11px] text-text opacity-50">{item.context}</span>
                </button>
              ))}
            </div>
          )}

          {(hiddenCount > 0 && results.length > 0) || isDefault ? (
            <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-text opacity-50">
              {isDefault && <span>Type to search cards and variables</span>}
              {hiddenCount > 0 && results.length > 0 && (
                <span className="ml-auto">
                  {hiddenCount} more hidden by the current filters
                </span>
              )}
            </div>
          ) : null}
        </div>
      </ModalContainer>
    </ModalOverlay>
  );
}
