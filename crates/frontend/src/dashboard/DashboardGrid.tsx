import { useCallback, useRef, useState } from "react";
import { WidgetRenderer } from "./WidgetRenderer";
import { useDashboardStore, type Widget } from "./DashboardStore";

const COLS = 12;
const ROW_HEIGHT = 80;
const GAP = 8;

interface DashboardGridProps {
  dashboardId: string;
  widgets: Widget[];
  editable?: boolean;
}

export function DashboardGrid({ dashboardId, widgets, editable = false }: DashboardGridProps) {
  const updateWidget = useDashboardStore((s) => s.updateWidget);
  const [dragId, setDragId] = useState<string | null>(null);
  const [resizeId, setResizeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent, widget: Widget) => {
      if (!editable) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
      const cellW = (rect.width - GAP * (COLS - 1)) / COLS;
      const colX = widget.config.x * (cellW + GAP);
      const rowY = widget.config.y * (ROW_HEIGHT + GAP);
      dragOffset.current = {
        x: e.clientX - rect.left - colX,
        y: e.clientY - rect.top - rowY,
      };
      setDragId(widget.id);
    },
    [editable],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragId) return;
      const container = (e.currentTarget as HTMLElement);
      const rect = container.getBoundingClientRect();
      const cellW = (rect.width - GAP * (COLS - 1)) / COLS;

      const x = Math.round(Math.max(0, (e.clientX - rect.left - dragOffset.current.x)) / (cellW + GAP));
      const y = Math.round(Math.max(0, (e.clientY - rect.top - dragOffset.current.y)) / (ROW_HEIGHT + GAP));

      useDashboardStore.getState().updateWidget(dashboardId, dragId, {
        config: {
          ...useDashboardStore.getState().dashboards.find((d) => d.id === dashboardId)?.widgets.find((w) => w.id === dragId)?.config,
          x: Math.min(x, COLS - 1),
          y,
        },
      });
    },
    [dragId, dashboardId],
  );

  const onPointerUp = useCallback(() => {
    setDragId(null);
    setResizeId(null);
  }, []);

  const cellW = `calc((100% - ${GAP * (COLS - 1)}px) / ${COLS})`;

  return (
    <div
      className="relative w-full h-full overflow-auto"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, ${cellW})`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        gap: `${GAP}px`,
        padding: `${GAP}px`,
        alignContent: "start",
      }}
    >
      {widgets.map((widget) => {
        const style: React.CSSProperties = {
          gridColumn: `${widget.config.x + 1} / span ${widget.config.w}`,
          gridRow: `${widget.config.y + 1} / span ${widget.config.h}`,
        };

        return (
          <div
            key={widget.id}
            style={style}
            className={`
              bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm
              overflow-hidden relative flex flex-col
              ${editable ? "cursor-grab active:cursor-grabbing" : ""}
              ${dragId === widget.id ? "opacity-70 ring-2 ring-blue-500 z-10" : ""}
            `}
          >
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-2 py-1 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750"
              onPointerDown={(e) => onPointerDown(e, widget)}
            >
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 truncate">
                {widget.title || widget.type}
              </span>
              {editable && (
                <span className="text-[10px] text-gray-400">{widget.config.w}x{widget.config.h}</span>
              )}
            </div>
            {/* Widget body */}
            <div className="flex-1 min-h-0">
              <WidgetRenderer widget={widget} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
