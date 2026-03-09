// Shades modal component with curve editor for lightness, saturation, and hue

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { ShadeCurveHandles, VariableData } from '../../types';
import { CloseIcon, RefreshIcon } from '../Icons';
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
  getBaseShadeToneAtT,
} from '../../utils/shades';

type CurveProperty = 'lightness' | 'saturation' | 'hue';
type DragTarget = 'handle1' | 'handle2' | 'startNode' | 'endNode';
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

function isDefaultCurve(curve: ShadeCurveHandles): boolean {
  const defaults = createDefaultCurveHandles();
  return (
    curve.startValue === defaults.startValue &&
    curve.handle1.t === defaults.handle1.t &&
    curve.handle1.value === defaults.handle1.value &&
    curve.handle2.t === defaults.handle2.t &&
    curve.handle2.value === defaults.handle2.value &&
    curve.endValue === defaults.endValue
  );
}

function isShadeVariableName(name: string): boolean {
  return /^(.+)\/(\d+)$/.test(name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // Curve states
  const [lightnessCurve, setLightnessCurve] = useState<ShadeCurveHandles>(createDefaultCurveHandles);
  const [saturationCurve, setSaturationCurve] = useState<ShadeCurveHandles>(createDefaultCurveHandles);
  const [hueCurve, setHueCurve] = useState<ShadeCurveHandles>(createDefaultCurveHandles);
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
    lightness: createDefaultCurveHandles(),
    saturation: createDefaultCurveHandles(),
    hue: createDefaultCurveHandles(),
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
    return variables.filter(
      variable =>
        variable.collectionId === selectedCollectionId &&
        variable.resolvedType === 'COLOR' &&
        shadePattern.test(variable.name)
    );
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
    return variables.filter(
      variable =>
        variable.collectionId === selectedCollectionId &&
        variable.resolvedType === 'COLOR' &&
        shadePattern.test(variable.name)
    );
  }, [selectedCollectionId, variables]);

  const applySourceSelection = useCallback((sourceVariable: VariableData | null, forcedGroupName?: string) => {
    const nextGroupName = sourceVariable?.name || forcedGroupName || '';
    const nextLegacyShades = getLegacyShadesForGroup(nextGroupName);
    const nextManagedGroup = sourceVariable
      ? getShadeGroupBySourceId(sourceVariable.id)
      : (forcedGroupName ? getShadeGroupByGroupName(forcedGroupName) : null);

    setSourceColorId(sourceVariable?.id || '');
    setGroupName(nextGroupName);
    setActiveProperty('lightness');

    if (sourceVariable) {
      const rgb = parseColorToRgb(sourceVariable.value) || parseColorToRgb(nextManagedGroup?.config.sourceValue || '');
      setBaseColor(rgb ? rgbObjToHex(rgb) : '#000000');
    } else if (forcedGroupName) {
      setBaseColor(getLegacyBaseColor(nextLegacyShades));
    } else {
      setBaseColor('#000000');
    }

    if (nextManagedGroup) {
      setShadeCount(nextManagedGroup.config.shadeCount);
      setLightnessCurve(nextManagedGroup.config.lightnessCurve);
      setSaturationCurve(nextManagedGroup.config.saturationCurve);
      setHueCurve(nextManagedGroup.config.hueCurve);
      return;
    }

    setShadeCount(nextLegacyShades.length || 11);
    setLightnessCurve(createDefaultCurveHandles());
    setSaturationCurve(createDefaultCurveHandles());
    setHueCurve(createDefaultCurveHandles());
  }, [
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
    setLightnessCurve(createDefaultCurveHandles());
    setSaturationCurve(createDefaultCurveHandles());
    setHueCurve(createDefaultCurveHandles());
    setActiveProperty('lightness');
  }, [isOpen, preSelectedGroup, sourceColors, selectedSourceVariable, applySourceSelection]);

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
    switch (property) {
      case 'saturation': setSaturationCurve(curve); break;
      case 'hue': setHueCurve(curve); break;
      default: setLightnessCurve(curve); break;
    }
  }, []);

  const generatedShades = useMemo(() => {
    if (!groupName) return [];
    return buildShadePayload(
      baseColor,
      groupName,
      shadeCount,
      lightnessCurve,
      saturationCurve,
      hueCurve,
      DEFAULT_SHADE_LIGHT_VALUE,
      DEFAULT_SHADE_DARK_VALUE
    );
  }, [baseColor, groupName, hueCurve, lightnessCurve, saturationCurve, shadeCount]);

  const shadeColors = useMemo(() => {
    return generatedShades.map(shade => rgbToHex(shade.value));
  }, [generatedShades]);

  const curveResetState = useMemo(() => ({
    lightness: !isDefaultCurve(lightnessCurve),
    saturation: !isDefaultCurve(saturationCurve),
    hue: !isDefaultCurve(hueCurve),
  }), [hueCurve, lightnessCurve, saturationCurve]);

  const getCurveDisplayValue = useCallback((property: CurveProperty, t: number, adjustment: number) => {
    if (property === 'lightness') {
      const baseTone = getBaseShadeToneAtT(
        t,
        shadeCount,
        DEFAULT_SHADE_LIGHT_VALUE,
        DEFAULT_SHADE_DARK_VALUE
      );
      return clamp(baseTone + adjustment, 0, 100);
    }

    const { min, max } = CURVE_DISPLAY_CONFIG[property];
    return clamp(adjustment, min, max);
  }, [shadeCount]);

  const getStoredCurveValue = useCallback((property: CurveProperty, t: number, displayValue: number) => {
    if (property === 'lightness') {
      const baseTone = getBaseShadeToneAtT(
        t,
        shadeCount,
        DEFAULT_SHADE_LIGHT_VALUE,
        DEFAULT_SHADE_DARK_VALUE
      );
      const { min, max } = getCurvePropertyValueRange(property);
      return clamp(displayValue - baseTone, min, max);
    }

    const { min, max } = getCurvePropertyValueRange(property);
    return clamp(displayValue, min, max);
  }, [shadeCount]);

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
    setCurveByProperty(property, createDefaultCurveHandles());
    setDragState(current => (current?.property === property ? null : current));
  }, [setCurveByProperty]);

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

      if (dragState.target === 'handle1' || dragState.target === 'handle2') {
        let newT = clamp((localX - firstNodeX) / rangeX, 0, 1);

        if (dragState.target === 'handle1') {
          const maxT = clamp(curve.handle2.t - CURVE_MIN_HANDLE_GAP, 0, 1 - CURVE_MIN_HANDLE_GAP);
          newT = clamp(newT, 0, maxT);
          updatedCurve.handle1 = {
            t: newT,
            value: getStoredCurveValue(dragState.property, newT, nextDisplayValue),
          };
        } else {
          const minT = clamp(curve.handle1.t + CURVE_MIN_HANDLE_GAP, CURVE_MIN_HANDLE_GAP, 1);
          newT = clamp(newT, minT, 1);
          updatedCurve.handle2 = {
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
  }, [dragState, getStoredCurveValue, setCurveByProperty, shadeCount, containerWidth]);

  // Render curve SVG
  const renderCurve = () => {
    const curve = activeCurve;
    const count = shadeCount;
    if (count < 2 || containerWidth === 0) return null;

    const nodeRadius = 8;
    const handleRadius = 8;
    const handleHitRadius = 16; // Larger invisible hit area for easier clicking
    const minY = CURVE_PADDING_Y;
    const maxY = CURVE_EDITOR_HEIGHT - CURVE_PADDING_Y;
    const zeroY = valueToCurveY(0, activeProperty, minY, maxY);

    const swatchWidth = containerWidth / count;
    const firstNodeX = swatchWidth / 2;
    const lastNodeX = containerWidth - swatchWidth / 2;
    const rangeX = Math.max(1, lastNodeX - firstNodeX);

    // Calculate node positions
    const adjustments = evaluateCurveAtNodes(curve, count);
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
          DEFAULT_SHADE_LIGHT_VALUE,
          DEFAULT_SHADE_DARK_VALUE
        );
        baseNodePositions.push({
          x,
          y: valueToCurveY(baseTone, activeProperty, minY, maxY),
        });
      }
    }

    // Handle positions
    const handle1T = clamp(curve.handle1.t, 0, 1);
    const handle1X = firstNodeX + rangeX * handle1T;
    const handle1Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, handle1T, curve.handle1.value),
      activeProperty,
      minY,
      maxY
    );

    const handle2T = clamp(curve.handle2.t, 0, 1);
    const handle2X = firstNodeX + rangeX * handle2T;
    const handle2Y = valueToCurveY(
      getCurveDisplayValue(activeProperty, handle2T, curve.handle2.value),
      activeProperty,
      minY,
      maxY
    );

    // Build smooth curve path using cubic Bezier with actual handle positions
    // This creates a single smooth curve from first to last node, controlled by the two handles
    const pathD = `M ${nodePositions[0].x} ${nodePositions[0].y} C ${handle1X} ${handle1Y}, ${handle2X} ${handle2Y}, ${nodePositions[count - 1].x} ${nodePositions[count - 1].y}`;
    const basePathD = activeProperty === 'lightness' && baseNodePositions.length > 1
      ? baseNodePositions.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
      : null;

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
          x1={nodePositions[0].x}
          y1={nodePositions[0].y}
          x2={handle1X}
          y2={handle1Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1={nodePositions[count - 1].x}
          y1={nodePositions[count - 1].y}
          x2={handle2X}
          y2={handle2Y}
          stroke="var(--text)"
          strokeWidth={1.5}
          opacity={0.6}
        />

        {/* Handles (draggable) - use squares for better differentiation from nodes */}
        {/* Handle 1 */}
        <g>
          {/* Larger invisible hit area */}
          <circle
            cx={handle1X}
            cy={handle1Y}
            r={handleHitRadius}
            fill="transparent"
            style={{ cursor: 'move' }}
            onMouseDown={e => handleMouseDown(e, 'handle1')}
          />
          {/* Visible handle */}
          <rect
            x={handle1X - handleRadius}
            y={handle1Y - handleRadius}
            width={handleRadius * 2}
            height={handleRadius * 2}
            fill="var(--accent)"
            stroke="var(--bg)"
            strokeWidth={2}
            rx={2}
            style={{ cursor: 'move', pointerEvents: 'none' }}
            className={dragState?.target === 'handle1' ? 'handle-active' : ''}
          />
        </g>

        {/* Handle 2 */}
        <g>
          {/* Larger invisible hit area */}
          <circle
            cx={handle2X}
            cy={handle2Y}
            r={handleHitRadius}
            fill="transparent"
            style={{ cursor: 'move' }}
            onMouseDown={e => handleMouseDown(e, 'handle2')}
          />
          {/* Visible handle */}
          <rect
            x={handle2X - handleRadius}
            y={handle2Y - handleRadius}
            width={handleRadius * 2}
            height={handleRadius * 2}
            fill="var(--accent)"
            stroke="var(--bg)"
            strokeWidth={2}
            rx={2}
            style={{ cursor: 'move', pointerEvents: 'none' }}
            className={dragState?.target === 'handle2' ? 'handle-active' : ''}
          />
        </g>

        {/* Nodes */}
        {nodePositions.map((np, i) => {
          const isFirstOrLast = i === 0 || i === nodePositions.length - 1;
          const fillColor = shadeColors[i] || 'var(--bg)';
          return (
            <circle
              key={`node-${i}`}
              cx={np.x}
              cy={np.y}
              r={nodeRadius}
              fill={fillColor}
              stroke="var(--accent)"
              strokeWidth={2}
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
              <select
                className="form-input"
                value={sourceColorId}
                onChange={handleSourceChange}
              >
                <option value="">-- Select a group --</option>
                {sourceColors.map(variable => (
                  <option key={variable.id} value={variable.id}>{variable.name}</option>
                ))}
              </select>
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
                    <input
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
                  <input
                    type="number"
                    className="form-input"
                    value={shadeCount}
                    onChange={e => setShadeCount(Number(e.target.value))}
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
                        className="shades-preview-item"
                        style={{ background: color }}
                        title={color}
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
            <button className="btn btn-danger" onClick={handleRemove}>
              Remove Shades
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={closeShadesModal}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!groupName || generatedShades.length === 0}
          >
            {existingGroup ? 'Update' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
