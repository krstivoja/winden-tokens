// Main entry point for the UI

import './styles/main.scss';
import { state } from './state';
import { renderCollections, renderTable } from './components/table';
import { initColorPicker, openColorPicker, closeColorPicker, confirmColorPicker } from './components/colorPicker';
import {
  initShadesModal,
  selectSourceColor,
  updateBaseFromHex,
  updateShadesPreview,
  closeShadesModal,
  generateShades,
  removeShades,
  openShadesColorPicker,
  updateCurveEditor
} from './components/shades';
import {
  initStepsModal,
  selectSourceNumber,
  selectRatioPreset,
  selectStepsPreset,
  onStepsListInput,
  onBaseStepChange,
  updateStepsPreview,
  closeStepsModal,
  generateSteps,
  removeSteps
} from './components/steps';
import { initModals, showInputModal, closeInputModal } from './components/modals';
import { post, $, esc } from './utils/helpers';
import { hexToRgb } from './utils/color';
import { icons, typeIcons } from './utils/icons';
import { VariableType } from './types';

// Inject icons into placeholders
function initIcons(): void {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = (el as HTMLElement).dataset.icon;
    if (!iconName) return;

    // Handle type icons (type-COLOR, type-FLOAT, etc.)
    if (iconName.startsWith('type-')) {
      const typeName = iconName.replace('type-', '') as VariableType;
      el.innerHTML = typeIcons[typeName] || '';
    } else {
      // Handle UI icons
      el.innerHTML = (icons as Record<string, string>)[iconName] || '';
    }
  });
}

// Initialize application
function init(): void {
  initIcons();
  initColorPicker();
  initShadesModal();
  initStepsModal();
  initModals();
  initColorReferenceModal();
  initTabs();
  initToolbar();
  initResize();
  initCollectionSelect();
  initAddMenu();
  initColorValueMenu();
  initDragDrop();

  // Expose app methods to window for inline handlers
  (window as any).app = {
    showAddMenu,
    showColorValueMenu,
    toggleGroup,
    deleteGroup,
    deleteVariable,
    duplicateVariable,
    updateNameFromDisplay,
    updateValue,
    handleKey,
    openColorPickerForVariable,
    closeColorReferenceModal,
    filterColorReferences,
    handleColorReferenceSearchKey,
    // Shades
    selectSourceColor,
    updateBaseFromHex,
    updateShadesPreview,
    closeShadesModal,
    generateShades,
    removeShades,
    openShadesColorPicker,
    updateCurveEditor,
    // Steps
    selectSourceNumber,
    selectRatioPreset,
    selectStepsPreset,
    onStepsListInput,
    onBaseStepChange,
    updateStepsPreview,
    closeStepsModal,
    generateSteps,
    removeSteps,
    // Bulk edit
    openBulkEdit,
    closeBulkEdit,
    applyBulkEdit,
    // Common
    closeColorPicker,
    confirmColorPicker,
    closeInputModal
  };
}

// Tab switching
function initTabs(): void {
  document.querySelectorAll('.tab').forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = (tab as HTMLElement).dataset.tab + '-tab';
      $(`${tabId}`)?.classList.add('active');
      if ((tab as HTMLElement).dataset.tab === 'json') updateJson();
    };
  });
}

// Toolbar buttons
function initToolbar(): void {
  const refreshBtn = $('refresh-btn');
  const addCollectionBtn = $('add-collection-btn');
  const expandBtn = $('expand-btn');
  const searchInput = $('search-input') as HTMLInputElement;

  if (refreshBtn) {
    refreshBtn.onclick = () => post({ type: 'refresh' });
  }

  if (addCollectionBtn) {
    addCollectionBtn.onclick = () => {
      showInputModal('New Collection', 'Collection name', 'Create', (name) => {
        post({ type: 'create-collection', name });
      });
    };
  }

  if (expandBtn) {
    expandBtn.onclick = toggleExpand;
  }

  if (searchInput) {
    searchInput.oninput = () => {
      state.setSearchQuery(searchInput.value);
      renderTable();
      updateSearchCount();
    };

    // Clear search on Escape
    searchInput.onkeydown = (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        state.setSearchQuery('');
        renderTable();
        updateSearchCount();
      }
    };
  }
}

function updateSearchCount(): void {
  const countEl = $('search-count');
  if (!countEl) return;

  const { shown, total } = state.getFilteredCount();

  if (state.searchQuery) {
    countEl.textContent = `${shown}/${total}`;
  } else {
    countEl.textContent = '';
  }
}

// Collection select
function initCollectionSelect(): void {
  const select = $('collection-select') as HTMLSelectElement;
  if (select) {
    select.onchange = () => {
      state.selectedCollectionId = select.value;
      renderTable();
      updateSearchCount();
    };
  }
}

// Add menu
const addMenu = $('add-menu');

function initAddMenu(): void {
  const addVariableBtn = $('add-variable-btn');
  if (addVariableBtn) {
    addVariableBtn.onclick = showAddMenu;
  }

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#add-menu') &&
        !target.closest('#add-variable-btn') &&
        !target.closest('.add-row-btn')) {
      addMenu?.classList.remove('open');
    }
  });

  addMenu?.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const type = (btn as HTMLElement).dataset.type;
      addMenu?.classList.remove('open');
      showInputModal('New Variable', 'Variable name', 'Create', (name) => {
        let value = '';
        if (type === 'COLOR') value = 'rgb(0, 0, 0)';
        else if (type === 'FLOAT') value = '0';
        else if (type === 'BOOLEAN') value = 'true';
        post({ type: 'create-variable', collectionId: state.selectedCollectionId, name, varType: type, value });
      });
    };
  });
}

function showAddMenu(e: Event): void {
  const target = e.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  if (addMenu) {
    addMenu.style.top = (rect.bottom + 4) + 'px';
    addMenu.style.left = rect.left + 'px';
    addMenu.classList.add('open');
  }
}

// Color value menu
const colorValueMenu = $('color-value-menu');
let currentColorVariableId = '';
let currentColorValue = '';

function initColorValueMenu(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#color-value-menu') &&
        !target.closest('.color-swatch')) {
      colorValueMenu?.classList.remove('open');
    }
  });

  colorValueMenu?.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const action = (btn as HTMLElement).dataset.action;
      colorValueMenu?.classList.remove('open');

      if (action === 'pick') {
        openColorPickerForVariable(currentColorVariableId, currentColorValue);
      } else if (action === 'reference') {
        showColorReferenceModal();
      }
    };
  });
}

function showColorValueMenu(e: Event, id: string, value: string): void {
  e.stopPropagation();
  const target = e.target as HTMLElement;
  const swatch = target.closest('.color-swatch') as HTMLElement;
  if (!swatch) return;

  const rect = swatch.getBoundingClientRect();
  currentColorVariableId = id;
  currentColorValue = value;

  if (colorValueMenu) {
    colorValueMenu.style.top = (rect.bottom + 4) + 'px';
    colorValueMenu.style.left = rect.left + 'px';
    colorValueMenu.classList.add('open');
  }
}

function showColorReferenceModal(): void {
  const colorVariables = state.variables.filter(v =>
    v.resolvedType === 'COLOR' && v.id !== currentColorVariableId
  );

  if (colorVariables.length === 0) {
    alert('No other color variables available to reference');
    return;
  }

  // Group colors by prefix
  const grouped: Record<string, typeof colorVariables> = {};
  const ungrouped: typeof colorVariables = [];

  colorVariables.forEach(v => {
    const parts = v.name.split('/');
    if (parts.length > 1) {
      const groupName = parts.slice(0, -1).join('/');
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(v);
    } else {
      ungrouped.push(v);
    }
  });

  const list = $('color-reference-list');
  if (!list) return;

  let html = '';

  // Render ungrouped colors
  if (ungrouped.length > 0) {
    html += '<div class="color-reference-group" data-group="">';
    if (Object.keys(grouped).length > 0) {
      html += '<div class="color-reference-group-header">Variables</div>';
    }
    ungrouped.forEach(v => {
      html += renderColorReferenceItem(v);
    });
    html += '</div>';
  }

  // Render grouped colors
  Object.keys(grouped).sort().forEach(groupName => {
    html += `<div class="color-reference-group" data-group="${esc(groupName)}">`;
    html += `<div class="color-reference-group-header">${esc(groupName)}</div>`;
    grouped[groupName].forEach(v => {
      html += renderColorReferenceItem(v);
    });
    html += '</div>';
  });

  list.innerHTML = html;

  // Add click handlers
  list.querySelectorAll('.color-reference-item').forEach(item => {
    item.addEventListener('click', () => {
      const varName = (item as HTMLElement).dataset.name;
      if (varName) {
        updateValue(currentColorVariableId, `{${varName}}`);
        closeColorReferenceModal();
      }
    });
  });

  // Check if current value is a reference and highlight it
  const refMatch = currentColorValue.match(/^\{(.+)\}$/);
  if (refMatch) {
    const currentRefName = refMatch[1];
    const selectedItem = list.querySelector(`.color-reference-item[data-name="${currentRefName}"]`) as HTMLElement;
    if (selectedItem) {
      selectedItem.classList.add('selected');
      // Scroll into view after modal is visible
      setTimeout(() => {
        selectedItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  }

  // Show modal
  const modal = $('color-reference-modal');
  if (modal) modal.classList.add('open');

  // Clear and focus search
  const search = $('color-reference-search') as HTMLInputElement;
  if (search) {
    search.value = '';
    setTimeout(() => search.focus(), 50);
  }
}

function renderColorReferenceItem(v: any): string {
  const displayName = v.name.includes('/') ? v.name.split('/').pop() : v.name;

  // Check if this color is also a reference
  const refMatch = v.value.match(/^\{(.+)\}$/);
  let displayColor = v.value;

  if (refMatch) {
    const refName = refMatch[1];
    const refVariable = state.variables.find(rv => rv.name === refName);
    if (refVariable && refVariable.resolvedType === 'COLOR') {
      displayColor = refVariable.value;
    } else {
      displayColor = '#888888';
    }
  }

  return `
    <div class="color-reference-item" data-name="${esc(v.name)}" data-search="${esc(v.name.toLowerCase())}">
      <div class="color-reference-swatch">
        <div class="color-reference-swatch-inner" style="background:${esc(displayColor)}"></div>
      </div>
      <span class="color-reference-name">${esc(displayName)}</span>
    </div>
  `;
}

function closeColorReferenceModal(): void {
  const modal = $('color-reference-modal');
  if (modal) modal.classList.remove('open');
}

// Initialize color reference modal
function initColorReferenceModal(): void {
  const modal = $('color-reference-modal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeColorReferenceModal();
    };
  }
}

function filterColorReferences(query: string): void {
  const list = $('color-reference-list');
  if (!list) return;

  const lowerQuery = query.toLowerCase();
  const items = list.querySelectorAll('.color-reference-item');
  const groups = list.querySelectorAll('.color-reference-group');

  items.forEach(item => {
    const searchText = (item as HTMLElement).dataset.search || '';
    if (searchText.includes(lowerQuery)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });

  // Hide groups that have no visible items
  groups.forEach(group => {
    const visibleItems = group.querySelectorAll('.color-reference-item:not(.hidden)');
    if (visibleItems.length === 0) {
      group.classList.add('hidden');
    } else {
      group.classList.remove('hidden');
    }
  });
}

function handleColorReferenceSearchKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    // Select first visible item
    const list = $('color-reference-list');
    const firstVisible = list?.querySelector('.color-reference-item:not(.hidden)') as HTMLElement;
    if (firstVisible) {
      firstVisible.click();
    }
  } else if (e.key === 'Escape') {
    closeColorReferenceModal();
  }
}

function deleteVariable(id: string): void {
  if (confirm('Delete this variable?')) {
    post({ type: 'delete-variable', id });
  }
}

function duplicateVariable(id: string): void {
  post({ type: 'duplicate-variable', id });
}

// Bulk edit
let currentBulkEditGroup = '';

function openBulkEdit(groupName: string): void {
  currentBulkEditGroup = groupName;

  const modal = $('bulk-edit-modal');
  const groupNameEl = $('bulk-edit-group-name');
  const textarea = $('bulk-edit-textarea') as HTMLTextAreaElement;
  const preview = $('bulk-edit-preview');

  if (!modal || !textarea) return;

  // Get variables in this group
  const groupVars = state.variables.filter(v =>
    v.collectionId === state.selectedCollectionId &&
    v.name.startsWith(groupName + '/')
  );

  // Convert to CSV format
  const csvLines = groupVars.map(v => {
    const shortName = v.name.replace(groupName + '/', '');
    return `${shortName}, ${v.value}`;
  });

  if (groupNameEl) groupNameEl.textContent = groupName;
  textarea.value = csvLines.join('\n');
  if (preview) preview.innerHTML = '';

  modal.classList.add('open');
  textarea.focus();

  // Add input listener for live preview
  textarea.oninput = () => updateBulkEditPreview();
  textarea.onkeydown = (e) => {
    if (e.key === 'Escape') closeBulkEdit();
  };

  updateBulkEditPreview();
}

function closeBulkEdit(): void {
  const modal = $('bulk-edit-modal');
  if (modal) modal.classList.remove('open');
  currentBulkEditGroup = '';
}

function updateBulkEditPreview(): void {
  const textarea = $('bulk-edit-textarea') as HTMLTextAreaElement;
  const preview = $('bulk-edit-preview');

  if (!textarea || !preview) return;

  const lines = textarea.value.split('\n').filter(line => line.trim());
  const existingVars = state.variables.filter(v =>
    v.collectionId === state.selectedCollectionId &&
    v.name.startsWith(currentBulkEditGroup + '/')
  );

  const existingNames = new Set(existingVars.map(v => v.name.replace(currentBulkEditGroup + '/', '')));

  let html = '';

  lines.forEach(line => {
    const [name, ...valueParts] = line.split(/[,\t]/);
    const trimmedName = name?.trim();
    const value = valueParts.join(',').trim();

    if (!trimmedName) return;

    const isNew = !existingNames.has(trimmedName);
    const existingVar = existingVars.find(v => v.name === currentBulkEditGroup + '/' + trimmedName);
    const isModified = existingVar && existingVar.value !== value;

    const statusClass = isNew ? 'new' : (isModified ? 'modified' : '');
    const statusText = isNew ? 'new' : (isModified ? 'modified' : '');

    // Check if it's a color
    const isColor = value.startsWith('#') || value.startsWith('rgb') || value.startsWith('{');

    html += `
      <div class="bulk-edit-preview-item">
        ${isColor ? `<div class="preview-swatch" style="background:${value.startsWith('{') ? '#888' : value}"></div>` : ''}
        <span class="preview-name">${currentBulkEditGroup}/${trimmedName}</span>
        <span class="preview-value">${value}</span>
        ${statusText ? `<span class="preview-status ${statusClass}">${statusText}</span>` : ''}
      </div>
    `;
  });

  preview.innerHTML = html;
}

function applyBulkEdit(): void {
  const textarea = $('bulk-edit-textarea') as HTMLTextAreaElement;
  if (!textarea) return;

  const lines = textarea.value.split('\n').filter(line => line.trim());
  const updates: { name: string; value: string }[] = [];

  lines.forEach(line => {
    const [name, ...valueParts] = line.split(/[,\t]/);
    const trimmedName = name?.trim();
    const value = valueParts.join(',').trim();

    if (trimmedName && value) {
      updates.push({
        name: currentBulkEditGroup + '/' + trimmedName,
        value
      });
    }
  });

  if (updates.length > 0) {
    post({
      type: 'bulk-update-group',
      collectionId: state.selectedCollectionId,
      groupName: currentBulkEditGroup,
      updates
    });
  }

  closeBulkEdit();
}

// Drag and drop reordering
let draggedRow: HTMLTableRowElement | null = null;

function initDragDrop(): void {
  const tableBody = $('table-body');
  if (!tableBody) return;

  tableBody.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('tr[data-id]') as HTMLTableRowElement;
    if (!row) return;

    draggedRow = row;
    row.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.id || '');
    }
  });

  tableBody.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedRow) return;

    const target = e.target as HTMLElement;
    const row = target.closest('tr[data-id]') as HTMLTableRowElement;
    if (!row || row === draggedRow) return;

    // Clear previous indicators
    tableBody.querySelectorAll('.drag-over, .drag-over-below').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-below');
    });

    // Determine if dropping above or below
    const rect = row.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      row.classList.add('drag-over');
    } else {
      row.classList.add('drag-over-below');
    }
  });

  tableBody.addEventListener('dragleave', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('tr[data-id]') as HTMLTableRowElement;
    if (row) {
      row.classList.remove('drag-over', 'drag-over-below');
    }
  });

  tableBody.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedRow) return;

    const target = e.target as HTMLElement;
    const dropRow = target.closest('tr[data-id]') as HTMLTableRowElement;
    if (!dropRow || dropRow === draggedRow) return;

    const draggedId = draggedRow.dataset.id;
    const targetId = dropRow.dataset.id;
    const insertBefore = dropRow.classList.contains('drag-over');

    // Clear states
    tableBody.querySelectorAll('.drag-over, .drag-over-below').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-below');
    });

    if (draggedId && targetId) {
      post({
        type: 'reorder-variable',
        draggedId,
        targetId,
        insertBefore
      });
    }
  });

  tableBody.addEventListener('dragend', () => {
    if (draggedRow) {
      draggedRow.classList.remove('dragging');
      draggedRow = null;
    }
    tableBody.querySelectorAll('.drag-over, .drag-over-below').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-below');
    });
  });
}

// Resize handling
let isExpanded = false;
let lastSize = { width: 0, height: 0 };

function toggleExpand(): void {
  const expandBtn = $('expand-btn');
  const iconEl = expandBtn?.querySelector('.icon') as HTMLElement | null;

  if (!isExpanded) {
    lastSize = { width: window.innerWidth, height: window.innerHeight };
    // Maximize to screen dimensions with minimal margins
    // Figma doesn't allow repositioning, but we can maximize size
    const maxWidth = Math.max(400, window.screen.availWidth - 20);
    const maxHeight = Math.max(300, window.screen.availHeight - 100);
    post({ type: 'resize', width: maxWidth, height: maxHeight });
    isExpanded = true;
    if (expandBtn) expandBtn.title = 'Collapse';
    if (iconEl) iconEl.innerHTML = icons.collapse;
  } else {
    const width = lastSize.width || 600;
    const height = lastSize.height || 500;
    post({ type: 'resize', width, height });
    isExpanded = false;
    if (expandBtn) expandBtn.title = 'Expand';
    if (iconEl) iconEl.innerHTML = icons.expand;
  }
}

type ResizeDir = 'top' | 'right' | 'bottom' | 'left' | 'corner';

function initResize(): void {
  const resizeHandles = document.querySelectorAll('[data-resize]');
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let direction: ResizeDir = 'corner';

  resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      const target = e.currentTarget as HTMLElement;
      direction = (target.dataset.resize as ResizeDir) || 'corner';
      isResizing = true;
      startX = (e as MouseEvent).clientX;
      startY = (e as MouseEvent).clientY;
      startWidth = window.innerWidth;
      startHeight = window.innerHeight;
      if (isExpanded) {
        isExpanded = false;
        const expandBtn = $('expand-btn');
        const iconEl = expandBtn?.querySelector('.icon') as HTMLElement | null;
        if (expandBtn) expandBtn.title = 'Expand';
        if (iconEl) iconEl.innerHTML = icons.expand;
      }
      e.preventDefault();
    });
  });

  document.onmousemove = (e) => {
    if (!isResizing) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    if (direction === 'right' || direction === 'corner') {
      newWidth = startWidth + deltaX;
    } else if (direction === 'left') {
      newWidth = startWidth - deltaX;
    }

    if (direction === 'bottom' || direction === 'corner') {
      newHeight = startHeight + deltaY;
    } else if (direction === 'top') {
      newHeight = startHeight - deltaY;
    }

    newWidth = Math.max(400, newWidth);
    newHeight = Math.max(300, newHeight);
    post({ type: 'resize', width: newWidth, height: newHeight });
  };

  document.onmouseup = () => {
    isResizing = false;
  };
}

// JSON editor
function updateJson(): void {
  const jsonEditor = $('json-editor') as HTMLTextAreaElement;
  if (!jsonEditor) return;

  jsonEditor.value = JSON.stringify({
    collections: state.collections,
    variables: state.variables.map(v => ({
      id: v.id,
      collectionId: v.collectionId,
      name: v.name,
      type: v.resolvedType,
      value: v.value
    }))
  }, null, 2);
}

// Actions
function toggleGroup(groupName: string): void {
  state.toggleGroup(groupName);
  renderTable();
}

function deleteGroup(ids: string): void {
  const idList = ids.split(',');
  if (confirm(`Delete all ${idList.length} variables in this group?`)) {
    post({ type: 'delete-group', ids: idList });
  }
}

function updateNameFromDisplay(id: string, displayName: string, fullName: string): void {
  const parts = fullName.split('/');
  let newFullName: string;
  if (parts.length > 1) {
    parts[parts.length - 1] = displayName;
    newFullName = parts.join('/');
  } else {
    newFullName = displayName;
  }
  if (newFullName !== fullName) {
    post({ type: 'update-variable-name', id, name: newFullName });
  }
}

function updateValue(id: string, value: string): void {
  post({ type: 'update-variable-value', id, value });
}

function handleKey(e: KeyboardEvent, rowIndex: number, field: string): void {
  const tableBody = $('table-body');
  if (!tableBody) return;

  const rows = tableBody.querySelectorAll('tr:not(.add-row):not(.group-row)');

  if (e.key === 'Tab') {
    e.preventDefault();
    if (field === 'name') {
      const valueInput = rows[rowIndex]?.querySelector('td:last-child input') as HTMLInputElement;
      if (valueInput) valueInput.focus();
    } else {
      const nextRow = rows[rowIndex + 1];
      if (nextRow) {
        const nameInput = nextRow.querySelector('.name-cell input') as HTMLInputElement;
        if (nameInput) nameInput.focus();
      }
    }
  } else if (e.key === 'Enter') {
    (e.target as HTMLElement).blur();
  }
}

function openColorPickerForVariable(id: string, currentValue: string): void {
  openColorPicker(currentValue, (hex) => {
    updateValue(id, hexToRgb(hex));
  });
}

// Status display
function showStatus(msg: string, type: string): void {
  const statusEl = $('status');
  if (!statusEl) return;

  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
  if (type === 'success') {
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status';
    }, 2000);
  }
}

// Message handler
window.onmessage = (e) => {
  const msg = e.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'data-loaded') {
    state.setData(msg.collections || [], msg.variables || []);
    renderCollections();
    renderTable();
    updateSearchCount();
    updateJson();
  }

  if (msg.type === 'update-success') showStatus('Saved', 'success');
  if (msg.type === 'update-error') showStatus('Error: ' + msg.error, 'warning');
  if (msg.type === 'changes-detected') showStatus('Changes detected - click Refresh', 'warning');
};

// JSON buttons
document.addEventListener('DOMContentLoaded', () => {
  init();

  const jsonFormatBtn = $('json-format-btn');
  const jsonUpdateBtn = $('json-update-btn');
  const jsonEditor = $('json-editor') as HTMLTextAreaElement;

  if (jsonFormatBtn && jsonEditor) {
    jsonFormatBtn.onclick = () => {
      try {
        jsonEditor.value = JSON.stringify(JSON.parse(jsonEditor.value), null, 2);
        jsonEditor.classList.remove('error');
      } catch {
        jsonEditor.classList.add('error');
      }
    };
  }

  if (jsonUpdateBtn && jsonEditor) {
    jsonUpdateBtn.onclick = () => {
      try {
        post({ type: 'update-from-json', data: JSON.parse(jsonEditor.value) });
        jsonEditor.classList.remove('error');
      } catch {
        jsonEditor.classList.add('error');
      }
    };
  }
});
