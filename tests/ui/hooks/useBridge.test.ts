// Tests for the dev browser bridge transport (src/ui/hooks/useBridge.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BRIDGE_ENABLED,
  BRIDGE_EVENT_TAG,
  BRIDGE_URL,
  BridgeClient,
  bridge,
  decodeEnvelope,
  encodeEnvelope,
  isInsideFigma,
  sendOverBridge,
  subscribeToBridgeMessages,
} from '../../../src/ui/hooks/useBridge';

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

describe('envelope encoding', () => {
  it('encodes a hello without a payload key', () => {
    expect(JSON.parse(encodeEnvelope('plugin', 'hello'))).toEqual({
      v: 1,
      role: 'plugin',
      kind: 'hello',
    });
  });

  it('round-trips an application message unchanged', () => {
    const payload = { type: 'update-variable-value', id: 'VariableID:1:2', value: '#fff' };
    const decoded = decodeEnvelope(encodeEnvelope('client', 'message', payload));

    expect(decoded).toEqual({ v: 1, role: 'client', kind: 'message', payload });
    // The existing plugin message object must survive verbatim.
    expect(decoded!.payload).toEqual(payload);
  });

  it('rejects anything that is not a v1 envelope', () => {
    expect(decodeEnvelope('not json')).toBeNull();
    expect(decodeEnvelope(42)).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 2, role: 'plugin', kind: 'hello' }))).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 1, role: 'relay', kind: 'hello' }))).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 1, role: 'plugin', kind: 'bye' }))).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 1, role: 'plugin', kind: 'message' }))).toBeNull();
  });
});

describe('environment detection', () => {
  afterEach(restoreParent);

  it('reports a plain browser tab when it is the top level document', () => {
    setParent(window);
    expect(isInsideFigma()).toBe(false);
  });

  it('reports the plugin when the document is embedded in another window', () => {
    setParent({ postMessage: vi.fn() });
    expect(isInsideFigma()).toBe(true);
  });
});

describe('build-time gate', () => {
  it('is compiled out under test/production, leaving no client and no socket', () => {
    expect(BRIDGE_ENABLED).toBe(false);
    expect(bridge).toBeNull();
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
    const client = new BridgeClient('client');
    client.start();

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(BRIDGE_URL);
    socket.accept();

    expect(socket.frames()[0]).toEqual({ v: 1, role: 'client', kind: 'hello' });
    client.stop();
  });

  it('queues browser messages sent before the relay answers, then flushes them', () => {
    const client = new BridgeClient('client');
    client.start();

    expect(client.send({ type: 'ui-ready' })).toBe(false);

    const socket = FakeWebSocket.instances[0];
    socket.accept();

    expect(socket.frames()).toEqual([
      { v: 1, role: 'client', kind: 'hello' },
      { v: 1, role: 'client', kind: 'message', payload: { type: 'ui-ready' } },
    ]);
    client.stop();
  });

  it('delivers plugin frames to subscribers and re-emits them as tagged window messages', () => {
    const client = new BridgeClient('client');
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

  it('gives the browser its data back: a client hello makes the plugin re-request a refresh', () => {
    const postMessage = vi.fn();
    setParent({ postMessage });

    const client = new BridgeClient('plugin');
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();
    socket.deliver(encodeEnvelope('client', 'hello'));

    expect(postMessage.mock.calls.map((call) => call[0].pluginMessage.type)).toEqual([
      'ui-ready',
      'get-history-state',
    ]);
    expect(client.getStatus().peerAttached).toBe(true);

    client.stop();
  });

  it('forwards browser commands into the Figma sandbox unchanged', () => {
    const postMessage = vi.fn();
    setParent({ postMessage });

    const client = new BridgeClient('plugin');
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    const command = { type: 'bind-node-property', nodeId: '1:2', target: 'fill', variableId: 'V:1' };
    socket.deliver(encodeEnvelope('client', 'message', command));

    expect(postMessage).toHaveBeenCalledWith({ pluginMessage: command }, '*');
    client.stop();
  });

  it('mirrors everything the sandbox posts to the plugin window', () => {
    setParent({ postMessage: vi.fn() });

    const client = new BridgeClient('plugin');
    client.start();
    const socket = FakeWebSocket.instances[0];
    socket.accept();

    window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: { type: 'update-success' } } }));

    expect(socket.frames().at(-1)).toEqual({
      v: 1,
      role: 'plugin',
      kind: 'message',
      payload: { type: 'update-success' },
    });
    client.stop();
  });

  it('stops retrying in the plugin when nothing is listening, and stays silent', () => {
    setParent({ postMessage: vi.fn() });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const client = new BridgeClient('plugin');
    client.start();

    for (let i = 0; i < 10; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }

    expect(FakeWebSocket.instances).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(client.getStatus().connected).toBe(false);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    client.stop();
  });

  it('keeps retrying with backoff in the browser, where the relay is the only transport', () => {
    const client = new BridgeClient('client');
    client.start();

    for (let i = 0; i < 8; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }

    expect(FakeWebSocket.instances.length).toBe(9);
    client.stop();
  });

  it('falls back to the browser preview mock when the first connect fails', () => {
    const inject = vi.fn();
    (window as any).__WINDEN_INJECT_MOCK__ = inject;

    const client = new BridgeClient('client');
    client.start();
    expect((window as any).__WINDEN_BRIDGE_ACTIVE__).toBe(true);

    FakeWebSocket.instances[0].refuse();

    expect(inject).toHaveBeenCalledTimes(1);
    expect((window as any).__WINDEN_BRIDGE_ACTIVE__).toBe(false);

    delete (window as any).__WINDEN_INJECT_MOCK__;
    client.stop();
  });

  it('reconnects indefinitely once the relay has been seen at least once', () => {
    setParent({ postMessage: vi.fn() });

    const client = new BridgeClient('plugin');
    client.start();
    FakeWebSocket.instances[0].accept();
    expect(client.getStatus().connected).toBe(true);

    for (let i = 0; i < 6; i += 1) {
      FakeWebSocket.instances.at(-1)!.refuse();
      vi.advanceTimersByTime(60000);
    }

    expect(FakeWebSocket.instances.length).toBe(7);
    client.stop();
  });

  it('never throws when the socket constructor is refused outright', () => {
    setParent({ postMessage: vi.fn() });
    (globalThis as any).WebSocket = class {
      static readonly OPEN = 1;
      constructor() {
        throw new Error('network access blocked');
      }
    };

    const client = new BridgeClient('plugin');
    expect(() => client.start()).not.toThrow();
    expect(client.send({ type: 'refresh' })).toBe(false);
    client.stop();
  });
});
