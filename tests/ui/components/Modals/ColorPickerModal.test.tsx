import React, { useLayoutEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider, useModalContext } from '../../../../src/ui/components/Modals/ModalContext';
import { ColorPickerModal } from '../../../../src/ui/components/Modals/ColorPickerModal';

function Opener({ initialColor, onConfirm }: { initialColor: string; onConfirm: (hex: string) => void }) {
  const { openColorPicker } = useModalContext();
  return (
    <button type="button" onClick={() => openColorPicker({ initialColor, onConfirm })}>
      Open {initialColor}
    </button>
  );
}

// Records the HEX input value after each commit that changes the picker
// config, before passive effects run - i.e. what the first painted frame shows
function FirstFrameProbe({ frames }: { frames: string[] }) {
  const { modals } = useModalContext();
  useLayoutEffect(() => {
    if (!modals.colorPicker) return;
    const input = screen.queryByLabelText('HEX') as HTMLInputElement | null;
    frames.push(input ? input.value : '(no input)');
  }, [modals.colorPicker]);
  return null;
}

function renderPicker(colors: string[], onConfirm = vi.fn(), frames: string[] = []) {
  render(
    <ModalProvider>
      {colors.map(color => (
        <Opener key={color} initialColor={color} onConfirm={onConfirm} />
      ))}
      <ColorPickerModal />
      <FirstFrameProbe frames={frames} />
    </ModalProvider>
  );
  return { onConfirm, frames };
}

function hexInput() {
  return screen.getByLabelText('HEX') as HTMLInputElement;
}

describe('ColorPickerModal', () => {
  it('opens at #000000 for an unresolved alias instead of crashing', () => {
    renderPicker(['{accent/50}']);
    fireEvent.click(screen.getByText('Open {accent/50}'));
    expect(screen.getByText('Pick Color')).toBeTruthy();
    expect(hexInput().value).toBe('#000000');
  });

  it('opens at #000000 for an unparseable value', () => {
    renderPicker(['not a color']);
    fireEvent.click(screen.getByText('Open not a color'));
    expect(screen.getByText('Pick Color')).toBeTruthy();
    expect(hexInput().value).toBe('#000000');
  });

  it('discards a cancelled edit when reopened with the same initialColor', () => {
    const { frames } = renderPicker(['#D5E1AE']);
    fireEvent.click(screen.getByText('Open #D5E1AE'));
    expect(hexInput().value).toBe('#D5E1AE');

    fireEvent.change(hexInput(), { target: { value: '#FF0000' } });
    fireEvent.blur(hexInput());
    expect(hexInput().value).toBe('#FF0000');

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Pick Color')).toBeNull();

    frames.length = 0;
    fireEvent.click(screen.getByText('Open #D5E1AE'));
    // The old effect painted the cancelled #FF0000 for a frame before resetting
    expect(frames[0]).toBe('#D5E1AE');
    expect(hexInput().value).toBe('#D5E1AE');
  });

  it('applies the fresh color after a cancelled edit', () => {
    const { onConfirm } = renderPicker(['#D5E1AE']);
    fireEvent.click(screen.getByText('Open #D5E1AE'));
    fireEvent.change(hexInput(), { target: { value: '#FF0000' } });
    fireEvent.blur(hexInput());
    fireEvent.click(screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Open #D5E1AE'));
    fireEvent.click(screen.getByText('Apply'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(String(onConfirm.mock.calls[0][0]).toLowerCase()).toBe('#d5e1ae');
  });

  it('shows the new initialColor on the first painted frame after reopening', () => {
    const { frames } = renderPicker(['#D5E1AE', '#3366FF']);
    fireEvent.click(screen.getByText('Open #D5E1AE'));
    fireEvent.click(screen.getByText('Cancel'));

    frames.length = 0;
    fireEvent.click(screen.getByText('Open #3366FF'));

    expect(frames[0]).toBe('#3366FF');
    expect(hexInput().value).toBe('#3366FF');
  });
});
