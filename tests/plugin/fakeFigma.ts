// In-memory stand-in for the Figma plugin API, enough to run the real plugin
// sandbox (src/plugin/code.ts) in vitest. Shared by the plugin suites.
//
// Usage:
//   const fake = installFakeFigma();      // sets globalThis.figma / __uiFiles__
//   ...seed collections, variables, nodes...
//   await loadPlugin();                    // imports code.ts, waits for its first fetch
//   await fake.send({ type: 'update-variable-value', ... });
//
// Behaviour copied from Figma where the plugin depends on it:
// - `remove()` soft-deletes a variable: getVariableByIdAsync still returns it,
//   it is gone from the local lists, and layers bound to it keep its id.
// - Variable names are unique per collection; setValueForMode rejects a mode
//   of another collection, a value of the wrong type, an unknown or removed
//   alias target and an alias cycle.
// - New variables get a default value in every mode; addMode copies the
//   default mode's values.
// - `world.failNext = 'createVariable' | 'setValueForMode' | 'remove'` makes
//   the next such call throw once, to test half-way failures.
// - A remote (library) variable resolves by id but is in no local list.
import { vi } from 'vitest';

type Value = any;
type Alias = { type: 'VARIABLE_ALIAS'; id: string };

const isAlias = (value: Value): value is Alias =>
  !!value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS';

const clone = <T>(value: T): T => (value === null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value)));

function defaultValueFor(type: string): Value {
  switch (type) {
    case 'COLOR': return { r: 0, g: 0, b: 0, a: 1 };
    case 'FLOAT': return 0;
    case 'STRING': return '';
    case 'BOOLEAN': return false;
    default: return null;
  }
}

function valueMatchesType(value: Value, type: string): boolean {
  if (isAlias(value)) return true;
  switch (type) {
    case 'COLOR': return !!value && typeof value === 'object' && typeof value.r === 'number';
    case 'FLOAT': return typeof value === 'number';
    case 'STRING': return typeof value === 'string';
    case 'BOOLEAN': return typeof value === 'boolean';
    default: return true;
  }
}

class PluginDataStore {
  private data = new Map<string, string>();
  getPluginData(key: string): string {
    return this.data.get(key) || '';
  }
  setPluginData(key: string, value: string): void {
    if (value) this.data.set(key, String(value));
    else this.data.delete(key);
  }
  getPluginDataKeys(): string[] {
    return Array.from(this.data.keys());
  }
}

export class FakeVariable extends PluginDataStore {
  readonly id: string;
  readonly key: string;
  readonly resolvedType: string;
  readonly remote: boolean;
  variableCollectionId: string;
  description = '';
  hiddenFromPublishing = false;
  removed = false;
  private _name: string;
  private _scopes: string[] = ['ALL_SCOPES'];
  private _codeSyntax: Record<string, string> = {};
  _values: Record<string, Value> = {};

  constructor(private world: FakeWorld, id: string, name: string, collectionId: string, type: string, remote = false) {
    super();
    this.id = id;
    this.key = `key-${id}`;
    this._name = name;
    this.variableCollectionId = collectionId;
    this.resolvedType = type;
    this.remote = remote;
  }

  private assertAlive(): void {
    if (this.removed) throw new Error(`Variable ${this.id} was removed`);
  }

  get name(): string {
    return this._name;
  }
  set name(next: string) {
    this.assertAlive();
    if (typeof next !== 'string' || !next.trim()) throw new Error('Invalid variable name');
    if (next !== this._name && this.world.nameTaken(this.variableCollectionId, next, this.id)) {
      throw new Error(`Variable name "${next}" already exists in this collection`);
    }
    this._name = next;
  }

  get valuesByMode(): Record<string, Value> {
    return clone(this._values);
  }

  setValueForMode(modeId: string, value: Value): void {
    this.assertAlive();
    this.world.maybeFail('setValueForMode');
    this.world.log.push(`setValueForMode ${this.id} ${modeId}`);
    const collection = this.world.collections.get(this.variableCollectionId);
    if (!collection || !collection._modes.some(mode => mode.modeId === modeId)) {
      throw new Error(`Mode ${modeId} does not belong to the collection of ${this._name}`);
    }
    if (!valueMatchesType(value, this.resolvedType)) {
      throw new Error(`Value does not match type ${this.resolvedType}`);
    }
    if (isAlias(value)) {
      const target = this.world.variables.get(value.id);
      if (!target || target.removed) throw new Error(`Alias target ${value.id} not found`);
      if (this.world.aliasReaches(value.id, this.id)) throw new Error('Alias would create a cycle');
      this._values[modeId] = { type: 'VARIABLE_ALIAS', id: value.id };
    } else {
      this._values[modeId] = clone(value);
    }
  }

  get scopes(): string[] {
    return this._scopes.slice();
  }
  set scopes(next: string[]) {
    this.assertAlive();
    this._scopes = next.slice();
  }

  get codeSyntax(): Record<string, string> {
    return { ...this._codeSyntax };
  }
  setVariableCodeSyntax(platform: string, value: string): void {
    this.assertAlive();
    this._codeSyntax[platform] = value;
  }
  removeVariableCodeSyntax(platform: string): void {
    this.assertAlive();
    delete this._codeSyntax[platform];
  }

  remove(): void {
    this.assertAlive();
    this.world.maybeFail('remove');
    this.removed = true;
    this.world.log.push(`remove ${this.id}`);
    const collection = this.world.collections.get(this.variableCollectionId);
    if (collection) collection._variableIds = collection._variableIds.filter(id => id !== this.id);
  }
}

export class FakeCollection extends PluginDataStore {
  readonly id: string;
  readonly key: string;
  readonly remote = false;
  readonly isExtension = false;
  name: string;
  hiddenFromPublishing = false;
  removed = false;
  _modes: Array<{ modeId: string; name: string }> = [];
  _variableIds: string[] = [];

  constructor(private world: FakeWorld, id: string, name: string) {
    super();
    this.id = id;
    this.key = `key-${id}`;
    this.name = name;
    this._modes.push({ modeId: world.nextModeId(), name: 'Mode 1' });
  }

  get modes(): Array<{ modeId: string; name: string }> {
    return this._modes.map(mode => ({ ...mode }));
  }
  get defaultModeId(): string {
    return this._modes[0].modeId;
  }
  get variableIds(): string[] {
    return this._variableIds.slice();
  }

  addMode(name: string): string {
    const modeId = this.world.nextModeId();
    this._modes.push({ modeId, name });
    for (const id of this._variableIds) {
      const variable = this.world.variables.get(id)!;
      variable._values[modeId] = clone(variable._values[this.defaultModeId]);
    }
    return modeId;
  }
  renameMode(modeId: string, name: string): void {
    const mode = this._modes.find(candidate => candidate.modeId === modeId);
    if (!mode) throw new Error(`Mode ${modeId} not found`);
    mode.name = name;
  }
  removeMode(modeId: string): void {
    if (this._modes.length <= 1) throw new Error('Cannot remove the last mode');
    this._modes = this._modes.filter(mode => mode.modeId !== modeId);
    for (const id of this._variableIds) {
      delete this.world.variables.get(id)!._values[modeId];
    }
  }
  remove(): void {
    this.removed = true;
    this.world.log.push(`remove ${this.id}`);
    for (const id of this._variableIds.slice()) this.world.variables.get(id)!.remove();
    this.world.collections.delete(this.id);
  }
}

// A scene node with the binding surface the plugin touches: paints (fills,
// strokes) with `boundVariables.color`, effects, and scalar fields.
export class FakeNode extends PluginDataStore {
  readonly id: string;
  readonly type: string;
  name: string;
  parent: FakeNode | FakePage | null = null;
  children: FakeNode[] = [];
  fills: any[] = [];
  strokes: any[] = [];
  effects: any[] = [];
  private _fieldBindings: Record<string, Alias> = {};

  constructor(id: string, type: string, name: string) {
    super();
    this.id = id;
    this.type = type;
    this.name = name;
  }

  get boundVariables(): Record<string, Alias | Alias[]> {
    const result: Record<string, Alias | Alias[]> = { ...this._fieldBindings };
    for (const key of ['fills', 'strokes', 'effects'] as const) {
      const list = (this as any)[key] as any[];
      if (list.some(item => item && item.boundVariables && item.boundVariables.color)) {
        result[key] = list.map(item => item && item.boundVariables ? item.boundVariables.color : undefined);
      }
    }
    return result;
  }

  setBoundVariable(field: string, variable: FakeVariable | null): void {
    if (variable) this._fieldBindings[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
    else delete this._fieldBindings[field];
  }

  appendChild(child: FakeNode): void {
    child.parent = this;
    this.children.push(child);
  }
}

export class FakePage extends PluginDataStore {
  readonly type = 'PAGE';
  selection: FakeNode[] = [];
  private _children: FakeNode[] = [];
  private listeners = new Map<string, Set<Function>>();

  constructor(private world: FakeWorld, readonly id: string, public name: string) {
    super();
  }

  // Under dynamic-page access only the current page is readable until
  // loadAllPagesAsync ran.
  get children(): FakeNode[] {
    if (!this.world.allPagesLoaded && this.world.currentPage !== this) {
      throw new Error(`Page ${this.name} is not loaded; call figma.loadAllPagesAsync() first`);
    }
    return this._children;
  }

  appendChild(child: FakeNode): void {
    child.parent = this;
    this._children.push(child);
  }

  setRelaunchData(): void {}
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }
  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }
}

export class FakeWorld {
  collections = new Map<string, FakeCollection>();
  variables = new Map<string, FakeVariable>();
  nodes = new Map<string, FakeNode>();
  pages: FakePage[] = [];
  currentPage: FakePage;
  allPagesLoaded = false;
  loadAllPagesCalls = 0;
  log: string[] = [];
  failNext: string | null = null;
  private counter = 0;

  // Throws once when `failNext` names this operation.
  maybeFail(op: string): void {
    if (this.failNext === op) {
      this.failNext = null;
      throw new Error(`Injected failure in ${op}`);
    }
  }

  constructor() {
    this.currentPage = this.addPage('Page 1');
  }

  next(): number {
    this.counter += 1;
    return this.counter;
  }
  nextModeId(): string {
    return `${this.next()}:0`;
  }

  addPage(name: string): FakePage {
    const page = new FakePage(this, `0:${this.next()}`, name);
    this.pages.push(page);
    return page;
  }

  nameTaken(collectionId: string, name: string, exceptId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;
    return collection._variableIds.some(id => id !== exceptId && this.variables.get(id)!.name === name);
  }

  aliasReaches(fromId: string, targetId: string, seen = new Set<string>()): boolean {
    if (fromId === targetId) return true;
    if (seen.has(fromId)) return false;
    seen.add(fromId);
    const variable = this.variables.get(fromId);
    if (!variable) return false;
    return Object.values(variable._values).some(value => isAlias(value) && this.aliasReaches(value.id, targetId, seen));
  }

  createCollection(name: string): FakeCollection {
    const collection = new FakeCollection(this, `VariableCollectionId:${this.next()}:0`, name);
    this.collections.set(collection.id, collection);
    return collection;
  }

  createVariable(name: string, collection: FakeCollection | string, type: string): FakeVariable {
    const target = typeof collection === 'string' ? this.collections.get(collection) : this.collections.get(collection.id);
    if (!target || target.removed) throw new Error('Collection not found');
    this.maybeFail('createVariable');
    if (this.nameTaken(target.id, name, '')) throw new Error(`Variable name "${name}" already exists in this collection`);
    const variable = new FakeVariable(this, `VariableID:${this.next()}:0`, name, target.id, type);
    for (const mode of target._modes) variable._values[mode.modeId] = defaultValueFor(type);
    this.variables.set(variable.id, variable);
    target._variableIds.push(variable.id);
    this.log.push(`createVariable ${variable.id} ${name}`);
    return variable;
  }

  // A library variable: resolvable by id, absent from the local lists.
  addRemoteVariable(name: string, type: string, value: Value): FakeVariable {
    const variable = new FakeVariable(this, `VariableID:lib${this.next()}/1:1`, name, 'VariableCollectionId:lib', type, true);
    variable._values['lib:0'] = clone(value);
    this.variables.set(variable.id, variable);
    return variable;
  }

  // The library went away: the id no longer resolves.
  dropVariable(id: string): void {
    this.variables.delete(id);
  }

  addNode(type: string, name: string, page: FakePage = this.currentPage): FakeNode {
    const node = new FakeNode(`${this.next()}:1`, type, name);
    page.appendChild(node);
    this.nodes.set(node.id, node);
    return node;
  }

  localCollections(): FakeCollection[] {
    return Array.from(this.collections.values()).filter(collection => !collection.removed);
  }
  localVariables(): FakeVariable[] {
    return Array.from(this.variables.values()).filter(variable => !variable.remote && !variable.removed);
  }
}

export interface FakeFigma {
  world: FakeWorld;
  figma: any;
  messages: any[];
  // Sends a UI message to the plugin and waits for it to settle.
  send(msg: any): Promise<void>;
  // Messages of one type posted since the last `clearMessages()`.
  messagesOfType(type: string): any[];
  lastData(): any;
  clearMessages(): void;
}

let current: FakeFigma | null = null;

export async function flushPlugin(): Promise<void> {
  // Every fake API resolves without timers, so a few macrotask turns let
  // the plugin's promise chains finish.
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

export function installFakeFigma(options: { command?: string } = {}): FakeFigma {
  const world = new FakeWorld();
  const messages: any[] = [];
  const rootData = new PluginDataStore();
  const listeners = new Map<string, Set<Function>>();
  const clientStorage = new Map<string, any>();

  const ui = {
    onmessage: null as null | ((msg: any) => Promise<void> | void),
    postMessage: (msg: any) => {
      messages.push(clone(msg));
    },
    resize: () => {},
  };

  const figma: any = {
    command: options.command ?? 'open',
    showUI: () => {},
    ui,
    root: {
      type: 'DOCUMENT',
      get children() {
        return world.pages;
      },
      getPluginData: (key: string) => rootData.getPluginData(key),
      setPluginData: (key: string, value: string) => rootData.setPluginData(key, value),
      getPluginDataKeys: () => rootData.getPluginDataKeys(),
      setRelaunchData: () => {},
    },
    get currentPage() {
      return world.currentPage;
    },
    on: (event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    off: (event: string, handler: Function) => {
      listeners.get(event)?.delete(handler);
    },
    loadAllPagesAsync: async () => {
      world.loadAllPagesCalls += 1;
      world.allPagesLoaded = true;
    },
    getNodeByIdAsync: async (id: string) => world.nodes.get(id) || null,
    clientStorage: {
      getAsync: async (key: string) => clone(clientStorage.get(key)),
      setAsync: async (key: string, value: any) => {
        clientStorage.set(key, clone(value));
      },
    },
    openExternal: () => {},
    closePlugin: () => {},
    saveVersionHistoryAsync: async () => ({ id: 'version-1' }),
    variables: {
      getLocalVariableCollectionsAsync: async () => world.localCollections(),
      getLocalVariablesAsync: async () => world.localVariables(),
      getVariableByIdAsync: async (id: string) => world.variables.get(id) || null,
      getVariableCollectionByIdAsync: async (id: string) => {
        const collection = world.collections.get(id);
        return collection && !collection.removed ? collection : null;
      },
      createVariableCollection: (name: string) => world.createCollection(name),
      createVariable: (name: string, collection: FakeCollection | string, type: string) =>
        world.createVariable(name, collection, type),
      setBoundVariableForPaint: (paint: any, field: string, variable: FakeVariable | null) => {
        const next = clone(paint);
        next.boundVariables = { ...(next.boundVariables || {}) };
        if (variable) next.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
        else delete next.boundVariables[field];
        return next;
      },
      setBoundVariableForEffect: (effect: any, field: string, variable: FakeVariable | null) => {
        const next = clone(effect);
        next.boundVariables = { ...(next.boundVariables || {}) };
        if (variable) next.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
        else delete next.boundVariables[field];
        return next;
      },
    },
  };

  (globalThis as any).figma = figma;
  (globalThis as any).__uiFiles__ = { open: '<html></html>', bridge: '<html></html>' };

  const fake: FakeFigma = {
    world,
    figma,
    messages,
    async send(msg: any) {
      if (!ui.onmessage) throw new Error('Plugin not loaded; call loadPlugin() first');
      await ui.onmessage(msg);
      await flushPlugin();
    },
    messagesOfType: (type: string) => messages.filter(message => message.type === type),
    lastData: () => {
      const data = messages.filter(message => message.type === 'data-loaded');
      return data[data.length - 1];
    },
    clearMessages: () => {
      messages.length = 0;
    },
  };
  current = fake;
  return fake;
}

// Imports the real plugin sandbox for its side effects. The 5 s change poll
// is parked (fake setInterval) so it never fires mid-test.
export async function loadPlugin(): Promise<FakeFigma> {
  if (!current) throw new Error('installFakeFigma() first');
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.resetModules();
  // @ts-ignore code.ts is a script (no exports), imported for its side effects.
  await import('../../src/plugin/code.ts');
  await flushPlugin();
  return current;
}

export function uninstallFakeFigma(): void {
  vi.useRealTimers();
  delete (globalThis as any).figma;
  delete (globalThis as any).__uiFiles__;
  current = null;
}

// A solid paint bound to `variable`, as Figma stores it.
export function boundPaint(variable: FakeVariable): any {
  return {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0 },
    boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable.id } },
  };
}

export const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
};
