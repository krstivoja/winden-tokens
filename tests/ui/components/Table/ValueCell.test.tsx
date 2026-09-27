import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { ModalProvider } from '../../../../src/ui/components/Modals/ModalContext';
import { ColorPickerModal } from '../../../../src/ui/components/Modals/ColorPickerModal';
import { ValueCell } from '../../../../src/ui/components/Table/ValueCell';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
];

function colorVar(name: string, value: string): VariableData {
  return { id: name, collectionId: 'c1', name, resolvedType: 'COLOR', value, valuesByMode: { m1: value } };
}

const variables: VariableData[] = [
  colorVar('accent/50', '#D5E1AE'),
  colorVar('card/text', '{accent/50}'),
  colorVar('card/broken', '{missing/1}'),
];

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ collections, variables, selectedModeId: 'm1' }),
}));

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  post: vi.fn(),
}));

function renderCell(name: string) {
  const variable = variables.find(candidate => candidate.name === name)!;
  const { container } = render(
    <ModalProvider>
      <ValueCell variable={variable} />
      <ColorPickerModal />
    </ModalProvider>
  );
  return container;
}

function openPickColor(container: HTMLElement) {
  const swatch = container.querySelector('.bg-checkerboard') as HTMLElement;
  fireEvent.click(swatch);
  fireEvent.click(screen.getByText('Pick Color'));
}

function hexInput() {
  return screen.getByLabelText('HEX') as HTMLInputElement;
}

// On the old code parseColor threw inside the modal's effect; act() rethrows
// it from fireEvent, so a regression fails the test rather than only logging
describe('ValueCell color picker', () => {
  it('opens Pick Color at the resolved color of an alias', () => {
    const container = renderCell('card/text');
    openPickColor(container);
    expect(hexInput().value.toLowerCase()).toBe('#d5e1ae');
  });

  it('opens Pick Color at the swatch gray for a dead alias', () => {
    const container = renderCell('card/broken');
    openPickColor(container);
    expect(hexInput().value.toLowerCase()).toBe('#888888');
  });
});
