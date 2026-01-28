// Shades modal component - placeholder for complex shade generation
// TODO: Port full functionality from shades.ts

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { CloseIcon } from '../Icons';
import { rgbToHsv, hsvToRgb, rgbObjToHex, hexToRgbObj, parseColorToRgb } from '../../utils/color';

export function ShadesModal() {
  const { modals, closeShadesModal, openColorPicker } = useModalContext();
  const { variables, selectedCollectionId } = useAppContext();
  const isOpen = modals.shadesModal;

  const [sourceColorId, setSourceColorId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [baseColor, setBaseColor] = useState('#000000');
  const [shadeCount, setShadeCount] = useState(11);
  const [existingGroup, setExistingGroup] = useState(false);

  const colorVariables = useMemo(() =>
    variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'),
    [variables, selectedCollectionId]
  );

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSourceColorId(id);

    if (id) {
      const v = colorVariables.find(c => c.id === id);
      if (v) {
        // Extract group name from variable name
        const parts = v.name.split('/');
        const baseName = parts.length > 1 ? parts.slice(0, -1).join('/') : v.name;
        setGroupName(baseName);

        // Parse color value
        const rgb = parseColorToRgb(v.value);
        if (rgb) {
          setBaseColor(rgbObjToHex(rgb));
        }

        // Check if this is an existing shade group
        const shadePattern = new RegExp(`^${baseName}/\\d+$`);
        const existingShades = colorVariables.filter(cv => shadePattern.test(cv.name));
        setExistingGroup(existingShades.length > 0);
      }
    }
  };

  const handleGenerate = () => {
    if (!groupName || !baseColor) return;

    // Generate shade names (50, 100, 200, ..., 900, 950)
    const shadeNames = shadeCount === 11
      ? ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
      : Array.from({ length: shadeCount }, (_, i) => String((i + 1) * 100));

    // Generate shades (simple lightness interpolation)
    const rgb = hexToRgbObj(baseColor);
    if (!rgb) return;

    const baseHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const shades = shadeNames.map((name, i) => {
      const progress = i / (shadeNames.length - 1);
      // Interpolate from light (95%) to dark (5%)
      const lightness = 95 - progress * 90;
      const shadeRgb = hsvToRgb(baseHsv.h, baseHsv.s * (0.3 + progress * 0.7), lightness);
      return {
        name: `${groupName}/${name}`,
        value: `rgb(${Math.round(shadeRgb.r)}, ${Math.round(shadeRgb.g)}, ${Math.round(shadeRgb.b)})`,
      };
    });

    post({
      type: 'create-shades',
      collectionId: selectedCollectionId,
      shades,
    });

    closeShadesModal();
  };

  const handleRemove = () => {
    if (!groupName) return;
    post({
      type: 'remove-shades',
      collectionId: selectedCollectionId,
      groupName,
    });
    closeShadesModal();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeShadesModal()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Generate Color Shades</h3>
          <button className="modal-close" onClick={closeShadesModal}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Select Color</label>
            <select
              className="form-input"
              value={sourceColorId}
              onChange={handleSourceChange}
            >
              <option value="">-- Select a color --</option>
              {colorVariables.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {sourceColorId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. blue, primary, brand"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>

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

              <div className="form-group">
                <label>Preview</label>
                <div className="shades-preview">
                  {Array.from({ length: shadeCount }).map((_, i) => {
                    const progress = i / (shadeCount - 1);
                    const rgb = hexToRgbObj(baseColor);
                    if (!rgb) return null;
                    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                    const lightness = 95 - progress * 90;
                    const shadeRgb = hsvToRgb(hsv.h, hsv.s * (0.3 + progress * 0.7), lightness);
                    return (
                      <div
                        key={i}
                        className="shade-item"
                        style={{
                          background: `rgb(${Math.round(shadeRgb.r)}, ${Math.round(shadeRgb.g)}, ${Math.round(shadeRgb.b)})`,
                        }}
                      />
                    );
                  })}
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
            disabled={!sourceColorId || !groupName}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
