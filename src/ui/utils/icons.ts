// Type icons (Figma native style)

import { VariableType } from '../types';

const icons: Record<VariableType, string> = {
  COLOR: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path></svg>',
  FLOAT: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm3.05 2.002a.5.5 0 0 1 .448.547l-.045.452h1.495l.055-.55a.5.5 0 0 1 .995.098l-.045.452h.547a.5.5 0 1 1 0 1h-.648l-.199 2h.847a.5.5 0 1 1 0 1h-.948l-.054.548a.501.501 0 0 1-.995-.098l.044-.45h-1.495l-.054.548a.501.501 0 0 1-.995-.098l.044-.45H9.5a.5.5 0 0 1 0-1h.647l.2-2H9.5a.5.5 0 0 1 0-1h.948l.055-.55a.5.5 0 0 1 .546-.449m.302 1.999-.199 2h1.494l.2-2z"></path></svg>',
  STRING: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3.5 1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0V10h1.5v4H11a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-.5v-4H14v.5a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5z" clip-rule="evenodd"></path></svg>',
  BOOLEAN: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10 8h4a4 4 0 0 1 0 8h-4a4 4 0 0 1 0-8m-5 4a5 5 0 0 1 5-5h4a5 5 0 0 1 0 10h-4a5 5 0 0 1-5-5m5 2a2 2 0 1 1 0-4 2 2 0 0 1 0 4m-3-2a3 3 0 1 1 6 0 3 3 0 0 1-6 0" clip-rule="evenodd"></path></svg>'
};

export function getTypeIcon(type: VariableType): string {
  return icons[type] || String(type);
}
