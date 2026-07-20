export const featureStyles = `
.quick-add-row { grid-template-columns: 26px minmax(0, 1fr); }
.meta-item.past-date { color: var(--muted); }
.checklist-item { grid-template-columns: 34px 18px minmax(0, 1fr) 24px; }
.checklist-reorder { display: grid; grid-template-columns: 1fr 1fr; opacity: .35; }
.checklist-item:hover .checklist-reorder,
.checklist-item:focus-within .checklist-reorder { opacity: 1; }
.checklist-item.sortable-ghost { opacity: .28; }
.checklist-item.sortable-chosen { background: var(--surface-subtle); }
.checklist-reorder button {
  width: 17px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
}
.checklist-reorder button:disabled { opacity: .2; cursor: default; }
.context-menu {
  z-index: 260;
  --wa-focus-ring-width: 0;
  --wa-panel-background-color: color-mix(in srgb, var(--surface) 96%, transparent);
  --wa-panel-border-color: var(--border-strong);
  --wa-panel-border-radius: 11px;
  --wa-panel-border-width: 1px;
}
.context-menu::part(menu) {
  width: min(220px, calc(100vw - 16px));
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 11px;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}
.context-menu-trigger {
  position: fixed;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}
.context-menu wa-dropdown-item {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--text);
  cursor: default;
  font-size: 14px;
  line-height: 1.25;
}
.context-menu wa-dropdown-item + wa-dropdown-item { margin-top: 2px; }
.context-menu wa-dropdown-item:focus,
.context-menu wa-dropdown-item:hover { background: var(--surface-subtle); }
.context-menu wa-dropdown-item.danger { color: var(--red); }

@media (max-width: 820px) {
  .context-menu wa-dropdown-item { min-height: var(--control-touch); padding-block: 10px; }
}
.task-row { grid-template-columns: 26px minmax(0, 1fr) 28px 16px; }
.task-row.bulk-selected { background: var(--blue-soft); }
.task-row.sortable-ghost { opacity: .25; }
.task-row.sortable-chosen { background: var(--surface-subtle); }
.section.sortable-ghost { opacity: .25; }
.section.sortable-chosen > .heading-header { background: var(--surface-subtle); border-radius: 7px; }
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
.archived-section { margin-top: 42px; opacity: .82; }
.archived-heading-header { border-top: 1px solid var(--border); }
.archived-heading-header .section-meta { color: var(--green); }
.heading-restore { min-height: 28px; padding: 4px 9px; font-size: 11px; }
.note-tools { display: flex; gap: 14px; }
.note-find-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 30px 30px 30px;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
}
.note-find-bar input { min-width: 0; border: 0; outline: 0; background: transparent; }
.note-find-bar span { color: var(--muted); font-size: 11px; white-space: nowrap; }
.note-find-bar .icon-button { width: 30px; height: 30px; }
.magic-add.dragging { opacity: .45; transform: scale(.92); }
.task-row { touch-action: pan-y; }
.task-row.task-swiping {
  z-index: 2;
  transform: translateX(var(--task-swipe-x, 0));
  transition: none;
  box-shadow: 0 5px 18px rgba(0,0,0,.08);
}
.task-row.task-swiping::after {
  content: attr(data-swipe-action);
  position: absolute;
  top: 50%;
  right: calc(100% + 12px);
  transform: translateY(-50%);
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
}
.tag-manager { display: grid; gap: 8px; }
.tag-manager-row { gap: 8px; }
.tag-manager-row .detail-input { min-width: 0; }
@media (max-width: 820px) {
  .checklist-item { grid-template-columns: 44px 24px minmax(0, 1fr) 44px; }
  .checklist-reorder { opacity: 1; }
  .checklist-reorder button { width: 22px; height: 44px; font-size: 15px; }
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
    top: auto;
    right: 72px;
    bottom: calc(22px + env(safe-area-inset-bottom, 0px));
    left: 12px;
    align-items: flex-end;
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
