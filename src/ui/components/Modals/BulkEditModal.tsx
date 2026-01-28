// Bulk edit modal component

import React, { useState, useEffect, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { CloseIcon } from '../Icons';

export function BulkEditModal() {
  const { modals, closeBulkEdit } = useModalContext();
  const { variables, selectedCollectionId } = useAppContext();
  const config = modals.bulkEdit;
  const [textValue, setTextValue] = useState('');

  const groupVars = useMemo(() => {
    if (!config) return [];
    return variables.filter(v =>
      v.collectionId === selectedCollectionId &&
      v.name.startsWith(config.groupName + '/')
    );
  }, [variables, selectedCollectionId, config]);

  useEffect(() => {
    if (config && groupVars.length > 0) {
      const csvLines = groupVars.map(v => {
        const shortName = v.name.replace(config.groupName + '/', '');
        return `${shortName}, ${v.value}`;
      });
      setTextValue(csvLines.join('\n'));
    }
  }, [config, groupVars]);

  const preview = useMemo(() => {
    if (!config) return [];
    const lines = textValue.split('\n').filter(line => line.trim());
    const existingNames = new Set(groupVars.map(v => v.name.replace(config.groupName + '/', '')));

    return lines.map(line => {
      const [name, ...valueParts] = line.split(/[,\t]/);
      const trimmedName = name?.trim();
      const value = valueParts.join(',').trim();

      if (!trimmedName) return null;

      const isNew = !existingNames.has(trimmedName);
      const existingVar = groupVars.find(v => v.name === config.groupName + '/' + trimmedName);
      const isModified = existingVar && existingVar.value !== value;
      const isColor = value.startsWith('#') || value.startsWith('rgb') || value.startsWith('{');

      return {
        name: trimmedName,
        value,
        isNew,
        isModified,
        isColor,
        fullName: `${config.groupName}/${trimmedName}`,
      };
    }).filter(Boolean);
  }, [textValue, config, groupVars]);

  const handleApply = () => {
    if (!config) return;

    const updates = preview
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map(p => ({
        name: p.fullName,
        value: p.value,
      }));

    if (updates.length > 0) {
      post({
        type: 'bulk-update-group',
        collectionId: selectedCollectionId,
        groupName: config.groupName,
        updates,
      });
    }

    closeBulkEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeBulkEdit();
    }
  };

  if (!config) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeBulkEdit()}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-header">
          <h3>Edit as Text: <span>{config.groupName}</span></h3>
          <button className="modal-close" onClick={closeBulkEdit}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>One variable per line: <code>name, value</code></label>
            <textarea
              className="bulk-edit-textarea"
              spellCheck={false}
              placeholder={'50, #FFFFFF\n100, #F5F5F5\n200, #EEEEEE'}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="bulk-edit-preview">
            {preview.map((p, i) => p && (
              <div key={i} className="bulk-edit-preview-item">
                {p.isColor && (
                  <div
                    className="preview-swatch"
                    style={{ background: p.value.startsWith('{') ? '#888' : p.value }}
                  />
                )}
                <span className="preview-name">{p.fullName}</span>
                <span className="preview-value">{p.value}</span>
                {(p.isNew || p.isModified) && (
                  <span className={`preview-status ${p.isNew ? 'new' : 'modified'}`}>
                    {p.isNew ? 'new' : 'modified'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={closeBulkEdit}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply}>Apply Changes</button>
        </div>
      </div>
    </div>
  );
}
