// Table rendering component

import { VariableData, VariableType } from '../types';
import { state } from '../state';
import { esc, post } from '../utils/helpers';
import { getTypeIcon, icons } from '../utils/icons';
import { rgbToHex } from '../utils/color';

export function renderCollections(): void {
  const select = document.getElementById('collection-select') as HTMLSelectElement;
  if (!select) return;

  select.innerHTML = state.collections.map(c =>
    `<option value="${c.id}" ${c.id === state.selectedCollectionId ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('') || '<option value="">No collections</option>';
}

export function renderTable(): void {
  const tableBody = document.getElementById('table-body');
  if (!tableBody) return;

  const filtered = state.getFilteredVariables();

  if (!filtered.length) {
    tableBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="3">
          <div class="empty-state">No variables yet</div>
        </td>
      </tr>
    `;
    return;
  }

  // Group variables by their path prefix
  const grouped: Record<string, VariableData[]> = {};
  const ungrouped: VariableData[] = [];

  filtered.forEach(v => {
    const parts = v.name.split('/');
    if (parts.length > 1) {
      const groupName = parts.slice(0, -1).join('/');
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push({ ...v, displayName: parts[parts.length - 1] });
    } else {
      ungrouped.push({ ...v, displayName: v.name });
    }
  });

  const sortedGroups = Object.keys(grouped).sort();

  let html = '';
  let rowIndex = 0;

  // Render ungrouped variables first
  ungrouped.forEach(v => {
    html += renderVariableRow(v, rowIndex++, false);
  });

  // Render grouped variables
  sortedGroups.forEach(groupName => {
    const isCollapsed = state.isGroupCollapsed(groupName);
    const groupIds = grouped[groupName].map(v => v.id).join(',');
    html += `
      <tr class="group-row ${isCollapsed ? 'collapsed' : ''}" data-group="${esc(groupName)}">
        <td colspan="2">
          <div class="group-header">
            <span class="group-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="window.app.toggleGroup('${esc(groupName)}')">${icons.chevronDown}</span>
            <span onclick="window.app.toggleGroup('${esc(groupName)}')" style="flex:1;cursor:pointer;">
              ${esc(groupName)}
              <span style="color:var(--text-dim);font-weight:400;font-size:10px;">(${grouped[groupName].length})</span>
            </span>
            <button class="row-action danger" onclick="window.app.deleteGroup('${groupIds}')" title="Delete group" style="opacity:0;">${icons.close}</button>
          </div>
        </td>
      </tr>
    `;

    grouped[groupName].forEach(v => {
      html += renderVariableRow(v, rowIndex++, true, isCollapsed, groupName);
    });
  });

  tableBody.innerHTML = html;
}

function renderVariableRow(
  v: VariableData,
  i: number,
  isGrouped: boolean,
  isHidden = false,
  groupName = ''
): string {
  const hiddenClass = isHidden ? 'hidden-by-group' : '';
  const groupedClass = isGrouped ? 'grouped-item' : '';
  const dataGroup = groupName ? `data-parent-group="${esc(groupName)}"` : '';

  return `
    <tr data-id="${v.id}" class="${groupedClass} ${hiddenClass}" ${dataGroup} draggable="true">
      <td>
        <div class="name-cell">
          <span class="drag-handle" title="Drag to reorder">${icons.drag}</span>
          <span class="type-icon ${v.resolvedType}">${getTypeIcon(v.resolvedType)}</span>
          <input class="cell-input" value="${esc(v.displayName)}"
            data-full-name="${esc(v.name)}"
            onblur="window.app.updateNameFromDisplay('${v.id}', this.value, '${esc(v.name)}')"
            onkeydown="window.app.handleKey(event, ${i}, 'name')">
        </div>
      </td>
      <td>
        ${renderValueCell(v)}
      </td>
    </tr>
  `;
}

function renderValueCell(v: VariableData): string {
  if (v.resolvedType === 'COLOR') {
    // Check if this is a reference (format: {variableName})
    const refMatch = v.value.match(/^\{(.+)\}$/);
    let displayColor = v.value;

    if (refMatch) {
      // This is a reference - look up the actual color
      const refName = refMatch[1];
      const refVariable = state.variables.find(rv => rv.name === refName);
      if (refVariable && refVariable.resolvedType === 'COLOR') {
        displayColor = refVariable.value;
      } else {
        // Reference not found or invalid, show gray
        displayColor = '#888888';
      }
    }

    return `
      <div class="color-value-cell">
        <div class="color-swatch" onclick="window.app.showColorValueMenu(event, '${v.id}', '${esc(v.value)}')">
          <div class="color-swatch-inner" style="background:${esc(displayColor)}"></div>
        </div>
        <input class="cell-input mono" value="${esc(v.value)}"
          onblur="window.app.updateValue('${v.id}', this.value)">
      </div>
    `;
  }

  if (v.resolvedType === 'BOOLEAN') {
    return `
      <div class="cell">
        <div class="bool-toggle">
          <button class="${v.value === 'true' ? 'active' : ''}" onclick="window.app.updateValue('${v.id}', 'true')">True</button>
          <button class="${v.value === 'false' ? 'active' : ''}" onclick="window.app.updateValue('${v.id}', 'false')">False</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="value-cell">
      <input class="cell-input mono" value="${esc(v.value)}"
        onblur="window.app.updateValue('${v.id}', this.value)">
    </div>
  `;
}
