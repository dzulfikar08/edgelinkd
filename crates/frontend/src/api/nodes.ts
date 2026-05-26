import { client } from "./client";
import type { NodeDefinition } from "./types";

export const nodesApi = {
  getNodes(): Promise<Record<string, NodeDefinition>> {
    return client.get<Record<string, NodeDefinition>>("/nodes");
  },
};
