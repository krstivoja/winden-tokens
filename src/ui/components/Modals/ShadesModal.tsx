// Shades modal component with curve editor for lightness, saturation, and hue

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { CloseIcon } from '../Icons';
import {
  rgbToHsv,
  hsvToRgb,
  rgbObjToHex,
  hexToRgbObj,
  parseColorToRgb,
  hexToRgb,
  getShadeNames,
  generateShadeColorsWithCurves,
  RGB,
} from '../../utils/color';

// Curve handles for bezier curve control
interface CurveHandles {
  startValue: number;
  handle1: { t: number; value: number };
  handle2: { t: number; value: number };
  endValue: number;
}

type CurveProperty = 'lightness' | 'saturation' | 'hue';
type DragTarget = 'handle1' | 'handle2' | 'startNode' | 'endNode';

// Default curve (flat line - no adjustment)
function createDefaultHandles(): CurveHandles {
  return {
    startValue: 0,
    handle1: { t: 0.25, value: 0 },
    handle2: { t: 0.75, value: 0 },
    endValue: 0,
  };
}

// Cubic bezier math
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cubicBezierAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function cubicBezierDerivative(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function solveBezierTForX(x: number, x1: number, x2: number): number {
  let t = clamp(x, 0, 1);
  for (let i = 0; i < 5; i++) {
    const xAt = cubicBezierAt(0, x1, x2, 1, t);
    const dx = xAt - x;
    if (Math.abs(dx) < 1e-4) break;
    const d = cubicBezierDerivative(0, x1, x2, 1, t);
    if (d === 0) break;
    t = clamp(t - dx / d, 0, 1);
  }
  return t;
}

function evaluateCubicBezier(handles: CurveHandles, t: number): number {
  const p0y = handles.startValue;
  const p1y = handles.handle1.value;
  const p2y = handles.handle2.value;
  const p3y = handles.endValue;
  const p1x = clamp(handles.handle1.t, 0, 1);
  const p2x = clamp(handles.handle2.t, 0, 1);
  const u = solveBezierTForX(t, p1x, p2x);
  return cubicBezierAt(p0y, p1y, p2y, p3y, u);
}

function evaluateCurveAtNodes(handles: CurveHandles, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    values.push(evaluateCubicBezier(handles, t));
  }
  return values;
}

// Default lightness range
const DEFAULT_LIGHT_VALUE = 5;
const DEFAULT_DARK_VALUE = 90;

export function ShadesModal() {
  const { modals, closeShadesModal, openColorPicker } = useModalContext();
  const { variables, selectedCollectionId } = useAppContext();
  const isOpen = modals.shadesModal;

  const [sourceColorId, setSourceColorId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [baseColor, setBaseColor] = useState('#000000');
  const [shadeCount, setShadeCount] = useState(11);
  const [existingGroup, setExistingGroup] = useState(false);

  // Curve states
  const [lightnessCurve, setLightnessCurve] = useState<CurveHandles>(createDefaultHandles);
  const [saturationCurve, setSaturationCurve] = useState<CurveHandles>(createDefaultHandles);
  const [hueCurve, setHueCurve] = useState<CurveHandles>(createDefaultHandles);
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
    if (!isOpen || !sourceColorId) return;

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
  }, [isOpen, sourceColorId]);

  // Get unique color groups
  const colorGroups = useMemo(() => {
    const allColors = variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR');
    const groupMap = new Map<string, { count: number; firstColor: typeof allColors[0] | null }>();

    allColors.forEach(v => {
      const parts = v.name.split('/');
      const groupName = parts.length > 1 ? parts[0] : v.name;
      const existing = groupMap.get(groupName);
      if (existing) {
        existing.count++;
      } else {
        groupMap.set(groupName, { count: 1, firstColor: v });
      }
    });

    return Array.from(groupMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      firstColor: data.firstColor,
    }));
  }, [variables, selectedCollectionId]);

  // Reset curves when modal opens
  useEffect(() => {
    if (isOpen) {
      setLightnessCurve(createDefaultHandles());
      setSaturationCurve(createDefaultHandles());
      setHueCurve(createDefaultHandles());
      setActiveProperty('lightness');
    }
  }, [isOpen]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSourceColorId(name);

    if (name) {
      const group = colorGroups.find(g => g.name === name);
      if (group) {
        setGroupName(name);

        if (group.firstColor) {
          const rgb = parseColorToRgb(group.firstColor.value);
          if (rgb) {
            setBaseColor(rgbObjToHex(rgb));
          }
        }

        const allColors = variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR');
        const shadePattern = new RegExp(`^${name}/\\d+$`);
        const existingShades = allColors.filter(cv => shadePattern.test(cv.name));
        setExistingGroup(existingShades.length > 0);
        if (existingShades.length > 0) {
          setShadeCount(existingShades.length);
        }
      }
    }

    // Reset curves on source change
    setLightnessCurve(createDefaultHandles());
    setSaturationCurve(createDefaultHandles());
    setHueCurve(createDefaultHandles());
  };

  // Get existing shade variable IDs for the selected group
  const existingShadeIds = useMemo(() => {
    if (!groupName) return [];
    const allColors = variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR');
    const shadePattern = new RegExp(`^${groupName}/\\d+$`);
    return allColors.filter(cv => shadePattern.test(cv.name)).map(cv => cv.id);
  }, [groupName, variables, selectedCollectionId]);

  // Get active curve
  const getActiveCurve = useCallback((): CurveHandles => {
    switch (activeProperty) {
      case 'saturation': return saturationCurve;
      case 'hue': return hueCurve;
      default: return lightnessCurve;
    }
  }, [activeProperty, lightnessCurve, saturationCurve, hueCurve]);

  const setActiveCurve = useCallback((curve: CurveHandles) => {
    switch (activeProperty) {
      case 'saturation': setSaturationCurve(curve); break;
      case 'hue': setHueCurve(curve); break;
      default: setLightnessCurve(curve); break;
    }
  }, [activeProperty]);

  // Generate shade colors using all curves
  const shadeColors = useMemo(() => {
    const rgb = hexToRgbObj(baseColor);
    if (!rgb) return [];

    const lightAdj = evaluateCurveAtNodes(lightnessCurve, shadeCount);
    const satAdj = evaluateCurveAtNodes(saturationCurve, shadeCount);
    const hueAdj = evaluateCurveAtNodes(hueCurve, shadeCount);

    return generateShadeColorsWithCurves(
      DEFAULT_LIGHT_VALUE,
      DEFAULT_DARK_VALUE,
      rgb,
      shadeCount,
      lightAdj,
      satAdj,
      hueAdj
    );
  }, [baseColor, shadeCount, lightnessCurve, saturationCurve, hueCurve]);

  // Handle generation
  const handleGenerate = () => {
    if (!groupName || !baseColor) return;

    const names = getShadeNames(shadeCount);
    const shades = shadeColors.map((hex, i) => ({
      name: `${groupName}/${names[i]}`,
      value: hexToRgb(hex),
    }));

    // Find the base color ID (the one without shades, e.g. "red" not "red/50")
    const baseColorVar = variables.find(
      v => v.collectionId === selectedCollectionId && v.name === groupName && v.resolvedType === 'COLOR'
    );
    const baseColorId = baseColorVar?.id;

    // Build list of IDs to delete: existing shades + base color (if exists)
    const deleteIds = [...existingShadeIds];
    if (baseColorId && !deleteIds.includes(baseColorId)) {
      deleteIds.push(baseColorId);
    }

    // Use update-shades which handles both deleting old variables and creating new ones
    post({ type: 'update-shades', collectionId: selectedCollectionId, deleteIds, shades });

    closeShadesModal();
  };

  const handleRemove = () => {
    if (!groupName || existingShadeIds.length === 0) return;

    post({
      type: 'remove-shades',
      collectionId: selectedCollectionId,
      deleteIds: existingShadeIds,
      newColor: {
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
      const baseLightness = DEFAULT_LIGHT_VALUE + (DEFAULT_DARK_VALUE - DEFAULT_LIGHT_VALUE) * t;
      const actualLightness = Math.max(0, Math.min(100, baseLightness + adjustments[i]));
      const y = maxY - (actualLightness / 100) * (maxY - minY);
      nodePositions.push({ x, y, value: actualLightness });
    }

    // Handle positions
    const handle1T = clamp(curve.handle1.t, 0, 1);
    const handle1BaseLightness = DEFAULT_LIGHT_VALUE + (DEFAULT_DARK_VALUE - DEFAULT_LIGHT_VALUE) * handle1T;
    const handle1ActualLightness = Math.max(0, Math.min(100, handle1BaseLightness + curve.handle1.value));
    const handle1X = firstNodeX + rangeX * handle1T;
    const handle1Y = clamp(maxY - (handle1ActualLightness / 100) * (maxY - minY), minY, maxY);

    const handle2T = clamp(curve.handle2.t, 0, 1);
    const handle2BaseLightness = DEFAULT_LIGHT_VALUE + (DEFAULT_DARK_VALUE - DEFAULT_LIGHT_VALUE) * handle2T;
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
          <div className="form-group">
            <label>Select Color Group</label>
            <select
              className="form-input"
              value={sourceColorId}
              onChange={handleSourceChange}
            >
              <option value="">-- Select a group --</option>
              {colorGroups.map(g => (
                <option key={g.name} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          {sourceColorId && (
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
            disabled={!sourceColorId}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
