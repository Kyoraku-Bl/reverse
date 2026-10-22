import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useStore } from "../lib/store";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" style={wide ? { width: "min(920px, 100%)" } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>{t.text}</div>
      ))}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#6E56CF" />
      <path fill="#fff" d="M9 23V9h6.4c3.5 0 5.7 1.9 5.7 4.7 0 1.9-1 3.3-2.7 4L23.2 23h-3.3l-4.3-3.5H12V23H9zm3-6.1h3.1c1.8 0 2.8-.8 2.8-2.1s-1-2.1-2.8-2.1H12v4.2z" />
    </svg>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
