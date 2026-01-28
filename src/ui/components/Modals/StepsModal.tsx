// Steps modal component

import React, { useState, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { CloseIcon } from '../Icons';

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
  { value: 'tshirt', label: 'T-shirt (xs-3xl)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl' },
  { value: 'numeric', label: 'Numeric (1-10)', steps: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10' },
  { value: 'gutenberg', label: 'Gutenberg (xs-ultra)', steps: 'xs, sm, md, lg, xl, 2xl, 3xl, ultra' },
  { value: 'custom', label: 'Custom...' },
];

export function StepsModal() {
  const { modals, closeStepsModal } = useModalContext();
  const { variables, selectedCollectionId } = useAppContext();
  const isOpen = modals.stepsModal;

  const [sourceNumberId, setSourceNumberId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [baseValue, setBaseValue] = useState(16);
  const [ratioPreset, setRatioPreset] = useState('1.25');
  const [customRatio, setCustomRatio] = useState(1.25);
  const [stepsPreset, setStepsPreset] = useState('tshirt');
  const [stepsList, setStepsList] = useState('xs, sm, md, lg, xl, 2xl, 3xl');
  const [baseStep, setBaseStep] = useState('md');
  const [existingGroup, setExistingGroup] = useState(false);

  const numberVariables = useMemo(() =>
    variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'FLOAT'),
    [variables, selectedCollectionId]
  );

  const stepsArray = useMemo(() =>
    stepsList.split(',').map(s => s.trim()).filter(Boolean),
    [stepsList]
  );

  const ratio = ratioPreset === 'custom' ? customRatio : parseFloat(ratioPreset);

  const preview = useMemo(() => {
    const baseIndex = stepsArray.indexOf(baseStep);
    if (baseIndex === -1) return [];

    return stepsArray.map((name, i) => {
      const offset = i - baseIndex;
      const value = baseValue * Math.pow(ratio, offset);
      return { name, value: Math.round(value * 100) / 100 };
    });
  }, [stepsArray, baseStep, baseValue, ratio]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSourceNumberId(id);

    if (id) {
      const v = numberVariables.find(n => n.id === id);
      if (v) {
        const parts = v.name.split('/');
        const baseName = parts.length > 1 ? parts.slice(0, -1).join('/') : v.name;
        setGroupName(baseName);
        setBaseValue(parseFloat(v.value) || 16);

        // Check existing group
        const existingSteps = numberVariables.filter(nv =>
          nv.name.startsWith(baseName + '/')
        );
        setExistingGroup(existingSteps.length > 0);
      }
    }
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
    }
  };

  const handleGenerate = () => {
    if (!groupName || preview.length === 0) return;

    const steps = preview.map(p => ({
      name: `${groupName}/${p.name}`,
      value: String(p.value),
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
      <div className="modal">
        <div className="modal-header">
          <h3>Generate Number Steps</h3>
          <button className="modal-close" onClick={closeStepsModal}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Select Number Variable</label>
            <select
              className="form-input"
              value={sourceNumberId}
              onChange={handleSourceChange}
            >
              <option value="">-- Select a number --</option>
              {numberVariables.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {sourceNumberId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. spacing"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Base Value</label>
                  <input
                    type="number"
                    className="form-input"
                    value={baseValue}
                    onChange={e => setBaseValue(parseFloat(e.target.value) || 0)}
                    min={0}
                    step="any"
                  />
                </div>
                <div className="form-group">
                  <label>Base Step</label>
                  <select
                    className="form-input"
                    value={baseStep}
                    onChange={e => setBaseStep(e.target.value)}
                  >
                    {stepsArray.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
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
                <input
                  type="text"
                  className="form-input mono"
                  value={stepsList}
                  onChange={e => {
                    setStepsList(e.target.value);
                    setStepsPreset('custom');
                  }}
                  style={{ marginTop: 6 }}
                />
              </div>

              <div className="form-group">
                <label>Preview</label>
                <div className="steps-preview">
                  {preview.map(p => (
                    <div key={p.name} className="step-item">
                      <span className="step-name">{p.name}</span>
                      <span className="step-value">{p.value}</span>
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
