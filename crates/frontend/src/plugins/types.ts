import type { ComponentType } from "react";
import type { NodeDefinition } from "../api/types";

export interface WidgetPlugin {
  id: string;
  name: string;
  component: ComponentType<Record<string, unknown>>;
}

export interface NodeTypePlugin {
  type: string;
  definition: NodeDefinition;
  component?: ComponentType<Record<string, unknown>>;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  widgets?: WidgetPlugin[];
  nodeTypes?: NodeTypePlugin[];
}
