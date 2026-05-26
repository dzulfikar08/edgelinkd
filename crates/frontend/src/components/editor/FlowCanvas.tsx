import { useCallback, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useStoreApi,
} from "@xyflow/react";
import { useFlowStore } from "../../store/flow-store";
import { useEditorStore } from "../../store/editor-store";
import { useBreakpoint, useTouchGestures } from "../../hooks";
import { GenericNode } from "./GenericNode";

const nodeTypes = {
  generic: GenericNode,
};

const VIEWPORT_KEY = "rustred-viewport";

function loadViewport() {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveViewport(vp: { x: number; y: number; zoom: number }) {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(vp));
  } catch {}
}

export function FlowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, addNode } = useFlowStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const { isMobile } = useBreakpoint();
  const store = useStoreApi();

  const onConnect = useCallback(
    (connection: Connection) => {
      useFlowStore.setState((state) => ({
        edges: addEdge(connection, state.edges) as Edge[],
      }));
    },
    [],
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    const saved = loadViewport();
    if (saved) {
      instance.setViewport(saved);
    }
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;

      const paletteNode = JSON.parse(raw) as {
        type: string;
        label: string;
        color: string;
      };

      if (!reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${paletteNode.type}-${Date.now()}`,
        type: "generic",
        position,
        data: {
          label: paletteNode.label,
          nodeType: paletteNode.type,
          color: paletteNode.color,
        },
      };

      addNode(newNode);
    },
    [addNode],
  );

  const onMoveEnd = useCallback(() => {
    if (reactFlowInstance.current) {
      saveViewport(reactFlowInstance.current.getViewport());
    }
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      useEditorStore.getState().selectNode(node.id);
    },
    [],
  );

  const handleDoubleTap = useCallback(
    (position: { x: number; y: number }) => {
      if (!reactFlowInstance.current) return;
      const flowPos = reactFlowInstance.current.screenToFlowPosition(position);
      const clicked = nodes.find((n) => {
        const nodeW = 140;
        const nodeH = 50;
        return (
          flowPos.x >= n.position.x &&
          flowPos.x <= n.position.x + nodeW &&
          flowPos.y >= n.position.y &&
          flowPos.y <= n.position.y + nodeH
        );
      });
      if (clicked) {
        useEditorStore.getState().selectNode(clicked.id);
      }
    },
    [nodes],
  );

  const handleLongPress = useCallback(
    (position: { x: number; y: number }) => {
      if (!reactFlowInstance.current) return;
      useEditorStore.getState().selectNode(null);
    },
    [],
  );

  const touchGestures = useTouchGestures({
    rfInstance: reactFlowInstance.current,
    onDoubleTap: handleDoubleTap,
  });

  return (
    <div className="flex-1" {...(isMobile ? touchGestures : {})}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={onMoveEnd}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView={!loadViewport()}
        className="bg-gray-100 dark:bg-gray-900"
        minZoom={0.1}
        maxZoom={5}
        zoomOnScroll={!isMobile}
        zoomOnPinch={!isMobile}
        panOnScroll={!isMobile}
        panOnDrag={isMobile ? [1, 2] : true}
        selectionOnDrag={!isMobile}
        selectNodesOnDrag={!isMobile}
        nodesDraggable={true}
        connectOnClick={true}
      >
        <Background gap={16} size={1} />
        <Controls
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable={true}
          zoomable={true}
        />
      </ReactFlow>
    </div>
  );
}
