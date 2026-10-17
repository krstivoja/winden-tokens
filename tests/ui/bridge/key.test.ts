// Tests for the plugin-key handshake with the sandbox (src/ui/bridge/key.ts).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestPluginKey, SANDBOX_GET_KEY } from '../../../src/ui/bridge/key';

function fakeTransport() {
  const posted: Record<string, unknown>[] = [];
  let handler: ((message: unknown) => void) | null = null;
  return {
    posted,
    reply: (message: unknown) => handler?.(message),
    listening: () => handler !== null,
    transport: {
      post: (message: Record<string, unknown>) => posted.push(message),
      listen: (h: (message: unknown) => void) => {
        handler = h;
        return () => {
          handler = null;
        };
      },
    },
  };
}

const CANDIDATE = 'c'.repeat(32);
const STORED = '5'.repeat(32);

afterEach(() => {
  vi.useRealTimers();
});

describe('requestPluginKey', () => {
  it('sends the candidate and resolves to the stored key', async () => {
    const t = fakeTransport();
    const pending = requestPluginKey(t.transport, CANDIDATE);
    expect(t.posted).toEqual([{ type: SANDBOX_GET_KEY, candidate: CANDIDATE }]);
    t.reply({ type: 'data-loaded' });
    t.reply({ type: 'bridge-key', key: STORED });
    await expect(pending).resolves.toBe(STORED);
    expect(t.listening()).toBe(false);
  });

  it('falls back to the candidate on an invalid reply', async () => {
    const t = fakeTransport();
    const pending = requestPluginKey(t.transport, CANDIDATE);
    t.reply({ type: 'bridge-key', key: null });
    await expect(pending).resolves.toBe(CANDIDATE);
  });

  it('falls back to the candidate when the sandbox never answers', async () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const pending = requestPluginKey(t.transport, CANDIDATE, 100);
    vi.advanceTimersByTime(100);
    await expect(pending).resolves.toBe(CANDIDATE);
    expect(t.listening()).toBe(false);
  });
});
