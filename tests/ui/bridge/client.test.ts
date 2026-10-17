// Tests for the plugin role of the bridge (src/ui/bridge/client.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OPEN_GRACE_MS,
  PluginBridge,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  isBlockedFromRelay,
  sandboxMessageFrom,
  type SocketLike,
} from '../../../src/ui/bridge/client';
import { BRIDGE_EVENT_TAG } from '../../../src/ui/bridge/protocol';

const KEY = 'a1'.repeat(16);

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onerror: SocketLike['onerror'] = null;
  onclose: SocketLike['onclose'] = null;

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  accept(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  closeWith(code?: number, reason = ''): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
  deliver(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  frames(): any[] {
    return this.sent.map((raw) => JSON.parse(raw));
  }
}

function relay(type: string, extra?: Record<string, unknown>) {
  return { v: 2, role: 'relay', kind: 'status', payload: { type, ...extra } };
}

function setup() {
  const sockets: FakeSocket[] = [];
  const toSandbox: Record<string, unknown>[] = [];
  let sandboxHandler: ((message: Record<string, unknown>) => void) | null = null;
  let now = 1_000_000;

  const bridge = new PluginBridge({
    url: 'ws://localhost:9337',
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    postToSandbox: (message) => toSandbox.push(message),
    onSandboxMessage: (handler) => {
      sandboxHandler = handler;
      return () => {
        sandboxHandler = null;
      };
    },
    now: () => now,
  });

  return {
    bridge,
    sockets,
    toSandbox,
    last: () => sockets[sockets.length - 1],
    fromSandbox: (message: Record<string, unknown>) => sandboxHandler?.(message),
    advanceClock: (ms: number) => {
      now += ms;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PluginBridge', () => {
  it('says hello with the plugin key, then reads as connected after the grace', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    expect(t.last().frames()).toEqual([{ v: 2, role: 'plugin', kind: 'hello', payload: { pluginKey: KEY } }]);
    expect(t.bridge.getState()).toEqual({ phase: 'connecting' });
    vi.advanceTimersByTime(OPEN_GRACE_MS);
    expect(t.bridge.getState()).toEqual({ phase: 'connected', tabs: 0 });
  });

  it('shows the relay as down and retries with capped backoff', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().closeWith(1006);
    expect(t.bridge.getState()).toEqual({ phase: 'relay-down' });

    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    expect(t.sockets).toHaveLength(2);
    for (let i = 0; i < 10; i++) {
      t.last().closeWith(1006);
      vi.advanceTimersByTime(RECONNECT_MAX_MS);
    }
    expect(t.sockets).toHaveLength(12);
  });

  it('shows the pairing code, and goes live on approval', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    t.last().deliver(relay('bridge/pairing-pending', { code: 'K7Q2ZP' }));
    vi.advanceTimersByTime(OPEN_GRACE_MS * 2);
    expect(t.bridge.getState()).toEqual({ phase: 'pairing', code: 'K7Q2ZP' });

    // Unpaired: nothing from the sandbox goes out.
    t.fromSandbox({ type: 'selection-changed' });
    expect(t.last().frames()).toHaveLength(1);

    t.last().deliver(relay('bridge/pairing-approved'));
    expect(t.bridge.getState()).toEqual({ phase: 'connected', tabs: 0 });
    t.fromSandbox({ type: 'selection-changed' });
    expect(t.last().frames()[1]).toEqual({ v: 2, role: 'plugin', kind: 'message', payload: { type: 'selection-changed' } });
  });

  it('stops on a denial until Retry', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    t.last().deliver(relay('bridge/pairing-pending', { code: 'K7Q2ZP' }));
    t.last().closeWith(4003, 'pairing denied');
    expect(t.bridge.getState()).toEqual({ phase: 'denied' });

    vi.advanceTimersByTime(RECONNECT_MAX_MS * 4);
    expect(t.sockets).toHaveLength(1);

    t.bridge.retry();
    expect(t.sockets).toHaveLength(2);
    expect(t.bridge.getState()).toEqual({ phase: 'connecting' });
  });

  it('stops for good on a version mismatch', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = setup();
    t.bridge.start(KEY);
    t.last().closeWith(4002, 'bridge protocol mismatch');
    expect(t.bridge.getState()).toEqual({ phase: 'version', reason: 'bridge protocol mismatch' });
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 4);
    expect(t.sockets).toHaveLength(1);
    errorSpy.mockRestore();
  });

  it('does not fight another Figma window that replaced it', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    t.last().closeWith(4000);
    expect(t.bridge.getState()).toEqual({ phase: 'replaced' });
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 4);
    expect(t.sockets).toHaveLength(1);
  });

  it('keeps retrying while another plugin holds the pairing prompt', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    t.last().closeWith(4005);
    expect(t.bridge.getState()).toEqual({ phase: 'busy' });
    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    expect(t.sockets).toHaveLength(2);
  });

  it('counts tabs and coalesces refresh requests', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    t.last().deliver(relay('bridge/client-attached', { clients: 1 }));
    t.last().deliver({ v: 2, role: 'client', kind: 'hello' });
    expect(t.bridge.getState()).toEqual({ phase: 'connected', tabs: 1 });
    expect(t.toSandbox).toEqual([{ type: 'ui-ready' }, { type: 'get-history-state' }]);

    // Answered: the next cue may ask again.
    t.fromSandbox({ type: 'data-loaded' });
    t.last().deliver(relay('bridge/client-attached', { clients: 2 }));
    expect(t.toSandbox).toHaveLength(4);
    expect(t.bridge.getState()).toEqual({ phase: 'connected', tabs: 2 });

    t.last().deliver(relay('bridge/client-detached', { clients: 0 }));
    expect(t.bridge.getState()).toEqual({ phase: 'connected', tabs: 0 });
  });

  it('hands browser commands to the sandbox, minus the blocked ones', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    vi.advanceTimersByTime(OPEN_GRACE_MS);
    const command = (payload: Record<string, unknown>) => ({ v: 2, role: 'client', kind: 'message', payload });
    t.last().deliver(command({ type: 'update-variable-value', id: 'v1', value: '#fff' }));
    t.last().deliver(command({ type: 'resize', width: 1920, height: 1080 }));
    t.last().deliver(command({ type: 'cancel' }));
    t.last().deliver(command({ type: 'bridge-get-key', candidate: 'x' }));
    expect(t.toSandbox).toEqual([{ type: 'update-variable-value', id: 'v1', value: '#fff' }]);
  });

  it('never mirrors the plugin key out', () => {
    const t = setup();
    t.bridge.start(KEY);
    t.last().accept();
    vi.advanceTimersByTime(OPEN_GRACE_MS);
    t.fromSandbox({ type: 'bridge-key', key: KEY });
    // Only the hello (which carries it to the relay, by design) went out.
    expect(t.last().frames().map((f) => f.kind)).toEqual(['hello']);
  });

  it('isBlockedFromRelay / sandboxMessageFrom', () => {
    expect(isBlockedFromRelay('refresh')).toBe(false);
    expect(isBlockedFromRelay(undefined)).toBe(true);
    expect(sandboxMessageFrom({ pluginMessage: { type: 'a' } })).toEqual({ type: 'a' });
    expect(sandboxMessageFrom({ pluginMessage: { type: 'a' }, [BRIDGE_EVENT_TAG]: true })).toBeNull();
    expect(sandboxMessageFrom('nope')).toBeNull();
  });
});
