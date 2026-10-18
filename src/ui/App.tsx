// Main App component

import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { usePluginMessages, post } from './hooks/usePluginMessages';
import { useBridge, answerBridgePairing, isInsideFigma, BRIDGE_CLIENT_ENABLED } from './hooks/useBridge';
import { BRIDGE_CLI_COMMAND } from './bridge/protocol';
import { TextButton } from './components/common/Button';
import { Icon } from './components/icons/Icon';
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

// The bridge banners share one look: a single row under the top edge.
const BRIDGE_BANNER_CLASS =
  'flex shrink-0 items-center justify-center gap-2 border-b border-border bg-base-2 px-4 py-2 text-center';
// The bridge is down or has no document: nothing in this tab works until it's
// fixed, so it reads as an alert, not a status line.
const BRIDGE_ALERT_CLASS =
  'flex shrink-0 items-center justify-center gap-2 bg-alert px-4 py-2 text-center text-on-alert';

// Where a user finds the Figma half of the bridge.
const BRIDGE_MENU_HINT =
  'run "Bridge to browser" from its menu (Plugins → Winden Tokens → Bridge to browser)';

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

  // Browser tab only: the relay connection behind this tab. Inside Figma, and
  // in any bundle built without the bridge client, this is a constant
  // disabled status and every banner below folds away.
  const bridgeStatus = useBridge();
  const showBridgeBanners = BRIDGE_CLIENT_ENABLED && bridgeStatus.enabled;

  // A bridge protocol mismatch, in the relay's own words. Shown in preference
  // to the generic "not connected" copy below, because "update the older half"
  // is the actual instruction.
  const bridgeError = showBridgeBanners ? bridgeStatus.error : null;

  // An unknown Figma plugin window wants to drive this file. Only a browser
  // tab can let it in — a hostile web page cannot be a client — so the prompt
  // lives here, with the code the Figma window shows for comparison.
  const pairingCode = showBridgeBanners ? bridgeStatus.pairingCode : null;

  // The browser tab is a remote control with no document of its own: with no
  // plugin window on the other end it renders a perfectly normal, perfectly
  // empty app, which reads as "selection is broken" rather than "nothing is
  // connected". Say so, persistently, until the plugin attaches — the relay's
  // status frames clear this the moment it does.
  const isDetachedClient =
    showBridgeBanners &&
    bridgeStatus.probed &&
    !bridgeStatus.peerAttached;

  const approvePairing = useCallback(() => answerBridgePairing(true), []);
  const denyPairing = useCallback(() => answerBridgePairing(false), []);

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

  return (
    <>
      {bridgeError ? (
        <div role="status" className={BRIDGE_ALERT_CLASS}>
          <span className="shrink-0 leading-0" aria-hidden="true"><Icon name="warning" size={14} /></span>
          <span className="text-xs">{bridgeError}</span>
        </div>
      ) : pairingCode ? (
        <div
          role="alert"
          className={`${BRIDGE_BANNER_CLASS} flex-wrap border-b-primary`}
        >
          {/* Dot and copy wrap as one unit, so the dot never sits alone on a row. */}
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs text-text">
              A Figma plugin window wants to connect. Code:{' '}
              <strong className="font-mono font-semibold tracking-wider">{pairingCode}</strong>
              {' '}— check it matches the code in the Figma "Bridge to browser" window.
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <TextButton
              variant="primary"
              size="sm"
              className="px-2 py-1 text-xs"
              onClick={approvePairing}
            >
              Approve
            </TextButton>
            <TextButton
              variant="outline"
              size="sm"
              className="px-2 py-1 text-xs"
              onClick={denyPairing}
            >
              Deny
            </TextButton>
          </span>
        </div>
      ) : isDetachedClient ? (
        <div role="status" className={BRIDGE_ALERT_CLASS}>
          <span className="shrink-0 leading-0" aria-hidden="true"><Icon name="warning" size={14} /></span>
          <span className="text-xs">
            {bridgeStatus.connected
              ? `No plugin connected. Open the Winden Tokens plugin in Figma and ${BRIDGE_MENU_HINT} — this tab has no data of its own.`
              : `Bridge relay not reachable. Run ${BRIDGE_CLI_COMMAND} (or npm run dev:bridge), then open the Winden Tokens plugin in Figma and ${BRIDGE_MENU_HINT}.`}
          </span>
        </div>
      ) : null}

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
