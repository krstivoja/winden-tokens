// Hook for handling plugin messages

import { useEffect } from 'react';
import {
  BRIDGE_EVENT_TAG,
  isBridgeClient,
  isInsideFigma,
  isSuppressedFromBrowser,
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
  // Inside Figma, or a bundle without the bridge client (a production build
  // opened directly in a browser): the one and only pre-bridge transport.
  if (isInsideFigma() || !isBridgeClient()) {
    parent.postMessage({ pluginMessage: msg }, '*');
    return;
  }

  // Browser tab: `parent.postMessage` goes nowhere, the relay is the transport.
  //
  // A tab may drive the DOCUMENT and must not drive the PLUGIN WINDOW, and it
  // must not repeat what the bridge handshake already sends on its behalf.
  // `BROWSER_SUPPRESSED_MESSAGES` in useBridge.ts states the rule and lists
  // what it covers. Dropped before the queue, so a message held while the relay
  // is down cannot be delivered later either.
  if (isSuppressedFromBrowser(msg.type)) return;

  sendOverBridge(msg);
}
