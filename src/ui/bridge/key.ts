// The plugin key: this Figma install's pairing identity with the relay.
//
// It lives in figma.clientStorage, which only the sandbox can reach. The
// sandbox has no guaranteed crypto.getRandomValues, so the iframe generates a
// candidate and the sandbox keeps whichever key it already has, storing the
// candidate only when it has none. One round trip, and no read-then-write race.

import { generatePluginKey, isValidPluginKey } from './protocol';

/**
 * Sandbox messages. Literal copies live in src/plugin/code.ts. The whole
 * `bridge-` prefix is private to this window: never mirrored to the relay,
 * never accepted from it (see client.ts).
 */
export const BRIDGE_SANDBOX_PREFIX = 'bridge-';
export const SANDBOX_GET_KEY = 'bridge-get-key';
export const SANDBOX_KEY_REPLY = 'bridge-key';
/** Ask the sandbox to open the relay's browser UI. Carries no URL: the sandbox owns it. */
export const SANDBOX_OPEN_UI = 'bridge-open-ui';

/** A sandbox that never answers must not leave the window stuck. */
export const KEY_REPLY_TIMEOUT_MS = 3000;

export interface KeyTransport {
  post(message: Record<string, unknown>): void;
  listen(handler: (message: unknown) => void): () => void;
}

/**
 * Resolves to the stored key. Falls back to the fresh candidate if the sandbox
 * does not answer in time — the bridge still works, the user just pairs again
 * next launch.
 */
export function requestPluginKey(
  transport: KeyTransport,
  candidate: string = generatePluginKey(),
  timeoutMs: number = KEY_REPLY_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (key: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(key);
    };

    const unsubscribe = transport.listen((message) => {
      const msg = message as { type?: unknown; key?: unknown } | null;
      if (!msg || msg.type !== SANDBOX_KEY_REPLY) return;
      finish(isValidPluginKey(msg.key) ? msg.key : candidate);
    });
    const timer = setTimeout(() => finish(candidate), timeoutMs);

    transport.post({ type: SANDBOX_GET_KEY, candidate });
  });
}
