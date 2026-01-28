// Hook for handling plugin messages

import { useEffect, useCallback } from 'react';

type MessageHandler = (data: any) => void;
type MessageHandlers = Record<string, MessageHandler>;

export function usePluginMessages(handlers: MessageHandlers) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      const handler = handlers[msg.type];
      if (handler) {
        handler(msg);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handlers]);
}

// Helper to send messages to the plugin
export function post(msg: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}
