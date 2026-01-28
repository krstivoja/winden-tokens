// Color conversion utilities

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export function rgbToHex(color: string): string {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;

  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]]
      .map(x => parseInt(x).toString(16).padStart(2, '0'))
      .join('');
  }
  return '#000000';
}

export function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`
    : hex;
}

export function hexToRgbObj(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

export function rgbObjToHex(rgb: RGB): string {
  return '#' + [rgb.r, rgb.g, rgb.b]
    .map(x => Math.round(x).toString(16).padStart(2, '0'))
    .join('');
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  s /= 100;
  v /= 100;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number, g: number, b: number;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return { h, s: s * 100, v: v * 100 };
}

export function lightnessToColor(baseRgb: RGB, lightness: number): string {
  if (lightness <= 50) {
    const t = lightness / 50;
    const rgb = {
      r: Math.round(255 + (baseRgb.r - 255) * t),
      g: Math.round(255 + (baseRgb.g - 255) * t),
      b: Math.round(255 + (baseRgb.b - 255) * t)
    };
    return rgbObjToHex(rgb);
  } else {
    const t = (lightness - 50) / 50;
    const rgb = {
      r: Math.round(baseRgb.r * (1 - t)),
      g: Math.round(baseRgb.g * (1 - t)),
      b: Math.round(baseRgb.b * (1 - t))
    };
    return rgbObjToHex(rgb);
  }
}

export function generateShadeColors(
  lightValue: number,
  darkValue: number,
  baseRgb: RGB,
  count: number
): string[] {
  const shades: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const lightness = lightValue + (darkValue - lightValue) * t;
    shades.push(lightnessToColor(baseRgb, lightness));
  }

  return shades;
}

export function getShadeNames(count: number): string[] {
  if (count === 5) return ['100', '300', '500', '700', '900'];
  if (count === 10) return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  if (count === 11) return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const value = Math.round(50 + (i / (count - 1)) * 900);
    names.push(String(value));
  }
  return names;
}

// Parse any color format to RGB object
export function parseColorToRgb(color: string): RGB | null {
  if (!color) return null;

  // Handle hex
  if (color.startsWith('#')) {
    return hexToRgbObj(color);
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  return null;
}

// RGB values to hex (takes individual r, g, b numbers)
export function rgbValuesToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(x => Math.round(x).toString(16).padStart(2, '0'))
    .join('');
}
