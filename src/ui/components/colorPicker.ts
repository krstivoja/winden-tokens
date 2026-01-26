// Color picker component

import { hsvToRgb, rgbToHsv, hexToRgbObj, rgbObjToHex, rgbToHex } from '../utils/color';

let colorPickerCallback: ((hex: string) => void) | null = null;
let pickerHue = 0;
let pickerSat = 100;
let pickerVal = 100;

let hueDragging = false;
let svDragging = false;

export function initColorPicker(): void {
  const hueSlider = document.getElementById('hue-slider');
  const svPanel = document.getElementById('sv-panel');
  const pickerHexInput = document.getElementById('picker-hex-input') as HTMLInputElement;

  if (hueSlider) {
    hueSlider.onmousedown = (e) => {
      hueDragging = true;
      updateHueFromEvent(e);
    };
  }

  if (svPanel) {
    svPanel.onmousedown = (e) => {
      svDragging = true;
      updateSVFromEvent(e);
    };
  }

  document.addEventListener('mousemove', (e) => {
    if (hueDragging) updateHueFromEvent(e);
    if (svDragging) updateSVFromEvent(e);
  });

  document.addEventListener('mouseup', () => {
    hueDragging = false;
    svDragging = false;
  });

  if (pickerHexInput) {
    pickerHexInput.oninput = () => {
      let hex = pickerHexInput.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        const rgb = hexToRgbObj(hex);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        pickerHue = hsv.h;
        pickerSat = hsv.s;
        pickerVal = hsv.v;
        updatePickerDisplay();
      }
    };
  }
}

function updateHueFromEvent(e: MouseEvent): void {
  const hueSlider = document.getElementById('hue-slider');
  if (!hueSlider) return;

  const rect = hueSlider.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  x = Math.max(0, Math.min(1, x));
  pickerHue = x * 360;
  updatePickerDisplay();
}

function updateSVFromEvent(e: MouseEvent): void {
  const svPanel = document.getElementById('sv-panel');
  if (!svPanel) return;

  const rect = svPanel.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  let y = (e.clientY - rect.top) / rect.height;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  pickerSat = x * 100;
  pickerVal = (1 - y) * 100;
  updatePickerDisplay();
}

function updatePickerDisplay(): void {
  const svPanel = document.getElementById('sv-panel');
  const hueHandle = document.getElementById('hue-handle');
  const svHandle = document.getElementById('sv-handle');
  const pickerHexInput = document.getElementById('picker-hex-input') as HTMLInputElement;

  if (svPanel) {
    const hueColor = `hsl(${pickerHue}, 100%, 50%)`;
    svPanel.style.background = `linear-gradient(to right, #fff, ${hueColor})`;
  }

  if (hueHandle) {
    hueHandle.style.left = `${(pickerHue / 360) * 100}%`;
  }

  if (svHandle) {
    svHandle.style.left = `${pickerSat}%`;
    svHandle.style.top = `${100 - pickerVal}%`;
  }

  if (pickerHexInput) {
    const rgb = hsvToRgb(pickerHue, pickerSat, pickerVal);
    pickerHexInput.value = rgbObjToHex(rgb);
  }
}

function getPickerHex(): string {
  const rgb = hsvToRgb(pickerHue, pickerSat, pickerVal);
  return rgbObjToHex(rgb);
}

export function openColorPicker(initialColor: string, callback: (hex: string) => void): void {
  colorPickerCallback = callback;

  const hex = initialColor.startsWith('#') ? initialColor : rgbToHex(initialColor);
  const rgb = hexToRgbObj(hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  pickerHue = hsv.h;
  pickerSat = hsv.s;
  pickerVal = hsv.v;

  updatePickerDisplay();

  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.add('open');
}

export function closeColorPicker(): void {
  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.remove('open');
  colorPickerCallback = null;
}

export function confirmColorPicker(): void {
  const hex = getPickerHex();
  if (colorPickerCallback) {
    colorPickerCallback(hex);
  }
  closeColorPicker();
}
