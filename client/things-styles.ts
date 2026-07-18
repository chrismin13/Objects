export const thingsStyles = `
:root {
  --sidebar-width: 268px;
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

body { font-size: 14px; }

.sidebar {
  border-right-color: var(--border);
  background: color-mix(in srgb, var(--sidebar) 91%, transparent);
  backdrop-filter: blur(24px) saturate(1.15);
}
.window-bar { height: 58px; padding: 17px 10px 7px 12px; gap: 4px; }
.window-bar-spacer { flex: 1; }
.window-actions { display: flex; align-items: center; gap: 0; flex: none; }
#search-button { width: 30px; opacity: .72; }
.space-settings-button { position: relative; width: 28px; }
.space-settings-button.schedule-enabled { color: var(--blue); }
.space-settings-button.schedule-enabled::after { content: ''; position: absolute; top: 5px; right: 4px; width: 5px; height: 5px; border: 1px solid var(--sidebar); border-radius: 50%; background: var(--green); }
.space-controls { min-width: 0; flex: 1; }
.space-pill { min-width: 0; height: 30px; display: flex; align-items: stretch; padding: 2px; border: 1px solid var(--border-strong); border-radius: 9px; background: color-mix(in srgb, var(--surface-subtle) 52%, transparent); }
.space-segment { min-width: 0; flex: 1 1 auto; padding: 3px 7px; overflow: hidden; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; font-size: 11.5px; font-weight: 590; text-overflow: ellipsis; white-space: nowrap; }
.space-segment:hover { color: var(--text); }
.space-segment.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
[data-theme="dark"] .space-segment.active { background: #393a3e; }
.space-overflow { max-width: 34px; flex-basis: 34px; }
.space-title-dot { width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--space-color); }
.sidebar-nav { padding: 4px 10px 20px; }
.nav-list { gap: 0; }
.nav-list + .nav-list { margin-top: 17px; }
.nav-section-title {
  padding: 5px 10px 7px;
  font-size: 10px;
  font-weight: 670;
  letter-spacing: .065em;
}
.nav-item {
  min-height: 31px;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 490;
  letter-spacing: -.01em;
}
.nav-item:hover { background: color-mix(in srgb, var(--surface-hover) 82%, transparent); }
.nav-item.active { background: #dfe1e5; box-shadow: none; }
[data-theme="dark"] .nav-item.active { background: #303135; }
.nav-item svg { width: 17px; height: 17px; stroke-width: 2; }
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
.nav-area-icon { color: #a7adb2 !important; stroke-width: 1.65 !important; }
.nav-count { font-size: 12px; }
.sidebar-footer { min-height: 48px; padding: 6px 10px 7px 14px; }
.quiet-button { font-size: 13px; }
#theme-button { display: none; }

.content { padding: 78px clamp(44px, 6vw, 72px) 82px; }
.content-inner { max-width: 760px; }
.view-header { margin-bottom: 24px; }
.eyebrow { display: none; }
.view-title-row { gap: 10px; }
.view-icon { width: 27px; height: 27px; color: var(--blue); stroke-width: 1.9; }
.content-inner[data-view-type="today"] .view-icon { color: var(--yellow); fill: currentColor; }
.content-inner[data-view-type="upcoming"] .view-icon { color: var(--red); }
.content-inner[data-view-type="anytime"] .view-icon { color: #3bb6a8; }
.content-inner[data-view-type="someday"] .view-icon { color: #b9a65d; }
.content-inner[data-view-type="logbook"] .view-icon { color: var(--green); }
.content-inner[data-view-type="trash"] .view-icon { color: #9a9ca0; }
.view-title-row h1 {
  font-size: clamp(30px, 3vw, 35px);
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: -.038em;
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
.filter-bar { gap: 3px; margin: 18px 0 0; }
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
  margin: 0 0 30px;
  padding: 8px 12px;
  border-radius: 9px;
  background: #f1f2f3;
}
[data-theme="dark"] .calendar-strip { background: var(--surface-subtle); }
.calendar-event {
  grid-template-columns: 66px 3px minmax(0, 1fr);
  gap: 9px;
  min-height: 32px;
}
.calendar-time { color: var(--blue); font-size: 13px; }
.calendar-line { height: 21px; }
.calendar-title { font-size: 14px; }
.calendar-name { margin-top: 0; font-size: 11px; }

.section { margin-top: 28px; }
.section:first-of-type { margin-top: 0; }
.section-header {
  min-height: 27px;
  padding: 0 2px 4px;
  border-bottom-color: var(--border);
}
.section-header h2 { font-size: 14px; font-weight: 680; letter-spacing: -.012em; }
.section-header.heading-header h2 { color: #1877b9; }
.section-header .section-meta { font-size: 12px; }
.section-header .section-symbol { margin-left: 0; color: #76a4ce; font-size: 15px; }

.task-row {
  grid-template-columns: 24px minmax(0, 1fr) 25px;
  gap: 2px;
  min-height: 39px;
  padding: 6px 2px 5px;
  border-bottom: 0;
  border-radius: 7px;
}
.task-row:hover { background: color-mix(in srgb, var(--surface-subtle) 72%, transparent); }
.task-row.selected,
.task-row.bulk-selected { background: var(--blue-soft); }
.task-chevron { display: none; }
.check-button { width: 19px; height: 19px; margin-top: 0; }
.check-visual { width: 15px; height: 15px; border-width: 1.35px; border-radius: 3.5px; }
.check-button:hover .check-visual { border-color: var(--blue); background: transparent; box-shadow: none; }
.task-title { font-size: 14px; font-weight: 520; line-height: 1.25; letter-spacing: -.006em; }
.task-notes-preview { margin-top: 1px; font-size: 12px; line-height: 1.25; }
.task-meta { gap: 5px; margin-top: 1px; font-size: 11px; line-height: 1.2; }
.meta-item svg { width: 12px; height: 12px; }
.tag-dot { display: none; }
.task-select { margin-top: -4px; }
.quick-add-row {
  grid-template-columns: 24px 1fr;
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
  left: 50%;
  bottom: 7px;
  width: 38px;
  height: 38px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text);
  box-shadow: none;
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}
.magic-add:hover { border-color: var(--border); background: var(--surface-subtle); box-shadow: none; transform: translateX(-50%) scale(1.04); }
.magic-add:active { transform: translateX(-50%) scale(.94); }
.magic-add.dragging { transform: translateX(-50%) scale(.92); }
.magic-add svg { width: 19px; height: 19px; stroke-width: 1.65; }

.app-shell.inspector-open { grid-template-columns: var(--sidebar-width) minmax(380px, 1fr) 0; }
.inspector {
  position: fixed;
  z-index: 40;
  top: 44px;
  right: 44px;
  bottom: 44px;
  width: min(520px, calc(100vw - var(--sidebar-width) - 88px));
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

.space-switcher-backdrop { padding: 18px; }
.space-switcher-modal { width: min(560px, 100%); overflow: hidden; }
.space-switcher-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 26px 28px 15px;
}
.space-switcher-header h2 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: -.02em; }
.space-switcher-header p { margin: 8px 0 0; color: var(--muted); line-height: 1.45; }
.space-switcher-header .icon-button { flex: none; margin: -6px -8px 0 0; }
.space-switcher-list { max-height: min(52vh, 430px); display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 8px 18px 20px; overflow-y: auto; }
.space-switcher-item { width: 100%; min-height: 50px; display: flex; align-items: center; gap: 12px; padding: 9px 13px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; transition: background .15s ease, color .15s ease; }
.space-switcher-item:hover { background: color-mix(in srgb, var(--surface-subtle) 65%, transparent); }
.space-switcher-item.active { background: var(--surface-subtle); }
.space-switcher-item > i { width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--space-color); }
.space-switcher-item > span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.space-switcher-item svg { width: 17px; height: 17px; flex: none; color: var(--blue); }
.space-switcher-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-top: 1px solid var(--border); }
.space-switcher-footer .button { min-height: 40px; }
.space-switcher-manage { display: inline-flex; align-items: center; gap: 8px; }
.space-switcher-manage svg { width: 17px; height: 17px; flex: none; }
.space-switcher-done { min-width: 88px; }
.mobile-only { display: none; }
.space-settings-backdrop { padding: 20px; }
.space-settings-modal {
  width: min(1260px, calc(100vw - 40px));
  max-height: calc(100dvh - 40px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}
.space-settings-header {
  position: relative;
  padding: 28px 36px 18px;
  border-bottom: 1px solid transparent;
}
.space-settings-header h2 { margin: 0; font-size: 28px; line-height: 1.15; letter-spacing: -.025em; }
.space-settings-header p { margin: 8px 0 0; color: var(--muted); line-height: 1.45; }
.space-settings-back {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 40px;
  height: 40px;
}
.space-settings-back span { place-items: center; }
.space-settings-back .desktop-only { display: grid; }
.space-settings-back .mobile-only { display: none; }
.space-settings-body { min-height: 0; padding: 0 36px 30px; overflow-y: auto; }
.space-settings-section { padding: 22px 0 24px; border-bottom: 1px solid var(--border); }
.space-settings-section:last-child { border-bottom: 0; }
.space-settings-section h3 { margin: 0 0 16px; font-size: 18px; letter-spacing: -.01em; }
.space-settings-section > p { margin: 13px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
.space-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.space-editor-card,
.space-add-card {
  min-width: 0;
  min-height: 132px;
  padding: 17px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface);
}
.space-editor-card { display: grid; grid-template-columns: 40px minmax(0, 1fr) 36px; gap: 18px 10px; align-items: center; }
.space-color-input { width: 40px; height: 40px; padding: 3px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface); cursor: pointer; }
.space-title-input { min-width: 0; height: 40px; font-size: 15px; }
.space-delete { grid-column: 3; grid-row: 1; width: 36px; height: 36px; color: var(--muted); }
.space-delete:hover { color: var(--red); }
.space-delete:disabled { opacity: .3; cursor: not-allowed; }
.space-pin { grid-column: 1 / -1; align-self: flex-start; display: flex; align-items: center; gap: 8px; color: var(--text); font-size: 13px; cursor: pointer; }
.space-pin input { width: 17px; height: 17px; margin: 0; accent-color: var(--blue); }
.space-pin input:disabled { cursor: not-allowed; opacity: .55; }
.space-pin-short { display: none; }
.space-add-card { display: grid; place-items: center; align-content: center; gap: 9px; border-style: dashed; color: var(--muted); cursor: pointer; }
.space-add-card:hover { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.space-add-card svg { width: 24px; height: 24px; }
.space-pin-usage { text-align: right; }
.space-default-controls { display: flex; align-items: center; gap: clamp(34px, 8vw, 110px); padding: 8px 16px 4px; }
.space-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; white-space: nowrap; }
.space-toggle input { position: absolute; opacity: 0; pointer-events: none; }
.space-toggle > span { position: relative; width: 46px; height: 27px; border-radius: 99px; background: var(--faint); transition: background .18s ease; }
.space-toggle > span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .18s var(--ease); }
.space-toggle input:checked + span { background: var(--blue); }
.space-toggle input:checked + span::after { transform: translateX(19px); }
.space-toggle input:focus-visible + span { outline: 2px solid var(--blue); outline-offset: 2px; }
.space-toggle b { font-weight: 560; }
.space-default-choice { display: flex; align-items: center; gap: 14px; }
.space-default-choice > span { white-space: nowrap; }
.space-default-choice .detail-select { min-width: 200px; height: 40px; }
.space-rules { display: flex; flex-direction: column; gap: 10px; }
.space-launch-rule {
  display: grid;
  grid-template-columns: auto minmax(360px, 1fr) auto 38px;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.space-rule-main,
.space-rule-days,
.space-rule-times,
.space-rule-times label { display: flex; align-items: center; gap: 9px; }
.space-rule-main > span,
.space-rule-field-label,
.space-rule-times label > span { color: var(--text); white-space: nowrap; }
.space-rule-main .detail-select { width: 168px; height: 40px; }
.space-rule-days { min-width: 0; }
.space-rule-days .weekday-row { width: 100%; display: grid; grid-template-columns: repeat(7, minmax(42px, 1fr)); gap: 0; margin: 0; }
.space-rule-days .chip { width: auto; min-width: 0; height: 40px; padding: 0 8px; border-radius: 0; border-right-width: 0; background: var(--surface); }
.space-rule-days .chip:first-child { border-radius: 8px 0 0 8px; }
.space-rule-days .chip:last-child { border-right-width: 1px; border-radius: 0 8px 8px 0; }
.space-rule-days .chip.active { position: relative; z-index: 1; border-right-width: 1px; background: var(--blue-soft); }
.space-rule-days .chip.active + .chip { border-left-width: 0; }
.weekday-short { display: none; }
.space-rule-times { gap: 10px; }
.space-rule-times label { gap: 7px; }
.space-rule-times .detail-input { width: 108px; height: 40px; font-variant-numeric: tabular-nums; }
.space-rule-delete { width: 38px; height: 38px; }
.space-rule-delete:hover { color: var(--red); }
.space-add-rule { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; }
.space-add-rule svg { width: 17px; height: 17px; }
.space-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 36px calc(14px + var(--safe-area-bottom));
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  backdrop-filter: blur(14px);
}
.space-settings-footer .button { min-height: 42px; padding-right: 22px; padding-left: 22px; }

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
  .window-bar { height: 52px; padding: 6px 7px; gap: 3px; }
  .space-segment { padding-right: 6px; padding-left: 6px; }
  .space-settings-button { width: 30px; }
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
    opacity: 0;
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
    border: 0;
    border-radius: 50%;
    background: var(--blue);
    color: #fff;
    box-shadow: 0 8px 23px color-mix(in srgb, var(--blue) 38%, transparent);
    transform: none;
  }
  .magic-add:hover { border: 0; background: var(--blue); box-shadow: 0 10px 26px color-mix(in srgb, var(--blue) 42%, transparent); transform: translateY(-1px) scale(1.03); }
  .magic-add:active,
  .magic-add.dragging { transform: scale(.94); }
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
  .space-manager-row { grid-template-columns: 34px minmax(0, 1fr) 48px 32px; }
  .space-rule-top { grid-template-columns: 1fr 30px; }
  .space-rule-times { grid-column: 1 / -1; grid-row: 2; }
  .space-rule-times .detail-input { flex: 1; width: auto; }
}

@media (max-width: 520px) {
  .content { padding-right: 16px; padding-left: 16px; }
  .calendar-strip { margin-right: -2px; margin-left: -2px; padding: 9px 10px; }
  .calendar-event { grid-template-columns: 64px 3px minmax(0, 1fr); }
  .section-header h2 { font-size: 14px; }
  .inspector-scroll { padding-right: 15px; padding-left: 15px; }
  .detail-group { grid-template-columns: 72px minmax(0, 1fr); gap: 5px 8px; }
}

@media (max-width: 1180px) {
  .space-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .space-launch-rule { grid-template-columns: minmax(0, 1fr) 38px; }
  .space-rule-main { grid-column: 1; }
  .space-rule-delete { grid-column: 2; grid-row: 1; }
  .space-rule-days,
  .space-rule-times { grid-column: 1 / -1; }
}

@media (max-width: 820px) {
  .space-switcher-backdrop {
    padding-top: calc(12px + var(--safe-area-top));
    padding-bottom: calc(12px + var(--safe-area-bottom));
  }
  .space-switcher-modal { max-height: calc(100dvh - 24px - var(--safe-area-top) - var(--safe-area-bottom)); }
  .space-switcher-header { padding: 23px 22px 13px; }
  .space-switcher-header h2 { font-size: 23px; }
  .space-switcher-header p { font-size: 13px; }
  .space-switcher-header .icon-button { width: 44px; height: 44px; margin: -9px -10px 0 0; }
  .space-switcher-list { max-height: min(55dvh, 430px); padding: 7px 12px 17px; }
  .space-switcher-item { min-height: 52px; padding-right: 12px; padding-left: 12px; }
  .space-switcher-item > span { font-size: 16px; }
  .space-switcher-footer { padding: 12px 12px calc(12px + var(--safe-area-bottom)); }
  .space-switcher-footer .button { min-height: 44px; }
  .space-settings-backdrop { padding: 0; }
  .space-settings-modal {
    width: 100vw;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .space-settings-header {
    min-height: calc(68px + var(--safe-area-top));
    padding: calc(18px + var(--safe-area-top)) 50px 14px;
    border-bottom-color: var(--border);
    text-align: center;
  }
  .space-settings-header h2 { font-size: 21px; }
  .space-settings-header p {
    margin: 28px -32px 0;
    color: var(--muted);
    font-size: 14px;
    text-align: left;
  }
  .space-settings-back {
    top: calc(12px + var(--safe-area-top));
    right: auto;
    left: 6px;
    width: 44px;
    height: 44px;
    color: var(--blue);
  }
  .desktop-only { display: none !important; }
  .space-settings-back .mobile-only { display: grid; }
  .space-settings-body { padding: 0 16px 28px; }
  .space-settings-section { padding: 22px 0; }
  .space-settings-section h3 { margin-bottom: 14px; font-size: 19px; }
  .space-card-grid { grid-template-columns: 1fr; gap: 8px; }
  .space-editor-card {
    min-height: 76px;
    grid-template-columns: 44px minmax(0, 1fr) auto 44px;
    gap: 8px;
    padding: 11px 10px;
  }
  .space-color-input { width: 44px; height: 44px; }
  .space-title-input { height: 44px; font-size: 16px; }
  .space-pin { grid-column: 3; align-self: center; min-height: 44px; }
  .space-pin-long { display: none; }
  .space-pin-short { display: inline; }
  .space-pin input { width: 20px; height: 20px; }
  .space-delete { grid-column: 4; grid-row: 1; width: 44px; height: 44px; }
  .space-add-card { min-height: 54px; padding: 10px; display: flex; justify-content: center; gap: 10px; }
  .space-pin-usage { text-align: left; font-size: 13px !important; }
  .space-default-controls { flex-direction: column; align-items: stretch; gap: 16px; padding: 4px 2px 2px; }
  .space-toggle { min-height: 44px; }
  .space-default-choice { min-height: 44px; justify-content: space-between; }
  .space-default-choice > span { white-space: normal; }
  .space-default-choice .detail-select { min-width: 0; width: min(190px, 52vw); height: 44px; }
  .space-default-section > p { font-size: 13px; }
  .space-launch-rule {
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 14px 8px;
    padding: 14px 12px;
    border-color: var(--border-strong);
    border-radius: 11px;
  }
  .space-rule-main { min-width: 0; gap: 10px; }
  .space-rule-main > span { font-size: 15px; }
  .space-rule-main .detail-select { min-width: 0; width: min(230px, 50vw); height: 44px; font-size: 16px; }
  .space-rule-delete { width: 44px; height: 44px; }
  .space-rule-days { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 8px; }
  .space-rule-days { grid-row: 2; }
  .space-rule-days .weekday-row { grid-template-columns: repeat(7, minmax(38px, 1fr)); }
  .space-rule-days .chip { height: 44px; padding: 0; font-size: 15px; }
  .space-rule-field-label { text-transform: capitalize; }
  .weekday-long { display: none; }
  .weekday-short { display: inline; }
  .space-rule-times { grid-row: 3; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .space-rule-times label { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; }
  .space-rule-times label > span { text-transform: capitalize; }
  .space-rule-times .detail-input { width: 100%; height: 44px; font-size: 16px; }
  .space-add-rule { width: 100%; min-height: 48px; justify-content: center; margin-top: 12px; }
  .space-settings-footer { display: grid; grid-template-columns: 1fr 1.35fr; padding: 12px 16px calc(12px + var(--safe-area-bottom)); }
  .space-settings-footer .button { min-height: 48px; font-size: 15px; }
}

@media (max-width: 430px) {
  .space-settings-header h2 { font-size: 20px; }
  .space-settings-body { padding-right: 12px; padding-left: 12px; }
  .space-editor-card { grid-template-columns: 42px minmax(0, 1fr) auto 42px; padding-right: 6px; padding-left: 8px; }
  .space-color-input { width: 42px; height: 42px; }
  .space-pin { gap: 5px; font-size: 13px; }
  .space-delete { width: 42px; height: 42px; }
  .space-rule-main > span { font-size: 14px; }
  .space-rule-main .detail-select { width: min(205px, 49vw); }
  .space-rule-days { grid-template-columns: 44px minmax(0, 1fr); }
  .space-rule-days .weekday-row { grid-template-columns: repeat(7, minmax(34px, 1fr)); }
  .space-rule-times label { grid-template-columns: 42px minmax(0, 1fr); }
}
`;
