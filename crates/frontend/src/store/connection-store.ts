import { create } from "zustand";

interface ConnectionState {
  mode: "idle" | "selecting-source" | "selecting-target";
  sourceNodeId: string | null;
  sourceHandle: string | null;
  sourcePosition: { x: number; y: number } | null;
  magnifierActive: boolean;

  startConnection: (nodeId: string, handleId: string, position: { x: number; y: number }) => void;
  cancelConnection: () => void;
  toggleMagnifier: () => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  mode: "idle",
  sourceNodeId: null,
  sourceHandle: null,
  sourcePosition: null,
  magnifierActive: false,

  startConnection: (nodeId, handleId, position) => {
    set({
      mode: "selecting-target",
      sourceNodeId: nodeId,
      sourceHandle: handleId,
      sourcePosition: position,
    });
  },

  cancelConnection: () => {
    set({
      mode: "idle",
      sourceNodeId: null,
      sourceHandle: null,
      sourcePosition: null,
    });
  },

  toggleMagnifier: () => {
    set((s) => ({ magnifierActive: !s.magnifierActive }));
  },

  reset: () => {
    set({
      mode: "idle",
      sourceNodeId: null,
      sourceHandle: null,
      sourcePosition: null,
      magnifierActive: false,
    });
  },
}));
