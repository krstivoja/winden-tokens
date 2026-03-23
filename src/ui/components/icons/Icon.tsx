// Icon component - loads SVGs from ./svg/ folder
// All SVGs use currentColor for fills/strokes and 24x24 viewBox

import React from 'react';

export type IconName =
  | 'plus'
  | 'refresh'
  | 'undo'
  | 'redo'
  | 'expand'
  | 'collapse'
  | 'expand-all'
  | 'collapse-all'
  | 'search'
  | 'trash'
  | 'close'
  | 'drag'
  | 'shades'
  | 'steps'
  | 'color'
  | 'float'
  | 'string'
  | 'boolean'
  | 'triangle'
  | 'copy'
  | 'edit'
  | 'folder'
  | 'relationships'
  | 'menu';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

// Import all SVG files as React components
import PlusSvg from './svg/plus.svg?raw';
import RefreshSvg from './svg/refresh.svg?raw';
import UndoSvg from './svg/undo.svg?raw';
import RedoSvg from './svg/redo.svg?raw';
import ExpandSvg from './svg/expand.svg?raw';
import CollapseSvg from './svg/collapse.svg?raw';
import ExpandAllSvg from './svg/expand-all.svg?raw';
import CollapseAllSvg from './svg/collapse-all.svg?raw';
import SearchSvg from './svg/search.svg?raw';
import TrashSvg from './svg/trash.svg?raw';
import CloseSvg from './svg/close.svg?raw';
import DragSvg from './svg/drag.svg?raw';
import ShadesSvg from './svg/shades.svg?raw';
import StepsSvg from './svg/steps.svg?raw';
import ColorSvg from './svg/color.svg?raw';
import FloatSvg from './svg/float.svg?raw';
import StringSvg from './svg/string.svg?raw';
import BooleanSvg from './svg/boolean.svg?raw';
import TriangleSvg from './svg/triangle.svg?raw';
import CopySvg from './svg/copy.svg?raw';
import EditSvg from './svg/edit.svg?raw';
import FolderSvg from './svg/folder.svg?raw';
import RelationshipsSvg from './svg/relationships.svg?raw';
import MenuSvg from './svg/menu.svg?raw';

const svgMap: Record<IconName, string> = {
  plus: PlusSvg,
  refresh: RefreshSvg,
  undo: UndoSvg,
  redo: RedoSvg,
  expand: ExpandSvg,
  collapse: CollapseSvg,
  'expand-all': ExpandAllSvg,
  'collapse-all': CollapseAllSvg,
  search: SearchSvg,
  trash: TrashSvg,
  close: CloseSvg,
  drag: DragSvg,
  shades: ShadesSvg,
  steps: StepsSvg,
  color: ColorSvg,
  float: FloatSvg,
  string: StringSvg,
  boolean: BooleanSvg,
  triangle: TriangleSvg,
  copy: CopySvg,
  edit: EditSvg,
  folder: FolderSvg,
  relationships: RelationshipsSvg,
  menu: MenuSvg,
};

export function Icon({ name, size = 24, className = '' }: IconProps) {
  const svgContent = svgMap[name];

  // Replace width/height attributes with the size prop
  // Also replace any hardcoded black fills/strokes with currentColor
  const svgWithSize = svgContent
    .replace(/width="24"/, `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`)
    .replace(/fill="black"/g, 'fill="currentColor"')
    .replace(/stroke="black"/g, 'stroke="currentColor"');

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: svgWithSize }}
      style={{
        display: 'inline-block',
        lineHeight: 0,
        color: 'inherit',
        opacity: 1
      }}
    />
  );
}
