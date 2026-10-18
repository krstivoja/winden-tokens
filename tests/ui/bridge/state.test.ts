// Tests for the bridge window's status model (src/ui/bridge/state.ts).

import { describe, it, expect } from 'vitest';
import { closeOutcome, isTerminal, tabsLabel, viewFor } from '../../../src/ui/bridge/state';

describe('closeOutcome', () => {
  it('maps the relay close codes', () => {
    expect(closeOutcome(4000)).toBe('replaced');
    expect(closeOutcome(4002)).toBe('version');
    expect(closeOutcome(4003)).toBe('denied');
    expect(closeOutcome(4004)).toBe('timed-out');
    expect(closeOutcome(4005)).toBe('busy');
  });

  it('retries everything else', () => {
    expect(closeOutcome(undefined)).toBe('retry');
    expect(closeOutcome(1006)).toBe('retry');
    expect(closeOutcome(4001)).toBe('retry');
  });
});

describe('isTerminal', () => {
  it('stops only on states the user must act on', () => {
    expect(isTerminal({ phase: 'denied' })).toBe(true);
    expect(isTerminal({ phase: 'timed-out' })).toBe(true);
    expect(isTerminal({ phase: 'replaced' })).toBe(true);
    expect(isTerminal({ phase: 'version', reason: '' })).toBe(true);
    expect(isTerminal({ phase: 'relay-down' })).toBe(false);
    expect(isTerminal({ phase: 'busy' })).toBe(false);
    expect(isTerminal({ phase: 'pairing', code: 'X' })).toBe(false);
  });
});

describe('viewFor', () => {
  it('hints the CLI when the relay is not running', () => {
    expect(viewFor({ phase: 'relay-down' }).detail?.code).toBe('npx winden-tokens');
  });

  it('shows the pairing code', () => {
    const view = viewFor({ phase: 'pairing', code: 'K7Q2ZP' });
    expect(view.title).toBe('Approve in your browser tab');
    expect(view.detail?.code).toBe('K7Q2ZP');
    expect(view.retry).toBe(false);
  });

  it('offers Retry after a denial', () => {
    const view = viewFor({ phase: 'denied' });
    expect(view.title).toBe('Pairing denied');
    expect(view.retry).toBe(true);
    expect(view.tone).toBe('error');
  });

  it('tells the user to update on a version mismatch, without Retry', () => {
    const view = viewFor({ phase: 'version', reason: 'x' });
    expect(view.detail?.code).toBe('npx winden-tokens@latest');
    expect(view.retry).toBe(false);
  });

  it('counts tabs', () => {
    expect(viewFor({ phase: 'connected', tabs: 2 }).detail?.text).toBe('2 browser tabs attached');
    expect(tabsLabel(1)).toBe('1 browser tab attached');
    expect(tabsLabel(0)).toBe('No browser tab open yet');
  });

  it('offers "Open in browser" only while connected or pairing', () => {
    expect(viewFor({ phase: 'connected', tabs: 0 }).openLink).toBe(true);
    expect(viewFor({ phase: 'pairing', code: 'K7Q2ZP' }).openLink).toBe(true);
    expect(viewFor({ phase: 'connecting' }).openLink).toBe(false);
    expect(viewFor({ phase: 'relay-down' }).openLink).toBe(false);
    expect(viewFor({ phase: 'busy' }).openLink).toBe(false);
    expect(viewFor({ phase: 'denied' }).openLink).toBe(false);
    expect(viewFor({ phase: 'timed-out' }).openLink).toBe(false);
    expect(viewFor({ phase: 'replaced' }).openLink).toBe(false);
    expect(viewFor({ phase: 'version', reason: 'x' }).openLink).toBe(false);
  });
});
