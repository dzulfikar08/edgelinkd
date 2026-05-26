import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = "Add node" }: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-[var(--color-primary)] text-white shadow-lg active:scale-95 transition-transform flex items-center justify-center md:hidden"
      aria-label={label}
    >
      <Plus size={24} />
    </button>
  );
}
