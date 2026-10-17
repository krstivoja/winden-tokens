// Entry for dist/bridge.html, the "Bridge to browser" window. No React: this
// window only relays messages and shows one status line.

import { PluginBridge, sandboxMessageFrom } from './client';
import { requestPluginKey } from './key';
import { BRIDGE_URL } from './protocol';
import { viewFor, type BridgePhase } from './state';

function postToSandbox(message: Record<string, unknown>): void {
  window.parent.postMessage({ pluginMessage: message }, '*');
}

function onSandboxMessage(handler: (message: Record<string, unknown>) => void): () => void {
  const listener = (event: MessageEvent) => {
    const message = sandboxMessageFrom(event.data);
    if (message) handler(message);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

function el<K extends keyof HTMLElementTagNameMap>(id: string): HTMLElementTagNameMap[K] {
  const node = document.getElementById(id);
  if (!node) throw new Error(`bridge.html is missing #${id}`);
  return node as HTMLElementTagNameMap[K];
}

const root = el<'div'>('bridge');
const title = el<'p'>('bridge-title');
const detail = el<'p'>('bridge-detail');
const detailText = el<'span'>('bridge-detail-text');
const detailCode = el<'code'>('bridge-detail-code');
const retry = el<'button'>('bridge-retry');

function render(state: BridgePhase): void {
  const view = viewFor(state);
  root.dataset.tone = view.tone;
  title.textContent = view.title;
  detail.hidden = !view.detail;
  detailText.textContent = view.detail?.text ?? '';
  detailCode.textContent = view.detail?.code ?? '';
  detailCode.hidden = !view.detail?.code;
  retry.hidden = !view.retry;
}

const bridge = new PluginBridge({
  url: BRIDGE_URL,
  createSocket: (url) => new WebSocket(url),
  postToSandbox,
  onSandboxMessage,
});

bridge.onState(render);
render(bridge.getState());
retry.addEventListener('click', () => bridge.retry());

void requestPluginKey({ post: postToSandbox, listen: onSandboxMessage }).then((key) => bridge.start(key));
