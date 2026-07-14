export const thingsStyles = `
:root {
  --sidebar-width: 286px;
  --bg: #f4f4f4;
  --surface: #ffffff;
  --surface-subtle: #f2f3f4;
  --surface-hover: #e8e9ea;
  --sidebar: #f3f4f5;
  --text: #202124;
  --muted: #85878b;
  --faint: #bec1c5;
  --border: rgba(35, 38, 42, .075);
  --border-strong: rgba(35, 38, 42, .14);
  --blue: #1686ed;
  --blue-soft: #e8f3fd;
  --yellow: #f4c82f;
  --red: #ef476f;
  --green: #43b979;
}

[data-theme="dark"] {
  --bg: #1c1c1e;
  --surface: #1c1c1e;
  --surface-subtle: #292a2d;
  --surface-hover: #323337;
  --sidebar: #19191b;
  --text: #f4f4f5;
  --muted: #9a9b9e;
  --faint: #626469;
  --border: rgba(255, 255, 255, .075);
  --border-strong: rgba(255, 255, 255, .14);
  --blue: #4aa2ff;
  --blue-soft: #20384f;
}

body { font-size: 15px; }

.sidebar { border-right-color: var(--border); }
.window-bar { height: 64px; padding: 17px 15px 8px 19px; }
.sidebar-nav { padding: 4px 11px 22px; }
.nav-list { gap: 0; }
.nav-list + .nav-list { margin-top: 20px; }
.nav-section-title {
  padding: 5px 10px 7px;
  font-size: 10px;
  font-weight: 670;
  letter-spacing: .065em;
}
.nav-item {
  min-height: 35px;
  gap: 9px;
  padding: 5px 9px;
  border-radius: 7px;
  font-size: 15px;
  font-weight: 490;
  letter-spacing: -.01em;
}
.nav-item:hover { background: color-mix(in srgb, var(--surface-hover) 82%, transparent); }
.nav-item.active { background: #dfe1e4; box-shadow: none; }
[data-theme="dark"] .nav-item.active { background: #303135; }
.nav-item svg { width: 19px; height: 19px; stroke-width: 2; }
.nav-item[data-view="inbox"] svg { color: #39a4ef; }
.nav-item[data-view="today"] svg { color: #f4c72c; fill: currentColor; }
.nav-item[data-view="upcoming"] svg { color: #ef4b74; }
.nav-item[data-view="anytime"] svg { color: #3bb6a8; }
.nav-item[data-view="someday"] svg { color: #c2ae62; }
.nav-item[data-view="logbook"] svg { color: #43b875; }
.nav-item[data-view="trash"] svg { color: #9a9ca0; }
.nav-item.active[data-view="inbox"] svg { color: #39a4ef; }
.nav-item.active[data-view="today"] svg { color: #f4c72c; }
.nav-item.active[data-view="upcoming"] svg { color: #ef4b74; }
.nav-item.active[data-view="anytime"] svg { color: #3bb6a8; }
.nav-item.active[data-view="someday"] svg { color: #c2ae62; }
.nav-item.active[data-view="logbook"] svg { color: #43b875; }
.nav-symbol { font-size: 16px; }
.nav-count { font-size: 13px; }
.sidebar-footer { min-height: 54px; padding: 8px 12px 9px 16px; }
.quiet-button { font-size: 14px; }

.content { padding: 88px clamp(48px, 6.4vw, 78px) 92px; }
.content-inner { max-width: 850px; }
.view-header { margin-bottom: 26px; }
.eyebrow { display: none; }
.view-title-row { gap: 10px; }
.view-icon { width: 30px; height: 30px; color: var(--yellow); stroke-width: 1.9; }
.view-title-row h1 {
  font-size: clamp(34px, 3.4vw, 41px);
  font-weight: 720;
  line-height: 1.04;
  letter-spacing: -.045em;
}
.view-subtitle { display: none; }
.content-inner:has(.progress-line) .view-subtitle {
  display: block;
  max-width: 700px;
  margin: 18px 0 0;
  color: var(--text);
  font-size: 15px;
  line-height: 1.45;
}
.filter-bar { gap: 3px; margin: 22px 0 0; }
.filter-bar .chip {
  min-height: 28px;
  padding: 3px 10px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 570;
}
.filter-bar .chip:hover { border: 0; background: var(--surface-subtle); color: var(--text); }
.filter-bar .chip.active { border: 0; background: #b6b9be; color: #fff; }
[data-theme="dark"] .filter-bar .chip.active { background: #5a5d63; }

.calendar-strip {
  margin: 0 0 34px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface-subtle);
}
.calendar-event {
  grid-template-columns: 66px 3px minmax(0, 1fr);
  gap: 9px;
  min-height: 32px;
}
.calendar-time { color: var(--blue); font-size: 13px; }
.calendar-line { height: 21px; }
.calendar-title { font-size: 14px; }
.calendar-name { margin-top: 0; font-size: 11px; }

.section { margin-top: 31px; }
.section:first-of-type { margin-top: 0; }
.section-header {
  min-height: 29px;
  padding: 0 2px 5px;
  border-bottom-color: var(--border);
}
.section-header h2 { font-size: 15px; font-weight: 680; letter-spacing: -.012em; }
.section-header .section-meta { font-size: 13px; }
.section-header .section-symbol { color: #74a4d0; font-size: 16px; }

.task-row {
  grid-template-columns: 27px minmax(0, 1fr) 27px;
  gap: 2px;
  min-height: 44px;
  padding: 8px 2px 7px;
  border-bottom: 0;
  border-radius: 7px;
}
.task-row:hover { background: color-mix(in srgb, var(--surface-subtle) 72%, transparent); }
.task-row.selected,
.task-row.bulk-selected { background: var(--blue-soft); }
.task-chevron { display: none; }
.check-button { width: 21px; height: 21px; margin-top: 0; }
.check-visual { width: 16px; height: 16px; border-width: 1.5px; border-radius: 4px; }
.check-button:hover .check-visual { border-color: var(--blue); background: transparent; box-shadow: none; }
.task-title { font-size: 15px; font-weight: 540; line-height: 1.27; letter-spacing: -.008em; }
.task-notes-preview { margin-top: 1px; font-size: 13px; line-height: 1.3; }
.task-meta { gap: 6px; margin-top: 2px; font-size: 12px; line-height: 1.22; }
.meta-item svg { width: 12px; height: 12px; }
.tag-dot { display: none; }
.task-select { margin-top: -4px; }
.quick-add-row {
  grid-template-columns: 27px 1fr;
  gap: 2px;
  min-height: 42px;
  padding: 6px 2px;
  border-bottom: 0;
}
.quick-add-dot { width: 16px; height: 16px; border-radius: 4px; }
.section-add {
  min-height: 33px;
  padding: 5px 3px;
  border-bottom: 0;
  opacity: .43;
}
.section-add:hover { background: transparent; opacity: 1; }

.magic-add {
  left: max(24px, 4vw);
  bottom: 24px;
  width: 48px;
  height: 48px;
  background: var(--blue);
  box-shadow: 0 7px 20px color-mix(in srgb, var(--blue) 30%, transparent);
}

.app-shell.inspector-open { grid-template-columns: var(--sidebar-width) minmax(380px, 1fr) 0; }
.inspector {
  position: fixed;
  z-index: 40;
  top: 44px;
  right: 44px;
  bottom: 44px;
  width: min(580px, calc(100vw - var(--sidebar-width) - 88px));
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 28px 78px rgba(15, 18, 22, .22), 0 4px 17px rgba(15, 18, 22, .1);
  opacity: 0;
  transform: translateY(10px) scale(.986);
}
.inspector-open .inspector { opacity: 1; transform: translateY(0) scale(1); }
.inspector-scroll { padding: 24px 30px 32px; }
.inspector-top { margin-bottom: 16px; background: var(--surface); }
.inspector-title { min-height: 38px; font-size: 23px; font-weight: 680; }
.inspector-notes { min-height: 72px; margin-top: 8px; color: var(--text); font-size: 14px; }
.note-tools { display: flex; gap: 14px; }
.detail-group { margin-top: 15px; padding-top: 13px; }
.detail-label { margin-bottom: 7px; text-transform: none; letter-spacing: 0; font-size: 12px; font-weight: 630; }
.schedule-chips { gap: 4px; }
.schedule-chips .chip { padding: 5px 8px; }
.inspector-actions { margin-top: 18px; }

@media (max-width: 1040px) {
  :root { --sidebar-width: 260px; }
  .content { padding-right: 48px; padding-left: 48px; }
  .inspector { right: 24px; width: min(540px, calc(100vw - var(--sidebar-width) - 48px)); }
}

@media (max-width: 820px) {
  :root { --sidebar-width: 286px; }
  .app-shell,
  .app-shell.inspector-open { display: block; }
  .sidebar { width: min(300px, 82vw); }
  .window-bar { height: 52px; padding: 6px 8px; }
  .sidebar-nav { padding: 4px 8px 14px; }
  .nav-list + .nav-list { margin-top: 14px; }
  .nav-section-title { padding: 4px 9px 5px; }
  .nav-item { min-height: 38px; padding: 5px 9px; font-size: 15px; }
  .sidebar-footer { min-height: 50px; padding: 5px 9px 6px 12px; }
  .mobile-header {
    height: calc(52px + var(--safe-area-top));
    padding: calc(4px + var(--safe-area-top)) 6px 4px;
    border-bottom: 0;
    background: color-mix(in srgb, var(--surface) 94%, transparent);
  }
  .mobile-brand { opacity: 0; pointer-events: none; }
  .mobile-header .icon-button { width: 42px; height: 42px; }
  .content {
    padding: calc(72px + var(--safe-area-top)) 20px calc(82px + var(--safe-area-bottom));
  }
  .content-inner { max-width: 680px; }
  .view-header { margin-bottom: 22px; padding: 0; }
  .view-title-row { gap: 8px; }
  .view-icon { width: 26px; height: 26px; }
  .view-title-row h1 { font-size: 33px; }
  .view-subtitle,
  .content-inner:has(.progress-line) .view-subtitle { display: none; }
  .filter-bar {
    flex-wrap: nowrap;
    margin-top: 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filter-bar::-webkit-scrollbar { display: none; }
  .calendar-strip { margin-bottom: 24px; }
  .section { margin-top: 25px; }
  .section-header { min-height: 27px; padding-bottom: 4px; }
  .task-row {
    grid-template-columns: 29px minmax(0, 1fr);
    gap: 0;
    min-height: 45px;
    padding: 7px 1px 6px;
  }
  .task-main { min-height: 32px; }
  .check-button { width: 40px; height: 40px; margin: -9px 0 -9px -10px; }
  .check-visual { width: 17px; height: 17px; }
  .task-select {
    position: absolute;
    top: 5px;
    right: 0;
    display: grid;
    width: 38px;
    height: 38px;
    margin: 0;
    opacity: .22;
  }
  .task-row:focus-within .task-select,
  .task-select.active { opacity: 1; }
  .task-main { padding-right: 34px; }
  .task-title { font-size: 16px; }
  .task-notes-preview { font-size: 13px; }
  .task-meta { font-size: 12px; }
  .section-add { display: none; }
  .quick-add-row { min-height: 44px; padding: 6px 1px; border-bottom: 0; }
  .empty-state { display: none; }
  .magic-add {
    top: auto;
    right: 20px;
    bottom: calc(20px + var(--safe-area-bottom));
    left: auto;
    width: 52px;
    height: 52px;
    box-shadow: 0 8px 23px color-mix(in srgb, var(--blue) 38%, transparent);
  }
  .inspector {
    position: fixed;
    inset: 0 0 0 auto;
    width: min(430px, 100vw);
    border: 0;
    border-radius: 0;
    box-shadow: var(--shadow);
    opacity: 1;
    transform: translateX(102%);
  }
  .inspector-open .inspector { transform: translateX(0); }
  .inspector-scroll {
    padding: calc(14px + var(--safe-area-top)) 18px calc(22px + var(--safe-area-bottom));
  }
  .inspector-top { margin: 0 0 10px; padding: 0 0 4px; }
  .inspector-title { min-height: 36px; font-size: 22px; line-height: 1.2; }
  .inspector-notes { min-height: 58px; margin-top: 5px; resize: none; font-size: 15px; line-height: 1.4; }
  .note-tools { min-height: 28px; gap: 12px; }
  .markdown-toggle { min-height: 28px; font-size: 11px; }
  .detail-group {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 6px 10px;
    align-items: center;
    margin-top: 0;
    padding: 10px 0;
  }
  .detail-label { grid-column: 1; margin: 0; font-size: 12px; }
  .detail-group > :not(.detail-label) { grid-column: 2; }
  .schedule-chips {
    flex-wrap: nowrap;
    gap: 3px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .schedule-chips::-webkit-scrollbar { display: none; }
  .schedule-chips .chip { min-height: 34px; padding: 4px 8px; white-space: nowrap; }
  .detail-row:has(.inline-add) { grid-template-columns: minmax(0, 1fr) auto; margin-top: 0 !important; }
  .detail-select,
  .detail-input,
  .tag-picker summary { min-height: 38px; height: 38px; font-size: 15px; }
  .checklist { gap: 2px; }
  .checklist-item { min-height: 38px; }
  .checklist-item input[type="text"] { min-height: 36px; font-size: 15px; }
  .checklist-add { min-height: 30px; margin-top: 2px; }
  .repeat-grid { grid-template-columns: 1fr 1fr; }
  .inspector-actions { gap: 5px; margin-top: 12px; padding-top: 2px; }
  .inspector-actions .button,
  .inspector-actions .danger-button { min-height: 36px; padding: 6px 9px; font-size: 12px; }
}

@media (max-width: 520px) {
  .content { padding-right: 16px; padding-left: 16px; }
  .calendar-strip { margin-right: -2px; margin-left: -2px; padding: 9px 10px; }
  .calendar-event { grid-template-columns: 59px 3px minmax(0, 1fr); }
  .section-header h2 { font-size: 14px; }
  .inspector-scroll { padding-right: 15px; padding-left: 15px; }
  .detail-group { grid-template-columns: 72px minmax(0, 1fr); gap: 5px 8px; }
}
`;
