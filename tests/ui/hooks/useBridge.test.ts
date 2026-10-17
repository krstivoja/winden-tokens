// Tests for the browser-tab bridge client (src/ui/hooks/useBridge.ts).
// Client role only: the Figma side lives in src/ui/bridge/ (tests/ui/bridge/).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BRIDGE_CLIENT_ENABLED,
  BRIDGE_EVENT_TAG,
  BRIDGE_CLOSE_VERSION,
  BRIDGE_URL,
  BridgeClient,
  bridge,
  isBridgeClient,
  isInsideFigma,
  isSuppressedFromBrowser,
  relayUrlFromLocation,
  sendOverBridge,
  subscribeToBridgeMessages,
} from '../../../src/ui/hooks/useBridge';
import { encodeEnvelope } from '../../../src/ui/bridge/protocol';

/** A relay-authored status frame, exactly as bridge/server.mjs sends it. */
function relayStatus(type: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({ v: 2, role: 'relay', kind: 'status', payload: { type, ...extra } });
}

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  // -- test helpers -------------------------------------------------------
  accept(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  refuse(): void {
    this.readyState = 3;
    this.onerror?.({});
    this.onclose?.({});
  }

  /** The relay closing the socket with a code and a reason. */
  rejectWith(code: number, reason = ''): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  deliver(data: string): void {
    this.onmessage?.({ data });
  }

  frames(): any[] {
    return this.sent.map((raw) => JSON.parse(raw));
  }
}

const originalWebSocket = (globalThis as any).WebSocket;
const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

function setParent(value: any): void {
  Object.defineProperty(window, 'parent', { value, configurable: true, writable: true });
}

function restoreParent(): void {
  if (originalParent) {
    Object.defineProperty(window, 'parent', originalParent);
  } else {
    delete (window as any).parent;
  }
}

describe('environment detection', () => {
  afterEach(restoreParent);

  it('reports a plain browser tab when it is the top level document', () => {
    setParent(window);
    expect(isInsideFigma()).toBe(false);
  });

  it('reports Figma when the document is embedded in another window', () => {
    setParent({ postMessage: vi.fn() });
    expect(isInsideFigma()).toBe(true);
  });
});

describe('build-time gate', () => {
  it('is compiled out under test/production, leaving no client and no socket', () => {
    expect(BRIDGE_CLIENT_ENABLED).toBe(false);
    expect(bridge).toBeNull();
    expect(isBridgeClient()).toBe(false);
    expect(sendOverBridge({ type: 'refresh' })).toBe(false);
    expect(typeof subscribeToBridgeMessages(() => undefined)).toBe('function');
  });
});

describe('BridgeClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).WebSocket = originalWebSocket;
    restoreParent();
  });

  it('says hello with its own role on connect', () => {
    const client = new BridgeClient();
    client.start();

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(BRIDGE_URL);
    socket.accept();

    expect(socket.frames()[0]).toEqual({ v: 2, role: 'client', kind: 'hello' });
    client.stop();
  });

  it('queues browser messages sent before the relay answers, then flushes them', () => {
    const client = new BridgeClient();
    client.start();

    expect(client.send({ type: 'ui-ready' })).toBe(false);

    const socket = FakeWebSocket.instances[0];
    socket.accept();

    expect(socket.frames()).toEqual([
      { v: 2, role: 'client', kind: 'hello' },
      { v: 2, role: 'client', kind: 'message', payload: { type: 'ui-ready' } },
    ]);
    client.stop();
  });

  it('delivers plugin frames to subscribers and re-emits them as tagged window messages', () => {
    const client = new BridgeClient();
    const seen: any[] = [];
    client.onPayload((payload) => seen.push(payload));
    const onWindowMessage = vi.fn();
    window.addEventListener('message', onWindowMessage);

    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(encodeEnvelope('plugin', 'message', { type: 'data-loaded', variables: [] }));

    expect(seen).toEqual([{ type: 'data-loaded', variables: [] }]);

    vi.advanceTimersByTime(0);
    window.removeEventListener('message', onWindowMessage);
    const emitted = onWindowMessage.mock.calls.map((call) => call[0].data);
    expect(emitted.some((data) => data?.[BRIDGE_EVENT_TAG] && data.pluginMessage?.type === 'data-loaded')).toBe(true);

    client.stop();
  });

  it('keeps retrying when nothing is listening, and stays silent', () => {
    // Opening the tab before `npx winden-tokens` is running must attach on its
    // own once the relay starts, without a reload and without console noise.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const client = new BridgeClient();
    client.start();

    for (let i = 0; i < 10; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }

    expect(FakeWebSocket.instances).toHaveLength(11);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(client.getStatus().connected).toBe(false);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    client.stop();
  });

  it('caps the cold backoff so retries stay one per 15s, not a storm', () => {
    const client = new BridgeClient();
    client.start();

    for (let i = 0; i < 8; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }
    const settled = FakeWebSocket.instances.length;

    // One more failure: nothing may reconnect before the cap elapses.
    FakeWebSocket.instances.at(-1)!.refuse();
    vi.advanceTimersByTime(14999);
    expect(FakeWebSocket.instances.length).toBe(settled);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances.length).toBe(settled + 1);

    client.stop();
  });

  it('falls back to the browser preview mock when the first connect fails', () => {
    const inject = vi.fn();
    (window as any).__WINDEN_INJECT_MOCK__ = inject;

    const client = new BridgeClient();
    client.start();
    expect((window as any).__WINDEN_BRIDGE_ACTIVE__).toBe(true);

    FakeWebSocket.instances[0].refuse();

    expect(inject).toHaveBeenCalledTimes(1);
    expect((window as any).__WINDEN_BRIDGE_ACTIVE__).toBe(false);

    delete (window as any).__WINDEN_INJECT_MOCK__;
    client.stop();
  });

  it('reconnects indefinitely once the relay has been seen, without falling back to mock data', () => {
    const inject = vi.fn();
    (window as any).__WINDEN_INJECT_MOCK__ = inject;

    const client = new BridgeClient();
    client.start();
    FakeWebSocket.instances[0].accept();
    expect(client.getStatus().connected).toBe(true);

    for (let i = 0; i < 6; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }

    expect(FakeWebSocket.instances.length).toBe(7);
    // The tab showed real data once; a lost relay must not swap in samples.
    expect(inject).not.toHaveBeenCalled();

    delete (window as any).__WINDEN_INJECT_MOCK__;
    client.stop();
  });

  it('never throws when the socket constructor is refused outright', () => {
    (globalThis as any).WebSocket = class {
      static readonly OPEN = 1;
      constructor() {
        throw new Error('network access blocked');
      }
    };

    const client = new BridgeClient();
    expect(() => client.start()).not.toThrow();
    expect(client.send({ type: 'refresh' })).toBe(false);
    client.stop();
  });

  // -- relay status frames (bug: the browser gave no sign the plugin was gone)

  it('tells a browser tab the plugin is gone, and that it came back', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    // The relay answers every client hello with the current state.
    socket.deliver(relayStatus('bridge/plugin-connected'));
    expect(client.getStatus().peerAttached).toBe(true);

    socket.deliver(relayStatus('bridge/plugin-disconnected'));
    expect(client.getStatus().peerAttached).toBe(false);

    socket.deliver(relayStatus('bridge/plugin-connected'));
    expect(client.getStatus().peerAttached).toBe(true);

    client.stop();
  });

  it('does not claim the relay is down before the first attempt resolves', () => {
    const client = new BridgeClient();
    client.start();
    expect(client.getStatus().probed).toBe(false);

    FakeWebSocket.instances[0].refuse();
    expect(client.getStatus().probed).toBe(true);

    client.stop();
  });

  it('marks itself probed as soon as the relay answers', () => {
    const client = new BridgeClient();
    client.start();
    FakeWebSocket.instances[0].accept();

    expect(client.getStatus().probed).toBe(true);
    client.stop();
  });

  it('ignores a peer pretending to be the relay', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(relayStatus('bridge/plugin-connected'));

    // Same payload, but claiming the plugin role: not the relay's frame.
    socket.deliver(
      JSON.stringify({
        v: 2,
        role: 'plugin',
        kind: 'status',
        payload: { type: 'bridge/plugin-disconnected' },
      })
    );

    expect(client.getStatus().peerAttached).toBe(true);
    client.stop();
  });

    it('ignores the plugin\'s own hello and anything that is not an app message', () => {
    const client = new BridgeClient();
    const seen: any[] = [];
    client.onPayload((payload) => seen.push(payload));
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    socket.deliver(encodeEnvelope('plugin', 'hello', { pluginKey: 'a'.repeat(32) }));
    socket.deliver(encodeEnvelope('client', 'message', { type: 'refresh' }));

    expect(seen).toEqual([]);
    client.stop();
  });

  // -- pairing: an unknown Figma plugin window waits for approval in a tab

  it('shows the pairing code the relay asks about', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    expect(client.getStatus().pairingCode).toBeNull();

    socket.deliver(relayStatus('bridge/pairing-request', { code: 'K7Q2XD' }));

    expect(client.getStatus().pairingCode).toBe('K7Q2XD');
    client.stop();
  });

  it('approves with a client status frame naming the code, and hides the prompt', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(relayStatus('bridge/pairing-request', { code: 'K7Q2XD' }));

    expect(client.answerPairing(true)).toBe(true);

    expect(socket.frames().at(-1)).toEqual({
      v: 2,
      role: 'client',
      kind: 'status',
      payload: { type: 'bridge/pairing-answer', code: 'K7Q2XD', approve: true },
    });
    expect(client.getStatus().pairingCode).toBeNull();
    client.stop();
  });

  it('denies with approve: false', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(relayStatus('bridge/pairing-request', { code: 'ABCDEF' }));

    client.answerPairing(false);

    expect(socket.frames().at(-1)).toEqual({
      v: 2,
      role: 'client',
      kind: 'status',
      payload: { type: 'bridge/pairing-answer', code: 'ABCDEF', approve: false },
    });
    client.stop();
  });

  it('sends nothing when there is no open request to answer', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    const before = socket.sent.length;

    expect(client.answerPairing(true)).toBe(false);

    expect(socket.sent.length).toBe(before);
    client.stop();
  });

  it('clears the prompt when the relay resolves the request, whoever answered', () => {
    const client = new BridgeClient();
    const statuses: (string | null)[] = [];
    client.onStatus((status) => statuses.push(status.pairingCode));
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    socket.deliver(relayStatus('bridge/pairing-request', { code: 'K7Q2XD' }));
    // Another tab approved it (or it timed out): this tab never answered.
    socket.deliver(relayStatus('bridge/pairing-resolved', { approved: false, reason: 'timeout' }));

    expect(client.getStatus().pairingCode).toBeNull();
    expect(statuses.at(-1)).toBeNull();
    client.stop();
  });

  it('drops a stale prompt when the relay goes away', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(relayStatus('bridge/pairing-request', { code: 'K7Q2XD' }));

    socket.refuse();

    expect(client.getStatus().pairingCode).toBeNull();
    client.stop();
  });

  it('ignores a pairing request without a usable code', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    socket.deliver(relayStatus('bridge/pairing-request'));
    socket.deliver(relayStatus('bridge/pairing-request', { code: 42 }));

    expect(client.getStatus().pairingCode).toBeNull();
    client.stop();
  });
});

describe('messages a browser tab must not send', () => {
  it('suppresses what acts on the plugin window, not on the document', () => {
    // The browser window's size is not the Figma panel's size.
    expect(isSuppressedFromBrowser('resize')).toBe(true);
  });

  it('suppresses the bootstrap the bridge handshake already issues', () => {
    expect(isSuppressedFromBrowser('ui-ready')).toBe(true);
    expect(isSuppressedFromBrowser('get-history-state')).toBe(true);
  });

  it('lets every document command through', () => {
    for (const type of [
      'refresh',
      'create-variable',
      'update-variable-value',
      'bind-node-property',
      'unbind-node-property',
      'delete-variable',
      'get-client-storage',
      'set-client-storage',
      'undo',
      'redo',
    ]) {
      expect(isSuppressedFromBrowser(type)).toBe(false);
    }
  });

  it('is total: an unknown or missing type is never suppressed', () => {
    expect(isSuppressedFromBrowser(undefined)).toBe(false);
    expect(isSuppressedFromBrowser(42)).toBe(false);
    expect(isSuppressedFromBrowser('some-future-command')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The relay now ships separately from the plugin (`npm i -g winden-tokens`),
// so an old install WILL meet a newer plugin. Neither half may answer that
// with an empty screen.
// ---------------------------------------------------------------------------

describe('relay URL', () => {
  it('derives the relay from the page the relay served, so --port works', () => {
    expect(relayUrlFromLocation({ protocol: 'http:', hostname: '127.0.0.1', port: '9500' }))
      .toBe('ws://127.0.0.1:9500');
    expect(relayUrlFromLocation({ protocol: 'https:', hostname: 'localhost', port: '9337' }))
      .toBe('wss://localhost:9337');
  });

  it('declines anything that cannot be a relay origin', () => {
    expect(relayUrlFromLocation({ protocol: 'file:', hostname: '', port: '' })).toBeNull();
    expect(relayUrlFromLocation({ protocol: 'http:', hostname: 'localhost', port: '' })).toBeNull();
  });
});

describe('protocol version mismatch', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
    vi.useFakeTimers();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    errorSpy.mockRestore();
    (globalThis as any).WebSocket = originalWebSocket;
    restoreParent();
  });

  it('stops retrying and surfaces the relay\'s own words', () => {
    const client = new BridgeClient();
    client.start();

    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.rejectWith(BRIDGE_CLOSE_VERSION, 'bridge protocol mismatch: relay v1, you sent v2');

    const status = client.getStatus();
    expect(status.error).toBe('bridge protocol mismatch: relay v1, you sent v2');
    expect(status.connected).toBe(false);
    expect(errorSpy).toHaveBeenCalled();

    // Retrying could only ever be refused again.
    vi.advanceTimersByTime(600000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    client.stop();
  });

  it('falls back to its own message when the relay gave no reason', () => {
    const client = new BridgeClient();
    client.start();
    FakeWebSocket.instances[0].accept();
    FakeWebSocket.instances[0].rejectWith(BRIDGE_CLOSE_VERSION);

    expect(client.getStatus().error).toMatch(/mismatch/i);
    client.stop();
  });

  it('keeps reconnecting for any other close code', () => {
    const client = new BridgeClient();
    client.start();
    FakeWebSocket.instances[0].accept();
    FakeWebSocket.instances[0].rejectWith(4001, 'no hello');

    expect(client.getStatus().error).toBeNull();
    vi.advanceTimersByTime(60000);
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);

    client.stop();
  });

  it('tells an attached tab that the OTHER half was turned away', () => {
    const client = new BridgeClient();
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    socket.deliver(
      relayStatus('bridge/version-mismatch', {
        relay: 1,
        peer: 2,
        message: 'Bridge protocol mismatch: the relay speaks v1, the other side speaks v2.',
      })
    );

    // This socket is fine — it is the peer that was refused, so the tab shows a
    // banner and stays connected rather than giving up.
    expect(client.getStatus().error).toMatch(/^Bridge protocol mismatch/);
    expect(client.getStatus().connected).toBe(true);

    client.stop();
  });

});
