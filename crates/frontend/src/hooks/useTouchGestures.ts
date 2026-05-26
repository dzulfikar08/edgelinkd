import { useCallback, useRef, useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";

interface TouchGestureOptions {
  rfInstance: ReactFlowInstance | null;
  minZoom?: number;
  maxZoom?: number;
  onDoubleTap?: (position: { x: number; y: number }) => void;
  onLongPress?: (position: { x: number; y: number }) => void;
}

export function useTouchGestures({
  rfInstance,
  minZoom = 0.1,
  maxZoom = 5,
  onDoubleTap,
  onLongPress,
}: TouchGestureOptions) {
  const lastTap = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStartPos = useRef({ x: 0, y: 0 });
  const initialPinchDist = useRef(0);
  const initialZoom = useRef(1);
  const isPinching = useRef(false);
  const pinchRaf = useRef(0);
  const pendingZoom = useRef<number | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPress();
      cancelAnimationFrame(pinchRaf.current);
    };
  }, [clearLongPress]);

  const getPinchDistance = useCallback((t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const applyZoom = useCallback(() => {
    if (pendingZoom.current !== null && rfInstance) {
      rfInstance.zoomTo(pendingZoom.current, { duration: 0 });
      pendingZoom.current = null;
    }
  }, [rfInstance]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };

        if (onLongPress) {
          clearLongPress();
          longPressTimer.current = setTimeout(() => {
            onLongPress({ x: touch.clientX, y: touch.clientY });
          }, 500);
        }
      }

      if (e.touches.length === 2) {
        isPinching.current = true;
        clearLongPress();
        initialPinchDist.current = getPinchDistance(e.touches[0], e.touches[1]);
        if (rfInstance) {
          initialZoom.current = rfInstance.getZoom();
        }
      }
    },
    [rfInstance, onLongPress, clearLongPress, getPinchDistance],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && !isPinching.current) {
        const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
        if (dx > 10 || dy > 10) {
          clearLongPress();
        }
      }

      if (e.touches.length === 2 && rfInstance) {
        isPinching.current = true;
        const currentDist = getPinchDistance(e.touches[0], e.touches[1]);
        const scale = currentDist / initialPinchDist.current;
        const newZoom = Math.min(maxZoom, Math.max(minZoom, initialZoom.current * scale));
        pendingZoom.current = newZoom;
        cancelAnimationFrame(pinchRaf.current);
        pinchRaf.current = requestAnimationFrame(applyZoom);
      }
    },
    [rfInstance, minZoom, maxZoom, clearLongPress, getPinchDistance, applyZoom],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching.current = false;
      }

      if (e.touches.length === 0 && e.changedTouches.length === 1) {
        clearLongPress();

        const touch = e.changedTouches[0];
        const now = Date.now();
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);

        if (dx < 15 && dy < 15) {
          if (now - lastTap.current < 300 && onDoubleTap) {
            onDoubleTap({ x: touch.clientX, y: touch.clientY });
            lastTap.current = 0;
          } else {
            lastTap.current = now;
          }
        }
      }
    },
    [onDoubleTap, clearLongPress],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
