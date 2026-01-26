// Shades generator component

import { state } from '../state';
import { esc, post } from '../utils/helpers';
import {
  rgbToHex,
  hexToRgb,
  hexToRgbObj,
  lightnessToColor,
  getShadeNames,
  rgbToHsv,
  hsvToRgb,
  RGB
} from '../utils/color';
import { openColorPicker } from './colorPicker';

// Curve state - 2 handles + start/end points control the overall curve shape
interface CurveHandles {
  startValue: number;                     // First node Y value
  handle1: { t: number; value: number };  // First handle (near start)
  handle2: { t: number; value: number };  // Second handle (near end)
  endValue: number;                       // Last node Y value
}

// Default handles create a flat line (no adjustment)
function createDefaultHandles(): CurveHandles {
  return {
    startValue: 0,
    handle1: { t: 0.25, value: 0 },
    handle2: { t: 0.75, value: 0 },
    endValue: 0
  };
}

let lightnessCurve: CurveHandles = createDefaultHandles();
let saturationCurve: CurveHandles = createDefaultHandles();
let hueCurve: CurveHandles = createDefaultHandles();

type DragTarget = 'handle1' | 'handle2' | 'startNode' | 'endNode';
let dragState: { startY: number; startValue: number; property: string; target: DragTarget } | null = null;

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
    removeBtn: document.getElementById('shades-remove-btn') as HTMLElement,
    curveProperty: document.getElementById('shades-curve-property') as HTMLSelectElement
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
  if (elements.curveProperty) elements.curveProperty.value = 'lightness';

  // Reset all curve adjustments
  lightnessCurve = createDefaultHandles();
  saturationCurve = createDefaultHandles();
  hueCurve = createDefaultHandles();

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
  const propertySelect = document.getElementById('shades-curve-property') as HTMLSelectElement;

  const lightValue = parseInt(lightInput?.value || '0') || 0;
  const darkValue = parseInt(darkInput?.value || '100') || 100;
  const count = parseInt(countInput?.value || '11');
  const property = propertySelect?.value || 'lightness';

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

  // Generate adjustment values from curves
  const lightAdj = evaluateCurveAtNodes(lightnessCurve, count);
  const satAdj = evaluateCurveAtNodes(saturationCurve, count);
  const hueAdj = evaluateCurveAtNodes(hueCurve, count);
  const shades = generateShadeColorsWithAllCurves(lightValue, darkValue, baseRgb, count, lightAdj, satAdj, hueAdj);
  const shadesPreview = document.getElementById('shades-preview');
  if (shadesPreview) {
    shadesPreview.innerHTML = shades.map(c =>
      `<div class="shades-preview-item" style="background:${c}" title="${c}"></div>`
    ).join('');
  }

  // Update curve editor
  renderCurve();
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
  const propertySelect = document.getElementById('shades-curve-property') as HTMLSelectElement;

  const lightValue = parseInt(lightInput?.value || '0') || 0;
  const darkValue = parseInt(darkInput?.value || '100') || 100;
  const count = parseInt(countInput?.value || '11');
  const property = propertySelect?.value || 'lightness';

  const baseRgb = hexToRgbObj(baseColor);
  // Use all curve adjustments when generating final colors
  const lightAdj = evaluateCurveAtNodes(lightnessCurve, count);
  const satAdj = evaluateCurveAtNodes(saturationCurve, count);
  const hueAdj = evaluateCurveAtNodes(hueCurve, count);
  const colors = generateShadeColorsWithAllCurves(lightValue, darkValue, baseRgb, count, lightAdj, satAdj, hueAdj);
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

// Helper to get current curve based on property
function getCurrentCurve(property: string): CurveHandles {
  switch (property) {
    case 'saturation': return saturationCurve;
    case 'hue': return hueCurve;
    default: return lightnessCurve;
  }
}

function setCurrentCurve(property: string, curve: CurveHandles): void {
  switch (property) {
    case 'saturation': saturationCurve = curve; break;
    case 'hue': hueCurve = curve; break;
    default: lightnessCurve = curve; break;
  }
}

// Evaluate a cubic bezier curve at parameter t (0-1)
// The curve goes from (0, startValue) through handle1 and handle2 to (1, endValue)
function evaluateCubicBezier(handles: CurveHandles, t: number): number {
  // Control points: P0=(0, startValue), P1=handle1, P2=handle2, P3=(1, endValue)
  const p0y = handles.startValue;
  const p1y = handles.handle1.value;
  const p2y = handles.handle2.value;
  const p3y = handles.endValue;

  // Cubic bezier formula
  const mt = 1 - t;
  return mt * mt * mt * p0y +
         3 * mt * mt * t * p1y +
         3 * mt * t * t * p2y +
         t * t * t * p3y;
}

// Get adjustment values for each node by evaluating the curve
function evaluateCurveAtNodes(handles: CurveHandles, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    values.push(evaluateCubicBezier(handles, t));
  }
  return values;
}

// Curve editor functions
export function updateCurveEditor(): void {
  updateShadesPreview();
}

function renderCurve(): void {
  const svg = document.getElementById('shades-curve-svg') as SVGElement;
  const container = document.getElementById('shades-curve-editor');
  const propertySelect = document.getElementById('shades-curve-property') as HTMLSelectElement;
  const countInput = document.getElementById('shades-count') as HTMLInputElement;

  if (!svg || !container) return;

  const property = propertySelect?.value || 'lightness';
  const curve = getCurrentCurve(property);
  const count = parseInt(countInput?.value || '11');
  if (count < 2) return;

  // Get container width for responsive layout
  const containerWidth = container.offsetWidth || 300;
  const curveHeight = 100;
  const nodeRadius = 8;
  const handleRadius = 6;

  // Set SVG dimensions
  svg.setAttribute('viewBox', `0 0 ${containerWidth} ${curveHeight}`);
  svg.style.width = containerWidth + 'px';
  svg.style.height = curveHeight + 'px';

  // Calculate positions - NO padding for nodes to align with swatches below
  const swatchWidth = containerWidth / count;
  const midY = curveHeight / 2;
  const maxY = curveHeight - 10;
  const minY = 10;
  const valueRange = midY - 15; // Range for mapping values to Y

  // Build SVG content
  let svgContent = '';

  // Middle line (zero adjustment baseline)
  svgContent += `<line x1="0" y1="${midY}" x2="${containerWidth}" y2="${midY}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>`;

  // Calculate node positions from curve evaluation - centered above each swatch
  const adjustments = evaluateCurveAtNodes(curve, count);
  const nodePositions: { x: number; y: number; value: number }[] = [];

  for (let i = 0; i < count; i++) {
    const x = swatchWidth * i + swatchWidth / 2;
    const value = adjustments[i];
    const y = midY - (value / 50) * valueRange;
    nodePositions.push({ x, y, value });
  }

  // Calculate handle screen positions (between nodes, fixed X based on t value)
  const firstNode = nodePositions[0];
  const lastNode = nodePositions[count - 1];

  // Handle 1: fixed X position between first and second node
  const handle1X = firstNode.x + swatchWidth * 0.7;
  const handle1Y = Math.max(minY, Math.min(maxY, midY - (curve.handle1.value / 50) * valueRange));

  // Handle 2: fixed X position between second-to-last and last node
  const handle2X = lastNode.x - swatchWidth * 0.7;
  const handle2Y = Math.max(minY, Math.min(maxY, midY - (curve.handle2.value / 50) * valueRange));

  // Draw a smooth curve THROUGH all nodes using Catmull-Rom style
  if (nodePositions.length > 1) {
    let path = `M ${nodePositions[0].x} ${nodePositions[0].y}`;

    for (let i = 0; i < nodePositions.length - 1; i++) {
      const p0 = nodePositions[Math.max(0, i - 1)];
      const p1 = nodePositions[i];
      const p2 = nodePositions[i + 1];
      const p3 = nodePositions[Math.min(nodePositions.length - 1, i + 2)];

      // Catmull-Rom to cubic bezier control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    svgContent += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  }

  // Draw handle lines
  svgContent += `<line x1="${firstNode.x}" y1="${firstNode.y}" x2="${handle1X}" y2="${handle1Y}" stroke="var(--text-dim)" stroke-width="1"/>`;
  svgContent += `<line x1="${lastNode.x}" y1="${lastNode.y}" x2="${handle2X}" y2="${handle2Y}" stroke="var(--text-dim)" stroke-width="1"/>`;

  // Draw handles (draggable)
  svgContent += `<circle cx="${handle1X}" cy="${handle1Y}" r="${handleRadius}" fill="var(--text)" class="curve-handle" data-target="handle1" style="cursor:grab;"/>`;
  svgContent += `<circle cx="${handle2X}" cy="${handle2Y}" r="${handleRadius}" fill="var(--text)" class="curve-handle" data-target="handle2" style="cursor:grab;"/>`;

  // Draw nodes - first and last are draggable (up/down only)
  nodePositions.forEach((np, i) => {
    const isFirstOrLast = i === 0 || i === nodePositions.length - 1;
    const target = i === 0 ? 'startNode' : (i === nodePositions.length - 1 ? 'endNode' : '');
    if (isFirstOrLast) {
      svgContent += `<circle cx="${np.x}" cy="${np.y}" r="${nodeRadius}" fill="var(--bg)" stroke="var(--accent)" stroke-width="2" class="curve-node-draggable" data-target="${target}" style="cursor:ns-resize;"/>`;
    } else {
      svgContent += `<circle cx="${np.x}" cy="${np.y}" r="${nodeRadius}" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>`;
    }
  });

  svg.innerHTML = svgContent;

  // Add drag handlers only for handles
  svg.querySelectorAll('.curve-handle').forEach(el => {
    (el as SVGElement).addEventListener('mousedown', onHandleMouseDown);
  });
}

function onHandleMouseDown(e: Event): void {
  const mouseEvent = e as MouseEvent;
  const target = mouseEvent.target as SVGElement;
  const targetType = target.dataset.target as DragTarget;
  const propertySelect = document.getElementById('shades-curve-property') as HTMLSelectElement;
  const property = propertySelect?.value || 'lightness';
  const curve = getCurrentCurve(property);

  const startValue = targetType === 'handle1' ? curve.handle1.value : curve.handle2.value;

  dragState = {
    startY: mouseEvent.clientY,
    startValue,
    property,
    target: targetType
  };

  document.addEventListener('mousemove', onHandleMouseMove);
  document.addEventListener('mouseup', onHandleMouseUp);
  e.preventDefault();
}

function onHandleMouseMove(e: MouseEvent): void {
  if (!dragState) return;

  const deltaY = dragState.startY - e.clientY;
  // Scale: 50px drag = 50 units change
  const deltaValue = (deltaY / 50) * 50;
  const newValue = Math.max(-50, Math.min(50, dragState.startValue + deltaValue));

  // Update the curve handle value
  const curve = getCurrentCurve(dragState.property);
  const updatedCurve = { ...curve };
  if (dragState.target === 'handle1') {
    updatedCurve.handle1 = { ...curve.handle1, value: newValue };
  } else {
    updatedCurve.handle2 = { ...curve.handle2, value: newValue };
  }
  setCurrentCurve(dragState.property, updatedCurve);

  renderCurve();
  updateShadesPreviewWithCurve();
}

function onHandleMouseUp(): void {
  dragState = null;
  document.removeEventListener('mousemove', onHandleMouseMove);
  document.removeEventListener('mouseup', onHandleMouseUp);
}

function updateShadesPreviewWithCurve(): void {
  const baseColorInput = document.getElementById('shades-base-color') as HTMLInputElement;
  const baseColor = baseColorInput?.value;
  if (!baseColor) return;

  const lightInput = document.getElementById('shades-light-value') as HTMLInputElement;
  const darkInput = document.getElementById('shades-dark-value') as HTMLInputElement;
  const countInput = document.getElementById('shades-count') as HTMLInputElement;

  const lightValue = parseInt(lightInput?.value || '0');
  const darkValue = parseInt(darkInput?.value || '100');
  const count = parseInt(countInput?.value || '11');

  const baseRgb = hexToRgbObj(baseColor);
  const lightAdj = evaluateCurveAtNodes(lightnessCurve, count);
  const satAdj = evaluateCurveAtNodes(saturationCurve, count);
  const hueAdj = evaluateCurveAtNodes(hueCurve, count);
  const shades = generateShadeColorsWithAllCurves(lightValue, darkValue, baseRgb, count, lightAdj, satAdj, hueAdj);

  const shadesPreview = document.getElementById('shades-preview');
  if (shadesPreview) {
    shadesPreview.innerHTML = shades.map(c =>
      `<div class="shades-preview-item" style="background:${c}" title="${c}"></div>`
    ).join('');
  }
}

export function generateShadeColorsWithAllCurves(
  lightValue: number,
  darkValue: number,
  baseRgb: RGB,
  count: number,
  lightAdj: number[],
  satAdj: number[],
  hueAdj: number[]
): string[] {
  const shades: string[] = [];
  const baseHsv = rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const baseLightness = lightValue + (darkValue - lightValue) * t;

    // Apply all adjustments
    const lightness = Math.max(0, Math.min(100, baseLightness + (lightAdj[i] || 0)));
    const saturation = Math.max(0, Math.min(100, baseHsv.s + (satAdj[i] || 0)));
    const hue = (baseHsv.h + (hueAdj[i] || 0) + 360) % 360;

    // Generate color: first apply hue/saturation, then lightness
    const rgb = hsvToRgb(hue, saturation, baseHsv.v);
    shades.push(lightnessToColor(rgb, lightness));
  }

  return shades;
}

export function resetCurveAdjustments(): void {
  lightnessCurve = createDefaultHandles();
  saturationCurve = createDefaultHandles();
  hueCurve = createDefaultHandles();
}
