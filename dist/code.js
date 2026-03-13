"use strict";
// Tokens Manager - Figma Plugin
figma.showUI(__html__, { width: 750, height: 500, themeColors: true });
// Track variable state for change detection
let lastDataHash = '';
const SHADE_GENERATOR_CONFIG_KEY = 'shadeGeneratorConfig';
// Get stored variable order
function getVariableOrder() {
    const orderJson = figma.root.getPluginData('variableOrder');
    return orderJson ? JSON.parse(orderJson) : [];
}
// Set stored variable order
function setVariableOrder(order) {
    figma.root.setPluginData('variableOrder', JSON.stringify(order));
}
function isShadeVariableName(name) {
    return /^(.+)\/(\d+)$/.test(name);
}
function getShadeBaseName(name) {
    const match = name.match(/^(.+)\/(\d+)$/);
    return match ? match[1] : null;
}
function extractShadeNumber(name) {
    const match = name.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
}
function readShadeGeneratorConfig(variable) {
    const raw = variable.getPluginData(SHADE_GENERATOR_CONFIG_KEY);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.generatedShades)) {
            return null;
        }
        return {
            version: typeof parsed.version === 'number' ? parsed.version : 1,
            sourceVariableId: typeof parsed.sourceVariableId === 'string' ? parsed.sourceVariableId : variable.id,
            sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : variable.name,
            sourceValue: typeof parsed.sourceValue === 'string' ? parsed.sourceValue : '',
            shadeCount: typeof parsed.shadeCount === 'number' ? parsed.shadeCount : parsed.generatedShades.length,
            lightValue: typeof parsed.lightValue === 'number' ? parsed.lightValue : 5,
            darkValue: typeof parsed.darkValue === 'number' ? parsed.darkValue : 90,
            lightnessCurve: parsed.lightnessCurve,
            saturationCurve: parsed.saturationCurve,
            hueCurve: parsed.hueCurve,
            generatedShades: parsed.generatedShades,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
        };
    }
    catch (error) {
        console.warn('[Plugin] Failed to parse shade generator config for', variable.name, error);
        return null;
    }
}
function clearShadeGeneratorConfig(variable) {
    variable.setPluginData(SHADE_GENERATOR_CONFIG_KEY, '');
}
function sortVariableData(variableData) {
    const order = getVariableOrder();
    const sorted = [...variableData];
    if (order.length > 0) {
        sorted.sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            if (indexA === -1 && indexB === -1)
                return 0;
            if (indexA === -1)
                return 1;
            if (indexB === -1)
                return -1;
            return indexA - indexB;
        });
    }
    const groupMap = new Map();
    for (const variable of sorted) {
        const baseName = getShadeBaseName(variable.name);
        if (!baseName)
            continue;
        if (!groupMap.has(baseName)) {
            groupMap.set(baseName, []);
        }
        groupMap.get(baseName).push(variable);
    }
    for (const group of groupMap.values()) {
        group.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
    }
    const result = [];
    const processedGroups = new Set();
    for (const variable of sorted) {
        const baseName = getShadeBaseName(variable.name);
        if (baseName) {
            if (!processedGroups.has(baseName)) {
                processedGroups.add(baseName);
                result.push(...groupMap.get(baseName));
            }
        }
        else {
            result.push(variable);
        }
    }
    return result;
}
function buildShadeGroups(variables, formattedValueMap) {
    const variableMap = new Map(variables.map(variable => [variable.id, variable]));
    const shadeGroups = [];
    for (const variable of variables) {
        if (variable.resolvedType !== 'COLOR')
            continue;
        const config = readShadeGeneratorConfig(variable);
        if (!config)
            continue;
        const trackedShades = config.generatedShades || [];
        const trackedShadeIds = new Set(trackedShades.map(shade => shade.id));
        const baseNames = new Set([variable.name, config.sourceName]);
        for (const shade of trackedShades) {
            const baseName = getShadeBaseName(shade.name);
            if (baseName) {
                baseNames.add(baseName);
            }
        }
        const actualShadeVars = variables.filter(candidate => {
            if (candidate.id === variable.id)
                return false;
            if (candidate.variableCollectionId !== variable.variableCollectionId)
                return false;
            if (candidate.resolvedType !== 'COLOR')
                return false;
            const baseName = getShadeBaseName(candidate.name);
            return !!baseName && baseNames.has(baseName);
        });
        actualShadeVars.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
        const deleteIds = Array.from(new Set([
            ...trackedShades.map(shade => shade.id),
            ...actualShadeVars.map(shade => shade.id),
        ].filter(id => !!variableMap.get(id))));
        const dirtyReasons = new Set();
        const currentSourceValue = formattedValueMap.get(variable.id) || '';
        if (currentSourceValue !== config.sourceValue) {
            dirtyReasons.add('source-value');
        }
        if (variable.name !== config.sourceName) {
            dirtyReasons.add('source-name');
        }
        if (trackedShades.length === 0) {
            dirtyReasons.add('missing-shades');
        }
        for (const shade of trackedShades) {
            const actual = variableMap.get(shade.id);
            if (!actual) {
                dirtyReasons.add('missing-shades');
                continue;
            }
            const actualValue = formattedValueMap.get(actual.id) || '';
            if (actual.name !== shade.name || actualValue !== shade.value) {
                dirtyReasons.add('modified-shades');
            }
        }
        if (actualShadeVars.length !== trackedShades.length) {
            dirtyReasons.add('modified-shades');
        }
        for (const actual of actualShadeVars) {
            if (!trackedShadeIds.has(actual.id)) {
                dirtyReasons.add('modified-shades');
            }
        }
        shadeGroups.push({
            sourceVariableId: variable.id,
            sourceVariableName: variable.name,
            collectionId: variable.variableCollectionId,
            deleteIds,
            status: dirtyReasons.size > 0 ? 'dirty' : 'clean',
            dirtyReasons: Array.from(dirtyReasons),
            config: {
                version: config.version,
                sourceVariableId: variable.id,
                sourceName: config.sourceName,
                sourceValue: config.sourceValue,
                shadeCount: config.shadeCount,
                lightValue: config.lightValue,
                darkValue: config.darkValue,
                lightnessCurve: config.lightnessCurve,
                saturationCurve: config.saturationCurve,
                hueCurve: config.hueCurve,
                generatedShades: config.generatedShades,
                updatedAt: config.updatedAt,
            },
        });
    }
    shadeGroups.sort((a, b) => a.sourceVariableName.localeCompare(b.sourceVariableName));
    return shadeGroups;
}
function getManagedShadeVariables(sourceVariable, config, variables) {
    const baseNames = new Set([sourceVariable.name, config.sourceName]);
    for (const shade of config.generatedShades || []) {
        const baseName = getShadeBaseName(shade.name);
        if (baseName) {
            baseNames.add(baseName);
        }
    }
    const actualShadeVars = variables.filter(candidate => {
        if (candidate.id === sourceVariable.id)
            return false;
        if (candidate.variableCollectionId !== sourceVariable.variableCollectionId)
            return false;
        if (candidate.resolvedType !== 'COLOR')
            return false;
        const baseName = getShadeBaseName(candidate.name);
        return !!baseName && baseNames.has(baseName);
    });
    actualShadeVars.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
    return actualShadeVars;
}
function collectManagedShadeDeleteIds(sourceVariable, config, variables) {
    return Array.from(new Set([
        ...(config.generatedShades || []).map(shade => shade.id),
        ...getManagedShadeVariables(sourceVariable, config, variables).map(shade => shade.id),
    ]));
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function cubicBezierAt(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}
function cubicBezierDerivative(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}
function solveBezierTForX(x, x1, x2) {
    let t = clamp(x, 0, 1);
    for (let i = 0; i < 5; i++) {
        const xAt = cubicBezierAt(0, x1, x2, 1, t);
        const dx = xAt - x;
        if (Math.abs(dx) < 1e-4)
            break;
        const derivative = cubicBezierDerivative(0, x1, x2, 1, t);
        if (derivative === 0)
            break;
        t = clamp(t - dx / derivative, 0, 1);
    }
    return t;
}
function evaluateShadeCurveAtNodes(handles, count) {
    const values = [];
    for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0;
        const u = solveBezierTForX(t, clamp(handles.handle1.t, 0, 1), clamp(handles.handle2.t, 0, 1));
        values.push(cubicBezierAt(handles.startValue, handles.handle1.value, handles.handle2.value, handles.endValue, u));
    }
    return values;
}
function rgbToHsv(r, g, b) {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const delta = max - min;
    let h = 0;
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    if (delta !== 0) {
        switch (max) {
            case nr:
                h = ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60;
                break;
            case ng:
                h = ((nb - nr) / delta + 2) * 60;
                break;
            default:
                h = ((nr - ng) / delta + 4) * 60;
                break;
        }
    }
    return { h, s: s * 100, v: v * 100 };
}
function hsvToRgb(h, s, v) {
    const normalizedS = s / 100;
    const normalizedV = v / 100;
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = normalizedV * (1 - normalizedS);
    const q = normalizedV * (1 - f * normalizedS);
    const t = normalizedV * (1 - (1 - f) * normalizedS);
    let r = normalizedV;
    let g = normalizedV;
    let b = normalizedV;
    switch (i) {
        case 0:
            r = normalizedV;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = normalizedV;
            b = p;
            break;
        case 2:
            r = p;
            g = normalizedV;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = normalizedV;
            break;
        case 4:
            r = t;
            g = p;
            b = normalizedV;
            break;
        default:
            r = normalizedV;
            g = p;
            b = q;
            break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}
function lightnessToRgb(baseRgb, lightness) {
    if (lightness <= 50) {
        const t = lightness / 50;
        return {
            r: Math.round(255 + (baseRgb.r - 255) * t),
            g: Math.round(255 + (baseRgb.g - 255) * t),
            b: Math.round(255 + (baseRgb.b - 255) * t),
        };
    }
    const t = (lightness - 50) / 50;
    return {
        r: Math.round(baseRgb.r * (1 - t)),
        g: Math.round(baseRgb.g * (1 - t)),
        b: Math.round(baseRgb.b * (1 - t)),
    };
}
function rgbToCss(rgb) {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
function getShadeNames(count) {
    if (count === 5)
        return ['100', '300', '500', '700', '900'];
    if (count === 10)
        return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
    if (count === 11)
        return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    const names = [];
    for (let i = 0; i < count; i++) {
        const value = Math.round(50 + (i / (count - 1)) * 900);
        names.push(String(value));
    }
    return names;
}
function getShadeBaseIndex(count) {
    const names = getShadeNames(count);
    const explicitBaseIndex = names.indexOf('500');
    if (explicitBaseIndex >= 0) {
        return explicitBaseIndex;
    }
    return Math.floor((count - 1) / 2);
}
function getBaseShadeToneAtT(t, count, lightValue, darkValue) {
    if (count <= 1) {
        return 50;
    }
    const baseIndex = getShadeBaseIndex(count);
    const baseT = baseIndex / (count - 1);
    const clampedT = clamp(t, 0, 1);
    if (clampedT <= baseT) {
        const localT = baseT === 0 ? 0 : clampedT / baseT;
        return lightValue + (50 - lightValue) * localT;
    }
    const localT = baseT === 1 ? 0 : (clampedT - baseT) / (1 - baseT);
    return 50 + (darkValue - 50) * localT;
}
function buildManagedShadePayload(baseRgb, groupName, config) {
    const lightAdj = evaluateShadeCurveAtNodes(config.lightnessCurve, config.shadeCount);
    const satAdj = evaluateShadeCurveAtNodes(config.saturationCurve, config.shadeCount);
    const hueAdj = evaluateShadeCurveAtNodes(config.hueCurve, config.shadeCount);
    const names = getShadeNames(config.shadeCount);
    const colors = [];
    const baseHsv = rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);
    for (let i = 0; i < config.shadeCount; i++) {
        const t = config.shadeCount > 1 ? i / (config.shadeCount - 1) : 0;
        const baseLightness = getBaseShadeToneAtT(t, config.shadeCount, config.lightValue, config.darkValue);
        const lightness = clamp(baseLightness + (lightAdj[i] || 0), 0, 100);
        const saturation = clamp(baseHsv.s + (satAdj[i] || 0), 0, 100);
        const hue = (baseHsv.h + (hueAdj[i] || 0) + 360) % 360;
        const adjustedRgb = hsvToRgb(hue, saturation, baseHsv.v);
        const shadeRgb = lightnessToRgb(adjustedRgb, lightness);
        colors.push({
            name: `${groupName}/${names[i]}`,
            value: rgbToCss(shadeRgb),
        });
    }
    return colors;
}
async function resolveSourceVariableRgb(variable, visited = new Set()) {
    if (visited.has(variable.id)) {
        return null;
    }
    visited.add(variable.id);
    const modeId = Object.keys(variable.valuesByMode)[0];
    const value = variable.valuesByMode[modeId];
    if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
        const referencedVariable = await figma.variables.getVariableByIdAsync(value.id);
        if (!referencedVariable) {
            return null;
        }
        return resolveSourceVariableRgb(referencedVariable, visited);
    }
    if (value && typeof value === 'object' && 'r' in value) {
        return {
            r: Math.round(value.r * 255),
            g: Math.round(value.g * 255),
            b: Math.round(value.b * 255),
        };
    }
    return null;
}
async function buildUiState() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    console.log('[Plugin] Collections:', collections.map(c => ({ name: c.name, variableIds: c.variableIds })));
    console.log('[Plugin] Variables from API:', variables.map(v => v.name));
    const collectionData = collections.map(c => ({
        id: c.id,
        name: c.name
    }));
    let variableData = [];
    for (const collection of collections) {
        for (const varId of collection.variableIds) {
            const variable = variables.find(v => v.id === varId);
            if (variable) {
                const modeId = Object.keys(variable.valuesByMode)[0];
                const value = variable.valuesByMode[modeId];
                variableData.push({
                    id: variable.id,
                    collectionId: variable.variableCollectionId,
                    name: variable.name,
                    resolvedType: variable.resolvedType,
                    value: await formatValue(value, variable.resolvedType)
                });
            }
        }
    }
    variableData = sortVariableData(variableData);
    console.log('[Plugin] Variables after collection order:', variableData.map(v => v.name));
    const formattedValueMap = new Map(variableData.map(variable => [variable.id, variable.value]));
    const shadeGroups = buildShadeGroups(variables, formattedValueMap);
    const hash = JSON.stringify({
        collections: collectionData,
        variables: variableData,
        shadeGroups,
    });
    return {
        collectionData,
        variableData,
        shadeGroups,
        hash,
    };
}
// Fetch and send all data to UI
async function fetchData() {
    await syncManagedShadeSources();
    const { collectionData, variableData, shadeGroups, hash } = await buildUiState();
    lastDataHash = hash;
    console.log('[Plugin] Sending data-loaded with', collectionData.length, 'collections,', variableData.length, 'variables and', shadeGroups.length, 'shade groups');
    figma.ui.postMessage({
        type: 'data-loaded',
        collections: collectionData,
        variables: variableData,
        shadeGroups,
    });
}
async function formatValue(value, type) {
    if (value === null || value === undefined) {
        return 'undefined';
    }
    if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
        // Look up the referenced variable and return its name in {name} format
        try {
            const refVariable = await figma.variables.getVariableByIdAsync(value.id);
            if (refVariable) {
                return `{${refVariable.name}}`;
            }
        }
        catch (e) {
            // If lookup fails, return the ID
        }
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
async function parseValue(value, type) {
    // Check if value is a variable reference (format: {variableName})
    const refMatch = value.match(/^\{(.+)\}$/);
    if (refMatch) {
        const refName = refMatch[1];
        const variables = await figma.variables.getLocalVariablesAsync();
        const refVariable = variables.find(v => v.name === refName);
        if (!refVariable) {
            throw new Error(`Referenced variable not found: ${refName}`);
        }
        // Return a variable alias
        return {
            type: 'VARIABLE_ALIAS',
            id: refVariable.id
        };
    }
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
async function createCollection(name) {
    try {
        figma.variables.createVariableCollection(name);
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Create a new variable
async function createVariable(collectionId, name, varType, value) {
    try {
        let collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        // Auto-create default collection if none exists (like Figma does)
        if (!collection) {
            const collections = await figma.variables.getLocalVariableCollectionsAsync();
            if (collections.length === 0) {
                collection = figma.variables.createVariableCollection('Collection 1');
            }
            else {
                throw new Error('Collection not found');
            }
        }
        const resolvedType = varType;
        const variable = figma.variables.createVariable(name, collection, resolvedType);
        const modeId = collection.modes[0].modeId;
        const parsedValue = value ? await parseValue(value, varType) : getDefaultValue(varType);
        variable.setValueForMode(modeId, parsedValue);
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Update variable name
async function updateVariableName(id, newName) {
    try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) {
            variable.name = newName;
            await fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Update variable value
async function updateVariableValue(id, newValue) {
    try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) {
            const modeId = Object.keys(variable.valuesByMode)[0];
            const parsedValue = await parseValue(newValue, variable.resolvedType);
            variable.setValueForMode(modeId, parsedValue);
            await fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Delete variable
async function deleteVariable(id) {
    try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) {
            const shadeConfig = readShadeGeneratorConfig(variable);
            if (shadeConfig) {
                for (const shade of shadeConfig.generatedShades) {
                    const shadeVariable = await figma.variables.getVariableByIdAsync(shade.id);
                    if (shadeVariable) {
                        shadeVariable.remove();
                    }
                }
            }
            variable.remove();
            await fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Delete group of variables
async function deleteGroup(ids) {
    try {
        for (const id of ids) {
            const variable = await figma.variables.getVariableByIdAsync(id);
            if (variable) {
                variable.remove();
            }
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Duplicate variable
async function duplicateVariable(id) {
    try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) {
            const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
            if (!collection)
                throw new Error('Collection not found');
            const newVariable = figma.variables.createVariable(variable.name + ' copy', collection, variable.resolvedType);
            // Copy value from first mode
            const modeId = Object.keys(variable.valuesByMode)[0];
            const value = variable.valuesByMode[modeId];
            newVariable.setValueForMode(modeId, value);
            await fetchData();
            figma.ui.postMessage({ type: 'update-success' });
        }
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Bulk update group from CSV
async function bulkUpdateGroup(collectionId, groupName, updates) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        const existingVariables = await figma.variables.getLocalVariablesAsync();
        // Find all variables in this group (matching groupName/ prefix)
        const groupPrefix = groupName + '/';
        const groupVariables = existingVariables.filter(v => v.variableCollectionId === collectionId && v.name.startsWith(groupPrefix));
        // Get set of names that should exist after update
        const updateNames = new Set(updates.map(u => u.name));
        // Delete variables that are in the group but not in updates
        for (const variable of groupVariables) {
            if (!updateNames.has(variable.name)) {
                variable.remove();
            }
        }
        // Update or create variables
        for (const update of updates) {
            // Find existing variable with this name
            const existing = existingVariables.find(v => v.variableCollectionId === collectionId && v.name === update.name);
            if (existing) {
                // Update existing variable
                const parsedValue = await parseValue(update.value, existing.resolvedType);
                existing.setValueForMode(modeId, parsedValue);
            }
            else {
                // Create new variable - detect type from value
                let varType = 'STRING';
                if (update.value.startsWith('#') || update.value.startsWith('rgb') || update.value.startsWith('{')) {
                    varType = 'COLOR';
                }
                else if (!isNaN(Number(update.value))) {
                    varType = 'FLOAT';
                }
                else if (update.value === 'true' || update.value === 'false') {
                    varType = 'BOOLEAN';
                }
                const newVariable = figma.variables.createVariable(update.name, collection, varType);
                const parsedValue = await parseValue(update.value, varType);
                newVariable.setValueForMode(modeId, parsedValue);
            }
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
async function upsertShadeSourceVariable(collection, modeId, source) {
    let variable = null;
    if (source.id) {
        variable = await figma.variables.getVariableByIdAsync(source.id);
    }
    if (!variable) {
        const variables = await figma.variables.getLocalVariablesAsync();
        variable = variables.find(candidate => candidate.variableCollectionId === collection.id &&
            candidate.name === source.name &&
            candidate.resolvedType === 'COLOR') || null;
    }
    if (!variable) {
        variable = figma.variables.createVariable(source.name, collection, 'COLOR');
    }
    if (variable.variableCollectionId !== collection.id) {
        throw new Error('Source color must be in the selected collection');
    }
    if (variable.resolvedType !== 'COLOR') {
        throw new Error('Source variable must be a color');
    }
    if (variable.name !== source.name) {
        variable.name = source.name;
    }
    const parsedValue = await parseValue(source.value, 'COLOR');
    variable.setValueForMode(modeId, parsedValue);
    return variable;
}
async function persistShadeGeneratorConfig(sourceVariable, modeId, config, shadeVariables) {
    const generatedShades = [];
    for (const variable of shadeVariables) {
        generatedShades.push({
            id: variable.id,
            name: variable.name,
            value: await formatValue(variable.valuesByMode[modeId], variable.resolvedType),
        });
    }
    const storedConfig = {
        version: 1,
        sourceVariableId: sourceVariable.id,
        sourceName: sourceVariable.name,
        sourceValue: await formatValue(sourceVariable.valuesByMode[modeId], sourceVariable.resolvedType),
        shadeCount: config.shadeCount,
        lightValue: config.lightValue,
        darkValue: config.darkValue,
        lightnessCurve: config.lightnessCurve,
        saturationCurve: config.saturationCurve,
        hueCurve: config.hueCurve,
        generatedShades,
        updatedAt: new Date().toISOString(),
    };
    sourceVariable.setPluginData(SHADE_GENERATOR_CONFIG_KEY, JSON.stringify(storedConfig));
}
async function applyShadeUpdate(collection, modeId, deleteIds, shades, sourceVariable, config) {
    const existingVars = [];
    for (const id of Array.from(new Set(deleteIds))) {
        if (sourceVariable && id === sourceVariable.id) {
            continue;
        }
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) {
            existingVars.push({ id, variable });
        }
    }
    existingVars.sort((a, b) => extractShadeNumber(a.variable.name) - extractShadeNumber(b.variable.name));
    const sortedShades = [...shades].sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
    const finalShadeVariables = [];
    const reusedCount = Math.min(existingVars.length, sortedShades.length);
    for (let i = 0; i < reusedCount; i++) {
        const variable = existingVars[i].variable;
        const shade = sortedShades[i];
        variable.name = shade.name;
        const parsedValue = await parseValue(shade.value, 'COLOR');
        variable.setValueForMode(modeId, parsedValue);
        finalShadeVariables.push(variable);
    }
    for (let i = reusedCount; i < existingVars.length; i++) {
        existingVars[i].variable.remove();
    }
    for (let i = reusedCount; i < sortedShades.length; i++) {
        const shade = sortedShades[i];
        const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
        const parsedValue = await parseValue(shade.value, 'COLOR');
        variable.setValueForMode(modeId, parsedValue);
        finalShadeVariables.push(variable);
    }
    if (sourceVariable) {
        if (config) {
            await persistShadeGeneratorConfig(sourceVariable, modeId, config, finalShadeVariables);
        }
        else {
            clearShadeGeneratorConfig(sourceVariable);
        }
    }
}
async function syncManagedShadeSources() {
    const variables = await figma.variables.getLocalVariablesAsync();
    let syncedAny = false;
    for (const variable of variables) {
        if (variable.resolvedType !== 'COLOR')
            continue;
        const storedConfig = readShadeGeneratorConfig(variable);
        if (!storedConfig)
            continue;
        const modeId = Object.keys(variable.valuesByMode)[0];
        const currentSourceValue = await formatValue(variable.valuesByMode[modeId], variable.resolvedType);
        const sourceChanged = currentSourceValue !== storedConfig.sourceValue ||
            variable.name !== storedConfig.sourceName;
        if (!sourceChanged)
            continue;
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
        if (!collection)
            continue;
        const resolvedSourceRgb = await resolveSourceVariableRgb(variable);
        if (!resolvedSourceRgb)
            continue;
        const shades = buildManagedShadePayload(resolvedSourceRgb, variable.name, {
            shadeCount: storedConfig.shadeCount,
            lightValue: storedConfig.lightValue,
            darkValue: storedConfig.darkValue,
            lightnessCurve: storedConfig.lightnessCurve,
            saturationCurve: storedConfig.saturationCurve,
            hueCurve: storedConfig.hueCurve,
        });
        await applyShadeUpdate(collection, modeId, collectManagedShadeDeleteIds(variable, storedConfig, variables), shades, variable, {
            shadeCount: storedConfig.shadeCount,
            lightValue: storedConfig.lightValue,
            darkValue: storedConfig.darkValue,
            lightnessCurve: storedConfig.lightnessCurve,
            saturationCurve: storedConfig.saturationCurve,
            hueCurve: storedConfig.hueCurve,
        });
        syncedAny = true;
    }
    return syncedAny;
}
// Create color shades
async function createShades(collectionId, shades) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        for (const shade of shades) {
            const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
            const parsedValue = await parseValue(shade.value, 'COLOR');
            variable.setValueForMode(modeId, parsedValue);
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Update color shades (update existing, delete extras, create new ones as needed)
async function updateShades(collectionId, deleteIds, shades, source, config) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        const sourceVariable = source
            ? await upsertShadeSourceVariable(collection, modeId, source)
            : null;
        await applyShadeUpdate(collection, modeId, deleteIds, shades, sourceVariable, config);
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Remove shades and keep the source color
async function removeShades(collectionId, deleteIds, source) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        const sourceVariable = source
            ? await upsertShadeSourceVariable(collection, modeId, source)
            : null;
        for (const id of Array.from(new Set(deleteIds))) {
            if (sourceVariable && id === sourceVariable.id) {
                continue;
            }
            const variable = await figma.variables.getVariableByIdAsync(id);
            if (variable) {
                variable.remove();
            }
        }
        if (sourceVariable) {
            clearShadeGeneratorConfig(sourceVariable);
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Create number steps
async function createSteps(collectionId, steps) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        for (const step of steps) {
            const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
            const parsedValue = await parseValue(step.value, 'FLOAT');
            variable.setValueForMode(modeId, parsedValue);
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Update number steps (update existing, delete extras, create new ones as needed)
async function updateSteps(collectionId, deleteIds, steps) {
    try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        // Get existing variables from the deleteIds list
        const existingVars = [];
        for (const id of deleteIds) {
            const variable = await figma.variables.getVariableByIdAsync(id);
            if (variable) {
                existingVars.push({ id, variable });
            }
        }
        // Steps arrive in the correct order from UI, so preserve that order
        // Match existing variables to new steps by index position
        const reusedCount = Math.min(existingVars.length, steps.length);
        for (let i = 0; i < reusedCount; i++) {
            const variable = existingVars[i].variable;
            const step = steps[i];
            // Update name and value
            variable.name = step.name;
            const parsedValue = await parseValue(step.value, 'FLOAT');
            variable.setValueForMode(modeId, parsedValue);
        }
        // Delete excess variables if we have more existing than needed
        for (let i = reusedCount; i < existingVars.length; i++) {
            existingVars[i].variable.remove();
        }
        // Create new variables if we need more than we had
        for (let i = reusedCount; i < steps.length; i++) {
            const step = steps[i];
            const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
            const parsedValue = await parseValue(step.value, 'FLOAT');
            variable.setValueForMode(modeId, parsedValue);
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Remove steps and convert back to single number
async function removeSteps(collectionId, deleteIds, newNumber) {
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
        if (!collection)
            throw new Error('Collection not found');
        const modeId = collection.modes[0].modeId;
        const variable = figma.variables.createVariable(newNumber.name, collection, 'FLOAT');
        const parsedValue = await parseValue(newNumber.value, 'FLOAT');
        variable.setValueForMode(modeId, parsedValue);
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Reorder variable (plugin-only - Figma API doesn't support native reordering)
async function reorderVariable(draggedId, targetId, insertBefore) {
    try {
        // Get current Figma order from collections
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let order = [];
        for (const collection of collections) {
            order = order.concat(collection.variableIds);
        }
        // Remove dragged item from current position
        const draggedIndex = order.indexOf(draggedId);
        if (draggedIndex > -1) {
            order.splice(draggedIndex, 1);
        }
        // Find target position and insert
        let targetIndex = order.indexOf(targetId);
        if (!insertBefore) {
            targetIndex++;
        }
        order.splice(targetIndex, 0, draggedId);
        // Save custom order (Note: this only affects plugin display, not Figma's native panel)
        setVariableOrder(order);
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        console.error('[Plugin] Reorder error:', error);
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Update from JSON
async function updateFromJson(data) {
    try {
        // Get collection IDs from the data
        const collectionIds = new Set(data.collections.map(c => c.id));
        // Get all current variables from those collections
        const allVariables = await figma.variables.getLocalVariablesAsync();
        const currentVarsInCollections = allVariables.filter(v => collectionIds.has(v.variableCollectionId));
        // Get IDs of variables in the JSON data
        const jsonVarIds = new Set(data.variables.map(v => v.id).filter(Boolean));
        // Delete variables that exist in Figma but not in the JSON
        for (const variable of currentVarsInCollections) {
            if (!jsonVarIds.has(variable.id)) {
                variable.remove();
            }
        }
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
                        const parsedValue = await parseValue(varData.value, varData.type || variable.resolvedType);
                        variable.setValueForMode(modeId, parsedValue);
                    }
                }
            }
        }
        await fetchData();
        figma.ui.postMessage({ type: 'update-success' });
    }
    catch (error) {
        figma.ui.postMessage({ type: 'update-error', error: error.message });
    }
}
// Poll for changes
async function checkForChanges() {
    const syncedManagedShades = await syncManagedShadeSources();
    if (syncedManagedShades) {
        await fetchData();
        return;
    }
    const { hash: currentHash } = await buildUiState();
    if (lastDataHash && currentHash !== lastDataHash) {
        figma.ui.postMessage({ type: 'changes-detected' });
    }
}
// Start polling
setInterval(checkForChanges, 2000);
// Initial fetch
fetchData();
// Message handler
figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
        case 'refresh':
            console.log('[Plugin] Refresh received');
            setVariableOrder([]); // Clear custom order on refresh to match Figma's order
            await fetchData();
            console.log('[Plugin] Refresh complete');
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
        case 'bulk-update-group':
            await bulkUpdateGroup(msg.collectionId, msg.groupName, msg.updates);
            break;
        case 'update-from-json':
            await updateFromJson(msg.data);
            break;
        case 'create-shades':
            await createShades(msg.collectionId, msg.shades);
            break;
        case 'update-shades':
            await updateShades(msg.collectionId, msg.deleteIds, msg.shades, msg.source, msg.config);
            break;
        case 'remove-shades':
            await removeShades(msg.collectionId, msg.deleteIds, msg.source);
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
        case 'reset-order':
            setVariableOrder([]);
            await fetchData();
            break;
        case 'get-client-storage':
            try {
                const value = await figma.clientStorage.getAsync(msg.key);
                figma.ui.postMessage({ type: 'client-storage-data', key: msg.key, value });
            }
            catch (error) {
                console.error('[Plugin] Error getting client storage:', error);
            }
            break;
        case 'set-client-storage':
            try {
                await figma.clientStorage.setAsync(msg.key, msg.value);
            }
            catch (error) {
                console.error('[Plugin] Error setting client storage:', error);
            }
            break;
        case 'resize':
            figma.ui.resize(msg.width, msg.height);
            break;
        case 'cancel':
            figma.closePlugin();
            break;
    }
};
