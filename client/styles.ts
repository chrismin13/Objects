export const styles = `
* { box-sizing: border-box; }
[hidden] { display: none !important; }

html, body { width: 100%; min-height: 100%; margin: 0; }

body {
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

button, input, textarea, select { font: inherit; color: inherit; }
button { -webkit-tap-highlight-color: transparent; }

.auth-screen {
  width: 100vw;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 32px 18px;
  overflow-y: auto;
  background:
    radial-gradient(circle at 15% 18%, color-mix(in srgb, var(--blue) 10%, transparent), transparent 34%),
    radial-gradient(circle at 88% 84%, color-mix(in srgb, var(--yellow) 11%, transparent), transparent 31%),
    var(--bg);
}
.auth-card { width: min(430px, 100%); padding: 34px; border: 1px solid var(--border); border-radius: 20px; background: color-mix(in srgb, var(--surface) 94%, transparent); box-shadow: var(--shadow); }
.auth-mark { width: 48px; height: 48px; display: grid; gap: 4px; padding: 10px; border-radius: 14px; background: var(--text); }
.auth-mark span { display: block; height: 3px; border-radius: 9px; background: var(--surface); }
.auth-mark span:nth-child(1) { width: 72%; }
.auth-mark span:nth-child(2) { width: 100%; }
.auth-mark span:nth-child(3) { width: 54%; }
.auth-brand { margin: 20px 0 7px; color: var(--muted); font-size: 12px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.auth-card h1 { font-size: 30px; }
.auth-copy { margin: 9px 0 24px; color: var(--muted); line-height: 1.5; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 10px; background: var(--surface-subtle); }
.auth-tab { min-height: 36px; padding: 6px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer; }
.auth-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); font-weight: 650; }
.auth-form { margin-top: 8px; }
.auth-hint { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
.auth-error { min-height: 18px; margin: 12px 0 0; color: var(--red); font-size: 12px; line-height: 1.45; }
.auth-submit { width: 100%; min-height: 43px; margin-top: 8px; }
.auth-submit:disabled { opacity: .62; cursor: wait; }
.auth-footnote { margin: 18px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; text-align: center; }

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(360px, 1fr) 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  transition: grid-template-columns .35s var(--ease);
}

.app-shell.inspector-open { grid-template-columns: var(--sidebar-width) minmax(360px, 1fr) var(--inspector-width); }

.sidebar {
  position: relative;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  user-select: none;
}

.window-bar {
  height: 62px;
  padding: 16px 14px 8px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.icon-button, .quiet-button, .magic-add {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.icon-button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--muted);
}
.icon-button:hover { background: var(--surface-hover); color: var(--text); }
.icon-button svg { width: 18px; height: 18px; }
.sidebar-close { display: none; }

.sidebar-nav { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 10px 24px; scrollbar-width: thin; }
.nav-list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.nav-list + .nav-list { margin-top: 19px; }
.nav-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 11px 6px 13px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.nav-item {
  width: 100%;
  min-height: 35px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.nav-item:hover { background: color-mix(in srgb, var(--surface-hover) 72%, transparent); }
.nav-item.active { background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.nav-item svg { width: 17px; height: 17px; color: var(--muted); flex: none; }
.nav-item.active svg { color: var(--blue); }
.nav-item .nav-symbol { width: 17px; text-align: center; color: var(--muted); font-size: 15px; }
.nav-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.nav-count { min-width: 20px; color: var(--muted); font-size: 12px; text-align: right; }
.nav-progress { width: 16px; height: 16px; position: relative; flex: none; }
.nav-progress svg { width: 16px; height: 16px; transform: rotate(-90deg); }
.nav-progress circle { fill: none; stroke-width: 2; }
.nav-progress .track { stroke: var(--border-strong); }
.nav-progress .value { stroke: var(--blue); stroke-linecap: round; }

.sidebar-footer {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 13px 12px 16px;
  border-top: 1px solid var(--border);
}
.sidebar-tools { display: flex; align-items: center; gap: 2px; }
.quiet-button { display: flex; align-items: center; gap: 8px; padding: 8px 9px; border-radius: 8px; color: var(--muted); }
.quiet-button:hover { background: var(--surface-hover); color: var(--text); }
.quiet-button svg { width: 16px; height: 16px; }

.main-pane { position: relative; min-width: 0; overflow: hidden; background: var(--surface); }
.content { width: 100%; height: 100%; overflow-y: auto; padding: 72px clamp(30px, 7vw, 92px) 110px; scrollbar-width: thin; }
.content-inner { max-width: 720px; margin: 0 auto; }
.mobile-header { display: none; }

.view-header { margin-bottom: 30px; }
.eyebrow { margin-bottom: 6px; color: var(--muted); font-size: 13px; font-weight: 500; }
.view-title-row { display: flex; align-items: center; gap: 12px; }
.view-icon { width: 27px; height: 27px; color: var(--blue); }
h1 { margin: 0; font-size: clamp(30px, 4vw, 38px); line-height: 1.08; letter-spacing: -.035em; font-weight: 750; }
.view-subtitle { max-width: 560px; margin: 10px 0 0; color: var(--muted); line-height: 1.5; }
.header-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }

.progress-line { height: 3px; margin-top: 20px; border-radius: 10px; background: var(--surface-subtle); overflow: hidden; }
.progress-line span { display: block; height: 100%; border-radius: inherit; background: var(--blue); transition: width .35s var(--ease); }

.filter-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 20px 0 4px; }
.filter-bar .chip { padding: 5px 9px; }

.calendar-strip { margin: 4px 0 32px; padding: 0 7px; }
.calendar-event { display: grid; grid-template-columns: 54px 3px minmax(0, 1fr); gap: 12px; align-items: center; min-height: 43px; color: var(--muted); }
.calendar-time { font-variant-numeric: tabular-nums; font-size: 12px; text-align: right; }
.calendar-line { width: 3px; height: 27px; border-radius: 4px; background: var(--blue); opacity: .65; }
.calendar-title { color: var(--text); }
.calendar-name { margin-top: 2px; color: var(--muted); font-size: 11px; }

.section { margin-top: 30px; }
.section:first-of-type { margin-top: 0; }
.section-header { display: flex; align-items: baseline; gap: 8px; min-height: 30px; padding: 0 8px 5px; border-bottom: 1px solid var(--border); }
.section-header h2 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .01em; }
.section-header .section-meta { color: var(--muted); font-size: 12px; }
.section-header .section-symbol { margin-left: auto; color: var(--faint); }
.section-header.heading-header { border-bottom: 0; padding-top: 5px; }
.heading-actions { margin-left: auto; display: flex; opacity: 0; }
.section-header:hover .heading-actions { opacity: 1; }
.heading-actions button { width: 26px; height: 26px; }

.task-list { list-style: none; padding: 0; margin: 0; }
.task-row {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: start;
  min-height: 48px;
  padding: 11px 7px 9px;
  border-bottom: 1px solid var(--border);
  border-radius: 6px 6px 0 0;
  cursor: default;
  transition: background .15s ease, opacity .2s ease, transform .2s ease;
}
.task-row:hover { background: color-mix(in srgb, var(--surface-subtle) 55%, transparent); }
.task-row.selected { background: var(--blue-soft); }
.task-row.dragging { opacity: .35; }
.task-row.drag-over { box-shadow: inset 0 2px 0 var(--blue); }
.section.drop-target { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--blue) 45%, transparent); border-radius: 8px; }
.task-row.completing { opacity: 0; transform: translateX(8px); }
.check-button {
  width: 19px;
  height: 19px;
  margin-top: 1px;
  border: 1.5px solid var(--faint);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  color: transparent;
  display: grid;
  place-items: center;
  transition: all .18s var(--ease);
}
.check-button:hover { border-color: var(--blue); box-shadow: inset 0 0 0 3px var(--surface); background: var(--blue-soft); }
.check-button.checked { border-color: var(--blue); background: var(--blue); color: #fff; }
.check-button svg { width: 12px; height: 12px; stroke-width: 3; }
.task-main { min-width: 0; }
.task-title { display: block; line-height: 1.35; overflow-wrap: anywhere; }
.task-row.completed .task-title { color: var(--muted); text-decoration: line-through; }
.task-notes-preview { margin-top: 3px; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 5px; color: var(--muted); font-size: 11px; }
.meta-item { display: inline-flex; align-items: center; gap: 3px; }
.meta-item svg { width: 12px; height: 12px; }
.meta-item.deadline { color: var(--red); }
.meta-item.reminder { color: var(--blue); }
.tag-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--faint); }
.today-star { color: var(--yellow); width: 15px; height: 15px; margin-top: 2px; }
.task-chevron { width: 16px; height: 16px; color: var(--faint); margin-top: 2px; opacity: 0; }
.task-row:hover .task-chevron, .task-row.selected .task-chevron { opacity: 1; }

.quick-add-row { display: grid; grid-template-columns: 26px 1fr; gap: 7px; align-items: center; min-height: 48px; padding: 8px 7px; border-bottom: 1px solid var(--border); }
.quick-add-row[hidden], .section-add[hidden] { display: none; }
.quick-add-dot { width: 19px; height: 19px; border: 1.5px solid var(--faint); border-radius: 50%; opacity: .45; }
.quick-add-input { width: 100%; padding: 7px 0; border: 0; outline: 0; background: transparent; }
.quick-add-input::placeholder { color: var(--faint); }
.section-add { width: 100%; min-height: 42px; display: flex; align-items: center; gap: 14px; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--faint); cursor: pointer; text-align: left; }
.section-add:hover { color: var(--blue); background: color-mix(in srgb, var(--surface-subtle) 45%, transparent); }
.section-add svg { width: 17px; height: 17px; }

.empty-state { padding: 64px 20px; text-align: center; color: var(--muted); }
.empty-state svg { width: 42px; height: 42px; margin-bottom: 16px; color: var(--faint); }
.empty-state h2 { margin: 0 0 8px; color: var(--text); font-size: 18px; }
.empty-state p { max-width: 360px; margin: 0 auto; line-height: 1.55; }

.magic-add {
  position: absolute;
  z-index: 8;
  left: clamp(23px, 4vw, 54px);
  bottom: 28px;
  width: 49px;
  height: 49px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  box-shadow: 0 8px 23px color-mix(in srgb, var(--blue) 35%, transparent);
  transition: transform .2s var(--ease), box-shadow .2s ease;
}
.magic-add:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 11px 27px color-mix(in srgb, var(--blue) 42%, transparent); }
.magic-add:active { transform: scale(.95); }
.magic-add svg { width: 23px; height: 23px; stroke-width: 2.4; }

.inspector {
  position: relative;
  z-index: 12;
  width: var(--inspector-width);
  overflow: hidden;
  background: var(--bg);
  border-left: 1px solid var(--border);
  opacity: 0;
  transform: translateX(18px);
  pointer-events: none;
  transition: opacity .25s ease, transform .35s var(--ease);
}
.inspector-open .inspector { opacity: 1; transform: translateX(0); pointer-events: auto; }
.inspector-scroll { height: 100%; overflow-y: auto; padding: 23px 24px 30px; }
.inspector-top { position: sticky; z-index: 3; top: 0; display: flex; align-items: center; justify-content: space-between; margin: -1px -2px 26px; padding: 1px 2px 8px; background: var(--bg); }
.inspector-status { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.inspector-title {
  width: 100%;
  min-height: 44px;
  padding: 0;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -.02em;
}
.inspector-notes { width: 100%; min-height: 110px; margin-top: 14px; padding: 0; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--muted); line-height: 1.55; }
.inspector-notes::placeholder, .inspector-title::placeholder { color: var(--faint); }
.detail-group { margin-top: 22px; padding-top: 17px; border-top: 1px solid var(--border); }
.detail-label { display: block; margin-bottom: 9px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.detail-row { display: flex; gap: 8px; }
.detail-select, .detail-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  background: var(--surface);
}
.detail-select:focus, .detail-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 16%, transparent); }
.schedule-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 6px 10px; border: 1px solid var(--border-strong); border-radius: 99px; background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.chip:hover { color: var(--text); border-color: var(--faint); }
.chip.active { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
.inspector-actions { display: flex; gap: 8px; margin-top: 26px; }
.danger-button { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--red); cursor: pointer; }
.danger-button:hover { background: color-mix(in srgb, var(--red) 10%, transparent); }
.danger-button svg { width: 16px; height: 16px; }

.checklist { display: flex; flex-direction: column; gap: 5px; }
.checklist-item { display: grid; grid-template-columns: 18px 1fr 24px; gap: 7px; align-items: center; }
.checklist-item input[type="checkbox"] { accent-color: var(--blue); }
.checklist-item input[type="text"] { min-width: 0; padding: 6px 0; border: 0; border-bottom: 1px solid var(--border); outline: 0; background: transparent; }
.checklist-remove { width: 24px; height: 24px; border: 0; background: transparent; color: var(--faint); cursor: pointer; }
.checklist-add { align-self: flex-start; margin-top: 5px; padding: 5px 0; border: 0; background: transparent; color: var(--blue); cursor: pointer; font-size: 12px; }
.markdown-preview { min-height: 110px; margin-top: 14px; color: var(--muted); line-height: 1.55; }
.markdown-preview h1, .markdown-preview h2, .markdown-preview h3 { margin: 15px 0 6px; color: var(--text); font-size: 15px; letter-spacing: 0; }
.markdown-preview p { margin: 7px 0; }
.markdown-preview ul { margin: 7px 0; padding-left: 20px; }
.markdown-preview code { padding: 1px 4px; border-radius: 4px; background: var(--surface-subtle); color: var(--text); }
.markdown-toggle { padding: 4px 0; border: 0; background: transparent; color: var(--blue); cursor: pointer; font-size: 11px; }

.quick-find { width: 100%; }
.modal-header { display: flex; align-items: center; gap: 10px; padding: 15px 16px; border-bottom: 1px solid var(--border); }
.modal-header svg { width: 19px; height: 19px; color: var(--muted); }
.modal-search { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 16px; }
.key-hint { padding: 3px 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-subtle); color: var(--muted); font-size: 11px; }
.search-results { max-height: min(54vh, 470px); overflow-y: auto; padding: 8px; }
.search-result { width: 100%; display: flex; align-items: center; gap: 11px; padding: 10px; border: 0; border-radius: 9px; background: transparent; text-align: left; cursor: pointer; }
.search-result:hover, .search-result.focused { background: var(--surface-subtle); }
.search-result svg { width: 18px; height: 18px; color: var(--muted); flex: none; }
.search-result-text { min-width: 0; flex: 1; }
.search-result-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result-meta { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }
.search-empty { padding: 38px 20px; color: var(--muted); text-align: center; }

.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 9px 0; }
.settings-row label { flex: 1; }
.settings-row input[type="checkbox"] { accent-color: var(--blue); }
.settings-row .detail-input { max-width: 210px; }
.button-row { display: flex; flex-wrap: wrap; gap: 8px; }
.hidden-file { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); opacity: 0; pointer-events: none; white-space: nowrap; }
.repeat-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.weekday-row { display: flex; gap: 4px; margin-top: 9px; }
.weekday-row .chip { width: 33px; padding-left: 0; padding-right: 0; text-align: center; }
.project-card-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.project-card { padding: 15px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); cursor: pointer; }
.project-card:hover { border-color: var(--border-strong); background: var(--surface-subtle); }
.project-card h2 { margin: 0 0 7px; font-size: 15px; }
.project-card p { margin: 0; color: var(--muted); font-size: 12px; }
.button { min-height: 36px; padding: 7px 14px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); cursor: pointer; }
.button:hover { background: var(--surface-subtle); }
.button.primary { border-color: var(--blue); background: var(--blue); color: white; }
.button.primary:hover { filter: brightness(1.04); }

.toast-region { position: fixed; z-index: 200; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast { display: flex; align-items: center; gap: 12px; min-width: 220px; padding: 10px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--text); color: var(--surface); box-shadow: 0 9px 30px rgba(0,0,0,.2); animation: toast-in .25s var(--ease) both; }
.toast { pointer-events: auto; }
.toast button { margin-left: auto; border: 0; background: transparent; color: inherit; font-weight: 700; cursor: pointer; }
.scrim { display: none; }

@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } }

@media (max-width: 1040px) {
  .app-shell.inspector-open { grid-template-columns: var(--sidebar-width) minmax(350px, 1fr) 310px; }
  :root { --inspector-width: 310px; }
  .content { padding-left: 44px; padding-right: 44px; }
}

@media (max-width: 820px) {
  .app-shell, .app-shell.inspector-open { display: block; }
  .sidebar { position: fixed; inset: 0 auto 0 0; width: min(310px, 86vw); transform: translateX(-102%); transition: transform .3s var(--ease); box-shadow: var(--shadow); }
  .app-shell.sidebar-open .sidebar { transform: translateX(0); }
  .sidebar-open .scrim { display: block; position: fixed; z-index: 15; inset: 0; background: rgba(0,0,0,.3); }
  .sidebar-close { display: grid; }
  .main-pane { width: 100%; height: 100%; }
  .mobile-header { position: absolute; z-index: 7; top: 0; left: 0; right: 0; height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 8px 13px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 87%, transparent); backdrop-filter: blur(14px); }
  .mobile-brand { font-weight: 700; letter-spacing: -.01em; }
  .content { padding: 84px 24px 110px; }
  .inspector { position: fixed; z-index: 30; inset: 0 0 0 auto; width: min(390px, 100vw); transform: translateX(102%); opacity: 1; box-shadow: var(--shadow); }
  .inspector-open .inspector { transform: translateX(0); }
  .magic-add { top: 7px; right: 51px; bottom: auto; left: auto; width: 40px; height: 40px; box-shadow: none; }
  .magic-add svg { width: 20px; height: 20px; }
}

@media (max-width: 520px) {
  .auth-screen { padding: 0; }
  .auth-card { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; padding: 28px 22px; border: 0; border-radius: 0; box-shadow: none; }
  .content { padding-left: 16px; padding-right: 16px; }
  .view-header { margin-bottom: 24px; padding: 0 5px; }
  .view-title-row { gap: 9px; }
  h1 { font-size: 31px; }
  .view-icon { width: 24px; height: 24px; }
  .task-row { padding-left: 4px; padding-right: 4px; }
  .task-chevron { display: none; }
  .magic-add { top: 7px; right: 51px; bottom: auto; left: auto; }
  .repeat-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;
