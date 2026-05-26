import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { clsx } from "clsx";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  initialHeight = 50,
  minHeight = 30,
  maxHeight = 90,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const updateHeight = useCallback((h: number) => {
    heightRef.current = h;
    setHeight(h);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startH.current = heightRef.current;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      const vh = window.innerHeight;
      const next = Math.min(maxHeight, Math.max(minHeight, startH.current + (delta / vh) * 100));
      updateHeight(next);
    },
    [maxHeight, minHeight, updateHeight],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    if (!open) setHeight(initialHeight);
  }, [open, initialHeight]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-xl shadow-2xl flex flex-col"
        style={{ height: `${height}vh` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          {title && (
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-2">
              {title}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto mt-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  width?: number;
}

export function SidePanel({ open, onClose, children, title, width = 30 }: SidePanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 hidden lg:block" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="absolute right-0 top-0 bottom-0 bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700"
        style={{ width: `${width}%` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface ResponsivePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function ResponsivePanel({ open, onClose, children, title }: ResponsivePanelProps) {
  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={title}>
        {children}
      </BottomSheet>
      <SidePanel open={open} onClose={onClose} title={title}>
        {children}
      </SidePanel>
    </>
  );
}
