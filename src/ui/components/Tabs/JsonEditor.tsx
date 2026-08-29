// JSON editor component — CodeMirror with fold gutters, so collection and
// group blocks collapse/expand like in a code editor.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TextButton } from '../common/Button';
import { buildNestedTokensJson, parseTokensJson } from '../../utils/tokensJson';

// Transparent chrome so the editor sits on the plugin's own theme tokens.
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%', fontSize: '12px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
});

export function JsonEditor() {
  const { collections, variables } = useAppContext();
  const [jsonValue, setJsonValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const postTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update JSON when data changes from outside (plugin updates)
  useEffect(() => {
    setJsonValue(buildNestedTokensJson(collections, variables));
    setHasError(false);
    setIsEdited(false);
  }, [collections, variables]);

  // Parse edits and push them to the plugin, debounced so half-typed (but
  // momentarily valid) JSON doesn't delete variables mid-edit.
  const handleChange = useCallback((value: string) => {
    setJsonValue(value);
    setIsEdited(true);

    if (postTimeoutRef.current) clearTimeout(postTimeoutRef.current);
    postTimeoutRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        const data = parseTokensJson(parsed, collections);
        if (!data) {
          setHasError(true);
          return;
        }
        post({ type: 'update-from-json', data });
        setHasError(false);
      } catch {
        setHasError(true);
      }
    }, 600);
  }, [collections]);

  useEffect(() => () => {
    if (postTimeoutRef.current) clearTimeout(postTimeoutRef.current);
  }, []);

  const handleFormat = useCallback(() => {
    try {
      setJsonValue(JSON.stringify(JSON.parse(jsonValue), null, 2));
      setHasError(false);
      setIsEdited(false);
    } catch {
      setHasError(true);
    }
  }, [jsonValue]);

  return (
    <div className="relative w-full h-full">
      {/* Floating Format button - top right */}
      <div className="absolute top-3 right-3 z-10">
        <TextButton variant={isEdited ? 'primary' : undefined} onClick={handleFormat}>
          Format
        </TextButton>
      </div>

      <div className={`w-full h-full overflow-auto ${hasError ? 'ring-1 ring-danger ring-inset' : ''}`}>
        <CodeMirror
          value={jsonValue}
          onChange={handleChange}
          extensions={[json(), editorTheme]}
          basicSetup={{
            foldGutter: true,
            lineNumbers: true,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSelectionMatches: false,
            autocompletion: false,
          }}
          height="100%"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
