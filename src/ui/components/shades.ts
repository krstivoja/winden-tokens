// Shades generator component

import { state } from '../state';
import { esc, post } from '../utils/helpers';
import {
  rgbToHex,
  hexToRgb,
  hexToRgbObj,
  lightnessToColor,
  generateShadeColors,
  getShadeNames
} from '../utils/color';
import { openColorPicker } from './colorPicker';

export function initShadesModal(): void {
  const shadesBtn = document.getElementById('shades-btn');
  const shadesModal = document.getElementById('shades-modal');

  if (shadesBtn) {
    shadesBtn.onclick = openShadesModal;
  }

  if (shadesModal) {
    shadesModal.onclick = (e) => {
      if (e.target === shadesModal) closeShadesModal();
    };
  }
}

function openShadesModal(): void {
  populateColorSourceDropdown();
  resetShadesForm();

  const modal = document.getElementById('shades-modal');
  if (modal) modal.classList.add('open');
}

function resetShadesForm(): void {
  const elements = {
    name: document.getElementById('shades-name') as HTMLInputElement,
    baseColor: document.getElementById('shades-base-color') as HTMLInputElement,
    baseHex: document.getElementById('shades-base-hex') as HTMLInputElement,
    basePreview: document.getElementById('shades-base-preview') as HTMLElement,
    lightValue: document.getElementById('shades-light-value') as HTMLInputElement,
    darkValue: document.getElementById('shades-dark-value') as HTMLInputElement,
    count: document.getElementById('shades-count') as HTMLInputElement,
    options: document.getElementById('shades-options') as HTMLElement,
    generateBtn: document.getElementById('shades-generate-btn') as HTMLElement,
    removeBtn: document.getElementById('shades-remove-btn') as HTMLElement
  };

  if (elements.name) elements.name.value = '';
  if (elements.baseColor) elements.baseColor.value = '';
  if (elements.baseHex) elements.baseHex.value = '';
  if (elements.basePreview) elements.basePreview.style.background = 'transparent';
  if (elements.lightValue) elements.lightValue.value = '5';
  if (elements.darkValue) elements.darkValue.value = '90';
  if (elements.count) elements.count.value = '11';
  if (elements.options) elements.options.style.display = 'none';
  if (elements.generateBtn) elements.generateBtn.style.display = 'none';
  if (elements.removeBtn) elements.removeBtn.style.display = 'none';

  clearShadesPreview();
}

function clearShadesPreview(): void {
  const preview = document.getElementById('shades-preview');
  const lightPreview = document.getElementById('shades-light-preview');
  const darkPreview = document.getElementById('shades-dark-preview');

  if (preview) {
    preview.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:8px;text-align:center;">Pick a color to preview shades</div>';
  }
  if (lightPreview) lightPreview.style.background = 'transparent';
  if (darkPreview) darkPreview.style.background = 'transparent';
}

function populateColorSourceDropdown(): void {
  const select = document.getElementById('shades-source') as HTMLSelectElement;
  if (!select) return;

  const colorVars = state.variables.filter(v =>
    v.collectionId === state.selectedCollectionId && v.resolvedType === 'COLOR'
  );

  const groups: Record<string, typeof colorVars> = {};
  const standalone: typeof colorVars = [];

  colorVars.forEach(v => {
    if (v.name.includes('/')) {
      const baseName = v.name.split('/')[0];
      if (!groups[baseName]) groups[baseName] = [];
      groups[baseName].push(v);
    } else {
      standalone.push(v);
    }
  });

  let options = '<option value="">-- Pick a color manually --</option>';

  standalone.forEach(v => {
    options += `<option value="single:${v.id}" data-color="${esc(v.value)}" data-name="${esc(v.name)}" data-type="single">${esc(v.name)}</option>`;
  });

  Object.keys(groups).sort().forEach(groupName => {
    const shades = groups[groupName];
    const midIndex = Math.floor(shades.length / 2);
    const baseShade = shades[midIndex];
    const shadeIds = shades.map(s => s.id).join(',');
    options += `<option value="group:${groupName}" data-color="${esc(baseShade.value)}" data-name="${esc(groupName)}" data-type="group" data-count="${shades.length}" data-ids="${shadeIds}">${esc(groupName)} (${shades.length} shades)</option>`;
  });

  select.innerHTML = options;
}

export function selectSourceColor(): void {
  const select = document.getElementById('shades-source') as HTMLSelectElement;
  const optionsDiv = document.getElementById('shades-options');
  const generateBtn = document.getElementById('shades-generate-btn');
  const removeBtn = document.getElementById('shades-remove-btn');

  if (!select || !optionsDiv || !generateBtn || !removeBtn) return;

  const selected = select.selectedOptions[0];

  if (!selected || !selected.value) {
    optionsDiv.style.display = 'none';
    generateBtn.style.display = 'none';
    removeBtn.style.display = 'none';
    return;
  }

  optionsDiv.style.display = 'flex';
  generateBtn.style.display = 'block';

  const colorValue = selected.dataset.color || '';
  const varName = selected.dataset.name || '';
  const type = selected.dataset.type;

  const nameInput = document.getElementById('shades-name') as HTMLInputElement;
  if (nameInput) nameInput.value = varName;

  const hex = rgbToHex(colorValue);
  const baseColorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const baseHexInput = document.getElementById('shades-base-hex') as HTMLInputElement;
  const basePreview = document.getElementById('shades-base-preview');

  if (baseColorInput) baseColorInput.value = hex;
  if (baseHexInput) baseHexInput.value = hex;
  if (basePreview) basePreview.style.background = hex;

  const lightInput = document.getElementById('shades-light-value') as HTMLInputElement;
  const darkInput = document.getElementById('shades-dark-value') as HTMLInputElement;
  if (lightInput) lightInput.value = '5';
  if (darkInput) darkInput.value = '90';

  if (type === 'group') {
    const count = parseInt(selected.dataset.count || '11');
    const countInput = document.getElementById('shades-count') as HTMLInputElement;
    if (countInput) countInput.value = String(count);
    generateBtn.textContent = 'Update Shades';
    removeBtn.style.display = 'block';
  } else {
    generateBtn.textContent = 'Generate';
    removeBtn.style.display = 'none';
  }

  updateShadesPreview();
}

export function updateBaseFromHex(): void {
  const hexInput = document.getElementById('shades-base-hex') as HTMLInputElement;
  const colorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const preview = document.getElementById('shades-base-preview');

  if (!hexInput || !colorInput) return;

  let hex = hexInput.value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;

  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    colorInput.value = hex;
    if (preview) preview.style.background = hex;
    updateShadesPreview();
  }
}

export function updateShadesPreview(): void {
  const baseColorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const baseColor = baseColorInput?.value;

  if (!baseColor) {
    clearShadesPreview();
    return;
  }

  const lightInput = document.getElementById('shades-light-value') as HTMLInputElement;
  const darkInput = document.getElementById('shades-dark-value') as HTMLInputElement;
  const countInput = document.getElementById('shades-count') as HTMLInputElement;

  const lightValue = parseInt(lightInput?.value || '0') || 0;
  const darkValue = parseInt(darkInput?.value || '100') || 100;
  const count = parseInt(countInput?.value || '11');

  const basePreview = document.getElementById('shades-base-preview');
  const baseHexInput = document.getElementById('shades-base-hex') as HTMLInputElement;
  if (basePreview) basePreview.style.background = baseColor;
  if (baseHexInput) baseHexInput.value = baseColor;

  const baseRgb = hexToRgbObj(baseColor);
  const lightColor = lightnessToColor(baseRgb, lightValue);
  const darkColor = lightnessToColor(baseRgb, darkValue);

  const lightPreview = document.getElementById('shades-light-preview');
  const darkPreview = document.getElementById('shades-dark-preview');
  if (lightPreview) lightPreview.style.background = lightColor;
  if (darkPreview) darkPreview.style.background = darkColor;

  const shades = generateShadeColors(lightValue, darkValue, baseRgb, count);
  const shadesPreview = document.getElementById('shades-preview');
  if (shadesPreview) {
    shadesPreview.innerHTML = shades.map(c =>
      `<div class="shades-preview-item" style="background:${c}" title="${c}"></div>`
    ).join('');
  }
}

export function closeShadesModal(): void {
  const modal = document.getElementById('shades-modal');
  if (modal) modal.classList.remove('open');
}

export function generateShades(): void {
  const nameInput = document.getElementById('shades-name') as HTMLInputElement;
  const baseColorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const name = nameInput?.value.trim();
  const baseColor = baseColorInput?.value;

  if (!baseColor) {
    alert('Please pick a base color');
    return;
  }

  if (!name) {
    alert('Please enter a group name');
    return;
  }

  const select = document.getElementById('shades-source') as HTMLSelectElement;
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

  const lightInput = document.getElementById('shades-light-value') as HTMLInputElement;
  const darkInput = document.getElementById('shades-dark-value') as HTMLInputElement;
  const countInput = document.getElementById('shades-count') as HTMLInputElement;

  const lightValue = parseInt(lightInput?.value || '0') || 0;
  const darkValue = parseInt(darkInput?.value || '100') || 100;
  const count = parseInt(countInput?.value || '11');

  const baseRgb = hexToRgbObj(baseColor);
  const colors = generateShadeColors(lightValue, darkValue, baseRgb, count);
  const names = getShadeNames(count);

  const shades = colors.map((hex, i) => ({
    name: `${name}/${names[i]}`,
    value: hexToRgb(hex)
  }));

  if (deleteIds.length > 0) {
    post({ type: 'update-shades', collectionId: state.selectedCollectionId, deleteIds, shades });
  } else {
    post({ type: 'create-shades', collectionId: state.selectedCollectionId, shades });
  }
  closeShadesModal();
}

export function removeShades(): void {
  const select = document.getElementById('shades-source') as HTMLSelectElement;
  const selected = select?.selectedOptions[0];

  if (!selected || selected.dataset.type !== 'group') return;

  const groupName = selected.dataset.name;
  const shadeIds = selected.dataset.ids?.split(',') || [];
  const baseColorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const baseColor = baseColorInput?.value;

  if (!confirm(`Convert "${groupName}" shades back to a single color?`)) return;

  post({
    type: 'remove-shades',
    collectionId: state.selectedCollectionId,
    deleteIds: shadeIds,
    newColor: {
      name: groupName,
      value: hexToRgb(baseColor)
    }
  });
  closeShadesModal();
}

export function openShadesColorPicker(): void {
  const currentHexInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const currentHex = currentHexInput?.value || '#000000';

  openColorPicker(currentHex, (hex) => {
    const colorInput = document.getElementById('shades-base-color') as HTMLInputElement;
    const hexInput = document.getElementById('shades-base-hex') as HTMLInputElement;
    const preview = document.getElementById('shades-base-preview');

    if (colorInput) colorInput.value = hex;
    if (hexInput) hexInput.value = hex;
    if (preview) preview.style.background = hex;
    updateShadesPreview();
  });
}
