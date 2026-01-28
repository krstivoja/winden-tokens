// Color picker modal component

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useModalContext } from './ModalContext';
import { CloseIcon } from '../Icons';
import { rgbToHsv, hsvToRgb, rgbObjToHex, hexToRgbObj, parseColorToRgb } from '../../utils/color';

export function ColorPickerModal() {
  const { modals, closeColorPicker } = useModalContext();
  const config = modals.colorPicker;

  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100);
  const [hexInput, setHexInput] = useState('#000000');

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
        setHexInput(rgbObjToHex(rgb));
      }
    }
  }, [config]);

  // Update hex when HSV changes
  useEffect(() => {
    const rgb = hsvToRgb(hue, saturation, value);
    setHexInput(rgbObjToHex(rgb));
  }, [hue, saturation, value]);

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

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setHexInput(hex);
    const rgb = hexToRgbObj(hex);
    if (rgb) {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setValue(hsv.v);
    }
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
            <div className="color-picker-inputs">
              <input
                type="text"
                className="form-input"
                placeholder="#000000"
                value={hexInput}
                onChange={handleHexChange}
              />
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
