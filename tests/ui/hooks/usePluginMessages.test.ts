// Tests for the plugin message transport boundary.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePluginMessages, post } from '../../../src/ui/hooks/usePluginMessages';
import { BRIDGE_EVENT_TAG } from '../../../src/ui/hooks/useBridge';

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

function setParent(value: any): void {
  Object.defineProperty(window, 'parent', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (originalParent) {
    Object.defineProperty(window, 'parent', originalParent);
  } else {
    delete (window as any).parent;
  }
});

describe('usePluginMessages', () => {
  it('dispatches plugin messages from window events to the matching handler', () => {
    const onDataLoaded = vi.fn();
    renderHook(() => usePluginMessages({ 'data-loaded': onDataLoaded }));

    window.dispatchEvent(
      new MessageEvent('message', { data: { pluginMessage: { type: 'data-loaded', variables: [] } } })
    );

    expect(onDataLoaded).toHaveBeenCalledWith({ type: 'data-loaded', variables: [] });
  });

  it('ignores frames the bridge re-emitted, which were already dispatched', () => {
    const onDataLoaded = vi.fn();
    renderHook(() => usePluginMessages({ 'data-loaded': onDataLoaded }));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { pluginMessage: { type: 'data-loaded' }, [BRIDGE_EVENT_TAG]: true },
      })
    );

    expect(onDataLoaded).not.toHaveBeenCalled();
  });

  it('ignores events without a plugin message and unknown message types', () => {
    const onDataLoaded = vi.fn();
    renderHook(() => usePluginMessages({ 'data-loaded': onDataLoaded }));

    window.dispatchEvent(new MessageEvent('message', { data: 'noise' }));
    window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: { type: 'nope' } } }));

    expect(onDataLoaded).not.toHaveBeenCalled();
  });
});

describe('post', () => {
  it('posts to the Figma sandbox when running inside the plugin iframe', () => {
    const postMessage = vi.fn();
    setParent({ postMessage });

    post({ type: 'refresh' });

    expect(postMessage).toHaveBeenCalledWith({ pluginMessage: { type: 'refresh' } }, '*');
  });

  it('keeps the pre-bridge behaviour in a browser when the bridge is compiled out', () => {
    const postMessage = vi.fn();
    setParent(undefined);
    Object.defineProperty(window, 'parent', { value: window, configurable: true, writable: true });
    const spy = vi.spyOn(window, 'postMessage').mockImplementation(postMessage);

    post({ type: 'refresh' });

    expect(postMessage).toHaveBeenCalledWith({ pluginMessage: { type: 'refresh' } }, '*');
    spy.mockRestore();
  });
});
