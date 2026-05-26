import { Share2, LayoutDashboard, Bug, Bot, Settings } from "lucide-react";
import { clsx } from "clsx";

export type MobileTab = "flows" | "dashboard" | "debug" | "ai" | "settings";

interface BottomTabBarProps {
  active: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  debugCount?: number;
}

const tabs: { id: MobileTab; label: string; Icon: typeof Share2 }[] = [
  { id: "flows", label: "Flows", Icon: Share2 },
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "debug", label: "Debug", Icon: Bug },
  { id: "ai", label: "AI", Icon: Bot },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function BottomTabBar({ active, onTabChange, debugCount = 0 }: BottomTabBarProps) {
  return (
    <nav className="flex items-center justify-around border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 safe-area-bottom md:hidden">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={clsx(
            "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] transition-colors relative",
            active === id
              ? "text-[var(--color-primary)]"
              : "text-gray-500 dark:text-gray-400",
          )}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon size={20} />
          <span className="text-[10px] font-medium">{label}</span>
          {id === "debug" && debugCount > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {debugCount > 99 ? "99+" : debugCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
