import { Upload, Bug, Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../store/theme-store";
import { useEditorStore } from "../../store/editor-store";

interface HeaderProps {
  onDeploy: () => void;
}

export function Header({ onDeploy }: HeaderProps) {
  const { theme, toggleTheme } = useThemeStore();
  const debugMessages = useEditorStore((s) => s.debugMessages);

  return (
    <header
      className="flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      style={{ height: "var(--header-height)" }}
    >
      <div className="flex items-center gap-2">
        <svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          className="flex-shrink-0"
        >
          <rect width="32" height="32" rx="6" fill="#8f0000" />
          <text
            x="16"
            y="23"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="22"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
          >
            R
          </text>
        </svg>
        <span className="font-bold text-sm tracking-tight select-none">
          Rust-Red
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Debug messages"
        >
          <Bug size={16} />
          {debugMessages.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {debugMessages.length > 9 ? "9+" : debugMessages.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          type="button"
          onClick={onDeploy}
          className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white rounded transition-colors"
          style={{ backgroundColor: "var(--color-primary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--color-primary-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-primary)";
          }}
        >
          <Upload size={14} />
          Deploy
        </button>
      </div>
    </header>
  );
}
