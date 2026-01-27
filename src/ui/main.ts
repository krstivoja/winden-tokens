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
import { post, $ } from './utils/helpers';
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
  initTabs();
  initToolbar();
  initResize();
  initCollectionSelect();
  initAddMenu();
  initDragDrop();

  // Expose app methods to window for inline handlers
  (window as any).app = {
    showAddMenu,
    toggleGroup,
    deleteGroup,
    updateNameFromDisplay,
    updateValue,
    handleKey,
    openColorPickerForVariable,
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
}

// Collection select
function initCollectionSelect(): void {
  const select = $('collection-select') as HTMLSelectElement;
  if (select) {
    select.onchange = () => {
      state.selectedCollectionId = select.value;
      renderTable();
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
