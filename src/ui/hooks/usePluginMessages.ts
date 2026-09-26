// Hook for handling plugin messages

import { useEffect } from 'react';
import {
  BRIDGE_ENABLED,
  BRIDGE_EVENT_TAG,
  isInsideFigma,
  sendOverBridge,
  startBridge,
  subscribeToBridgeMessages,
} from './useBridge';

type MessageHandler = (data: any) => void;
type MessageHandlers = Record<string, MessageHandler>;

export function usePluginMessages(handlers: MessageHandlers) {
  useEffect(() => {
    const dispatch = (msg: any) => {
      if (!msg) return;

      const handler = handlers[msg.type];
      if (handler) {
        handler(msg);
      }
    };

    const onMessage = (event: MessageEvent) => {
      // Frames the bridge re-emitted were already dispatched below.
      if (event.data?.[BRIDGE_EVENT_TAG]) return;
      dispatch(event.data?.pluginMessage);
    };

    window.addEventListener('message', onMessage);
    const unsubscribeFromBridge = subscribeToBridgeMessages(dispatch);
    startBridge();

    return () => {
      window.removeEventListener('message', onMessage);
      unsubscribeFromBridge();
    };
  }, [handlers]);
}

// Helper to send messages to the plugin
export function post(msg: Record<string, unknown>): void {
  if (isInsideFigma()) {
    // Unchanged path: this is the only transport the shipped plugin uses.
    parent.postMessage({ pluginMessage: msg }, '*');
    // Mirrored so an attached browser tab sees what the plugin UI did.
    // No-op when no relay is connected.
    sendOverBridge(msg);
    return;
  }

  // Browser tab: `parent.postMessage` goes nowhere, the relay is the transport.
  if (sendOverBridge(msg)) return;

  // Bridge compiled out (a production bundle opened directly in a browser):
  // keep the exact pre-bridge behaviour.
  if (!BRIDGE_ENABLED) {
    parent.postMessage({ pluginMessage: msg }, '*');
  }
}
