// Shades modal component with curve editor for lightness, saturation, and hue

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { ShadeCurveHandles, VariableData } from '../../types';
import { CloseIcon, RefreshIcon } from '../Icons';
import { Input } from '../common/Input';
import { TextButton } from '../common/Button';
import { Select } from '../common/Select';
import {
  rgbObjToHex,
  parseColorToRgb,
  hexToRgb,
  rgbToHex,
} from '../../utils/color';
import {
  buildShadePayload,
  clamp,
  createDefaultCurveHandles,
  DEFAULT_SHADE_DARK_VALUE,
  DEFAULT_SHADE_LIGHT_VALUE,
  evaluateCurveAtNodes,
  findClosestShadeIndex,
  getBaseShadeToneAtT,
  getShadeBaseIndex,
  getShadeBaseIndexForColor,
  getShadeBaseT,
  normalizeCurveHandles,
  normalizeShadeBaseIndex,
  remapShadeBaseIndex,
} from '../../utils/shades';

type CurveProperty = 'lightness' | 'saturation' | 'hue';
type DragTarget =
  | 'leftHandle1'
  | 'leftHandle2'
  | 'rightHandle1'
  | 'rightHandle2'
  | 'startNode'
  | 'endNode';
const CURVE_PROPERTIES: CurveProperty[] = ['lightness', 'saturation', 'hue'];

const CURVE_EDITOR_HEIGHT = 200;
const CURVE_PADDING_Y = 12;
const CURVE_MIN_HANDLE_GAP = 0.05;

const CURVE_PROPERTY_CONFIG: Record<CurveProperty, { min: number; max: number; unit: string; label: string }> = {
  lightness: { min: -100, max: 100, unit: '%', label: 'Lightness offset' },
  saturation: { min: -100, max: 100, unit: '%', label: 'Saturation offset' },
  hue: { min: -180, max: 180, unit: 'deg', label: 'Hue shift' },
};

const CURVE_DISPLAY_CONFIG: Record<CurveProperty, { min: number; max: number }> = {
  lightness: { min: 0, max: 100 },
  saturation: { min: -100, max: 100 },
  hue: { min: -180, max: 180 },
};

function getCurvePropertyValueRange(property: CurveProperty) {
  return CURVE_PROPERTY_CONFIG[property];
}

function valueToCurveY(value: number, property: CurveProperty, minY: number, maxY: number): number {
  const { min, max } = CURVE_DISPLAY_CONFIG[property];
  const normalized = (clamp(value, min, max) - min) / (max - min);
  return minY + normalized * (maxY - minY);
}

function curveYToValue(y: number, property: CurveProperty, minY: number, maxY: number): number {
  const { min, max } = CURVE_DISPLAY_CONFIG[property];
  const clampedY = clamp(y, minY, maxY);
  const normalized = (clampedY - minY) / (maxY - minY);
  return clamp(min + normalized * (max - min), min, max);
}

function getCurvePropertyLabel(property: CurveProperty): string {
  return property.charAt(0).toUpperCase() + property.slice(1);
}

function isDefaultCurve(curve: ShadeCurveHandles, count: number, baseIndex: number): boolean {
  const defaults = createDefaultCurveHandles(count, baseIndex);
  return (
    curve.startValue === defaults.startValue &&
    curve.leftHandle1.t === defaults.leftHandle1.t &&
    curve.leftHandle1.value === defaults.leftHandle1.value &&
    curve.leftHandle2.t === defaults.leftHandle2.t &&
    curve.leftHandle2.value === defaults.leftHandle2.value &&
    curve.rightHandle1.t === defaults.rightHandle1.t &&
    curve.rightHandle1.value === defaults.rightHandle1.value &&
    curve.rightHandle2.t === defaults.rightHandle2.t &&
    curve.rightHandle2.value === defaults.rightHandle2.value &&
    curve.endValue === defaults.endValue
  );
}

function isShadeVariableName(name: string): boolean {
  return /^(.+)\/(\d+)$/.test(name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractShadeNumber(name: string): number {
  const match = name.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function getLegacyBaseColor(shades: VariableData[]): string {
  const preferred =
    shades.find(shade => /\/500$/.test(shade.name)) ||
    shades[Math.floor(shades.length / 2)] ||
    shades[0];

  const rgb = preferred ? parseColorToRgb(preferred.value) : null;
  return rgb ? rgbObjToHex(rgb) : '#000000';
}

export function ShadesModal() {
  const { modals, closeShadesModal, openColorPicker } = useModalContext();
  const {
    variables,
    selectedCollectionId,
    getShadeGroupByGroupName,
    getShadeGroupBySourceId,
  } = useAppContext();
  const isOpen = !!modals.shadesModal;
  const preSelectedGroup = modals.shadesModal?.groupName || '';

  const [sourceColorId, setSourceColorId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [baseColor, setBaseColor] = useState('#000000');
  const [shadeCount, setShadeCount] = useState(11);
  const [baseIndex, setBaseIndex] = useState(getShadeBaseIndex(11));

  // Curve states
  const [lightnessCurve, setLightnessCurve] = useState<ShadeCurveHandles>(() => createDefaultCurveHandles(11, getShadeBaseIndex(11)));
  const [saturationCurve, setSaturationCurve] = useState<ShadeCurveHandles>(() => createDefaultCurveHandles(11, getShadeBaseIndex(11)));
  const [hueCurve, setHueCurve] = useState<ShadeCurveHandles>(() => createDefaultCurveHandles(11, getShadeBaseIndex(11)));
  const [activeProperty, setActiveProperty] = useState<CurveProperty>('lightness');

  // Drag state for curve editor
  const [dragState, setDragState] = useState<{
    target: DragTarget;
    property: CurveProperty;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const curvesRef = useRef<Record<CurveProperty, ShadeCurveHandles>>({
    lightness: createDefaultCurveHandles(11, getShadeBaseIndex(11)),
    saturation: createDefaultCurveHandles(11, getShadeBaseIndex(11)),
    hue: createDefaultCurveHandles(11, getShadeBaseIndex(11)),
  });

  // Track container width for proper curve rendering
  useEffect(() => {
    if (!isOpen || !groupName) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    // Initial measurement after a frame to ensure DOM is ready
    const frame = requestAnimationFrame(updateWidth);

    // Also listen for resize
    window.addEventListener('resize', updateWidth);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateWidth);
    };
  }, [isOpen, groupName]);

  const sourceColors = useMemo(() => {
    return variables
      .filter(
        variable =>
          variable.collectionId === selectedCollectionId &&
          variable.resolvedType === 'COLOR' &&
          !isShadeVariableName(variable.name)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variables, selectedCollectionId]);

  const selectedSourceVariable = useMemo(() => {
    if (!sourceColorId) return null;
    return sourceColors.find(variable => variable.id === sourceColorId) || null;
  }, [sourceColorId, sourceColors]);

  const legacyShadeVariables = useMemo(() => {
    if (!groupName || !selectedCollectionId) return [];
    const shadePattern = new RegExp(`^${escapeRegExp(groupName)}/\\d+$`);
    return variables
      .filter(
        variable =>
          variable.collectionId === selectedCollectionId &&
          variable.resolvedType === 'COLOR' &&
          shadePattern.test(variable.name)
      )
      .sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
  }, [groupName, selectedCollectionId, variables]);

  const managedShadeGroup = useMemo(() => {
    if (selectedSourceVariable) {
      return getShadeGroupBySourceId(selectedSourceVariable.id);
    }
    if (groupName) {
      return getShadeGroupByGroupName(groupName);
    }
    return null;
  }, [selectedSourceVariable, groupName, getShadeGroupBySourceId, getShadeGroupByGroupName]);

  const existingShadeIds = useMemo(() => {
    if (managedShadeGroup) {
      return managedShadeGroup.deleteIds;
    }
    return legacyShadeVariables.map(variable => variable.id);
  }, [managedShadeGroup, legacyShadeVariables]);

  const existingGroup = existingShadeIds.length > 0;

  const getLegacyShadesForGroup = useCallback((nextGroupName: string) => {
    if (!nextGroupName || !selectedCollectionId) return [];
    const shadePattern = new RegExp(`^${escapeRegExp(nextGroupName)}/\\d+$`);
    return variables
      .filter(
        variable =>
          variable.collectionId === selectedCollectionId &&
          variable.resolvedType === 'COLOR' &&
          shadePattern.test(variable.name)
      )
      .sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
  }, [selectedCollectionId, variables]);

  const applySourceSelection = useCallback((sourceVariable: VariableData | null, forcedGroupName?: string) => {
    const nextGroupName = sourceVariable?.name || forcedGroupName || '';
    const nextLegacyShades = getLegacyShadesForGroup(nextGroupName);
    const nextManagedGroup = sourceVariable
      ? getShadeGroupBySourceId(sourceVariable.id)
      : (forcedGroupName ? getShadeGroupByGroupName(forcedGroupName) : null);
    const nextShadeCount = nextManagedGroup?.config.shadeCount || nextLegacyShades.length || 11;
    const nextSourceRgb = sourceVariable
      ? parseColorToRgb(sourceVariable.value) || parseColorToRgb(nextManagedGroup?.config.sourceValue || '')
      : (forcedGroupName ? parseColorToRgb(getLegacyBaseColor(nextLegacyShades)) : null);
    const nextBaseColorHex = nextSourceRgb ? rgbObjToHex(nextSourceRgb) : '#000000';

    setSourceColorId(sourceVariable?.id || '');
    setGroupName(nextGroupName);
    setActiveProperty('lightness');

    setBaseColor(nextBaseColorHex);

    if (nextManagedGroup) {
      const nextBaseIndex = nextSourceRgb
        ? getShadeBaseIndexForColor(nextBaseColorHex, nextManagedGroup.config.shadeCount)
        : normalizeShadeBaseIndex(nextManagedGroup.config.baseIndex, nextManagedGroup.config.shadeCount);
      setShadeCount(nextManagedGroup.config.shadeCount);
      setBaseIndex(nextBaseIndex);
      setLightnessCurve(normalizeCurveHandles(nextManagedGroup.config.lightnessCurve, nextManagedGroup.config.shadeCount, nextBaseIndex));
      setSaturationCurve(normalizeCurveHandles(nextManagedGroup.config.saturationCurve, nextManagedGroup.config.shadeCount, nextBaseIndex));
      setHueCurve(normalizeCurveHandles(nextManagedGroup.config.hueCurve, nextManagedGroup.config.shadeCount, nextBaseIndex));
      return;
    }

    const nextBaseIndex = nextLegacyShades.length > 0
      ? findClosestShadeIndex(nextBaseColorHex, nextLegacyShades, nextShadeCount)
      : getShadeBaseIndexForColor(nextBaseColorHex, nextShadeCount);

    setShadeCount(nextShadeCount);
    setBaseIndex(nextBaseIndex);
    setLightnessCurve(createDefaultCurveHandles(nextShadeCount, nextBaseIndex));
    setSaturationCurve(createDefaultCurveHandles(nextShadeCount, nextBaseIndex));
    setHueCurve(createDefaultCurveHandles(nextShadeCount, nextBaseIndex));
  }, [
    findClosestShadeIndex,
    getShadeGroupByGroupName,
    getShadeGroupBySourceId,
    getLegacyShadesForGroup,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    if (preSelectedGroup) {
      const sourceVariable = sourceColors.find(variable => variable.name === preSelectedGroup) || null;
      applySourceSelection(sourceVariable, preSelectedGroup);
      return;
    }

    if (selectedSourceVariable) {
      applySourceSelection(selectedSourceVariable);
      return;
    }

    setSourceColorId('');
    setGroupName('');
    setBaseColor('#000000');
    setShadeCount(11);
    setBaseIndex(getShadeBaseIndex(11));
    setLightnessCurve(createDefaultCurveHandles(11, getShadeBaseIndex(11)));
    setSaturationCurve(createDefaultCurveHandles(11, getShadeBaseIndex(11)));
    setHueCurve(createDefaultCurveHandles(11, getShadeBaseIndex(11)));
    setActiveProperty('lightness');
  }, [isOpen, preSelectedGroup, sourceColors, selectedSourceVariable, applySourceSelection]);

  useEffect(() => {
    if (!groupName) return;

    const nextBaseIndex = managedShadeGroup
      ? getShadeBaseIndexForColor(baseColor, shadeCount)
      : legacyShadeVariables.length > 0
      ? findClosestShadeIndex(baseColor, legacyShadeVariables, shadeCount)
      : getShadeBaseIndexForColor(baseColor, shadeCount);

    if (nextBaseIndex === baseIndex) return;

    setBaseIndex(nextBaseIndex);
    setLightnessCurve(prev => normalizeCurveHandles(prev, shadeCount, nextBaseIndex));
    setSaturationCurve(prev => normalizeCurveHandles(prev, shadeCount, nextBaseIndex));
    setHueCurve(prev => normalizeCurveHandles(prev, shadeCount, nextBaseIndex));
  }, [
    baseColor,
    baseIndex,
    findClosestShadeIndex,
    getShadeBaseIndexForColor,
    groupName,
    legacyShadeVariables,
    managedShadeGroup,
    shadeCount,
  ]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSourceId = e.target.value;
    const sourceVariable = sourceColors.find(variable => variable.id === nextSourceId) || null;
    applySourceSelection(sourceVariable);
  };

  const activeCurve = useMemo((): ShadeCurveHandles => {
    switch (activeProperty) {
      case 'saturation': return saturationCurve;
      case 'hue': return hueCurve;
      default: return lightnessCurve;
    }
  }, [activeProperty, lightnessCurve, saturationCurve, hueCurve]);

  useEffect(() => {
    curvesRef.current = {
      lightness: lightnessCurve,
      saturation: saturationCurve,
      hue: hueCurve,
    };
  }, [lightnessCurve, saturationCurve, hueCurve]);

  const setCurveByProperty = useCallback((property: CurveProperty, curve: ShadeCurveHandles) => {
    const normalizedCurve = normalizeCurveHandles(curve, shadeCount, baseIndex);
    switch (property) {
      case 'saturation': setSaturationCurve(normalizedCurve); break;
      case 'hue': setHueCurve(normalizedCurve); break;
      default: setLightnessCurve(normalizedCurve); break;
    }
  }, [baseIndex, shadeCount]);

  const generatedShades = useMemo(() => {
    if (!groupName) return [];
    return buildShadePayload(
      baseColor,
      groupName,
      shadeCount,
      baseIndex,
      lightnessCurve,
      saturationCurve,
      hueCurve,
      DEFAULT_SHADE_LIGHT_VALUE,
      DEFAULT_SHADE_DARK_VALUE
    );
  }, [baseColor, baseIndex, groupName, hueCurve, lightnessCurve, saturationCurve, shadeCount]);

  const shadeColors = useMemo(() => {
    return generatedShades.map(shade => rgbToHex(shade.value));
  }, [generatedShades]);

  const curveResetState = useMemo(() => ({
    lightness: !isDefaultCurve(lightnessCurve, shadeCount, baseIndex),
    saturation: !isDefaultCurve(saturationCurve, shadeCount, baseIndex),
    hue: !isDefaultCurve(hueCurve, shadeCount, baseIndex),
  }), [baseIndex, hueCurve, lightnessCurve, saturationCurve, shadeCount]);

  const getCurveDisplayValue = useCallback((property: CurveProperty, t: number, adjustment: number) => {
    if (property === 'lightness') {
      const baseTone = getBaseShadeToneAtT(
        t,
        shadeCount,
        baseIndex,
        DEFAULT_SHADE_LIGHT_VALUE,
        DEFAULT_SHADE_DARK_VALUE
      );
      return clamp(baseTone + adjustment, 0, 100);
    }

    const { min, max } = CURVE_DISPLAY_CONFIG[property];
    return clamp(adjustment, min, max);
  }, [baseIndex, shadeCount]);

  const getStoredCurveValue = useCallback((property: CurveProperty, t: number, displayValue: number) => {
    if (property === 'lightness') {
      const baseTone = getBaseShadeToneAtT(
        t,
        shadeCount,
        baseIndex,
        DEFAULT_SHADE_LIGHT_VALUE,
        DEFAULT_SHADE_DARK_VALUE
      );
      const { min, max } = getCurvePropertyValueRange(property);
      return clamp(displayValue - baseTone, min, max);
    }

    const { min, max } = getCurvePropertyValueRange(property);
    return clamp(displayValue, min, max);
  }, [baseIndex, shadeCount]);

  const handleShadeCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nextShadeCount = clamp(Number(e.target.value) || 0, 2, 20);
    const nextBaseIndex = remapShadeBaseIndex(baseIndex, shadeCount, nextShadeCount);

    setShadeCount(nextShadeCount);
    setBaseIndex(nextBaseIndex);
    setLightnessCurve(prev => normalizeCurveHandles(prev, nextShadeCount, nextBaseIndex));
    setSaturationCurve(prev => normalizeCurveHandles(prev, nextShadeCount, nextBaseIndex));
    setHueCurve(prev => normalizeCurveHandles(prev, nextShadeCount, nextBaseIndex));
  }, [baseIndex, shadeCount]);

  // Handle generation
  const handleGenerate = () => {
    if (!groupName || !baseColor || !selectedCollectionId || generatedShades.length === 0) return;

    post({
      type: 'update-shades',
      collectionId: selectedCollectionId,
      deleteIds: existingShadeIds,
      shades: generatedShades,
      source: {
        id: selectedSourceVariable?.id,
        name: groupName,
        value: hexToRgb(baseColor),
      },
      config: {
        shadeCount,
        baseIndex,
        lightValue: DEFAULT_SHADE_LIGHT_VALUE,
        darkValue: DEFAULT_SHADE_DARK_VALUE,
        lightnessCurve,
        saturationCurve,
        hueCurve,
      },
    });

    closeShadesModal();
  };

  const handleRemove = () => {
    if (!groupName || existingShadeIds.length === 0 || !selectedCollectionId) return;

    post({
      type: 'remove-shades',
      collectionId: selectedCollectionId,
      deleteIds: existingShadeIds,
      source: {
        id: selectedSourceVariable?.id,
        name: groupName,
        value: hexToRgb(baseColor),
      },
    });
    closeShadesModal();
  };

  const handleResetCurve = useCallback((property: CurveProperty) => {
    setCurveByProperty(property, createDefaultCurveHandles(shadeCount, baseIndex));
    setDragState(current => (current?.property === property ? null : current));
  }, [baseIndex, setCurveByProperty, shadeCount]);

  // Curve editor mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, target: DragTarget) => {
    e.preventDefault();
    setDragState({
      target,
      property: activeProperty,
    });
  }, [activeProperty]);

  useEffect(() => {
    if (!dragState || containerWidth === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const curve = curvesRef.current[dragState.property];
      const updatedCurve = { ...curve };
      const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, shadeCount);
      const baseT = getShadeBaseT(shadeCount, normalizedBaseIndex);
      const minY = CURVE_PADDING_Y;
      const maxY = CURVE_EDITOR_HEIGHT - CURVE_PADDING_Y;

      const swatchWidth = containerWidth / shadeCount;
      const firstNodeX = swatchWidth / 2;
      const lastNodeX = containerWidth - swatchWidth / 2;
      const rangeX = Math.max(1, lastNodeX - firstNodeX);
      const svgRect = svgRef.current?.getBoundingClientRect();

      if (!svgRect || svgRect.width === 0 || svgRect.height === 0) return;

      const localX = ((e.clientX - svgRect.left) / svgRect.width) * containerWidth;
      const localY = ((e.clientY - svgRect.top) / svgRect.height) * CURVE_EDITOR_HEIGHT;
      const nextDisplayValue = curveYToValue(localY, dragState.property, minY, maxY);

      if (
        dragState.target === 'leftHandle1' ||
        dragState.target === 'leftHandle2' ||
        dragState.target === 'rightHandle1' ||
        dragState.target === 'rightHandle2'
      ) {
        let newT = clamp((localX - firstNodeX) / rangeX, 0, 1);

        if (dragState.target === 'leftHandle1') {
          const maxT = clamp(curve.leftHandle2.t - CURVE_MIN_HANDLE_GAP, 0, baseT);
          newT = clamp(newT, 0, maxT);
          updatedCurve.leftHandle1 = {
            t: newT,
            value: getStoredCurveValue(dragState.property, newT, nextDisplayValue),
          };
        } else if (dragState.target === 'leftHandle2') {
          const minT = clamp(curve.leftHandle1.t + CURVE_MIN_HANDLE_GAP, 0, baseT);
          newT = clamp(newT, minT, baseT);
          updatedCurve.leftHandle2 = {
            t: newT,
            value: getStoredCurveValue(dragState.property, newT, nextDisplayValue),
          };
        } else if (dragState.target === 'rightHandle1') {
          const maxT = clamp(curve.rightHandle2.t - CURVE_MIN_HANDLE_GAP, baseT, 1);
          newT = clamp(newT, baseT, maxT);
          updatedCurve.rightHandle1 = {
            t: newT,
            value: getStoredCurveValue(dragState.property, newT, nextDisplayValue),
          };
        } else {
          const minT = clamp(curve.rightHandle1.t + CURVE_MIN_HANDLE_GAP, baseT, 1);
          newT = clamp(newT, minT, 1);
          updatedCurve.rightHandle2 = {
            t: newT,
            value: getStoredCurveValue(dragState.property, newT, nextDisplayValue),
          };
        }
      } else {
        const targetT = dragState.target === 'startNode' ? 0 : 1;
        const nextStoredValue = getStoredCurveValue(dragState.property, targetT, nextDisplayValue);
        if (dragState.target === 'startNode') {
          updatedCurve.startValue = nextStoredValue;
        } else {
          updatedCurve.endValue = nextStoredValue;
        }
      }

      setCurveByProperty(dragState.property, updatedCurve);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [baseIndex, dragState, getStoredCurveValue, setCurveByProperty, shadeCount, containerWidth]);

  // Render curve SVG
  const renderCurve = () => {
    const curve = normalizeCurveHandles(activeCurve, shadeCount, baseIndex);
    const count = shadeCount;
    if (count < 2 || containerWidth === 0) return null;

    const nodeRadius = 8;
    const baseNodeRadius = 10;
    const handleRadius = 8;
    const handleHitRadius = 16;
    const minY = CURVE_PADDING_Y;
    const maxY = CURVE_EDITOR_HEIGHT - CURVE_PADDING_Y;
    const zeroY = valueToCurveY(0, activeProperty, minY, maxY);
    const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, count);
    const baseT = getShadeBaseT(count, normalizedBaseIndex);

    const swatchWidth = containerWidth / count;
    const firstNodeX = swatchWidth / 2;
    const lastNodeX = containerWidth - swatchWidth / 2;
    const rangeX = Math.max(1, lastNodeX - firstNodeX);

    const adjustments = evaluateCurveAtNodes(curve, count, normalizedBaseIndex);
    const nodePositions: { x: number; y: number; value: number }[] = [];
    const baseNodePositions: { x: number; y: number }[] = [];

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = firstNodeX + rangeX * t;
      const adjustmentValue = adjustments[i];
      const displayValue = getCurveDisplayValue(activeProperty, t, adjustmentValue);
      const y = valueToCurveY(displayValue, activeProperty, minY, maxY);
      nodePositions.push({ x, y, value: displayValue });

      if (activeProperty === 'lightness') {
        const baseTone = getBaseShadeToneAtT(
          t,
          count,
          normalizedBaseIndex,
          DEFAULT_SHADE_LIGHT_VALUE,
          DEFAULT_SHADE_DARK_VALUE
        );
        baseNodePositions.push({
          x,
          y: valueToCurveY(baseTone, activeProperty, minY, maxY),
        });
      }
    }

    const startNode = nodePositions[0];
    const baseNode = nodePositions[normalizedBaseIndex];
    const endNode = nodePositions[count - 1];

    const leftHandle1X = firstNodeX + rangeX * curve.leftHandle1.t;
    const leftHandle1Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, curve.leftHandle1.t, curve.leftHandle1.value),
      activeProperty,
      minY,
      maxY
    );
    const leftHandle2X = firstNodeX + rangeX * curve.leftHandle2.t;
    const leftHandle2Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, curve.leftHandle2.t, curve.leftHandle2.value),
      activeProperty,
      minY,
      maxY
    );
    const rightHandle1X = firstNodeX + rangeX * curve.rightHandle1.t;
    const rightHandle1Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, curve.rightHandle1.t, curve.rightHandle1.value),
      activeProperty,
      minY,
      maxY
    );
    const rightHandle2X = firstNodeX + rangeX * curve.rightHandle2.t;
    const rightHandle2Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, curve.rightHandle2.t, curve.rightHandle2.value),
      activeProperty,
      minY,
      maxY
    );

    const pathD = [
      `M ${startNode.x} ${startNode.y}`,
      `C ${leftHandle1X} ${leftHandle1Y}, ${leftHandle2X} ${leftHandle2Y}, ${baseNode.x} ${baseNode.y}`,
      `C ${rightHandle1X} ${rightHandle1Y}, ${rightHandle2X} ${rightHandle2Y}, ${endNode.x} ${endNode.y}`,
    ].join(' ');
    const basePathD = activeProperty === 'lightness' && baseNodePositions.length > 1
      ? baseNodePositions.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
      : null;

    const renderHandle = (key: DragTarget, x: number, y: number) => (
      <g key={key}>
        <circle
          cx={x}
          cy={y}
          r={handleHitRadius}
          fill="transparent"
          style={{ cursor: 'move' }}
          onMouseDown={e => handleMouseDown(e, key)}
        />
        <rect
          x={x - handleRadius}
          y={y - handleRadius}
          width={handleRadius * 2}
          height={handleRadius * 2}
          fill="var(--accent)"
          stroke="var(--bg)"
          strokeWidth={2}
          rx={2}
          style={{ cursor: 'move', pointerEvents: 'none' }}
          className={dragState?.target === key ? 'handle-active' : ''}
        />
      </g>
    );

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${containerWidth} ${CURVE_EDITOR_HEIGHT}`}
        style={{ width: containerWidth, height: CURVE_EDITOR_HEIGHT }}
        className="curve-svg"
      >
        {/* Grid lines */}
        {Array.from({ length: count + 1 }).map((_, i) => (
          <line
            key={`grid-${i}`}
            x1={i * swatchWidth}
            y1={0}
            x2={i * swatchWidth}
            y2={CURVE_EDITOR_HEIGHT}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.35}
          />
        ))}

        {activeProperty === 'lightness' && basePathD ? (
          <path
            d={basePathD}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="4,4"
            opacity={0.8}
          />
        ) : (
          <line
            x1={0}
            y1={zeroY}
            x2={containerWidth}
            y2={zeroY}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.3}
          />
        )}

        {/* Curve path */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {/* Handle lines */}
        <line
          x1={startNode.x}
          y1={startNode.y}
          x2={leftHandle1X}
          y2={leftHandle1Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1={baseNode.x}
          y1={baseNode.y}
          x2={leftHandle2X}
          y2={leftHandle2Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1={baseNode.x}
          y1={baseNode.y}
          x2={rightHandle1X}
          y2={rightHandle1Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1={endNode.x}
          y1={endNode.y}
          x2={rightHandle2X}
          y2={rightHandle2Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />

        {renderHandle('leftHandle1', leftHandle1X, leftHandle1Y)}
        {renderHandle('leftHandle2', leftHandle2X, leftHandle2Y)}
        {renderHandle('rightHandle1', rightHandle1X, rightHandle1Y)}
        {renderHandle('rightHandle2', rightHandle2X, rightHandle2Y)}

        {/* Nodes */}
        {nodePositions.map((np, i) => {
          const isFirstOrLast = i === 0 || i === nodePositions.length - 1;
          const isBaseNode = i === normalizedBaseIndex;
          const fillColor = shadeColors[i] || 'var(--bg)';
          return (
            <circle
              key={`node-${i}`}
              cx={np.x}
              cy={np.y}
              r={isBaseNode ? baseNodeRadius : nodeRadius}
              fill={fillColor}
              stroke={isBaseNode ? 'var(--text)' : 'var(--accent)'}
              strokeWidth={isBaseNode ? 3 : 2}
              className={isBaseNode ? 'curve-node curve-node-base' : 'curve-node'}
              style={isFirstOrLast ? { cursor: 'ns-resize' } : undefined}
              onMouseDown={isFirstOrLast ? e => handleMouseDown(e, i === 0 ? 'startNode' : 'endNode') : undefined}
            />
          );
        })}
      </svg>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeShadesModal()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Generate Color Shades</h3>
          <button className="modal-close" onClick={closeShadesModal}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          {!preSelectedGroup && (
            <div className="form-group">
              <label>Select Color Group</label>
              <Select
                className="form-input"
                value={sourceColorId}
                onChange={handleSourceChange}
              >
                <Select.Option value="">-- Select a group --</Select.Option>
                {sourceColors.map(variable => (
                  <Select.Option key={variable.id} value={variable.id}>{variable.name}</Select.Option>
                ))}
              </Select>
            </div>
          )}

          {groupName && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Base Color</label>
                  <div className="color-input-wrapper">
                    <div
                      className="color-input-preview"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openColorPicker({
                        initialColor: baseColor,
                        onConfirm: setBaseColor,
                      })}
                    >
                      <div className="color-fill" style={{ background: baseColor }} />
                    </div>
                    <Input
                      type="text"
                      className="form-input mono"
                      value={baseColor}
                      onChange={e => setBaseColor(e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Shades</label>
                  <Input
                    type="number"
                    className="form-input"
                    value={shadeCount}
                    onChange={handleShadeCountChange}
                    min={2}
                    max={20}
                    style={{ width: 60 }}
                  />
                </div>
                <div className="form-group">
                  <label>Curve Property</label>
                  <div className="curve-property-toggle" role="tablist" aria-label="Curve Property">
                    {CURVE_PROPERTIES.map(property => {
                      const label = getCurvePropertyLabel(property);
                      const isActive = activeProperty === property;
                      const isEdited = curveResetState[property];

                      return (
                        <div
                          key={property}
                          className={`curve-property-item ${isActive ? 'active' : ''} ${isEdited ? 'has-reset' : ''}`}
                        >
                          <button
                            type="button"
                            className={`curve-property-btn ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveProperty(property)}
                            aria-pressed={isActive}
                          >
                            {label}
                          </button>
                          {isEdited && (
                            <button
                              type="button"
                              className="curve-property-reset"
                              onClick={() => handleResetCurve(property)}
                              aria-label={`Reset ${label}`}
                              title={`Reset ${label}`}
                            >
                              <RefreshIcon />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

	              {/* Curve Editor + Preview Combined */}
	              <div className="form-group">
		                <div className="curve-preview-combined">
	                  <div
	                    ref={containerRef}
                    className="curve-editor-container"
                  >
                    {renderCurve()}
                  </div>
                  <div className="shades-preview">
                    {shadeColors.map((color, i) => (
                      <div
                        key={i}
                        className={`shades-preview-item ${i === normalizeShadeBaseIndex(baseIndex, shadeCount) ? 'is-base-shade' : ''}`.trim()}
                        style={{ background: color }}
                        title={i === normalizeShadeBaseIndex(baseIndex, shadeCount) ? `${color} (Base)` : color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {existingGroup && (
            <TextButton variant="danger" onClick={handleRemove}>
              Remove Shades
            </TextButton>
          )}
          <div className="spacer" />
          <TextButton onClick={closeShadesModal}>Cancel</TextButton>
          <TextButton
            variant="primary"
            onClick={handleGenerate}
            disabled={!groupName || generatedShades.length === 0}
          >
            {existingGroup ? 'Update' : 'Generate'}
          </TextButton>
        </div>
      </div>
    </div>
  );
}
