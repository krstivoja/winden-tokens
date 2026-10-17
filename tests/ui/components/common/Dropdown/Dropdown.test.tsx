// A menu choice must not also count as a click on whatever hosts the menu.
// In a graph card that host is a React Flow node, whose click toggles the
// path highlight — so "Highlight path" used to highlight and un-highlight.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dropdown } from '../../../../../src/ui/components/common/Dropdown/Dropdown';

function renderInHost(onHostClick: () => void, onItemClick: () => void) {
  render(
    <div onClick={onHostClick}>
      <Dropdown>
        <Dropdown.Trigger asChild>
          <button type="button" onClick={(e) => e.stopPropagation()}>Open</button>
        </Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item onClick={onItemClick}>Choose</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

describe('Dropdown menu clicks', () => {
  it('runs the item and does not bubble to the host', () => {
    const onHostClick = vi.fn();
    const onItemClick = vi.fn();
    renderInHost(onHostClick, onItemClick);
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Choose'));
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onHostClick).not.toHaveBeenCalled();
  });

  it('marks the root while open, for stacking the host above its siblings', () => {
    const { container } = render(
      <Dropdown>
        <Dropdown.Trigger asChild><button type="button">Open</button></Dropdown.Trigger>
        <Dropdown.Menu><Dropdown.Item>Choose</Dropdown.Item></Dropdown.Menu>
      </Dropdown>
    );
    expect(container.querySelector('[data-dropdown-open]')).toBe(null);
    fireEvent.click(screen.getByText('Open'));
    expect(container.querySelector('[data-dropdown-open]')).not.toBe(null);
  });
});
