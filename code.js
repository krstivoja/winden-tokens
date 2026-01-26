"use strict";
// Tokens Manager - Figma Plugin
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 600, height: 500, themeColors: true });
// Track variable state for change detection
let lastDataHash = '';
// Fetch and send all data to UI
function fetchData() {
    return __awaiter(this, void 0, void 0, function* () {
        const collections = yield figma.variables.getLocalVariableCollectionsAsync();
        const variables = yield figma.variables.getLocalVariablesAsync();
        const collectionData = collections.map(c => ({
            id: c.id,
            name: c.name
        }));
        const variableData = variables.map(variable => {
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
        // Update hash for change detection
        lastDataHash = JSON.stringify({ collections: collectionData, variables: variableData });
        figma.ui.postMessage({
            type: 'data-loaded',
            collections: collectionData,
            variables: variableData
        });
    });
}
function formatValue(value, type) {
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
                const toHex = (n) => ('0' + n.toString(16).toUpperCase()).slice(-2);
                const hex = '#' + toHex(r) + toHex(g) + toHex(b);
                if (a < 1) {
                    return hex + toHex(Math.round(a * 255));
                }
                return hex;
            }
            return String(value);
        case 'FLOAT':
            return String(value);
        case 'STRING':
            return String(value);
        case 'BOOLEAN':
            return value ? 'true' : 'false';
        default:
            return JSON.stringify(value);
    }
}
function parseValue(value, type) {
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
            if (isNaN(num))
                throw new Error(`Invalid number: ${value}`);
            return num;
        case 'STRING':
            return value;
        case 'BOOLEAN':
            if (value === 'true')
                return true;
            if (value === 'false')
                return false;
            throw new Error(`Invalid boolean: ${value}`);
        default:
            return value;
    }
}
function getDefaultValue(type) {
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
function createCollection(name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            figma.variables.createVariableCollection(name);
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Create a new variable
function createVariable(collectionId, name, varType, value) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const collection = yield figma.variables.getVariableCollectionByIdAsync(collectionId);
            if (!collection)
                throw new Error('Collection not found');
            const resolvedType = varType;
            const variable = figma.variables.createVariable(name, collection, resolvedType);
            const modeId = collection.modes[0].modeId;
            const parsedValue = value ? parseValue(value, varType) : getDefaultValue(varType);
            variable.setValueForMode(modeId, parsedValue);
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Update variable name
function updateVariableName(id, newName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const variable = yield figma.variables.getVariableByIdAsync(id);
            if (variable) {
                variable.name = newName;
                yield fetchData();
                figma.ui.postMessage({ type: 'update-success' });
            }
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Update variable value
function updateVariableValue(id, newValue) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const variable = yield figma.variables.getVariableByIdAsync(id);
            if (variable) {
                const modeId = Object.keys(variable.valuesByMode)[0];
                const parsedValue = parseValue(newValue, variable.resolvedType);
                variable.setValueForMode(modeId, parsedValue);
                yield fetchData();
                figma.ui.postMessage({ type: 'update-success' });
            }
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Delete variable
function deleteVariable(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const variable = yield figma.variables.getVariableByIdAsync(id);
            if (variable) {
                variable.remove();
                yield fetchData();
                figma.ui.postMessage({ type: 'update-success' });
            }
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Delete group of variables
function deleteGroup(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            for (const id of ids) {
                const variable = yield figma.variables.getVariableByIdAsync(id);
                if (variable) {
                    variable.remove();
                }
            }
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Duplicate variable
function duplicateVariable(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const variable = yield figma.variables.getVariableByIdAsync(id);
            if (variable) {
                const collection = yield figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
                if (!collection)
                    throw new Error('Collection not found');
                const newVariable = figma.variables.createVariable(variable.name + ' copy', collection, variable.resolvedType);
                // Copy value from first mode
                const modeId = Object.keys(variable.valuesByMode)[0];
                const value = variable.valuesByMode[modeId];
                newVariable.setValueForMode(modeId, value);
                yield fetchData();
                figma.ui.postMessage({ type: 'update-success' });
            }
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Create color shades
function createShades(collectionId, shades) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const collection = yield figma.variables.getVariableCollectionByIdAsync(collectionId);
            if (!collection)
                throw new Error('Collection not found');
            const modeId = collection.modes[0].modeId;
            for (const shade of shades) {
                const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
                const parsedValue = parseValue(shade.value, 'COLOR');
                variable.setValueForMode(modeId, parsedValue);
            }
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Update color shades (delete old, create new)
function updateShades(collectionId, deleteIds, shades) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Delete old shades
            for (const id of deleteIds) {
                const variable = yield figma.variables.getVariableByIdAsync(id);
                if (variable) {
                    variable.remove();
                }
            }
            // Create new shades
            const collection = yield figma.variables.getVariableCollectionByIdAsync(collectionId);
            if (!collection)
                throw new Error('Collection not found');
            const modeId = collection.modes[0].modeId;
            for (const shade of shades) {
                const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
                const parsedValue = parseValue(shade.value, 'COLOR');
                variable.setValueForMode(modeId, parsedValue);
            }
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Remove shades and convert back to single color
function removeShades(collectionId, deleteIds, newColor) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Delete all shades
            for (const id of deleteIds) {
                const variable = yield figma.variables.getVariableByIdAsync(id);
                if (variable) {
                    variable.remove();
                }
            }
            // Create single color
            const collection = yield figma.variables.getVariableCollectionByIdAsync(collectionId);
            if (!collection)
                throw new Error('Collection not found');
            const modeId = collection.modes[0].modeId;
            const variable = figma.variables.createVariable(newColor.name, collection, 'COLOR');
            const parsedValue = parseValue(newColor.value, 'COLOR');
            variable.setValueForMode(modeId, parsedValue);
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Update from JSON
function updateFromJson(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Update existing variables
            for (const varData of data.variables) {
                if (varData.id) {
                    const variable = yield figma.variables.getVariableByIdAsync(varData.id);
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
            yield fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
        catch (error) {
            figma.ui.postMessage({ type: 'update-error', error: error.message });
        }
    });
}
// Poll for changes
function checkForChanges() {
    return __awaiter(this, void 0, void 0, function* () {
        const collections = yield figma.variables.getLocalVariableCollectionsAsync();
        const variables = yield figma.variables.getLocalVariablesAsync();
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
    });
}
// Start polling
setInterval(checkForChanges, 2000);
// Initial fetch
fetchData();
// Message handler
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    switch (msg.type) {
        case 'refresh':
            yield fetchData();
            break;
        case 'create-collection':
            yield createCollection(msg.name);
            break;
        case 'create-variable':
            yield createVariable(msg.collectionId, msg.name, msg.varType, msg.value);
            break;
        case 'update-variable-name':
            yield updateVariableName(msg.id, msg.name);
            break;
        case 'update-variable-value':
            yield updateVariableValue(msg.id, msg.value);
            break;
        case 'delete-variable':
            yield deleteVariable(msg.id);
            break;
        case 'delete-group':
            yield deleteGroup(msg.ids);
            break;
        case 'duplicate-variable':
            yield duplicateVariable(msg.id);
            break;
        case 'update-from-json':
            yield updateFromJson(msg.data);
            break;
        case 'create-shades':
            yield createShades(msg.collectionId, msg.shades);
            break;
        case 'update-shades':
            yield updateShades(msg.collectionId, msg.deleteIds, msg.shades);
            break;
        case 'remove-shades':
            yield removeShades(msg.collectionId, msg.deleteIds, msg.newColor);
            break;
        case 'resize':
            figma.ui.resize(msg.width, msg.height);
            break;
        case 'cancel':
            figma.closePlugin();
            break;
    }
});
