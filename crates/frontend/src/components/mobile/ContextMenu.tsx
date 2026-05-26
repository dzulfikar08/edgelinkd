import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Trash2, Edit3, Link, Scissors, Clipboard } from "lucide-react";

export interface ContextAction {
  id: string;
  label: string;
  icon?: typeof Copy;
  danger?: boolean;
  handler: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    requestAnimationFrame(() => document.addEventListener("pointerdown", handler));
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 200;
  const menuH = actions.length * 48;
  const left = x + menuW > vw ? Math.max(8, vw - menuW - 8) : x;
  const top = y + menuH > vh ? Math.max(8, vh - menuH - 8) : y;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[200px] py-1 animate-in fade-in zoom-in-95"
      style={{ left, top }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => {
            action.handler();
            onClose();
          }}
          className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors min-h-[44px] ${
            action.danger
              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          {action.icon && <action.icon size={16} />}
          {action.label}
        </button>
      ))}
    </div>
  );
}

export const NODE_CONTEXT_ACTIONS: ContextAction[] = [
  { id: "edit", label: "Edit", icon: Edit3, handler: () => {} },
  { id: "copy", label: "Copy", icon: Copy, handler: () => {} },
  { id: "cut", label: "Cut", icon: Scissors, handler: () => {} },
  { id: "connect", label: "Connect from here", icon: Link, handler: () => {} },
  { id: "delete", label: "Delete", icon: Trash2, danger: true, handler: () => {} },
];

export const CANVAS_CONTEXT_ACTIONS: ContextAction[] = [
  { id: "paste", label: "Paste", icon: Clipboard, handler: () => {} },
  { id: "select-all", label: "Select all", handler: () => {} },
];

export function useLongPress(callback: (e: React.PointerEvent) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const target = useRef<EventTarget | null>(null);

  const start = useCallback(
    (e: React.PointerEvent) => {
      target.current = e.target;
      timer.current = setTimeout(() => callback(e), ms);
    },
    [callback, ms],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => () => clear(), [clear]);

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
