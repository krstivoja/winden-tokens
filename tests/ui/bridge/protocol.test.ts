// Tests for the shared bridge wire protocol (src/ui/bridge/protocol.ts).

import { describe, it, expect } from 'vitest';
import {
  BRIDGE_PROTOCOL_VERSION,
  decodeEnvelope,
  encodeEnvelope,
  generatePluginKey,
  isValidPluginKey,
} from '../../../src/ui/bridge/protocol';

describe('bridge protocol', () => {
  it('speaks v2', () => {
    expect(BRIDGE_PROTOCOL_VERSION).toBe(2);
  });

  it('puts the plugin key in the hello payload', () => {
    const frame = JSON.parse(encodeEnvelope('plugin', 'hello', { pluginKey: 'a'.repeat(32) }));
    expect(frame).toEqual({ v: 2, role: 'plugin', kind: 'hello', payload: { pluginKey: 'a'.repeat(32) } });
  });

  it('keeps a payload-less hello payload-less', () => {
    expect(JSON.parse(encodeEnvelope('client', 'hello'))).toEqual({ v: 2, role: 'client', kind: 'hello' });
  });

  it('carries the payload of a client status frame (the pairing answer)', () => {
    const payload = { type: 'bridge/pairing-answer', code: 'K7Q2XD', approve: true };
    expect(JSON.parse(encodeEnvelope('client', 'status', payload))).toEqual({
      v: 2,
      role: 'client',
      kind: 'status',
      payload,
    });
  });

  it('round-trips a message frame', () => {
    const raw = encodeEnvelope('client', 'message', { type: 'refresh' });
    expect(decodeEnvelope(raw)).toEqual({ v: 2, role: 'client', kind: 'message', payload: { type: 'refresh' } });
  });

  it('rejects other versions, junk and impersonated relay frames', () => {
    expect(decodeEnvelope(JSON.stringify({ v: 1, role: 'client', kind: 'message', payload: {} }))).toBeNull();
    expect(decodeEnvelope('not json')).toBeNull();
    expect(decodeEnvelope(42)).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 2, role: 'client', kind: 'status', payload: {} }))).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 2, role: 'relay', kind: 'message', payload: {} }))).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ v: 2, role: 'client', kind: 'message' }))).toBeNull();
  });

  it('accepts relay status frames', () => {
    const raw = JSON.stringify({ v: 2, role: 'relay', kind: 'status', payload: { type: 'bridge/pairing-pending', code: 'ABC123' } });
    expect(decodeEnvelope(raw)?.payload).toEqual({ type: 'bridge/pairing-pending', code: 'ABC123' });
  });

  it('generates 128-bit lowercase hex keys', () => {
    const key = generatePluginKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidPluginKey(key)).toBe(true);
    expect(generatePluginKey()).not.toBe(key);
  });

  it('hex-encodes every byte with padding', () => {
    const key = generatePluginKey((bytes) => {
      bytes.fill(0);
      bytes[0] = 0x0f;
      bytes[15] = 0xff;
      return bytes;
    });
    expect(key).toBe('0f' + '00'.repeat(14) + 'ff');
  });

  it('validates key shape', () => {
    expect(isValidPluginKey('A'.repeat(32))).toBe(false);
    expect(isValidPluginKey('a'.repeat(31))).toBe(false);
    expect(isValidPluginKey(null)).toBe(false);
  });
});
