// JSON editor component

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TextButton } from '../common/Button';
import { highlightJsonToHtml } from '../../utils/jsonHighlight';
import { buildNestedTokensJson, parseTokensJson } from '../../utils/tokensJson';
import { SegmentedControl } from '../common/SegmentedControl/SegmentedControl';
import { JsonTreeView } from './JsonTreeView';

export function JsonEditor() {
  const { collections, variables } = useAppContext();
  const [jsonValue, setJsonValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const editorRef = useRef<HTMLDivElement>(null);

  // Update JSON when data changes from outside (plugin updates)
  useEffect(() => {
    const json = buildNestedTokensJson(collections, variables);
    setJsonValue(json);
    setHasError(false);
    setIsEdited(false);

    // Update contenteditable (only mounted in raw mode; re-runs on switch)
    if (editorRef.current) {
      editorRef.current.innerHTML = highlightJsonToHtml(json);
    }
  }, [collections, variables, viewMode]);

  // Handle input in contenteditable
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const newValue = editorRef.current.innerText;
    setJsonValue(newValue);
    setIsEdited(true);

    try {
      const parsed = JSON.parse(newValue);
      // Nested tree (or legacy flat shape) → the flat payload the plugin expects.
      const data = parseTokensJson(parsed, collections);
      if (!data) {
        setHasError(true);
        return;
      }
      post({ type: 'update-from-json', data });
      setHasError(false);

      // Re-highlight after successful parse
      const cursorPos = saveCursorPosition(editorRef.current);
      editorRef.current.innerHTML = highlightJsonToHtml(newValue);
      restoreCursorPosition(editorRef.current, cursorPos);
    } catch {
      setHasError(true);
    }
  }, [collections]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonValue(formatted);
      setHasError(false);
      setIsEdited(false);

      if (editorRef.current) {
        editorRef.current.innerHTML = highlightJsonToHtml(formatted);
      }
    } catch {
      setHasError(true);
    }
  }, [jsonValue]);

  // Save cursor position
  const saveCursorPosition = (el: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // Restore cursor position
  const restoreCursorPosition = (el: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let currentOffset = 0;
    let found = false;

    const walk = (node: Node) => {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentOffset + textLength >= offset) {
          range.setStart(node, offset - currentOffset);
          range.collapse(true);
          found = true;
          return;
        }
        currentOffset += textLength;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
          if (found) return;
        }
      }
    };

    walk(el);

    if (found) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Floating controls - top right */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {viewMode === 'raw' && (
          <TextButton variant={isEdited ? 'primary' : undefined} onClick={handleFormat}>
            Format
          </TextButton>
        )}
        <SegmentedControl
          options={[{ value: 'tree', label: 'Tree' }, { value: 'raw', label: 'Raw' }]}
          value={viewMode}
          onChange={value => setViewMode(value as 'tree' | 'raw')}
        />
      </div>

      {viewMode === 'tree' ? (
        <JsonTreeView />
      ) : (
        <div className="w-full h-full">
          <div
            ref={editorRef}
            contentEditable
            spellCheck={false}
            onInput={handleInput}
            className={`json-editor json-highlight w-full h-full ${hasError ? 'error' : ''}`}
            style={{ whiteSpace: 'pre', outline: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
