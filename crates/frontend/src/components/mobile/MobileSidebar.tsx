import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, X, Search } from "lucide-react";

interface PaletteNode {
  type: string;
  label: string;
  color: string;
}

interface Category {
  name: string;
  label: string;
  nodes: PaletteNode[];
}

const categories: Category[] = [
  {
    name: "common",
    label: "Common",
    nodes: [
      { type: "inject", label: "inject", color: "#a6bbcf" },
      { type: "debug", label: "debug", color: "#87a669" },
      { type: "comment", label: "comment", color: "#ffffff" },
      { type: "link-in", label: "link in", color: "#ddd" },
      { type: "link-out", label: "link out", color: "#ddd" },
    ],
  },
  {
    name: "function",
    label: "Function",
    nodes: [
      { type: "function", label: "function", color: "#fdd0a2" },
      { type: "switch", label: "switch", color: "#e2d96e" },
      { type: "change", label: "change", color: "#e2d96e" },
      { type: "template", label: "template", color: "#e2d96e" },
      { type: "delay", label: "delay", color: "#e2d96e" },
    ],
  },
  {
    name: "network",
    label: "Network",
    nodes: [
      { type: "http-in", label: "http in", color: "#c1977b" },
      { type: "http-response", label: "http response", color: "#c1977b" },
      { type: "http-request", label: "http request", color: "#e2d96e" },
      { type: "websocket-in", label: "websocket in", color: "#c1977b" },
      { type: "websocket-out", label: "websocket out", color: "#c1977b" },
      { type: "mqtt-in", label: "mqtt in", color: "#c1977b" },
      { type: "mqtt-out", label: "mqtt out", color: "#c1977b" },
    ],
  },
  {
    name: "storage",
    label: "Storage",
    nodes: [
      { type: "file", label: "file", color: "#e2d96e" },
      { type: "file-in", label: "file in", color: "#e2d96e" },
    ],
  },
  {
    name: "parser",
    label: "Parser",
    nodes: [
      { type: "json", label: "json", color: "#e2d96e" },
      { type: "xml", label: "xml", color: "#e2d96e" },
      { type: "csv", label: "csv", color: "#e2d96e" },
      { type: "html", label: "html", color: "#e2d96e" },
    ],
  },
];

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectNode: (node: PaletteNode) => void;
}

export function MobileSidebar({ open, onClose, onSelectNode }: MobileSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(categories.map((c) => c.name)));
  const [search, setSearch] = useState("");

  const toggleCategory = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const filtered = categories
    .map((cat) => ({
      ...cat,
      nodes: cat.nodes.filter(
        (n) =>
          !search ||
          n.label.toLowerCase().includes(search.toLowerCase()) ||
          n.type.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.nodes.length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[80vw] bg-white dark:bg-gray-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Node Palette
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes..."
              className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.map((cat) => (
            <div key={cat.name}>
              <button
                type="button"
                onClick={() => toggleCategory(cat.name)}
                className="flex items-center gap-1 w-full px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {expanded.has(cat.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat.label}
                <span className="ml-auto text-[10px] text-gray-400">{cat.nodes.length}</span>
              </button>
              {expanded.has(cat.name) && (
                <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
                  {cat.nodes.map((node) => (
                    <button
                      key={node.type}
                      type="button"
                      onClick={() => {
                        onSelectNode(node);
                        onClose();
                      }}
                      className="flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:bg-gray-300 dark:active:bg-gray-500 min-h-[44px]"
                    >
                      <span
                        className="w-4 h-4 rounded border border-gray-300 dark:border-gray-500 flex-shrink-0"
                        style={{ backgroundColor: node.color }}
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                        {node.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
