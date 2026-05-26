import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Trash2, Search, ChevronDown, ChevronRight, Copy, Pause, Play } from "lucide-react";
import { useEditorStore } from "../../store/editor-store";
import { useBreakpoint } from "../../hooks";
import { BottomSheet } from "../mobile/BottomSheet";

type FilterChip = "all" | "error" | "warn" | "info";

const FILTER_COLORS: Record<string, string> = {
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function MobileDebugPanel() {
  const debugMessages = useEditorStore((s) => s.debugMessages);
  const clearDebugMessages = useEditorStore((s) => s.clearDebugMessages);
  const { isMobile } = useBreakpoint();

  const [filter, setFilter] = useState<FilterChip>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let msgs = debugMessages;
    if (filter !== "all") {
      msgs = msgs.filter((m) => {
        const msg = String(m.msg).toLowerCase();
        if (filter === "error") return msg.includes("error") || msg.includes("err");
        if (filter === "warn") return msg.includes("warn");
        return true;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      msgs = msgs.filter(
        (m) =>
          String(m.msg).toLowerCase().includes(q) ||
          (m.topic && m.topic.toLowerCase().includes(q)) ||
          (m.name && m.name.toLowerCase().includes(q)),
      );
    }
    return msgs;
  }, [debugMessages, filter, search]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  const toggleExpand = useCallback((i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  if (isMobile) {
    return <MobileDebugSheet messages={filtered} allMessages={debugMessages} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} expanded={expanded} toggleExpand={toggleExpand} handleCopy={handleCopy} clearDebugMessages={clearDebugMessages} autoScroll={autoScroll} setAutoScroll={setAutoScroll} scrollRef={scrollRef} />;
  }

  return <DesktopDebugPanel messages={filtered} allMessages={debugMessages} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} expanded={expanded} toggleExpand={toggleExpand} handleCopy={handleCopy} clearDebugMessages={clearDebugMessages} />;
}

interface DebugPanelSharedProps {
  messages: typeof debugMessages;
  allMessages: typeof debugMessages;
  search: string;
  setSearch: (s: string) => void;
  filter: FilterChip;
  setFilter: (f: FilterChip) => void;
  expanded: Set<number>;
  toggleExpand: (i: number) => void;
  handleCopy: (text: string) => void;
  clearDebugMessages: () => void;
  autoScroll?: boolean;
  setAutoScroll?: (v: boolean) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

function MobileDebugSheet(props: DebugPanelSharedProps) {
  const { messages, allMessages, search, setSearch, filter, setFilter, expanded, toggleExpand, handleCopy, clearDebugMessages, autoScroll, setAutoScroll, scrollRef } = props;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Debug
          {allMessages.length > 0 && (
            <span className="ml-1 text-gray-400">({messages.length}/{allMessages.length})</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {setAutoScroll && (
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
            >
              {autoScroll ? <Pause size={14} className="text-gray-500" /> : <Play size={14} className="text-green-500" />}
            </button>
          )}
          <button
            type="button"
            onClick={clearDebugMessages}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Clear"
          >
            <Trash2 size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {(["all", "error", "warn", "info"] as FilterChip[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium min-w-[44px] transition-colors ${
              filter === f
                ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        {messages.length === 0 ? (
          <div className="p-6 text-gray-400 text-center text-sm">No debug messages</div>
        ) : (
          messages.map((msg, i) => (
            <DebugMessageCard
              key={`${msg.id}-${i}`}
              msg={msg}
              index={i}
              expanded={expanded.has(i)}
              onToggle={() => toggleExpand(i)}
              onCopy={handleCopy}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DesktopDebugPanel(props: DebugPanelSharedProps) {
  const { messages, allMessages, search, setSearch, filter, setFilter, expanded, toggleExpand, handleCopy, clearDebugMessages } = props;

  return (
    <div className="flex flex-col border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" style={{ height: "var(--debug-panel-height)" }}>
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Debug
          {allMessages.length > 0 && <span className="ml-1 text-gray-400">({messages.length})</span>}
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5 mr-2">
            <Search size={10} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent text-[10px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-20"
            />
          </div>
          <button type="button" onClick={clearDebugMessages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Clear">
            <Trash2 size={12} className="text-gray-500" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {messages.length === 0 ? (
          <div className="p-3 text-gray-400 text-center">No debug messages</div>
        ) : (
          messages.map((msg, i) => (
            <DebugMessageCard key={`${msg.id}-${i}`} msg={msg} index={i} expanded={expanded.has(i)} onToggle={() => toggleExpand(i)} onCopy={handleCopy} />
          ))
        )}
      </div>
    </div>
  );
}

function DebugMessageCard({
  msg,
  index,
  expanded,
  onToggle,
  onCopy,
}: {
  msg: { id?: string; timestamp?: string; topic?: string; name?: string; msg: unknown };
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
}) {
  const msgStr = typeof msg.msg === "string" ? msg.msg : JSON.stringify(msg.msg, null, 2);
  const severity = msgStr.toLowerCase().includes("error") ? "error" : msgStr.toLowerCase().includes("warn") ? "warn" : "info";

  return (
    <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center gap-2">
        {typeof msg.msg === "object" && (
          <button type="button" onClick={onToggle} className="text-gray-400 p-0.5">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
        <span className="text-gray-400 text-[10px]">{msg.timestamp}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${FILTER_COLORS[severity] || ""}`}>
          {severity}
        </span>
        <span className="text-blue-600 dark:text-blue-400 text-xs">{msg.topic || msg.name}</span>
        <button
          type="button"
          onClick={() => onCopy(msgStr)}
          className="ml-auto p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100"
          title="Copy"
        >
          <Copy size={10} className="text-gray-400" />
        </button>
      </div>
      {expanded && typeof msg.msg === "object" ? (
        <pre className="text-gray-700 dark:text-gray-300 text-[10px] mt-1 whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900 rounded p-2">
          {msgStr}
        </pre>
      ) : (
        <div className="text-gray-700 dark:text-gray-300 break-all text-xs mt-0.5">{msgStr}</div>
      )}
    </div>
  );
}
