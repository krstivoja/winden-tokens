// Tokens Manager - Figma Plugin

figma.showUI(__html__, { width: 600, height: 500, themeColors: true } as any);

// Track variable state for change detection
let lastDataHash = '';

interface UIVariableData {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: string;
  value: string;
}

interface CollectionData {
  id: string;
  name: string;
}

// Get stored variable order
function getVariableOrder(): string[] {
  const orderJson = figma.root.getPluginData('variableOrder');
  return orderJson ? JSON.parse(orderJson) : [];
}

// Set stored variable order
function setVariableOrder(order: string[]): void {
  figma.root.setPluginData('variableOrder', JSON.stringify(order));
}

// Fetch and send all data to UI
async function fetchData() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  const collectionData: CollectionData[] = collections.map(c => ({
    id: c.id,
    name: c.name
  }));

  let variableData: UIVariableData[] = variables.map(variable => {
    const modeId = Object.keys(variable.valuesByMode)[0];
    const value = variable.valuesByMode[modeId];

    return {
      id: variable.id,
      collectionId: variable.variableCollectionId,
      name: variable.name,
      resolvedType: variable.resolvedType,
      value: formatValue(value, variable.resolvedType)
    };
  });

  // Apply custom order if exists
  const order = getVariableOrder();
  if (order.length > 0) {
    variableData.sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      // Items not in order go to the end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  // Update hash for change detection
  lastDataHash = JSON.stringify({ collections: collectionData, variables: variableData });

  figma.ui.postMessage({
    type: 'data-loaded',
    collections: collectionData,
    variables: variableData
  });
}

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    return `→ ${value.id}`;
  }

  switch (type) {
    case 'COLOR':
      if (typeof value === 'object' && 'r' in value) {
        const r = Math.round(value.r * 255);
        const g = Math.round(value.g * 255);
        const b = Math.round(value.b * 255);
        const a = value.a !== undefined ? value.a : 1;
        const toHex = (n: number) => ('0' + n.toString(16).toUpperCase()).slice(-2);
        const hex = '#' + toHex(r) + toHex(g) + toHex(b);
        if (a < 1) {
          return hex + toHex(Math.round(a * 255));
        }
        return hex;
      }
      return String(value);
    case 'FLOAT':
      // Round to remove floating point precision artifacts
      const rounded = Math.round(value * 1000) / 1000;
      // If it's a whole number, show without decimals
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    case 'STRING':
      return String(value);
    case 'BOOLEAN':
      return value ? 'true' : 'false';
    default:
      return JSON.stringify(value);
  }
}

function parseValue(value: string, type: string): any {
  switch (type) {
    case 'COLOR':
      const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1]) / 255,
          g: parseInt(rgbaMatch[2]) / 255,
          b: parseInt(rgbaMatch[3]) / 255,
          a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
        };
      }
      const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return {
          r: parseInt(hex.substring(0, 2), 16) / 255,
          g: parseInt(hex.substring(2, 4), 16) / 255,
          b: parseInt(hex.substring(4, 6), 16) / 255,
          a: 1
        };
      }
      throw new Error(`Invalid color format: ${value}`);
    case 'FLOAT':
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
      return num;
    case 'STRING':
      return value;
    case 'BOOLEAN':
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error(`Invalid boolean: ${value}`);
    default:
      return value;
  }
}

function getDefaultValue(type: string): any {
  switch (type) {
    case 'COLOR':
      return { r: 0, g: 0, b: 0, a: 1 };
    case 'FLOAT':
      return 0;
    case 'STRING':
      return '';
    case 'BOOLEAN':
      return false;
    default:
      return null;
  }
}

// Create a new collection
async function createCollection(name: string) {
  try {
    figma.variables.createVariableCollection(name);
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Create a new variable
async function createVariable(
  collectionId: string,
  name: string,
  varType: string,
  value: string
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const resolvedType = varType as VariableResolvedDataType;
    const variable = figma.variables.createVariable(name, collection, resolvedType);

    const modeId = collection.modes[0].modeId;
    const parsedValue = value ? parseValue(value, varType) : getDefaultValue(varType);
    variable.setValueForMode(modeId, parsedValue);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update variable name
async function updateVariableName(id: string, newName: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      variable.name = newName;
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update variable value
async function updateVariableValue(id: string, newValue: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const modeId = Object.keys(variable.valuesByMode)[0];
      const parsedValue = parseValue(newValue, variable.resolvedType);
      variable.setValueForMode(modeId, parsedValue);
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Delete variable
async function deleteVariable(id: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      variable.remove();
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Delete group of variables
async function deleteGroup(ids: string[]) {
  try {
    for (const id of ids) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Duplicate variable
async function duplicateVariable(id: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (!collection) throw new Error('Collection not found');

      const newVariable = figma.variables.createVariable(
        variable.name + ' copy',
        collection,
        variable.resolvedType
      );

      // Copy value from first mode
      const modeId = Object.keys(variable.valuesByMode)[0];
      const value = variable.valuesByMode[modeId];
      newVariable.setValueForMode(modeId, value);

      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Create color shades
async function createShades(
  collectionId: string,
  shades: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    for (const shade of shades) {
      const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
      const parsedValue = parseValue(shade.value, 'COLOR');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update color shades (delete old, create new)
async function updateShades(
  collectionId: string,
  deleteIds: string[],
  shades: { name: string; value: string }[]
) {
  try {
    // Delete old shades
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    // Create new shades
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    for (const shade of shades) {
      const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
      const parsedValue = parseValue(shade.value, 'COLOR');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Remove shades and convert back to single color
async function removeShades(
  collectionId: string,
  deleteIds: string[],
  newColor: { name: string; value: string }
) {
  try {
    // Delete all shades
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    // Create single color
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const variable = figma.variables.createVariable(newColor.name, collection, 'COLOR');
    const parsedValue = parseValue(newColor.value, 'COLOR');
    variable.setValueForMode(modeId, parsedValue);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Create number steps
async function createSteps(
  collectionId: string,
  steps: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    for (const step of steps) {
      const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
      const parsedValue = parseValue(step.value, 'FLOAT');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update number steps (delete old, create new)
async function updateSteps(
  collectionId: string,
  deleteIds: string[],
  steps: { name: string; value: string }[]
) {
  try {
    // Delete old steps
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    // Create new steps
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    for (const step of steps) {
      const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
      const parsedValue = parseValue(step.value, 'FLOAT');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Remove steps and convert back to single number
async function removeSteps(
  collectionId: string,
  deleteIds: string[],
  newNumber: { name: string; value: string }
) {
  try {
    // Delete all steps
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    // Create single number
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const variable = figma.variables.createVariable(newNumber.name, collection, 'FLOAT');
    const parsedValue = parseValue(newNumber.value, 'FLOAT');
    variable.setValueForMode(modeId, parsedValue);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Reorder variable
async function reorderVariable(draggedId: string, targetId: string, insertBefore: boolean) {
  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    let order = getVariableOrder();

    // Initialize order if empty
    if (order.length === 0) {
      order = variables.map(v => v.id);
    }

    // Remove dragged item from current position
    const draggedIndex = order.indexOf(draggedId);
    if (draggedIndex > -1) {
      order.splice(draggedIndex, 1);
    }

    // Find target position
    let targetIndex = order.indexOf(targetId);
    if (!insertBefore) {
      targetIndex++;
    }

    // Insert at new position
    order.splice(targetIndex, 0, draggedId);

    setVariableOrder(order);
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update from JSON
async function updateFromJson(data: { collections: CollectionData[], variables: any[] }) {
  try {
    // Update existing variables
    for (const varData of data.variables) {
      if (varData.id) {
        const variable = await figma.variables.getVariableByIdAsync(varData.id);
        if (variable) {
          if (varData.name && varData.name !== variable.name) {
            variable.name = varData.name;
          }
          if (varData.value !== undefined) {
            const modeId = Object.keys(variable.valuesByMode)[0];
            const parsedValue = parseValue(varData.value, varData.type || variable.resolvedType);
            variable.setValueForMode(modeId, parsedValue);
          }
        }
      }
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Poll for changes
async function checkForChanges() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  const collectionData = collections.map(c => ({ id: c.id, name: c.name }));
  const variableData = variables.map(v => {
    const modeId = Object.keys(v.valuesByMode)[0];
    return {
      id: v.id,
      collectionId: v.variableCollectionId,
      name: v.name,
      resolvedType: v.resolvedType,
      value: formatValue(v.valuesByMode[modeId], v.resolvedType)
    };
  });

  const currentHash = JSON.stringify({ collections: collectionData, variables: variableData });

  if (lastDataHash && currentHash !== lastDataHash) {
    figma.ui.postMessage({ type: 'changes-detected' });
  }
}

// Start polling
setInterval(checkForChanges, 2000);

// Initial fetch
fetchData();

// Message handler
figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {
    case 'refresh':
      await fetchData();
      break;

    case 'create-collection':
      await createCollection(msg.name);
      break;

    case 'create-variable':
      await createVariable(msg.collectionId, msg.name, msg.varType, msg.value);
      break;

    case 'update-variable-name':
      await updateVariableName(msg.id, msg.name);
      break;

    case 'update-variable-value':
      await updateVariableValue(msg.id, msg.value);
      break;

    case 'delete-variable':
      await deleteVariable(msg.id);
      break;

    case 'delete-group':
      await deleteGroup(msg.ids);
      break;

    case 'duplicate-variable':
      await duplicateVariable(msg.id);
      break;

    case 'update-from-json':
      await updateFromJson(msg.data);
      break;

    case 'create-shades':
      await createShades(msg.collectionId, msg.shades);
      break;

    case 'update-shades':
      await updateShades(msg.collectionId, msg.deleteIds, msg.shades);
      break;

    case 'remove-shades':
      await removeShades(msg.collectionId, msg.deleteIds, msg.newColor);
      break;

    case 'create-steps':
      await createSteps(msg.collectionId, msg.steps);
      break;

    case 'update-steps':
      await updateSteps(msg.collectionId, msg.deleteIds, msg.steps);
      break;

    case 'remove-steps':
      await removeSteps(msg.collectionId, msg.deleteIds, msg.newNumber);
      break;

    case 'reorder-variable':
      await reorderVariable(msg.draggedId, msg.targetId, msg.insertBefore);
      break;

    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;

    case 'cancel':
      figma.closePlugin();
      break;
  }
};
