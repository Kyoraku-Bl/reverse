import React from "react";
export default function ShortcutHelp({ shortcuts, onClose }) {
  return (
    <div className="re-share-overlay" onClick={onClose}>
      <div
        className="shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            e.preventDefault();
            e.currentTarget.querySelector("button").focus();
          }
        }}
      >
        <button
          autoFocus
          className="re-share-close"
          onClick={onClose}
          aria-label="Close keyboard shortcuts"
        >
          ×
        </button>
        <h2>Keyboard shortcuts</h2>
        <p>
          Use ⌘ on Mac, Ctrl on Windows/Linux. Text fields keep their normal
          editing shortcuts. Object/clip clipboard is local to this editor; when
          the object clipboard is empty, you can also paste PNG/JPEG/WebP images
          from your system clipboard into a design.
        </p>
        <dl>
          {shortcuts.map(([keys, desc]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
