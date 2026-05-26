import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  header?: ReactNode;
}

export function DashboardLayout({ children, header }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {header && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 flex items-center gap-3">
          {header}
        </div>
      )}
      <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
