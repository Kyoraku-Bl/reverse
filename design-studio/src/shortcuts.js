export const isTyping = (target) =>
  target instanceof Element &&
  !!target.closest(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
  );
export const canvasShortcuts = [
  ["Ctrl/⌘ X / C / V", "Cut / copy / paste objects"],
  ["Ctrl/⌘ D", "Duplicate selection"],
  ["Ctrl/⌘ Z", "Undo"],
  ["Ctrl/⌘ Shift Z / Ctrl Y", "Redo"],
  ["Ctrl/⌘ S", "Save project"],
  ["Ctrl/⌘ B / I / U", "Bold / italic / underline"],
  ["Ctrl/⌘ A", "Select unlocked objects"],
  ["Ctrl/⌘ G", "Group / ungroup"],
  ["Ctrl/⌘ L", "Lock / unlock selection"],
  ["Delete / Backspace", "Delete unlocked objects"],
  ["Arrows / Shift + Arrows", "Move 1 px / 10 px"],
  ["Ctrl/⌘ ] / [", "Bring forward / send backward"],
  ["T / R / O", "Add text / rectangle / circle"],
  ["Escape", "Deselect / stop drawing"],
  ["+ / − / 0", "Zoom in / out / fit"],
];
export const videoShortcuts = [
  ["Ctrl/⌘ X / C / V", "Cut / copy / paste selected clip"],
  ["Ctrl/⌘ D", "Duplicate selected clip"],
  ["Ctrl/⌘ Z / Shift Z / Ctrl Y", "Undo / redo"],
  ["Ctrl/⌘ S", "Save montage"],
  ["Space", "Play / pause"],
  ["S", "Split selected clip at playhead"],
  ["← / → (Shift)", "Seek one frame (one second)"],
  ["Home / End", "Start / end"],
  ["Delete / Backspace", "Delete selected clip"],
];
