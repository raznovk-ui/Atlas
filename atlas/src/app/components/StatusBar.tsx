import { useAppStore } from "../state.js";

export function StatusBar() {
  const status = useAppStore((s) => s.status);
  return (
    <p
      // Progress and errors are announced, not signalled by colour alone.
      role="status"
      aria-live="polite"
      className="border-t border-slate-200 px-4 py-2 text-sm text-slate-700"
    >
      {status}
    </p>
  );
}
