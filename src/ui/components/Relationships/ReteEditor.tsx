// Rete.js based node editor for color relationships

import React, { useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { NodeEditor, GetSchemes, ClassicPreset } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets, ReactArea2D } from 'rete-react-plugin';
import { VariableData } from '../../types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { post } from '../../hooks/usePluginMessages';

// Define socket for color connections
class ColorSocket extends ClassicPreset.Socket {
  constructor() {
    super('Color');
  }
}

const colorSocket = new ColorSocket();

// Custom node for color variables
class ColorNode extends ClassicPreset.Node {
  width = 180;
  height = 80;

  constructor(
    public variableId: string,
    public variableName: string,
    public displayName: string,
    public color: string,
    public isReference: boolean,
    public referenceName: string | null
  ) {
    super(displayName);

    // Add input and output sockets
    this.addInput('input', new ClassicPreset.Input(colorSocket, 'In'));
    this.addOutput('output', new ClassicPreset.Output(colorSocket, 'Out'));
  }
}

// Connection class
class ColorConnection extends ClassicPreset.Connection<ColorNode, ColorNode> {}

// Type schemes
type Schemes = GetSchemes<ColorNode, ColorConnection>;
type AreaExtra = ReactArea2D<Schemes>;

// Custom styled socket component
function StyledSocket(props: { data: ClassicPreset.Socket }) {
  return (
    <div
      className="rete-socket"
      title={props.data.name}
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#7c93c3',
        border: '2px solid #5a73a3',
        cursor: 'crosshair',
      }}
    />
  );
}

// Custom node component with sockets
function StyledNode(props: { data: ColorNode; emit: (data: any) => void }) {
  const { data } = props;
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);

  return (
    <div
      className="rete-node"
      style={{
        background: '#8b9dc3',
        borderRadius: '10px',
        border: '2px solid #6b7db3',
        padding: '12px',
        minWidth: '160px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* Title */}
      <div
        style={{
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: data.color,
            border: '2px solid rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}
        />
        {data.displayName}
      </div>

      {/* Reference info */}
      {data.isReference && (
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '8px',
          }}
        >
          → {data.referenceName}
        </div>
      )}

      {/* Sockets row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {inputs.map(([key, input]) =>
            input ? (
              <div
                key={key}
                className="input-socket"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Presets.classic.Socket data={input.socket!} />
                <span style={{ color: 'white', fontSize: '11px' }}>
                  {input.label || 'In'}
                </span>
              </div>
            ) : null
          )}
        </div>

        {/* Outputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          {outputs.map(([key, output]) =>
            output ? (
              <div
                key={key}
                className="output-socket"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ color: 'white', fontSize: '11px' }}>
                  {output.label || 'Out'}
                </span>
                <Presets.classic.Socket data={output.socket!} />
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

interface ReteEditorProps {
  variables: VariableData[];
  selectedCollectionId: string | null;
}

export function ReteEditor({ variables, selectedCollectionId }: ReteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<NodeEditor<Schemes> | null>(null);
  const areaRef = useRef<AreaPlugin<Schemes, AreaExtra> | null>(null);
  const destroyedRef = useRef(false);

  const createEditor = useCallback(async () => {
    if (!containerRef.current || destroyedRef.current) return;

    const container = containerRef.current;

    // Create editor
    const editor = new NodeEditor<Schemes>();
    editorRef.current = editor;

    // Area plugin for rendering
    const area = new AreaPlugin<Schemes, AreaExtra>(container);
    areaRef.current = area;

    // Connection plugin
    const connection = new ConnectionPlugin<Schemes, AreaExtra>();
    connection.addPreset(ConnectionPresets.classic.setup());

    // React plugin for rendering nodes
    const reactPlugin = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

    // Use classic preset with custom node
    reactPlugin.addPreset(
      Presets.classic.setup({
        customize: {
          node() {
            return StyledNode as any;
          },
          socket() {
            return StyledSocket as any;
          },
        },
      })
    );

    // Register plugins
    editor.use(area);
    area.use(connection);
    area.use(reactPlugin);

    // Enable selecting nodes
    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
      accumulating: AreaExtensions.accumulateOnCtrl(),
    });

    // Filter color variables
    const colorVars = variables.filter(
      v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'
    );

    const refPattern = /^\{(.+)\}$/;

    // Create nodes in a grid layout (not grouped)
    const nodeMap = new Map<string, ColorNode>();
    const COLS = Math.ceil(Math.sqrt(colorVars.length)); // Square-ish grid
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 120;

    for (let i = 0; i < colorVars.length; i++) {
      const v = colorVars[i];
      const parts = v.name.split('/');
      const displayName = parts[parts.length - 1];

      const refMatch = v.value.match(refPattern);
      const isReference = !!refMatch;
      const referenceName = refMatch ? refMatch[1] : null;

      let displayColor = v.value;
      if (isReference && referenceName) {
        const refVar = colorVars.find(cv => cv.name === referenceName);
        if (refVar) displayColor = refVar.value;
      }

      const rgb = parseColorToRgb(displayColor);
      const hexColor = rgb ? rgbObjToHex(rgb) : '#888888';

      const node = new ColorNode(
        v.id,
        v.name,
        displayName,
        hexColor,
        isReference,
        referenceName
      );

      await editor.addNode(node);

      // Grid position
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      await area.translate(node.id, { x: 50 + col * NODE_WIDTH, y: 50 + row * NODE_HEIGHT });

      nodeMap.set(v.name, node);
    }

    // Create connections for references
    for (const [name, node] of nodeMap) {
      if (node.isReference && node.referenceName) {
        const targetNode = nodeMap.get(node.referenceName);
        if (targetNode) {
          const conn = new ColorConnection(node, 'output', targetNode, 'input');
          await editor.addConnection(conn);
        }
      }
    }

    // Handle new connections
    editor.addPipe(context => {
      if (context.type === 'connectioncreated') {
        const { data } = context;
        const sourceNode = editor.getNode(data.source);
        const targetNode = editor.getNode(data.target);

        if (sourceNode && targetNode && sourceNode instanceof ColorNode && targetNode instanceof ColorNode) {
          // Create reference: source variable references target variable
          const newValue = `{${targetNode.variableName}}`;
          post({ type: 'update-variable-value', id: sourceNode.variableId, value: newValue });
        }
      }
      return context;
    });

    // Handle connection removal
    editor.addPipe(context => {
      if (context.type === 'connectionremoved') {
        const { data } = context;
        const sourceNode = editor.getNode(data.source);
        const targetNode = editor.getNode(data.target);

        if (sourceNode && targetNode && sourceNode instanceof ColorNode && targetNode instanceof ColorNode) {
          // Remove reference - set to the resolved color
          post({ type: 'update-variable-value', id: sourceNode.variableId, value: targetNode.color });
        }
      }
      return context;
    });

    // Zoom to fit
    setTimeout(() => {
      if (!destroyedRef.current) {
        AreaExtensions.zoomAt(area, editor.getNodes());
      }
    }, 100);

  }, [variables, selectedCollectionId]);

  useEffect(() => {
    destroyedRef.current = false;
    createEditor();

    return () => {
      destroyedRef.current = true;
      if (areaRef.current) {
        areaRef.current.destroy();
        areaRef.current = null;
      }
      if (editorRef.current) {
        editorRef.current = null;
      }
    };
  }, [createEditor]);

  return (
    <div
      ref={containerRef}
      className="rete-container"
      style={{
        width: '100%',
        height: '100%',
        background: '#f0f0f0',
      }}
    />
  );
}
