// Number steps generator component

import { state } from '../state';
import { esc, post } from '../utils/helpers';

// Steps presets with their values and default base step
const STEPS_PRESETS: Record<string, { steps: string; baseStep: string }> = {
  tshirt: { steps: 'xs, sm, md, lg, xl, 2xl, 3xl', baseStep: 'md' },
  numeric: { steps: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10', baseStep: '5' },
  gutenberg: { steps: 'xs, sm, base, md, lg, giga, mega, ultra', baseStep: 'base' }
};

export function initStepsModal(): void {
  const stepsBtn = document.getElementById('steps-btn');
  const stepsModal = document.getElementById('steps-modal');

  if (stepsBtn) {
    stepsBtn.onclick = openStepsModal;
  }

  if (stepsModal) {
    stepsModal.onclick = (e) => {
      if (e.target === stepsModal) closeStepsModal();
    };
  }
}

function openStepsModal(): void {
  populateNumberSourceDropdown();
  resetStepsForm();

  const modal = document.getElementById('steps-modal');
  if (modal) modal.classList.add('open');

  updateStepsPreview();
}

function resetStepsForm(): void {
  const elements = {
    options: document.getElementById('steps-options'),
    name: document.getElementById('steps-name') as HTMLInputElement,
    baseValue: document.getElementById('steps-base-value') as HTMLInputElement,
    ratioPreset: document.getElementById('steps-ratio-preset') as HTMLSelectElement,
    ratioCustom: document.getElementById('steps-ratio-custom') as HTMLInputElement,
    stepsListPreset: document.getElementById('steps-list-preset') as HTMLSelectElement,
    stepsList: document.getElementById('steps-list') as HTMLInputElement,
    generateBtn: document.getElementById('steps-generate-btn') as HTMLElement,
    removeBtn: document.getElementById('steps-remove-btn') as HTMLElement
  };

  if (elements.options) elements.options.style.display = 'none';
  if (elements.name) elements.name.value = '';
  if (elements.baseValue) elements.baseValue.value = '16';
  if (elements.ratioPreset) elements.ratioPreset.value = '1.25';
  if (elements.ratioCustom) {
    elements.ratioCustom.value = '1.25';
    elements.ratioCustom.disabled = true;
  }
  if (elements.stepsListPreset) elements.stepsListPreset.value = 'tshirt';
  if (elements.stepsList) elements.stepsList.value = 'xs, sm, md, lg, xl, 2xl, 3xl';
  if (elements.generateBtn) elements.generateBtn.textContent = 'Generate';
  if (elements.removeBtn) elements.removeBtn.style.display = 'none';

  populateBaseStepDropdown('md');
}

function populateNumberSourceDropdown(): void {
  const select = document.getElementById('steps-source') as HTMLSelectElement;
  if (!select) return;

  const numberVars = state.variables.filter(v =>
    v.collectionId === state.selectedCollectionId && v.resolvedType === 'FLOAT'
  );

  // Group numbers by their base name (before /)
  const groups: Record<string, typeof numberVars> = {};
  const standalone: typeof numberVars = [];

  numberVars.forEach(v => {
    if (v.name.includes('/')) {
      const baseName = v.name.split('/')[0];
      if (!groups[baseName]) groups[baseName] = [];
      groups[baseName].push(v);
    } else {
      standalone.push(v);
    }
  });

  let options = '<option value="">-- Create new scale --</option>';

  // Add standalone numbers
  standalone.forEach(v => {
    options += `<option value="single:${v.id}" data-value="${esc(v.value)}" data-name="${esc(v.name)}" data-type="single">${esc(v.name)} (${v.value})</option>`;
  });

  // Add grouped numbers
  Object.keys(groups).sort().forEach(groupName => {
    const steps = groups[groupName];
    // Find a middle value to display
    const midIndex = Math.floor(steps.length / 2);
    const baseStep = steps[midIndex];
    const stepIds = steps.map(s => s.id).join(',');
    options += `<option value="group:${groupName}" data-value="${esc(baseStep.value)}" data-name="${esc(groupName)}" data-type="group" data-count="${steps.length}" data-ids="${stepIds}">${esc(groupName)} (${steps.length} steps)</option>`;
  });

  select.innerHTML = options;
}

export function selectSourceNumber(): void {
  const select = document.getElementById('steps-source') as HTMLSelectElement;
  const options = document.getElementById('steps-options');
  const generateBtn = document.getElementById('steps-generate-btn');
  const removeBtn = document.getElementById('steps-remove-btn');

  if (!select || !options || !generateBtn || !removeBtn) return;

  const selected = select.selectedOptions[0];

  if (!selected || !selected.value) {
    options.style.display = 'none';
    generateBtn.textContent = 'Generate';
    removeBtn.style.display = 'none';
    return;
  }

  // Show options
  options.style.display = 'flex';

  const varName = selected.dataset.name || '';
  const varValue = selected.dataset.value || '16';
  const type = selected.dataset.type;

  const nameInput = document.getElementById('steps-name') as HTMLInputElement;
  const baseValueInput = document.getElementById('steps-base-value') as HTMLInputElement;

  if (nameInput) nameInput.value = varName;
  if (baseValueInput) baseValueInput.value = varValue;

  if (type === 'group') {
    generateBtn.textContent = 'Update Steps';
    removeBtn.style.display = 'block';
  } else {
    generateBtn.textContent = 'Generate';
    removeBtn.style.display = 'none';
  }

  updateStepsPreview();
}

export function selectRatioPreset(): void {
  const presetSelect = document.getElementById('steps-ratio-preset') as HTMLSelectElement;
  const customInput = document.getElementById('steps-ratio-custom') as HTMLInputElement;

  if (!presetSelect || !customInput) return;

  const value = presetSelect.value;
  if (value === 'custom') {
    customInput.disabled = false;
    customInput.focus();
  } else {
    customInput.value = value;
    customInput.disabled = true;
  }

  updateStepsPreview();
}

function populateBaseStepDropdown(selectedValue?: string): void {
  const baseStepSelect = document.getElementById('steps-base-step') as HTMLSelectElement;
  const stepsListInput = document.getElementById('steps-list') as HTMLInputElement;

  if (!baseStepSelect || !stepsListInput) return;

  const stepsList = stepsListInput.value.split(',').map(s => s.trim()).filter(s => s);

  // Build options
  let options = '';
  stepsList.forEach(step => {
    const selected = step === selectedValue ? ' selected' : '';
    options += `<option value="${esc(step)}"${selected}>${esc(step)}</option>`;
  });

  baseStepSelect.innerHTML = options;

  // If selectedValue not found, select middle step
  if (selectedValue && !stepsList.includes(selectedValue) && stepsList.length > 0) {
    const midIndex = Math.floor(stepsList.length / 2);
    baseStepSelect.value = stepsList[midIndex];
  }
}

export function selectStepsPreset(): void {
  const presetSelect = document.getElementById('steps-list-preset') as HTMLSelectElement;
  const stepsListInput = document.getElementById('steps-list') as HTMLInputElement;

  if (!presetSelect || !stepsListInput) return;

  const presetKey = presetSelect.value;
  const preset = STEPS_PRESETS[presetKey];

  if (preset) {
    stepsListInput.value = preset.steps;
    populateBaseStepDropdown(preset.baseStep);
  }

  updateStepsPreview();
}

export function onStepsListInput(): void {
  // When user edits the steps list, switch to custom preset
  const presetSelect = document.getElementById('steps-list-preset') as HTMLSelectElement;
  if (presetSelect) {
    presetSelect.value = 'custom';
  }
  // Keep current selection if still valid, otherwise select middle
  const baseStepSelect = document.getElementById('steps-base-step') as HTMLSelectElement;
  const currentBase = baseStepSelect?.value;
  populateBaseStepDropdown(currentBase);
  updateStepsPreview();
}

export function closeStepsModal(): void {
  const modal = document.getElementById('steps-modal');
  if (modal) modal.classList.remove('open');
}

export function updateStepsPreview(): void {
  const baseValueInput = document.getElementById('steps-base-value') as HTMLInputElement;
  const baseStepSelect = document.getElementById('steps-base-step') as HTMLSelectElement;
  const ratioInput = document.getElementById('steps-ratio-custom') as HTMLInputElement;
  const stepsListInput = document.getElementById('steps-list') as HTMLInputElement;
  const preview = document.getElementById('steps-preview');

  if (!baseValueInput || !baseStepSelect || !ratioInput || !stepsListInput || !preview) return;

  const baseValue = parseFloat(baseValueInput.value) || 16;
  const baseStep = baseStepSelect.value || '';
  const ratio = parseFloat(ratioInput.value) || 1.25;
  const stepsList = stepsListInput.value.split(',').map(s => s.trim()).filter(s => s);

  if (stepsList.length === 0) {
    preview.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:8px;text-align:center;">Enter step names</div>';
    return;
  }

  // Find base step index
  const baseStepIndex = stepsList.indexOf(baseStep);
  if (baseStepIndex === -1) {
    preview.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:8px;text-align:center;">Select a base step</div>';
    return;
  }

  // Calculate values
  const values = stepsList.map((step, i) => {
    const stepsFromBase = i - baseStepIndex;
    const value = baseValue * Math.pow(ratio, stepsFromBase);
    return { step, value: Math.round(value) };
  });

  // Render preview
  preview.innerHTML = `
    <div class="steps-preview-list">
      ${values.map(({ step, value }) => `
        <div class="steps-preview-item ${step === baseStep ? 'base' : ''}">
          <span class="step-name">${esc(step)}</span>
          <span class="step-value">${value}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function getStepNames(): string[] {
  const stepsListInput = document.getElementById('steps-list') as HTMLInputElement;
  if (!stepsListInput) return [];
  return stepsListInput.value.split(',').map(s => s.trim()).filter(s => s);
}

function calculateStepValues(): { step: string; value: number }[] {
  const baseValueInput = document.getElementById('steps-base-value') as HTMLInputElement;
  const baseStepSelect = document.getElementById('steps-base-step') as HTMLSelectElement;
  const ratioInput = document.getElementById('steps-ratio-custom') as HTMLInputElement;

  const baseValue = parseFloat(baseValueInput?.value || '16');
  const baseStep = baseStepSelect?.value || '';
  const ratio = parseFloat(ratioInput?.value || '1.25');
  const stepsList = getStepNames();

  const baseStepIndex = stepsList.indexOf(baseStep);
  if (baseStepIndex === -1) return [];

  return stepsList.map((step, i) => {
    const stepsFromBase = i - baseStepIndex;
    const value = baseValue * Math.pow(ratio, stepsFromBase);
    return { step, value: Math.round(value) };
  });
}

export function generateSteps(): void {
  const nameInput = document.getElementById('steps-name') as HTMLInputElement;
  const name = nameInput?.value.trim();

  if (!name) {
    alert('Please enter a group name');
    return;
  }

  const values = calculateStepValues();
  if (values.length === 0) {
    alert('Please check your step configuration');
    return;
  }

  const select = document.getElementById('steps-source') as HTMLSelectElement;
  const selected = select?.selectedOptions[0];
  const isUpdate = selected && selected.dataset.type === 'group';
  const isSingle = selected && selected.dataset.type === 'single';

  let deleteIds: string[] = [];
  if (isUpdate && selected.dataset.ids) {
    deleteIds = selected.dataset.ids.split(',');
  } else if (isSingle && selected.value) {
    const singleId = selected.value.replace('single:', '');
    deleteIds = [singleId];
  }

  const steps = values.map(({ step, value }) => ({
    name: `${name}/${step}`,
    value: String(value)
  }));

  if (deleteIds.length > 0) {
    post({ type: 'update-steps', collectionId: state.selectedCollectionId, deleteIds, steps });
  } else {
    post({ type: 'create-steps', collectionId: state.selectedCollectionId, steps });
  }
  closeStepsModal();
}

export function removeSteps(): void {
  const select = document.getElementById('steps-source') as HTMLSelectElement;
  const selected = select?.selectedOptions[0];

  if (!selected || selected.dataset.type !== 'group') return;

  const groupName = selected.dataset.name;
  const stepIds = selected.dataset.ids?.split(',') || [];
  const baseValueInput = document.getElementById('steps-base-value') as HTMLInputElement;
  const baseValue = baseValueInput?.value || '16';

  if (!confirm(`Convert "${groupName}" steps back to a single number?`)) return;

  post({
    type: 'remove-steps',
    collectionId: state.selectedCollectionId,
    deleteIds: stepIds,
    newNumber: {
      name: groupName,
      value: baseValue
    }
  });
  closeStepsModal();
}
