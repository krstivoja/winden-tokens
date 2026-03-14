// Steps modal component

import React, { useState, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { CloseIcon, TrashIcon, RefreshIcon } from '../Icons';
import type { VariableData } from '../../types';

const RATIO_PRESETS = [
  { value: '1.125', label: 'Minor Second (1.125)' },
  { value: '1.2', label: 'Minor Third (1.2)' },
  { value: '1.25', label: 'Major Third (1.25)' },
  { value: '1.333', label: 'Perfect Fourth (1.333)' },
  { value: '1.414', label: 'Augmented Fourth (1.414)' },
  { value: '1.5', label: 'Perfect Fifth (1.5)' },
  { value: '1.618', label: 'Golden Ratio (1.618)' },
  { value: '2', label: 'Octave (2)' },
  { value: 'custom', label: 'Custom...' },
];

const STEPS_PRESETS = [
  { value: 'tshirt', label: 'T-shirt (xs-3xl)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl', baseStep: 'md' },
  { value: 'numeric', label: 'Numeric (1-10)', steps: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10', baseStep: '5' },
  { value: 'gutenberg', label: 'Gutenberg (xs-ultra)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl, ultra', baseStep: 'md' },
  { value: 'custom', label: 'Custom...' },
];

function resolveNumberValue(variable: VariableData | null, varsByName: Map<string, VariableData>, visited = new Set<string>()): number {
  if (!variable) return 0;

  const parsed = Number.parseFloat(variable.value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const refMatch = variable.value.match(/^\{(.+)\}$/);
  if (!refMatch) {
    return 0;
  }

  const referenceName = refMatch[1];
  if (visited.has(referenceName)) {
    return 0;
  }

  visited.add(referenceName);
  return resolveNumberValue(varsByName.get(referenceName) || null, varsByName, visited);
}

export function StepsModal() {
  const { modals, closeStepsModal } = useModalContext();
  const { variables, selectedCollectionId } = useAppContext();
  const isOpen = !!modals.stepsModal;
  const preSelectedGroup = modals.stepsModal?.groupName || '';

  const [sourceNumberId, setSourceNumberId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [ratioPreset, setRatioPreset] = useState('1.25');
  const [customRatio, setCustomRatio] = useState(1.25);
  const [stepsPreset, setStepsPreset] = useState('tshirt');
  const [stepsList, setStepsList] = useState('xs, sm, md, lg, xl, 2xl, 3xl');
  const [baseStep, setBaseStep] = useState('md');
  const [existingGroup, setExistingGroup] = useState(false);
  const [editableSteps, setEditableSteps] = useState<{ name: string; value: number }[]>([]);

  const numberVariables = useMemo(() =>
    variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'FLOAT'),
    [variables, selectedCollectionId]
  );

  const numberVarsByName = useMemo(
    () => new Map(numberVariables.map(variable => [variable.name, variable])),
    [numberVariables]
  );

  // Get unique number groups (like ShadesModal)
  const numberGroups = useMemo(() => {
    const groupMap = new Map<string, VariableData[]>();

    numberVariables.forEach(v => {
      const parts = v.name.split('/');
      const groupName = parts.length > 1 ? parts[0] : v.name;
      const group = groupMap.get(groupName) || [];
      group.push(v);
      groupMap.set(groupName, group);
    });

    return Array.from(groupMap.entries()).map(([name, groupVariables]) => {
      const sourceVar = groupVariables.find(variable => variable.name === name)
        || groupVariables.find(variable => variable.name.endsWith('/base'))
        || groupVariables[0]
        || null;

      return {
        name,
        count: groupVariables.length,
        firstVar: groupVariables[0] || null,
        sourceVar,
        resolvedBaseValue: resolveNumberValue(sourceVar, numberVarsByName),
      };
    });
  }, [numberVariables, numberVarsByName]);

  const selectedNumberGroup = useMemo(
    () => numberGroups.find(group => group.name === sourceNumberId) || null,
    [numberGroups, sourceNumberId]
  );
  const sourceReferenceName = selectedNumberGroup?.sourceVar?.name || '';
  const baseReferenceAlias = sourceReferenceName ? `{${sourceReferenceName}}` : '';
  const baseValue = selectedNumberGroup?.resolvedBaseValue ?? 0;
  const baseReferenceDisplay = sourceReferenceName ? `{${sourceReferenceName}:${baseValue}}` : '';

  // Auto-select pre-selected group when modal opens
  React.useEffect(() => {
    if (isOpen && preSelectedGroup) {
      setSourceNumberId(preSelectedGroup);
    }
  }, [isOpen, preSelectedGroup]);

  React.useEffect(() => {
    if (!sourceNumberId) {
      setGroupName('');
      setExistingGroup(false);
      return;
    }

    if (!selectedNumberGroup) return;

    setGroupName(selectedNumberGroup.name);
    setExistingGroup(selectedNumberGroup.count > 1);
  }, [selectedNumberGroup, sourceNumberId]);

  const stepsArray = useMemo(() =>
    stepsList.split(',').map(s => s.trim()).filter(Boolean),
    [stepsList]
  );

  const ratio = ratioPreset === 'custom' ? customRatio : parseFloat(ratioPreset);

  // Calculate preview and update editable steps when dependencies change
  const calculatedPreview = useMemo(() => {
    const baseIndex = stepsArray.indexOf(baseStep);
    if (baseIndex === -1) return [];

    return stepsArray.map((name, i) => {
      const offset = i - baseIndex;
      const value = baseValue * Math.pow(ratio, offset);
      return { name, value: Math.round(value * 100) / 100 };
    });
  }, [stepsArray, baseStep, baseValue, ratio]);

  // Update editable steps when calculated preview changes
  React.useEffect(() => {
    if (calculatedPreview.length > 0) {
      setEditableSteps(calculatedPreview);
    }
  }, [calculatedPreview]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceNumberId(e.target.value);
  };

  const handleRatioPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setRatioPreset(value);
    if (value !== 'custom') {
      setCustomRatio(parseFloat(value));
    }
  };

  const handleStepsPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStepsPreset(value);
    const preset = STEPS_PRESETS.find(p => p.value === value);
    if (preset && preset.steps) {
      setStepsList(preset.steps);
      if ('baseStep' in preset && preset.baseStep) {
        setBaseStep(preset.baseStep);
      }
    }
  };

  const handleStepNameChange = (index: number, newName: string) => {
    setEditableSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: newName };
      return updated;
    });
  };

  const handleStepValueChange = (index: number, newValue: number) => {
    setEditableSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: newValue };
      return updated;
    });
  };

  const handleResetStepValue = (index: number) => {
    if (editableSteps[index]?.name === baseStep) return;

    const calculatedValue = calculatedPreview[index]?.value;
    if (calculatedValue !== undefined) {
      setEditableSteps(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], value: calculatedValue };
        return updated;
      });
    }
  };

  const isValueModified = (index: number): boolean => {
    if (editableSteps[index]?.name === baseStep) return false;

    const editedValue = editableSteps[index]?.value;
    const calculatedValue = calculatedPreview[index]?.value;
    return editedValue !== undefined && calculatedValue !== undefined && editedValue !== calculatedValue;
  };

  const handleBaseStepChange = (stepName: string) => {
    setBaseStep(stepName);
  };

  const handleDeleteStep = (index: number) => {
    setEditableSteps(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If we deleted the base step, set the first step as base
      const deletedStep = prev[index];
      if (deletedStep.name === baseStep && updated.length > 0) {
        setBaseStep(updated[0].name);
      }
      return updated;
    });
  };

  const handleAddStep = () => {
    setEditableSteps(prev => {
      const newStep = { name: `step-${Date.now()}`, value: 0 };
      return [...prev, newStep];
    });
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (dragIndex === dropIndex) return;

    setEditableSteps(prev => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, draggedItem);

      // Recalculate values based on new positions
      const baseIndex = updated.findIndex(step => step.name === baseStep);
      if (baseIndex !== -1) {
        return updated.map((step, i) => {
          const offset = i - baseIndex;
          const value = baseValue * Math.pow(ratio, offset);
          return { ...step, value: Math.round(value * 100) / 100 };
        });
      }

      return updated;
    });
  };

  const handleGenerate = () => {
    if (!groupName || editableSteps.length === 0) return;

    const steps = editableSteps.map(p => ({
      name: `${groupName}/${p.name}`,
      value: p.name === baseStep && baseReferenceAlias ? baseReferenceAlias : String(p.value),
    }));

    post({
      type: 'create-steps',
      collectionId: selectedCollectionId,
      steps,
    });

    closeStepsModal();
  };

  const handleRemove = () => {
    if (!groupName) return;
    post({
      type: 'remove-steps',
      collectionId: selectedCollectionId,
      groupName,
    });
    closeStepsModal();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeStepsModal()}>
      <div className="modal modal-steps">
        <div className="modal-header">
          <h3>Generate Number Steps</h3>
          <button className="modal-close" onClick={closeStepsModal}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          {!preSelectedGroup && (
            <div className="form-group">
              <label>Select Number Group</label>
              <select
                className="form-input"
                value={sourceNumberId}
                onChange={handleSourceChange}
              >
                <option value="">-- Select a group --</option>
                {numberGroups.map(g => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {sourceNumberId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Base Reference</label>
                <input
                  type="text"
                  className="form-input"
                  value={baseReferenceDisplay}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Scale Ratio</label>
                <div className="form-row">
                  <select
                    className="form-input"
                    value={ratioPreset}
                    onChange={handleRatioPresetChange}
                  >
                    {RATIO_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    value={customRatio}
                    onChange={e => setCustomRatio(parseFloat(e.target.value) || 1)}
                    min={1}
                    step={0.001}
                    style={{ width: 80 }}
                    disabled={ratioPreset !== 'custom'}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Steps</label>
                <select
                  className="form-input"
                  value={stepsPreset}
                  onChange={handleStepsPresetChange}
                >
                  {STEPS_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingRight: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '16px 24px minmax(0, 1fr) 180px 48px', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div />
                    <label style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500, textAlign: 'center' }}>Base</label>
                    <label style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>Label</label>
                    <label style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500, textAlign: 'right' }}>Value</label>
                    <div />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleAddStep}
                    style={{ marginLeft: 8 }}
                  >
                    + Add Step
                  </button>
                </div>
                <div className="steps-editable-table">
                  {editableSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`steps-editable-row ${step.name === baseStep ? 'base' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, index)}
                    >
                      <div
                        className="drag-handle"
                        title="Drag to reorder"
                        draggable
                        onDragStart={e => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <circle cx="3" cy="3" r="1.5" />
                          <circle cx="9" cy="3" r="1.5" />
                          <circle cx="3" cy="9" r="1.5" />
                          <circle cx="9" cy="9" r="1.5" />
                        </svg>
                      </div>
                      <input
                        type="radio"
                        name="base-step"
                        checked={step.name === baseStep}
                        onChange={() => handleBaseStepChange(step.name)}
                        className="base-radio"
                      />
                      <input
                        type="text"
                        className="step-label-input"
                        value={step.name}
                        onChange={e => handleStepNameChange(index, e.target.value)}
                      />
                      {step.name === baseStep ? (
                        <input
                          type="text"
                          className="step-value-input"
                          value={baseReferenceDisplay}
                          readOnly
                          title={`Resolved value: ${baseValue}`}
                        />
                      ) : (
                        <input
                          type="number"
                          className="step-value-input"
                          value={step.value}
                          onChange={e => handleStepValueChange(index, parseFloat(e.target.value) || 0)}
                          step="any"
                        />
                      )}
                      <div className="step-actions">
                        {isValueModified(index) && (
                          <button
                            type="button"
                            className="step-reset-btn"
                            onClick={() => handleResetStepValue(index)}
                            title="Reset to calculated value"
                          >
                            <RefreshIcon />
                          </button>
                        )}
                        <button
                          type="button"
                          className="step-delete-btn"
                          onClick={() => handleDeleteStep(index)}
                          title="Delete step"
                          disabled={editableSteps.length <= 1}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {existingGroup && (
            <button className="btn btn-danger" onClick={handleRemove}>
              Remove Steps
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={closeStepsModal}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!sourceNumberId || !groupName}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
