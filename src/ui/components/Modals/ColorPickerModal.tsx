// Color picker modal component using React Aria ColorPicker

import React, { useState, useEffect } from 'react';
import { useModalContext } from './ModalContext';
import { TextButton } from '../common/Button';
import { SegmentedControl } from '../common/SegmentedControl';
import { ModalOverlay, ModalContainer, ModalHeader, ModalBody, ModalFooter } from './Modal';
import {
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorField,
  SliderTrack,
  ColorThumb,
  Label,
  Input,
} from 'react-aria-components';
import { parseColor } from 'react-aria-components';

type ColorMode = 'hex' | 'rgb' | 'hsl';

const COLOR_MODE_OPTIONS = [
  { value: 'hex' as const, label: 'HEX' },
  { value: 'rgb' as const, label: 'RGB' },
  { value: 'hsl' as const, label: 'HSL' },
];

export function ColorPickerModal() {
  const { modals, closeColorPicker } = useModalContext();
  const config = modals.colorPicker;

  const [colorMode, setColorMode] = useState<ColorMode>('hex');
  const [color, setColor] = useState(() => parseColor('#000000'));

  // Update color when config changes
  useEffect(() => {
    if (config?.initialColor) {
      setColor(parseColor(config.initialColor));
    }
  }, [config?.initialColor]);

  if (!config) return null;

  const handleConfirm = () => {
    config?.onConfirm(color.toString('hex'));
    closeColorPicker();
  };

  return (
    <ModalOverlay isOpen={!!config} onClose={closeColorPicker}>
      <ModalContainer width={300}>
        <ModalHeader title="Pick Color" onClose={closeColorPicker} />
        <ModalBody>
          <ColorPicker value={color} onChange={setColor}>
            {/* Color area for saturation and brightness */}
            <ColorArea
              colorSpace="hsb"
              xChannel="saturation"
              yChannel="brightness"
              className="w-full h-[180px] rounded mb-3"
            >
              <ColorThumb className="w-5 h-5 border-2 border-white rounded-full shadow-md" />
            </ColorArea>

            {/* Hue slider */}
            <ColorSlider colorSpace="hsb" channel="hue" className="w-full mb-4">
              <SliderTrack className="h-6 rounded relative">
                <ColorThumb className="w-5 h-5 border-2 border-white rounded-full shadow-md top-1/2 -translate-y-1/2" />
              </SliderTrack>
            </ColorSlider>

            {/* Color mode tabs */}
            <SegmentedControl
              options={COLOR_MODE_OPTIONS}
              value={colorMode}
              onChange={setColorMode}
              fullWidth
              className="mb-3"
            />

            {/* Color input fields based on selected mode */}
            <div>
              {colorMode === 'hex' && (
                <ColorField className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-text">HEX</Label>
                  <Input />
                </ColorField>
              )}

              {colorMode === 'rgb' && (
                <div className="grid grid-cols-3 gap-2">
                  <ColorField channel="red" colorSpace="rgb" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">R</Label>
                    <Input />
                  </ColorField>
                  <ColorField channel="green" colorSpace="rgb" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">G</Label>
                    <Input />
                  </ColorField>
                  <ColorField channel="blue" colorSpace="rgb" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">B</Label>
                    <Input />
                  </ColorField>
                </div>
              )}

              {colorMode === 'hsl' && (
                <div className="grid grid-cols-3 gap-2">
                  <ColorField channel="hue" colorSpace="hsl" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">H</Label>
                    <Input />
                  </ColorField>
                  <ColorField channel="saturation" colorSpace="hsl" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">S</Label>
                    <Input />
                  </ColorField>
                  <ColorField channel="lightness" colorSpace="hsl" className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-text">L</Label>
                    <Input />
                  </ColorField>
                </div>
              )}
            </div>
          </ColorPicker>
        </ModalBody>
        <ModalFooter>
          <TextButton onClick={closeColorPicker}>Cancel</TextButton>
          <TextButton variant="primary" onClick={handleConfirm}>
            Apply
          </TextButton>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
}
