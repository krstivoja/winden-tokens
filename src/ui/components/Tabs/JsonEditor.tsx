// JSON editor component

import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';

export function JsonEditor() {
  const { collections, variables } = useAppContext();
  const [jsonValue, setJsonValue] = useState('');
  const [hasError, setHasError] = useState(false);

  // Update JSON when data changes
  useEffect(() => {
    const json = JSON.stringify({
      collections,
      variables: variables.map(v => ({
        id: v.id,
        collectionId: v.collectionId,
        name: v.name,
        type: v.resolvedType,
        value: v.value,
      })),
    }, null, 2);
    setJsonValue(json);
    setHasError(false);
  }, [collections, variables]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      setJsonValue(JSON.stringify(parsed, null, 2));
      setHasError(false);
    } catch {
      setHasError(true);
    }
  };

  const handleUpdate = () => {
    try {
      const data = JSON.parse(jsonValue);
      post({ type: 'update-from-json', data });
      setHasError(false);
    } catch {
      setHasError(true);
    }
  };

  return (
    <div className="json-panel">
      <textarea
        id="json-editor"
        className={`json-editor ${hasError ? 'error' : ''}`}
        spellCheck={false}
        value={jsonValue}
        onChange={e => setJsonValue(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={handleUpdate}>
          Update
        </button>
        <button className="btn" onClick={handleFormat}>
          Format
        </button>
      </div>
    </div>
  );
}
