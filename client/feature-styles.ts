export const featureStyles = `
.task-row { grid-template-columns: 26px minmax(0, 1fr) 28px 16px; }
.task-row.bulk-selected { background: var(--blue-soft); }
.task-select {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  margin: -4px 0 0;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--faint);
  cursor: pointer;
  opacity: 0;
}
.task-select svg { width: 17px; height: 17px; }
.task-row:hover .task-select,
.task-row:focus-within .task-select,
.task-select.active { opacity: 1; }
.task-select.active { background: var(--blue); color: #fff; }
.selection-toolbar {
  position: fixed;
  z-index: 25;
  left: calc(var(--sidebar-width) + (100vw - var(--sidebar-width)) / 2);
  bottom: 22px;
  transform: translateX(-50%);
  max-width: min(760px, calc(100vw - var(--sidebar-width) - 32px));
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  border: 1px solid var(--border-strong);
  border-radius: 13px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}
.selection-toolbar strong { padding: 0 8px; white-space: nowrap; font-size: 12px; }
.selection-toolbar .button,
.selection-toolbar .danger-button { min-height: 34px; white-space: nowrap; }
.selection-toolbar .icon-button { flex: none; }
.bulk-tag-grid { display: flex; flex-wrap: wrap; gap: 7px; }
.bulk-tag-option { position: relative; }
.bulk-tag-option input { position: absolute; opacity: 0; pointer-events: none; }
.bulk-tag-option span { display: block; padding: 7px 11px; border: 1px solid var(--border-strong); border-radius: 999px; color: var(--muted); cursor: pointer; }
.bulk-tag-option input:checked + span { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.bulk-tag-option input:focus-visible + span { outline: 2px solid var(--blue); outline-offset: 2px; }
.detail-row:has(.inline-add) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.inline-add { padding-inline: 12px; margin: 0; }
.detail-help {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}
.markdown-preview a { color: var(--blue); text-decoration: underline; text-underline-offset: 2px; }
.markdown-preview blockquote {
  margin: 10px 0;
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--faint);
  color: var(--muted);
}
.markdown-preview pre {
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-raised, rgba(127,127,127,.1));
}
.markdown-preview mark { background: #ffe58a; color: #3b3218; border-radius: 2px; padding: 0 2px; }
.markdown-preview hr { border: 0; border-top: 1px solid var(--faint); margin: 16px 0; }
.markdown-task { list-style: none; display: flex; gap: 8px; margin-left: -18px; }
.markdown-task.done { text-decoration: line-through; color: var(--muted); }
.markdown-task.cancelled { text-decoration: line-through; opacity: .65; }
.project-card-list + .section { margin-top: 24px; }
.agenda-empty {
  margin: 2px 0 8px 37px;
  color: var(--muted);
  font-size: 12px;
  font-style: italic;
}
.nav-item.drop-target {
  background: var(--blue-soft);
  color: var(--blue);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--blue) 35%, transparent);
}
.task-row.canceled .task-title { text-decoration-style: wavy; opacity: .66; }
.completion-choices { display: grid; gap: 8px; margin: 20px 0; }
.tag-manager { display: grid; gap: 8px; }
.tag-manager-row { gap: 8px; }
.tag-manager-row .detail-input { min-width: 0; }
.form-field textarea {
  width: 100%;
  resize: vertical;
  min-height: 80px;
  border: 1px solid var(--faint);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  background: var(--surface);
  font: inherit;
}

@media (max-width: 820px) {
  .task-row { grid-template-columns: 32px minmax(0, 1fr) 44px 16px; }
  .task-select { width: 44px; height: 44px; margin: -8px 0; opacity: 1; }
  .selection-toolbar {
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    max-width: none;
    transform: none;
  }
  .toast-region {
    top: calc(68px + env(safe-area-inset-top, 0px));
    right: 12px;
    bottom: auto;
    left: 12px;
    align-items: center;
    transform: none;
  }
  .toast {
    width: fit-content;
    min-width: 0;
    max-width: min(100%, 360px);
    padding: 9px 13px;
    border-radius: 999px;
    animation-name: mobile-toast-in;
  }
  .toast span { overflow-wrap: anywhere; }
}

@media (max-width: 520px) {
  .task-row { grid-template-columns: 32px minmax(0, 1fr) 44px; }
}

@keyframes mobile-toast-in {
  from { opacity: 0; transform: translateY(-8px); }
}
`;
