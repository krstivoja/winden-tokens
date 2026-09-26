// Main App component

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from './context/AppContext';
import { usePluginMessages, post } from './hooks/usePluginMessages';
import { useBridge, releaseBridgePeer, isInsideFigma, BRIDGE_ENABLED } from './hooks/useBridge';
import { TextButton } from './components/common/Button';
import { TabBar, type TabId } from './components/Tabs/TabBar';
import { TabContent } from './components/Tabs/TabContent';
import { ShadesModal } from './components/Modals/ShadesModal';
import { StepsModal } from './components/Modals/StepsModal';
import { InputModal } from './components/Modals/InputModal';
import { AddVariableModal } from './components/Modals/AddVariableModal';
import { ColorPickerModal } from './components/Modals/ColorPickerModal';
import { ColorReferenceModal } from './components/Modals/ColorReferenceModal';
import { BulkEditModal } from './components/Modals/BulkEditModal';
import { ResizeHandles } from './components/ResizeHandles';

export type ActiveTab = TabId;

// Headless is a status line, not a screen: one row, no scroll, no resize grips.
const HEADLESS_WINDOW = { width: 320, height: 52 };

export function App() {
  const { setData, setSelection } = useAppContext();
  // The browser tab exists to give the Relationships graph room, so it opens
  // straight into it and hides the tab bar. The plugin keeps every tab.
  const isBrowserClient = !isInsideFigma();
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    isBrowserClient ? 'relationships' : 'table'
  );
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: '', type: '' });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const showStatus = useCallback((message: string, type: string) => {
    setStatus({ message, type });
    if (type === 'success') {
      setTimeout(() => setStatus({ message: '', type: '' }), 2000);
    }
  }, []);

  // Handle plugin messages
  const messageHandlers = useCallback(() => ({
    'data-loaded': (msg: any) => {
      setData(msg.collections || [], msg.variables || [], msg.shadeGroups || []);
      setStatus({ message: '', type: '' }); // Clear any warning status after refresh
    },
    'update-success': () => {
      showStatus('Saved', 'success');
    },
    'update-error': (msg: any) => {
      showStatus('Error: ' + msg.error, 'warning');
    },
    'history-state': (msg: any) => {
      setHistoryState({
        canUndo: !!msg.canUndo,
        canRedo: !!msg.canRedo,
      });
    },
    'history-applied': (msg: any) => {
      showStatus(msg.direction === 'redo' ? 'Redid' : 'Undid', 'success');
    },
    'history-error': (msg: any) => {
      showStatus(msg.error, 'warning');
    },
    'selection-changed': (msg: any) => {
      setSelection(msg.node || null, !!msg.multiple);
    },
  }), [setData, setSelection, showStatus]);

  usePluginMessages(messageHandlers());

  // Dev bridge: while a browser tab is driving this file, the plugin window
  // stays open (only it can reach the Figma API) but stops rendering the app,
  // so the graph is not paid for twice.
  const bridgeStatus = useBridge();
  const isHeadless = bridgeStatus.role === 'plugin' && bridgeStatus.connected && bridgeStatus.peerAttached;

  // The browser tab is a remote control with no document of its own: with no
  // plugin window on the other end it renders a perfectly normal, perfectly
  // empty app, which reads as "selection is broken" rather than "nothing is
  // connected". Say so, persistently, until the plugin attaches — the relay's
  // status frames clear this the moment it does.
  // `BRIDGE_ENABLED` first so a production build folds the whole banner away
  // rather than shipping dead dev-only markup.
  const isDetachedClient =
    BRIDGE_ENABLED &&
    bridgeStatus.role === 'client' &&
    bridgeStatus.probed &&
    !bridgeStatus.peerAttached;

  // Nothing is rendered in headless mode, so the window must not keep the
  // size the full UI needed — shrink it to the strip and hand the old size
  // back when the browser tab lets go.
  const restoreWindowRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!BRIDGE_ENABLED || isBrowserClient) {
      return;
    }

    if (isHeadless) {
      if (!restoreWindowRef.current) {
        restoreWindowRef.current = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      }
      post({ type: 'resize', ...HEADLESS_WINDOW });
      return;
    }

    const previous = restoreWindowRef.current;
    if (previous) {
      restoreWindowRef.current = null;
      post({ type: 'resize', ...previous });
    }
  }, [isHeadless, isBrowserClient]);

  useEffect(() => {
    post({ type: 'ui-ready' });
    post({ type: 'get-history-state' });
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const wantsUndo = key === 'z' && !event.shiftKey;

      if (wantsUndo && historyState.canUndo) {
        event.preventDefault();
        post({ type: 'undo' });
      } else if (wantsRedo && historyState.canRedo) {
        event.preventDefault();
        post({ type: 'redo' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyState.canRedo, historyState.canUndo]);

  if (isHeadless) {
    return (
      <div
        className="flex h-full items-center gap-2 bg-base px-3"
        title="Keep this window open — it is the only thing that can talk to Figma."
      >
        <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
        <span className="truncate text-xs text-text">Browser has the wheel</span>
        <TextButton
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 px-2 py-1 text-xs"
          onClick={releaseBridgePeer}
        >
          Take over
        </TextButton>
      </div>
    );
  }

  return (
    <>
      {isDetachedClient && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-base-2 px-4 py-2 text-center"
        >
          <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
          <span className="text-xs text-text">
            {bridgeStatus.connected
              ? 'No plugin connected. Open the Winden Tokens plugin in Figma — this tab has no data of its own.'
              : 'Bridge relay not reachable. Run npm run dev:bridge, then open the Winden Tokens plugin in Figma.'}
          </span>
        </div>
      )}

      {!isBrowserClient && (
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          canUndo={historyState.canUndo}
          canRedo={historyState.canRedo}
        />
      )}

      <TabContent
        activeTab={activeTab}
        status={status}
      />

      {/* Modals */}
      <ShadesModal />
      <StepsModal />
      <InputModal />
      <AddVariableModal />
      <ColorPickerModal />
      <ColorReferenceModal />
      <BulkEditModal />

      {/* Resize Handles */}
      <ResizeHandles />
    </>
  );
}
