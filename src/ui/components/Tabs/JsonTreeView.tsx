// Collapsible tree view for the JSON tab.
//
// Renders the same nested structure as the raw JSON editor, but with
// clickable group tags that fold/unfold their subtree, and leaf values
// editable inline (same update path as the Table's value cells).

import React, { useMemo, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { resolveModeIdForCollection, resolveAliasValue } from '../../utils/modes';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { buildNestedTokensTree, isTokenLeaf } from '../../utils/tokensJson';
import { TextButton } from '../common/Button';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function countLeaves(node: Record<string, unknown>): number {
  let count = isTokenLeaf(node) ? 1 : 0;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (isPlainObject(child)) count += countLeaves(child);
  }
  return count;
}

function LeafValue({ variableId, value }: { variableId: string; value: string }) {
  const { collections, variables, selectedModeId } = useAppContext();
  const [draft, setDraft] = useState(value);

  React.useEffect(() => setDraft(value), [value]);

  const commit = useCallback(() => {
    if (draft === value) return;
    const variable = variables.find(v => v.id === variableId);
    if (!variable) return;
    const modeId = resolveModeIdForCollection(collections, variable.collectionId, selectedModeId);
    post({ type: 'update-variable-value', id: variableId, value: draft, modeId });
  }, [draft, value, variableId, variables, collections, selectedModeId]);

  // Swatch for colors: resolve alias chains so references show their color too.
  const resolved = resolveAliasValue(collections, variables, value, selectedModeId);
  const rgb = parseColorToRgb(resolved);

  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {rgb && (
        <span
          className="w-3.5 h-3.5 rounded-sm border border-border shrink-0"
          style={{ background: rgbObjToHex(rgb) }}
        />
      )}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 text-xs font-mono text-text-secondary focus:text-text outline-none min-w-0 w-full"
        spellCheck={false}
      />
    </span>
  );
}

export function JsonTreeView() {
  const { collections, variables } = useAppContext();
  const tree = useMemo(() => buildNestedTokensTree(collections, variables), [collections, variables]);

  // Expanded group paths. Collections start expanded so the first level of
  // groups is visible as closed tags.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collections.map(c => c.name))
  );

  const toggle = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const walk = (node: Record<string, unknown>, path: string) => {
      all.add(path);
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (isPlainObject(child)) walk(child, path ? `${path}/${key}` : key);
      }
    };
    Object.entries(tree).forEach(([name, subtree]) => walk(subtree, name));
    setExpanded(all);
  }, [tree]);

  const renderNode = (
    key: string,
    node: Record<string, unknown>,
    path: string,
    depth: number
  ): React.ReactNode => {
    const childEntries = Object.entries(node).filter(
      ([k, v]) => !k.startsWith('$') && isPlainObject(v)
    ) as Array<[string, Record<string, unknown>]>;
    const leaf = isTokenLeaf(node);
    const isOpen = expanded.has(path);

    return (
      <div key={path} style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
        <div className="flex items-center gap-1.5 h-7 min-w-0">
          {childEntries.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(path)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-pointer transition-all shrink-0 ${
                isOpen
                  ? 'bg-base-2 text-text border-border'
                  : 'bg-base-2 text-text-secondary border-border hover:bg-base-3 hover:text-text'
              }`}
            >
              <span
                className="inline-block transition-transform duration-150 text-[9px]"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
              >
                ▶
              </span>
              {key}
              {!isOpen && (
                <span className="text-[10px] opacity-60">{countLeaves(node)}</span>
              )}
            </button>
          ) : (
            <span className="text-xs font-medium text-text px-1 shrink-0">{key}</span>
          )}

          {leaf && typeof node.$id === 'string' && (
            <LeafValue variableId={node.$id} value={String(node.$value)} />
          )}
        </div>

        {isOpen && childEntries.map(([childKey, child]) =>
          renderNode(childKey, child, `${path}/${childKey}`, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-auto p-3">
      <div className="flex gap-2 mb-3">
        <TextButton variant="secondary" onClick={expandAll}>Expand All</TextButton>
        <TextButton variant="secondary" onClick={collapseAll}>Collapse All</TextButton>
      </div>
      {Object.entries(tree).map(([collectionName, subtree]) => (
        <div key={collectionName} className="mb-2">
          {renderNode(collectionName, subtree, collectionName, 0)}
        </div>
      ))}
    </div>
  );
}
