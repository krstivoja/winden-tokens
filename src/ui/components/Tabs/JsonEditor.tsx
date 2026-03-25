// JSON editor component

import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TextButton } from '../common/Button';
import { Textarea } from '../common/Textarea';
import { JsonHighlighter } from './JsonHighlighter';

export function JsonEditor() {
  const { collections, variables } = useAppContext();
  const [jsonValue, setJsonValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

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
      setIsEditing(false);
    } catch {
      setHasError(true);
    }
  };

  const handleCancel = () => {
    // Reset to current data
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
    setIsEditing(false);
  };

  return (
    <div className="json-panel">
      {isEditing ? (
        <Textarea
          id="json-editor"
          className={`json-editor ${hasError ? 'error' : ''}`}
          spellCheck={false}
          mono
          value={jsonValue}
          onChange={e => setJsonValue(e.target.value)}
          autoFocus
        />
      ) : (
        <JsonHighlighter json={jsonValue} />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isEditing ? (
          <>
            <TextButton variant="primary" onClick={handleUpdate}>
              Update
            </TextButton>
            <TextButton onClick={handleFormat}>
              Format
            </TextButton>
            <TextButton onClick={handleCancel}>
              Cancel
            </TextButton>
          </>
        ) : (
          <TextButton onClick={() => setIsEditing(true)}>
            Edit
          </TextButton>
        )}
      </div>
    </div>
  );
}
