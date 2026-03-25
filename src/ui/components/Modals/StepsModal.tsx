// Steps modal component

import React, { useState, useMemo, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TrashIcon, RefreshIcon } from '../Icons';
import { Input } from '../common/Input';
import { TextButton } from '../common/Button';
import { Radio } from '../common/Radio';
import { Select } from '../common/Select';
import type { VariableData } from '../../types';
import { ModalOverlay, ModalContainer, ModalHeader, ModalBody, ModalFooter } from './Modal';

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
  { value: 'tshirt', label: 'T-shirt (xs-4xl)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl, 4xl', baseStep: 'md' },
  { value: 'numeric', label: 'Numeric (1-10)', steps: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10', baseStep: '5' },
  { value: 'gutenberg', label: 'Gutenberg (xs-ultra)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl, ultra', baseStep: 'md' },
  { value: 'custom', label: 'Custom...' },
];

const DEFAULT_RATIO_PRESET = '1.25';
const DEFAULT_CUSTOM_RATIO = 1.25;
const DEFAULT_STEPS_PRESET = 'tshirt';
const DEFAULT_STEPS_LIST = 'xs, sm, md, lg, xl, 2xl, 3xl, 4xl';
const DEFAULT_BASE_STEP = 'md';

interface RestoredStepsModalState {
  ratioPreset: string;
  customRatio: number;
  stepsPreset: string;
  stepsList: string;
  baseStep: string;
  editableSteps: Array<{ name: string; value: number }>;
}

function normalizeRestoredStepsModalState(value: unknown): RestoredStepsModalState | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<RestoredStepsModalState>;
  if (
    typeof candidate.ratioPreset !== 'string' ||
    typeof candidate.customRatio !== 'number' ||
    typeof candidate.stepsPreset !== 'string' ||
    typeof candidate.stepsList !== 'string' ||
    typeof candidate.baseStep !== 'string' ||
    !Array.isArray(candidate.editableSteps)
  ) {
    return null;
  }

  const editableSteps = candidate.editableSteps
    .filter(step => step && typeof step.name === 'string' && typeof step.value === 'number')
    .map(step => ({ name: step.name, value: step.value }));

  return {
    ratioPreset: candidate.ratioPreset,
    customRatio: candidate.customRatio,
    stepsPreset: candidate.stepsPreset,
    stepsList: candidate.stepsList,
    baseStep: candidate.baseStep,
    editableSteps,
  };
}

function resolveNumberValue(
  variable: VariableData | null,
  varsByName: Map<string, VariableData>,
  selectedModeId: string | null,
  visited = new Set<string>()
): number {
  if (!variable) return 0;

  // Get value for the selected mode, fall back to default value
  const modeValue = selectedModeId && variable.valuesByMode?.[selectedModeId]
    ? variable.valuesByMode[selectedModeId]
    : variable.value;

  const parsed = Number.parseFloat(modeValue);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const refMatch = modeValue.match(/^\{(.+)\}$/);
  if (!refMatch) {
    return 0;
  }

  const referenceName = refMatch[1];
  if (visited.has(referenceName)) {
    return 0;
  }

  visited.add(referenceName);
  return resolveNumberValue(varsByName.get(referenceName) || null, varsByName, selectedModeId, visited);
}

export function StepsModal() {
  const { modals, closeStepsModal } = useModalContext();
  const { variables, selectedCollectionId, selectedModeId } = useAppContext();
  const isOpen = !!modals.stepsModal;
  const preSelectedGroup = modals.stepsModal?.groupName || '';
  const targetCollectionId = modals.stepsModal?.collectionId || selectedCollectionId;

  const [sourceNumberId, setSourceNumberId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [ratioPreset, setRatioPreset] = useState(DEFAULT_RATIO_PRESET);
  const [customRatio, setCustomRatio] = useState(DEFAULT_CUSTOM_RATIO);
  const [stepsPreset, setStepsPreset] = useState(DEFAULT_STEPS_PRESET);
  const [stepsList, setStepsList] = useState(DEFAULT_STEPS_LIST);
  const [baseStep, setBaseStep] = useState(DEFAULT_BASE_STEP);
  const [existingGroup, setExistingGroup] = useState(false);
  const [editableSteps, setEditableSteps] = useState<{ name: string; value: number }[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const skipNextPreviewSyncRef = useRef(false);

  const numberVariables = useMemo(() =>
    variables.filter(v => v.collectionId === targetCollectionId && v.resolvedType === 'FLOAT'),
    [variables, targetCollectionId]
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
        variables: groupVariables,
        sourceVar,
        resolvedBaseValue: resolveNumberValue(sourceVar, numberVarsByName, selectedModeId),
      };
    });
  }, [numberVariables, numberVarsByName, selectedModeId]);

  const selectedNumberGroup = useMemo(
    () => numberGroups.find(group => group.name === sourceNumberId) || null,
    [numberGroups, sourceNumberId]
  );
  const sourceReferenceName = selectedNumberGroup?.sourceVar?.name || '';
  const baseReferenceAlias = sourceReferenceName ? `{${sourceReferenceName}}` : '';
  const baseValue = selectedNumberGroup?.resolvedBaseValue ?? 0;
  const baseReferenceDisplay = sourceReferenceName ? `{${sourceReferenceName}:${baseValue}}` : '';
  const selectedSourceVariableId = selectedNumberGroup?.sourceVar?.id || null;

  React.useEffect(() => {
    if (!isOpen) {
      setSourceNumberId('');
      return;
    }

    setSourceNumberId(currentSourceNumberId => preSelectedGroup || currentSourceNumberId);
    setDraggedIndex(null);
  }, [isOpen, preSelectedGroup, selectedModeId]);

  React.useEffect(() => {
    if (!isOpen) return;

    if (!selectedNumberGroup) {
      skipNextPreviewSyncRef.current = false;
      setGroupName('');
      setExistingGroup(false);
      setRatioPreset(DEFAULT_RATIO_PRESET);
      setCustomRatio(DEFAULT_CUSTOM_RATIO);
      setStepsPreset(DEFAULT_STEPS_PRESET);
      setStepsList(DEFAULT_STEPS_LIST);
      setBaseStep(DEFAULT_BASE_STEP);
      setEditableSteps([]);
      return;
    }

    // Update basic group info
    setGroupName(selectedNumberGroup.name);
    setExistingGroup(selectedNumberGroup.count > 1);

    // Only reset form fields if NOT preselected (stored state will load in next effect)
    const hasPreselected = !!preSelectedGroup;
    if (!hasPreselected) {
      skipNextPreviewSyncRef.current = false;
      setRatioPreset(DEFAULT_RATIO_PRESET);
      setCustomRatio(DEFAULT_CUSTOM_RATIO);
      setStepsPreset(DEFAULT_STEPS_PRESET);
      setStepsList(DEFAULT_STEPS_LIST);
      setBaseStep(DEFAULT_BASE_STEP);
      setEditableSteps([]);
    }
  }, [isOpen, selectedNumberGroup, selectedModeId, preSelectedGroup]);

  React.useEffect(() => {
    if (!isOpen || !selectedSourceVariableId) return;

    const handleStoredState = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (
        msg?.type !== 'step-modal-state' ||
        msg.sourceVariableId !== selectedSourceVariableId ||
        msg.modeId !== (selectedModeId || null)
      ) {
        return;
      }

      const restoredState = normalizeRestoredStepsModalState(msg.state);
      if (restoredState) {
        skipNextPreviewSyncRef.current = true;
        setRatioPreset(restoredState.ratioPreset);
        setCustomRatio(restoredState.customRatio);
        setStepsPreset(restoredState.stepsPreset);
        setStepsList(restoredState.stepsList);
        setBaseStep(restoredState.baseStep);
        setEditableSteps(restoredState.editableSteps);
      }
    };

    window.addEventListener('message', handleStoredState);
    post({
      type: 'get-step-modal-state',
      sourceVariableId: selectedSourceVariableId,
      modeId: selectedModeId,
    });
    return () => window.removeEventListener('message', handleStoredState);
  }, [isOpen, selectedSourceVariableId, selectedModeId]);

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
    if (skipNextPreviewSyncRef.current) {
      skipNextPreviewSyncRef.current = false;
      return;
    }

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
    if (!groupName || editableSteps.length === 0 || !selectedNumberGroup) return;

    const steps = editableSteps.map(p => ({
      name: `${groupName}/${p.name}`,
      value: p.name === baseStep && baseReferenceAlias ? baseReferenceAlias : String(p.value),
    }));
    const modalState = {
      ratioPreset,
      customRatio,
      stepsPreset,
      stepsList: editableSteps.map(step => step.name).join(', '),
      baseStep,
    };
    const deleteIds = selectedNumberGroup.variables
      .filter(variable => variable.id !== selectedNumberGroup.sourceVar?.id)
      .map(variable => variable.id);

    post({
      type: existingGroup ? 'update-steps' : 'create-steps',
      collectionId: targetCollectionId,
      deleteIds,
      steps,
      modeId: selectedModeId,
      modalState,
    });

    closeStepsModal();
  };

  const handleRemove = () => {
    if (!selectedSourceVariableId) return;
    post({
      type: 'remove-steps',
      sourceVariableId: selectedSourceVariableId,
    });
    closeStepsModal();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={closeStepsModal}>
      <ModalContainer width={600}>
        <ModalHeader title="Generate Number Steps" onClose={closeStepsModal} />
        <ModalBody>
          {!preSelectedGroup && (
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium text-text">Select Number Group</label>
              <Select
                value={sourceNumberId}
                onChange={handleSourceChange}
              >
                <Select.Option value="">-- Select a group --</Select.Option>
                {numberGroups.map(g => (
                  <Select.Option key={g.name} value={g.name}>
                    {g.name} ({g.count})
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {sourceNumberId && !selectedNumberGroup && (
            <div className="text-sm text-text-secondary p-4 text-center">
              This number group is not available in the selected collection.
            </div>
          )}

          {sourceNumberId && selectedNumberGroup && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text">Base Reference</label>
                <Input
                  type="text"
                  value={baseReferenceDisplay}
                  readOnly
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text">Scale Ratio</label>
                <div className="flex gap-2">
                  <Select
                    value={ratioPreset}
                    onChange={handleRatioPresetChange}
                  >
                    {RATIO_PRESETS.map(p => (
                      <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    value={customRatio}
                    onChange={e => setCustomRatio(parseFloat(e.target.value) || 1)}
                    min={1}
                    step={0.001}
                    style={{ width: 80 }}
                    disabled={ratioPreset !== 'custom'}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text">Steps</label>
                <Select
                  value={stepsPreset}
                  onChange={handleStepsPresetChange}
                >
                  {STEPS_PRESETS.map(p => (
                    <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="grid gap-2" style={{ gridTemplateColumns: '20px 40px 1fr 120px 60px' }}>
                    <div />
                    <label className="text-xs text-text-secondary font-medium text-center m-0">Base</label>
                    <label className="text-xs text-text-secondary font-medium m-0">Label</label>
                    <label className="text-xs text-text-secondary font-medium text-right m-0">Value</label>
                    <div />
                  </div>
                  <TextButton
                    type="button"
                    size="sm"
                    onClick={handleAddStep}
                    className="ml-2"
                  >
                    + Add Step
                  </TextButton>
                </div>
                <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                  {editableSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`grid gap-2 items-center p-2 rounded border ${
                        step.name === baseStep
                          ? 'bg-primary/10 border-primary'
                          : 'bg-base-2 border-border'
                      } ${
                        draggedIndex === index ? 'opacity-50' : ''
                      }`}
                      style={{ gridTemplateColumns: '20px 40px 1fr 120px 60px' }}
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, index)}
                    >
                      <div
                        className="flex items-center justify-center cursor-move text-text-secondary hover:text-text"
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
                      <div className="flex justify-center">
                        <Radio
                          name="base-step"
                          checked={step.name === baseStep}
                          onChange={() => handleBaseStepChange(step.name)}
                        />
                      </div>
                      <Input
                        type="text"
                        value={step.name}
                        onChange={e => handleStepNameChange(index, e.target.value)}
                        fullWidth
                      />
                      {step.name === baseStep ? (
                        <Input
                          type="text"
                          value={baseReferenceDisplay}
                          readOnly
                          title={`Resolved value: ${baseValue}`}
                          fullWidth
                        />
                      ) : (
                        <Input
                          type="number"
                          value={step.value}
                          onChange={e => handleStepValueChange(index, parseFloat(e.target.value) || 0)}
                          step="any"
                          fullWidth
                        />
                      )}
                      <div className="flex items-center justify-end gap-1">
                        {isValueModified(index) && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded transition-colors bg-transparent text-text hover:bg-base-2 active:bg-base-3 w-6 h-6 text-sm p-0"
                            onClick={() => handleResetStepValue(index)}
                            title="Reset to calculated value"
                          >
                            <RefreshIcon />
                          </button>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded transition-colors bg-transparent text-text hover:bg-base-2 active:bg-base-3 w-6 h-6 text-sm p-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </ModalBody>
        <ModalFooter>
          {existingGroup && (
            <TextButton variant="danger" onClick={handleRemove}>
              Remove Steps
            </TextButton>
          )}
          <div className="flex-1" />
          <TextButton onClick={closeStepsModal}>Cancel</TextButton>
          <TextButton
            variant="primary"
            onClick={handleGenerate}
            disabled={!sourceNumberId || !groupName || !selectedNumberGroup || !targetCollectionId}
          >
            {existingGroup ? 'Update' : 'Generate'}
          </TextButton>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
}
