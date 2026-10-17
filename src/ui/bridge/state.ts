// What the bridge window shows, as pure data: the connection phase, how a relay
// close code moves it, and the words for each phase. No DOM here, so all of it
// is unit-testable without a socket.

import {
  BRIDGE_CLI_COMMAND,
  BRIDGE_CLI_UPDATE_COMMAND,
  BRIDGE_CLOSE_PAIRING_BUSY,
  BRIDGE_CLOSE_PAIRING_DENIED,
  BRIDGE_CLOSE_PAIRING_TIMEOUT,
  BRIDGE_CLOSE_REPLACED,
  BRIDGE_CLOSE_VERSION,
} from './protocol';

export type BridgePhase =
  /** Reading the plugin key, or the first socket has not resolved yet. */
  | { phase: 'connecting' }
  /** Nothing listening on the relay port. Retrying with capped backoff. */
  | { phase: 'relay-down' }
  /** Another unknown plugin holds the pairing prompt. Retrying. */
  | { phase: 'busy' }
  /** The relay does not know this key yet; the user approves in a tab. */
  | { phase: 'pairing'; code: string }
  /** Paired and live. `tabs` = browser tabs attached to the relay. */
  | { phase: 'connected'; tabs: number }
  /** Terminal until Retry: the user said no in the browser tab. */
  | { phase: 'denied' }
  /** Terminal until Retry: nobody answered the prompt in time. */
  | { phase: 'timed-out' }
  /** Terminal until Retry: another Figma window ran Bridge and took over. */
  | { phase: 'replaced' }
  /** Terminal: relay and plugin speak different protocol versions. */
  | { phase: 'version'; reason: string };

/** What a socket close means for the next step. */
export type CloseOutcome = 'retry' | 'busy' | 'denied' | 'timed-out' | 'replaced' | 'version';

/**
 * Close code → next step. Only the codes the relay authors for a reason the
 * user can act on stop the retry loop; everything else (relay quit, refused
 * connection, generic policy) is "try again later".
 */
export function closeOutcome(code: number | undefined): CloseOutcome {
  switch (code) {
    case BRIDGE_CLOSE_VERSION:
      return 'version';
    case BRIDGE_CLOSE_PAIRING_DENIED:
      return 'denied';
    case BRIDGE_CLOSE_PAIRING_TIMEOUT:
      return 'timed-out';
    case BRIDGE_CLOSE_REPLACED:
      // Two Figma windows each running Bridge would otherwise replace each
      // other forever, one reconnect per backoff step.
      return 'replaced';
    case BRIDGE_CLOSE_PAIRING_BUSY:
      return 'busy';
    default:
      return 'retry';
  }
}

/** True when the window stops retrying and waits for the user. */
export function isTerminal(state: BridgePhase): boolean {
  return (
    state.phase === 'denied' ||
    state.phase === 'timed-out' ||
    state.phase === 'replaced' ||
    state.phase === 'version'
  );
}

export type BridgeTone = 'pending' | 'ok' | 'warn' | 'error';

export interface BridgeView {
  tone: BridgeTone;
  title: string;
  /** Second line. `code` is rendered monospace. */
  detail?: { text: string; code?: string };
  /** Show the Retry button. */
  retry: boolean;
}

export function tabsLabel(tabs: number): string {
  if (tabs <= 0) return 'No browser tab open yet';
  return tabs === 1 ? '1 browser tab attached' : `${tabs} browser tabs attached`;
}

export function viewFor(state: BridgePhase): BridgeView {
  switch (state.phase) {
    case 'connecting':
      return { tone: 'pending', title: 'Connecting…', retry: false };
    case 'relay-down':
      return {
        tone: 'warn',
        title: 'winden-tokens is not running',
        detail: { text: 'Start it in a terminal:', code: BRIDGE_CLI_COMMAND },
        retry: false,
      };
    case 'busy':
      return {
        tone: 'warn',
        title: 'Another Figma window is waiting for approval',
        detail: { text: 'Answer that one in your browser tab first.' },
        retry: false,
      };
    case 'pairing':
      return {
        tone: 'pending',
        title: 'Approve in your browser tab',
        detail: { text: 'Code', code: state.code },
        retry: false,
      };
    case 'connected':
      return {
        tone: 'ok',
        title: 'Connected',
        detail: { text: tabsLabel(state.tabs) },
        retry: false,
      };
    case 'denied':
      return {
        tone: 'error',
        title: 'Pairing denied',
        detail: { text: 'It was declined in the browser tab.' },
        retry: true,
      };
    case 'timed-out':
      return {
        tone: 'error',
        title: 'Pairing timed out',
        detail: { text: 'Nobody approved it in the browser tab.' },
        retry: true,
      };
    case 'replaced':
      return {
        tone: 'warn',
        title: 'Another Figma window took over',
        detail: { text: 'Only one window can bridge at a time.' },
        retry: true,
      };
    case 'version':
      return {
        tone: 'error',
        title: 'Update winden-tokens',
        detail: { text: 'Run', code: BRIDGE_CLI_UPDATE_COMMAND },
        retry: false,
      };
  }
}
