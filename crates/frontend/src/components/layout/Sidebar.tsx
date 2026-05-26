import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { categories, type PaletteNode } from "../shared/node-palette";

export type { PaletteNode } from "../shared/node-palette";

export function Sidebar() {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.name)),
  );

  const toggleCategory = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const onDragStart = useCallback(
    (event: React.DragEvent, node: PaletteNode) => {
      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify(node),
      );
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  return (
    <aside
      className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="p-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Node Palette
      </div>
      {categories.map((cat) => (
        <div key={cat.name}>
          <button
            type="button"
            onClick={() => toggleCategory(cat.name)}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {expanded.has(cat.name) ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            {cat.label}
          </button>
          {expanded.has(cat.name) && (
            <div className="px-2 pb-2 flex flex-col gap-1">
              {cat.nodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node)}
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-grab text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:cursor-grabbing"
                >
                  <span
                    className="w-3 h-3 rounded-sm border border-gray-300 dark:border-gray-500 flex-shrink-0"
                    style={{ backgroundColor: node.color }}
                  />
                  <span>{node.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
