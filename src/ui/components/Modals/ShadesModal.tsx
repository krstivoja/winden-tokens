// Shades modal component with curve editor for lightness, saturation, and hue

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { ShadeCurveHandles, VariableData } from '../../types';
import { CloseIcon } from '../Icons';
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
} from '../../utils/shades';

type CurveProperty = 'lightness' | 'saturation' | 'hue';
type DragTarget = 'handle1' | 'handle2' | 'startNode' | 'endNode';

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
    startX: number;
    startY: number;
    startValue: number;
    startT: number;
    target: DragTarget;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  // Get active curve
  const getActiveCurve = useCallback((): ShadeCurveHandles => {
    switch (activeProperty) {
      case 'saturation': return saturationCurve;
      case 'hue': return hueCurve;
      default: return lightnessCurve;
    }
  }, [activeProperty, lightnessCurve, saturationCurve, hueCurve]);

  const setActiveCurve = useCallback((curve: ShadeCurveHandles) => {
    switch (activeProperty) {
      case 'saturation': setSaturationCurve(curve); break;
      case 'hue': setHueCurve(curve); break;
      default: setLightnessCurve(curve); break;
    }
  }, [activeProperty]);

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

  // Curve editor mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, target: DragTarget) => {
    e.preventDefault();
    const curve = getActiveCurve();

    let startValue: number;
    let startT: number;

    if (target === 'handle1') {
      startValue = curve.handle1.value;
      startT = curve.handle1.t;
    } else if (target === 'handle2') {
      startValue = curve.handle2.value;
      startT = curve.handle2.t;
    } else if (target === 'startNode') {
      startValue = curve.startValue;
      startT = 0;
    } else {
      startValue = curve.endValue;
      startT = 1;
    }

    setDragState({
      startX: e.clientX,
      startY: e.clientY,
      startValue,
      startT,
      target,
    });
  }, [getActiveCurve]);

  useEffect(() => {
    if (!dragState || containerWidth === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const curve = getActiveCurve();
      const updatedCurve = { ...curve };

      const curveHeight = 100;
      const minY = 10;
      const maxY = curveHeight - 10;
      const yRange = maxY - minY;

      const swatchWidth = containerWidth / shadeCount;
      const firstNodeX = swatchWidth / 2;
      const lastNodeX = containerWidth - swatchWidth / 2;
      const rangeX = Math.max(1, lastNodeX - firstNodeX);

      if (dragState.target === 'handle1' || dragState.target === 'handle2') {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = dragState.startY - e.clientY;
        const valueChange = (deltaY / yRange) * 100;
        const newValue = clamp(dragState.startValue + valueChange, -50, 50);
        let newT = dragState.startT + deltaX / rangeX;
        const minGap = 0.05;

        if (dragState.target === 'handle1') {
          const maxT = clamp(curve.handle2.t - minGap, 0, 1 - minGap);
          newT = clamp(newT, 0, maxT);
          updatedCurve.handle1 = { t: newT, value: newValue };
        } else {
          const minT = clamp(curve.handle1.t + minGap, minGap, 1);
          newT = clamp(newT, minT, 1);
          updatedCurve.handle2 = { t: newT, value: newValue };
        }
      } else {
        const deltaY = dragState.startY - e.clientY;
        const valueChange = (deltaY / yRange) * 100;
        const newValue = clamp(dragState.startValue + valueChange, -50, 50);

        if (dragState.target === 'startNode') {
          updatedCurve.startValue = newValue;
        } else {
          updatedCurve.endValue = newValue;
        }
      }

      setActiveCurve(updatedCurve);
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
  }, [dragState, getActiveCurve, setActiveCurve, shadeCount, containerWidth]);

  // Render curve SVG
  const renderCurve = () => {
    const curve = getActiveCurve();
    const count = shadeCount;
    if (count < 2 || containerWidth === 0) return null;

    const curveHeight = 100;
    const nodeRadius = 8;
    const handleRadius = 6;
    const minY = 10;
    const maxY = curveHeight - 10;

    const swatchWidth = containerWidth / count;
    const firstNodeX = swatchWidth / 2;
    const lastNodeX = containerWidth - swatchWidth / 2;
    const rangeX = Math.max(1, lastNodeX - firstNodeX);

    // Calculate node positions
    const adjustments = evaluateCurveAtNodes(curve, count);
    const nodePositions: { x: number; y: number; value: number }[] = [];

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = firstNodeX + rangeX * t;
      const baseLightness = DEFAULT_SHADE_LIGHT_VALUE + (DEFAULT_SHADE_DARK_VALUE - DEFAULT_SHADE_LIGHT_VALUE) * t;
      const actualLightness = Math.max(0, Math.min(100, baseLightness + adjustments[i]));
      const y = maxY - (actualLightness / 100) * (maxY - minY);
      nodePositions.push({ x, y, value: actualLightness });
    }

    // Handle positions
    const handle1T = clamp(curve.handle1.t, 0, 1);
    const handle1BaseLightness = DEFAULT_SHADE_LIGHT_VALUE + (DEFAULT_SHADE_DARK_VALUE - DEFAULT_SHADE_LIGHT_VALUE) * handle1T;
    const handle1ActualLightness = Math.max(0, Math.min(100, handle1BaseLightness + curve.handle1.value));
    const handle1X = firstNodeX + rangeX * handle1T;
    const handle1Y = clamp(maxY - (handle1ActualLightness / 100) * (maxY - minY), minY, maxY);

    const handle2T = clamp(curve.handle2.t, 0, 1);
    const handle2BaseLightness = DEFAULT_SHADE_LIGHT_VALUE + (DEFAULT_SHADE_DARK_VALUE - DEFAULT_SHADE_LIGHT_VALUE) * handle2T;
    const handle2ActualLightness = Math.max(0, Math.min(100, handle2BaseLightness + curve.handle2.value));
    const handle2X = firstNodeX + rangeX * handle2T;
    const handle2Y = clamp(maxY - (handle2ActualLightness / 100) * (maxY - minY), minY, maxY);

    // Build curve path using Catmull-Rom
    let pathD = `M ${nodePositions[0].x} ${nodePositions[0].y}`;
    for (let i = 0; i < nodePositions.length - 1; i++) {
      const p0 = nodePositions[Math.max(0, i - 1)];
      const p1 = nodePositions[i];
      const p2 = nodePositions[i + 1];
      const p3 = nodePositions[Math.min(nodePositions.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${containerWidth} ${curveHeight}`}
        style={{ width: containerWidth, height: curveHeight }}
        className="curve-svg"
      >
        {/* Grid lines */}
        {Array.from({ length: count + 1 }).map((_, i) => (
          <line
            key={`grid-${i}`}
            x1={i * swatchWidth}
            y1={0}
            x2={i * swatchWidth}
            y2={curveHeight}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.35}
          />
        ))}

        {/* Zero baseline */}
        <line
          x1={0}
          y1={curveHeight / 2}
          x2={containerWidth}
          y2={curveHeight / 2}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.3}
        />

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

        {/* Handles (draggable) */}
        <circle
          cx={handle1X}
          cy={handle1Y}
          r={handleRadius}
          fill="var(--bg)"
          stroke="var(--text)"
          strokeWidth={2}
          style={{ cursor: 'move' }}
          onMouseDown={e => handleMouseDown(e, 'handle1')}
        />
        <circle
          cx={handle2X}
          cy={handle2Y}
          r={handleRadius}
          fill="var(--bg)"
          stroke="var(--text)"
          strokeWidth={2}
          style={{ cursor: 'move' }}
          onMouseDown={e => handleMouseDown(e, 'handle2')}
        />

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
              </div>

              {/* Curve Editor + Preview Combined */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ margin: 0 }}>Preview</label>
                  <select
                    className="form-input"
                    value={activeProperty}
                    onChange={e => setActiveProperty(e.target.value as CurveProperty)}
                    style={{ width: 120 }}
                  >
                    <option value="lightness">Lightness</option>
                    <option value="saturation">Saturation</option>
                    <option value="hue">Hue</option>
                  </select>
                </div>
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
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
