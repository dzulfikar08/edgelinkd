import type { Node, Edge } from "@xyflow/react";

export interface FlowNodeData {
  label: string;
  type: string;
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

export interface FlowsResponse {
  rev: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowsPayload {
  rev: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowResponse {
  id: string;
  label: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface NodeDefinition {
  type: string;
  name: string;
  category: string;
  color: string;
  defaults: Record<string, unknown>;
  inputs: number;
  outputs: number;
}

export interface SystemSettings {
  httpAdminRoot: string;
  httpNodeRoot: string;
  version: string;
  paletteCategories: string[];
}

export interface CommsMessage {
  topic: string;
  data: unknown;
}

export interface DebugMessageData {
  id: string;
  z: string;
  name: string;
  topic: string;
  msg: string;
  format: string;
  timestamp: string;
}

export interface StatusMessageData {
  id: string;
  status: {
    fill: string;
    shape: string;
    text: string;
  };
}

export interface NotificationData {
  type: "success" | "warning" | "error" | "info";
  message: string;
  timestamp?: string;
}
