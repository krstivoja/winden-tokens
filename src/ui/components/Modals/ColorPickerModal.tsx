// Color picker modal component

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useModalContext } from './ModalContext';
import { CloseIcon } from '../Icons';
import { rgbToHsv, hsvToRgb, rgbObjToHex, hexToRgbObj, parseColorToRgb, rgbToHsl, hslToRgb, RGB } from '../../utils/color';

type ColorMode = 'HEX' | 'RGB' | 'HSL';

export function ColorPickerModal() {
  const { modals, closeColorPicker } = useModalContext();
  const config = modals.colorPicker;

  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100);
  const [colorMode, setColorMode] = useState<ColorMode>('HEX');

  // Input states
  const [hexInput, setHexInput] = useState('#000000');
  const [rgbInputs, setRgbInputs] = useState({ r: 0, g: 0, b: 0 });
  const [hslInputs, setHslInputs] = useState({ h: 0, s: 0, l: 0 });

  const svPanelRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingSV = useRef(false);
  const isDraggingHue = useRef(false);

  // Initialize from config
  useEffect(() => {
    if (config) {
      const rgb = parseColorToRgb(config.initialColor);
      if (rgb) {
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        setHue(hsv.h);
        setSaturation(hsv.s);
        setValue(hsv.v);
        updateAllInputs(rgb);
      }
    }
  }, [config]);

  const updateAllInputs = useCallback((rgb: RGB) => {
    setHexInput(rgbObjToHex(rgb));
    setRgbInputs({ r: rgb.r, g: rgb.g, b: rgb.b });
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    setHslInputs(hsl);
  }, []);

  // Update inputs when HSV changes
  useEffect(() => {
    const rgb = hsvToRgb(hue, saturation, value);
    updateAllInputs(rgb);
  }, [hue, saturation, value, updateAllInputs]);

  const updateSVFromMouse = useCallback((clientX: number, clientY: number) => {
    if (!svPanelRef.current) return;
    const rect = svPanelRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setSaturation(x * 100);
    setValue((1 - y) * 100);
  }, []);

  const updateHueFromMouse = useCallback((clientX: number) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHue(x * 360);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSV.current) {
        updateSVFromMouse(e.clientX, e.clientY);
      }
      if (isDraggingHue.current) {
        updateHueFromMouse(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingSV.current = false;
      isDraggingHue.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateSVFromMouse, updateHueFromMouse]);

  const updateFromRgb = useCallback((rgb: RGB) => {
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHue(hsv.h);
    setSaturation(hsv.s);
    setValue(hsv.v);
  }, []);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setHexInput(hex);
    const rgb = hexToRgbObj(hex);
    if (rgb && hex.length === 7) {
      updateFromRgb(rgb);
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', val: string) => {
    const num = Math.max(0, Math.min(255, parseInt(val) || 0));
    const newRgb = { ...rgbInputs, [channel]: num };
    setRgbInputs(newRgb);
    updateFromRgb(newRgb);
  };

  const handleHslChange = (channel: 'h' | 's' | 'l', val: string) => {
    const max = channel === 'h' ? 360 : 100;
    const num = Math.max(0, Math.min(max, parseInt(val) || 0));
    const newHsl = { ...hslInputs, [channel]: num };
    setHslInputs(newHsl);
    const rgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    updateFromRgb(rgb);
  };

  const handleConfirm = () => {
    config?.onConfirm(hexInput);
    closeColorPicker();
  };

  if (!config) return null;

  const hueColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeColorPicker()}>
      <div className="modal" style={{ width: 300 }}>
        <div className="modal-header">
          <h3>Pick Color</h3>
          <button className="modal-close" onClick={closeColorPicker}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="color-picker-container">
            <div
              ref={svPanelRef}
              className="picker-sv-panel"
              style={{ background: hueColor }}
              onMouseDown={(e) => {
                isDraggingSV.current = true;
                updateSVFromMouse(e.clientX, e.clientY);
              }}
            >
              <div
                className="picker-sv-handle"
                style={{
                  left: `${saturation}%`,
                  top: `${100 - value}%`,
                }}
              />
            </div>
            <div
              ref={hueSliderRef}
              className="picker-hue-slider"
              onMouseDown={(e) => {
                isDraggingHue.current = true;
                updateHueFromMouse(e.clientX);
              }}
            >
              <div
                className="picker-hue-handle"
                style={{ left: `${(hue / 360) * 100}%` }}
              />
            </div>

            <div className="color-mode-selector">
              {(['HEX', 'RGB', 'HSL'] as ColorMode[]).map(mode => (
                <button
                  key={mode}
                  className={`color-mode-btn ${colorMode === mode ? 'active' : ''}`}
                  onClick={() => setColorMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="color-picker-inputs">
              {colorMode === 'HEX' && (
                <input
                  type="text"
                  className="form-input hex-input"
                  placeholder="#000000"
                  value={hexInput}
                  onChange={handleHexChange}
                />
              )}

              {colorMode === 'RGB' && (
                <div className="color-input-row">
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="255"
                      value={rgbInputs.r}
                      onChange={e => handleRgbChange('r', e.target.value)}
                    />
                    <label>R</label>
                  </div>
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="255"
                      value={rgbInputs.g}
                      onChange={e => handleRgbChange('g', e.target.value)}
                    />
                    <label>G</label>
                  </div>
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="255"
                      value={rgbInputs.b}
                      onChange={e => handleRgbChange('b', e.target.value)}
                    />
                    <label>B</label>
                  </div>
                </div>
              )}

              {colorMode === 'HSL' && (
                <div className="color-input-row">
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="360"
                      value={hslInputs.h}
                      onChange={e => handleHslChange('h', e.target.value)}
                    />
                    <label>H</label>
                  </div>
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="100"
                      value={hslInputs.s}
                      onChange={e => handleHslChange('s', e.target.value)}
                    />
                    <label>S</label>
                  </div>
                  <div className="color-input-group">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="100"
                      value={hslInputs.l}
                      onChange={e => handleHslChange('l', e.target.value)}
                    />
                    <label>L</label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={closeColorPicker}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Apply</button>
        </div>
      </div>
    </div>
  );
}
