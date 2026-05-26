import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Trash2, Sparkles, Copy, Plus } from "lucide-react";
import { useChatStore, type ChatMessage } from "./ChatStore";
import { useEditorStore } from "../../store/editor-store";

const QUICK_PROMPTS = [
  "Build a flow that...",
  "Debug this flow",
  "Explain selected node",
  "Add MQTT input",
  "Add HTTP endpoint",
  "Optimize this flow",
];

export function AIAssistant() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const isListening = useChatStore((s) => s.isListening);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setListening = useChatStore((s) => s.setListening);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const loadMessages = useChatStore((s) => s.loadMessages);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setInput("");
      setStreaming(true);

      // Simulated AI response (replace with real API call)
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: generateResponse(text),
          timestamp: Date.now(),
        };
        addMessage(aiMsg);
        setStreaming(false);
      }, 800);
    },
    [addMessage, setStreaming],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage],
  );

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [isListening, setListening]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const hasSpeechAPI = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Sparkles size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              RustRED AI Assistant
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px]">
              Ask me to build flows, debug issues, explain nodes, or optimize your automation.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-[var(--color-primary)] text-white rounded-br-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              {msg.role === "assistant" && (
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <Copy size={10} /> Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="flex-shrink-0 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Clear button */}
      {messages.length > 0 && (
        <div className="px-4 pb-1">
          <button
            type="button"
            onClick={clearMessages}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <Trash2 size={10} /> Clear chat
          </button>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 safe-area-bottom">
        {hasSpeechAPI && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
              isListening
                ? "bg-red-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <div className="flex-1 flex items-end bg-gray-100 dark:bg-gray-700 rounded-2xl px-3 py-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask the AI assistant..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none resize-none max-h-[100px] py-2"
            style={{ minHeight: "36px" }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white disabled:opacity-40 flex-shrink-0 active:scale-95 transition-transform"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function generateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("mqtt")) {
    return "I'll create an MQTT input node for you. Here's what I'll add:\n\n- MQTT Input node connected to a Debug node\n- Default broker: localhost:1883\n- Topic: # (all topics)\n\nTap 'Apply' to insert this flow into your canvas.";
  }
  if (lower.includes("http")) {
    return "I'll set up an HTTP endpoint. The flow will include:\n\n- HTTP In node (GET /api/data)\n- Function node for processing\n- HTTP Response node\n\nThis creates a basic REST API endpoint that you can customize.";
  }
  if (lower.includes("debug")) {
    return "Let me analyze your current flow for issues:\n\n1. Check that all nodes have proper connections\n2. Verify MQTT/HTTP nodes have valid configurations\n3. Look for any disconnected outputs\n\nI'd recommend adding Debug nodes after each major processing step to trace message flow.";
  }
  if (lower.includes("explain")) {
    return "This node processes incoming messages and passes them to the next node in the flow. You can configure its behavior by tapping on it to open the configuration panel.";
  }
  return "I can help you build flows, debug issues, and optimize your automation. Try asking me to:\n\n- Build a specific flow\n- Debug a problem\n- Explain a node\n- Add specific nodes (MQTT, HTTP, etc.)";
}
