// Bulk edit modal component

import React, { useState, useEffect, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TextButton } from '../common/Button';
import { Textarea } from '../common/Textarea';
import { ColorSwatch } from '../common/ColorSwatch/ColorSwatch';
import { ModalOverlay, ModalContainer, ModalHeader, ModalBody, ModalFooter } from './Modal';

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

      // Resolve color reference if needed
      let resolvedColor = value;
      if (value.startsWith('{') && value.endsWith('}')) {
        const refName = value.slice(1, -1);
        const referencedVar = variables.find(v => v.name === refName);
        if (referencedVar && referencedVar.resolvedType === 'COLOR') {
          resolvedColor = referencedVar.value;
        }
      }

      return {
        name: trimmedName,
        value,
        isNew,
        isModified,
        isColor,
        resolvedColor,
        fullName: `${config.groupName}/${trimmedName}`,
      };
    }).filter(Boolean);
  }, [textValue, config, groupVars, variables]);

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
    <ModalOverlay isOpen={!!config} onClose={closeBulkEdit}>
      <ModalContainer width={480}>
        <ModalHeader
          title={<>Edit as Text: <span className="font-normal text-text opacity-60">{config.groupName}</span></>}
          onClose={closeBulkEdit}
        />
        <ModalBody>
          <div className="space-y-2">
            <label className="text-sm">
              One variable per line: <code className="text-xs bg-base-2 px-1 py-0.5 rounded">name, value</code>
            </label>
            <Textarea
              className="min-h-[120px] mt-2"
              spellCheck={false}
              mono
              placeholder={'50, #FFFFFF\n100, #F5F5F5\n200, #EEEEEE'}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          {preview.length > 0 && (
            <div className="mt-4 space-y-1 max-h-[200px] overflow-auto border border-border rounded p-2">
              {preview.map((p, i) => p && (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  {p.isColor && <ColorSwatch color={p.resolvedColor} />}
                  <span className="font-mono text-xs opacity-60">{p.fullName}</span>
                  <span className="font-mono text-xs flex-1">{p.value}</span>
                  {(p.isNew || p.isModified) && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.isNew ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'}`}>
                      {p.isNew ? 'new' : 'modified'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <TextButton onClick={closeBulkEdit}>Cancel</TextButton>
          <TextButton variant="primary" onClick={handleApply}>Apply Changes</TextButton>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
}
