// Tests for the browser-tab bridge banners in src/ui/App.tsx.
//
// The bridge client is compiled out under test (BRIDGE_CLIENT_ENABLED is false),
// so the hook module is replaced with a controllable status. The heavy app
// surface (tabs, modals) is stubbed: these tests are about the banner row only.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BridgeStatus } from '../../src/ui/hooks/useBridge';

const bridgeMock = vi.hoisted(() => ({
  status: null as BridgeStatus | null,
  answer: vi.fn(),
}));

vi.mock('../../src/ui/hooks/useBridge', () => ({
  BRIDGE_CLIENT_ENABLED: true,
  isInsideFigma: () => false,
  useBridge: () => bridgeMock.status,
  answerBridgePairing: (approve: boolean) => bridgeMock.answer(approve),
}));

vi.mock('../../src/ui/hooks/usePluginMessages', () => ({
  usePluginMessages: () => undefined,
  post: () => undefined,
}));

vi.mock('../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ setData: () => undefined, setSelection: () => undefined }),
}));

vi.mock('../../src/ui/components/Tabs/TabBar', () => ({ TabBar: () => null }));
vi.mock('../../src/ui/components/Tabs/TabContent', () => ({ TabContent: () => null }));
vi.mock('../../src/ui/components/Modals/ShadesModal', () => ({ ShadesModal: () => null }));
vi.mock('../../src/ui/components/Modals/StepsModal', () => ({ StepsModal: () => null }));
vi.mock('../../src/ui/components/Modals/InputModal', () => ({ InputModal: () => null }));
vi.mock('../../src/ui/components/Modals/AddVariableModal', () => ({ AddVariableModal: () => null }));
vi.mock('../../src/ui/components/Modals/ColorPickerModal', () => ({ ColorPickerModal: () => null }));
vi.mock('../../src/ui/components/Modals/ColorReferenceModal', () => ({ ColorReferenceModal: () => null }));
vi.mock('../../src/ui/components/Modals/BulkEditModal', () => ({ BulkEditModal: () => null }));
vi.mock('../../src/ui/components/ResizeHandles', () => ({ ResizeHandles: () => null }));

import { App } from '../../src/ui/App';

function status(overrides: Partial<BridgeStatus>): BridgeStatus {
  return {
    enabled: true,
    connected: true,
    peerAttached: false,
    probed: true,
    error: null,
    pairingCode: null,
    ...overrides,
  };
}

beforeEach(() => {
  bridgeMock.answer.mockReset();
});

describe('App bridge banners (browser tab)', () => {
  it('tells a connected tab with no plugin where the Bridge command lives', () => {
    bridgeMock.status = status({});
    render(<App />);

    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('Open the Winden Tokens plugin in Figma');
    expect(text).toContain('Plugins → Winden Tokens → Bridge to browser');
  });

  it('asks to approve an unknown plugin window, showing its code', () => {
    bridgeMock.status = status({ pairingCode: 'K7Q2XD' });
    render(<App />);

    const prompt = screen.getByRole('alert');
    expect(prompt.textContent).toContain('A Figma plugin window wants to connect.');
    expect(prompt.textContent).toContain('K7Q2XD');
    expect(prompt.textContent).toContain('"Bridge to browser" window');
    // The prompt replaces the "no plugin connected" banner.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('answers approve and deny through the bridge', () => {
    bridgeMock.status = status({ pairingCode: 'K7Q2XD' });
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    expect(bridgeMock.answer.mock.calls).toEqual([[true], [false]]);
  });

  it('removes the prompt once the request is resolved', () => {
    bridgeMock.status = status({ pairingCode: 'K7Q2XD' });
    const { rerender } = render(<App />);
    expect(screen.queryByRole('alert')).not.toBeNull();

    bridgeMock.status = status({ pairingCode: null, peerAttached: true });
    rerender(<App />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('prefers a protocol mismatch over the pairing prompt', () => {
    bridgeMock.status = status({ pairingCode: 'K7Q2XD', error: 'Bridge protocol mismatch: update one side.' });
    render(<App />);

    expect(screen.getByRole('status').textContent?.trim()).toBe('Bridge protocol mismatch: update one side.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows nothing when the bridge is not active in this window', () => {
    bridgeMock.status = status({ enabled: false, probed: false, connected: false });
    render(<App />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
