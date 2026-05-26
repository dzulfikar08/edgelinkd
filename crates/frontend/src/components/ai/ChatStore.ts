import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  flowPreview?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isListening: boolean;

  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  setListening: (v: boolean) => void;
  clearMessages: () => void;
  loadMessages: () => Promise<void>;
}

const DB_NAME = "rustred-chat";
const STORE = "messages";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAllMessages(messages: ChatMessage[]) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    messages.forEach((m) => store.put(m));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

async function loadAllMessages(): Promise<ChatMessage[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as ChatMessage[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  isListening: false,

  addMessage: (msg) => {
    set((s) => {
      const next = [...s.messages, msg];
      saveAllMessages(next);
      return { messages: next };
    });
  },

  setStreaming: (v) => set({ isStreaming: v }),
  setListening: (v) => set({ isListening: v }),

  clearMessages: () => {
    set({ messages: [] });
    saveAllMessages([]);
  },

  loadMessages: async () => {
    const msgs = await loadAllMessages();
    set({ messages: msgs });
  },
}));
