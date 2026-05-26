import { create } from "zustand";
import type { DebugMessageData, StatusMessageData, NotificationData } from "../ws/types";

interface EditorState {
  debugMessages: DebugMessageData[];
  statuses: Map<string, StatusMessageData>;
  notifications: NotificationData[];
  selectedNodeId: string | null;

  addDebugMessage: (msg: DebugMessageData) => void;
  clearDebugMessages: () => void;
  setStatus: (id: string, status: StatusMessageData) => void;
  addNotification: (n: NotificationData) => void;
  dismissNotification: (index: number) => void;
  selectNode: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  debugMessages: [],
  statuses: new Map(),
  notifications: [],
  selectedNodeId: null,

  addDebugMessage: (msg) => {
    set((state) => ({
      debugMessages: [...state.debugMessages, msg],
    }));
  },

  clearDebugMessages: () => {
    set({ debugMessages: [] });
  },

  setStatus: (id, status) => {
    set((state) => {
      const next = new Map(state.statuses);
      next.set(id, status);
      return { statuses: next };
    });
  },

  addNotification: (n) => {
    const notification: NotificationData = {
      ...n,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      notifications: [...state.notifications, notification],
    }));
  },

  dismissNotification: (index) => {
    set((state) => ({
      notifications: state.notifications.filter((_, i) => i !== index),
    }));
  },

  selectNode: (id) => {
    set({ selectedNodeId: id });
  },
}));
