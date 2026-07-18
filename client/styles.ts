export const styles = `
@layer reset, tokens, base, components, responsive;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #app { width: 100%; height: 100%; margin: 0; }
  button, input, textarea, select { font: inherit; }
  button { color: inherit; }
  ul { margin: 0; padding: 0; list-style: none; }
}

@layer tokens {
  :root {
    color-scheme: light;
    --bg: #fafafa;
    --surface: #fff;
    --sidebar: #f5f5f4;
    --surface-subtle: #f2f2f0;
    --surface-hover: #eaeae8;
    --text: #202124;
    --muted: #87898e;
    --faint: #c5c7ca;
    --border: rgba(34, 36, 39, .09);
    --border-strong: rgba(34, 36, 39, .15);
    --blue: #1685ed;
    --blue-soft: #e8f3fe;
    --yellow: #f5c542;
    --red: #e7505a;
    --green: #44ad76;
    --sidebar-width: 270px;
    --inspector-width: 350px;
    --radius: 10px;
    --shadow: 0 24px 70px rgba(22, 28, 35, .18), 0 3px 14px rgba(22, 28, 35, .08);
    --ease: cubic-bezier(.2,.8,.2,1);
  }
  [data-theme="dark"] {
    color-scheme: dark;
    --bg: #222321;
    --surface: #292a28;
    --sidebar: #1d1e1c;
    --surface-subtle: #313230;
    --surface-hover: #393a37;
    --text: #f2f1ed;
    --muted: #a4a39e;
    --faint: #686a66;
    --border: rgba(255,255,255,.08);
    --border-strong: rgba(255,255,255,.14);
    --blue: #55a4f4;
    --blue-soft: #253b50;
    --yellow: #f2c54e;
    --red: #f17379;
    --green: #62bd8d;
    --shadow: 0 24px 70px rgba(0,0,0,.4), 0 3px 14px rgba(0,0,0,.2);
  }
}

@layer base {
  body { overflow: hidden; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
  button { border: 0; background: none; cursor: pointer; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid color-mix(in srgb, var(--blue) 30%, transparent); outline-offset: 2px; }
  input, textarea, select { width: 100%; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); padding: 9px 10px; }
  textarea { resize: vertical; }
  h1, h2, h3, p { margin-top: 0; }
  .icon { width: 20px; height: 20px; flex: 0 0 auto; }
}

@layer components {
  .app-shell { width: 100%; height: 100%; display: grid; grid-template-columns: var(--sidebar-width) minmax(360px, 1fr) 0; overflow: hidden; transition: grid-template-columns .28s var(--ease); }
  .app-shell.inspector-open { grid-template-columns: var(--sidebar-width) minmax(360px, 1fr) var(--inspector-width); }
  .sidebar { min-width: 0; height: 100%; display: flex; flex-direction: column; background: var(--sidebar); border-right: 1px solid var(--border); z-index: 10; }
  .sidebar-top { min-height: 58px; padding: 11px 12px 8px; display: flex; align-items: center; gap: 8px; }
  .spaces-pill { min-width: 0; flex: 1; display: flex; align-items: center; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface) 62%, transparent); box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .spaces-pill > button, .spaces-pill > details > summary { min-width: 0; height: 27px; padding: 0 9px; display: grid; place-items: center; border-radius: 7px; color: var(--muted); font-size: 11px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; list-style: none; cursor: pointer; }
  .spaces-pill > button { flex: 1; }
  .spaces-pill > button.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.1); }
  .spaces-pill > button:not(:first-child)::before { content: ""; width: 5px; height: 5px; margin-right: 5px; display: inline-block; border-radius: 50%; background: var(--space-color); }
  .spaces-overflow { position: relative; }
  .spaces-overflow summary::-webkit-details-marker { display: none; }
  .spaces-menu { position: absolute; z-index: 50; top: 34px; right: 0; width: 180px; padding: 6px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow); }
  .spaces-menu button { width: 100%; padding: 8px; display: flex; align-items: center; gap: 8px; border-radius: 7px; text-align: left; }
  .spaces-menu button:hover { background: var(--surface-hover); }
  .spaces-menu i { width: 8px; height: 8px; border-radius: 50%; }
  .icon-button { width: 34px; height: 34px; display: inline-grid; place-items: center; flex: 0 0 auto; border-radius: 8px; color: var(--muted); }
  .icon-button:hover { background: var(--surface-hover); color: var(--text); }
  .icon-button .icon { width: 18px; height: 18px; }
  .sidebar-nav { min-height: 0; flex: 1; overflow-y: auto; padding: 4px 10px 20px; }
  .sidebar-nav > ul { padding-bottom: 16px; }
  .nav-item { width: 100%; min-height: 38px; padding: 7px 9px; display: flex; align-items: center; gap: 10px; border-radius: 8px; color: var(--muted); text-align: left; }
  .nav-item:hover { background: color-mix(in srgb, var(--surface-hover) 72%, transparent); color: var(--text); }
  .nav-item.active { background: var(--surface-hover); color: var(--text); font-weight: 620; }
  .nav-item > span:not(.area-dot, .progress-ring) { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .nav-item em { font-style: normal; font-size: 12px; color: var(--muted); }
  .nav-item:nth-child(2) .icon { color: var(--yellow); fill: color-mix(in srgb, var(--yellow) 18%, transparent); }
  .sidebar-lists { padding-top: 12px; border-top: 1px solid var(--border); }
  .sidebar-lists section { margin-bottom: 3px; }
  .area-item { font-weight: 620; color: var(--text); }
  .project-item { padding-left: 31px; }
  .area-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.07); }
  .progress-ring, .project-progress { background: conic-gradient(var(--blue) var(--progress), var(--border-strong) 0); border-radius: 50%; position: relative; }
  .progress-ring { width: 14px; height: 14px; }
  .progress-ring::after, .project-progress::after { content: ""; position: absolute; inset: 2px; border-radius: inherit; background: var(--sidebar); }
  .sidebar-footer { min-height: 55px; padding: 8px 11px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); }
  .quiet-button { min-height: 34px; padding: 6px 9px; display: inline-flex; align-items: center; gap: 7px; border-radius: 8px; color: var(--muted); }
  .quiet-button:hover { background: var(--surface-hover); color: var(--text); }
  .quiet-button .icon { width: 16px; height: 16px; }
  .main-pane { min-width: 0; height: 100%; position: relative; background: var(--surface); }
  .content-scroll { width: 100%; height: 100%; overflow-y: auto; }
  .content-inner { width: min(760px, 100%); min-height: 100%; margin: 0 auto; padding: 68px 58px 130px; }
  .view-header { margin-bottom: 30px; padding: 0 5px; }
  .view-eyebrow { min-height: 19px; display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; font-weight: 650; letter-spacing: .02em; }
  .save-state { font-weight: 500; }
  .save-state.error { color: var(--red); }
  .view-title { margin-top: 5px; display: flex; align-items: center; gap: 10px; }
  .view-title > .icon { width: 25px; height: 25px; color: var(--yellow); fill: color-mix(in srgb, var(--yellow) 18%, transparent); }
  .view-title h1 { min-width: 0; flex: 1; margin: 0; font-size: clamp(30px, 4vw, 39px); line-height: 1.12; letter-spacing: -.035em; }
  .view-header > p { margin: 9px 0 0 35px; color: var(--muted); font-size: 13px; line-height: 1.5; }
  .progress-line { height: 3px; margin: 17px 0 0 35px; overflow: hidden; border-radius: 3px; background: var(--surface-subtle); }
  .progress-line span { height: 100%; display: block; background: var(--blue); border-radius: inherit; transition: width .25s var(--ease); }
  .calendar-strip { margin: 0 0 30px 37px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
  .calendar-event { min-height: 34px; display: grid; grid-template-columns: 62px 2px 1fr; gap: 11px; align-items: start; }
  .calendar-event time { padding-top: 2px; color: var(--muted); font-size: 11px; text-align: right; }
  .calendar-event > i { width: 2px; height: 24px; border-radius: 2px; background: var(--blue); }
  .calendar-event div { display: grid; }
  .calendar-event strong { font-size: 13px; }
  .calendar-event span { color: var(--muted); font-size: 11px; }
  .project-grid { margin: 0 0 30px 36px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .project-card { min-height: 74px; padding: 13px; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); text-align: left; transition: transform .15s, background .15s; }
  .project-card:hover { background: var(--surface-subtle); transform: translateY(-1px); }
  .project-card > div { min-width: 0; flex: 1; display: grid; gap: 4px; }
  .project-card strong, .project-card span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .project-card span { color: var(--muted); font-size: 11px; }
  .project-card > .icon { width: 14px; color: var(--faint); }
  .project-progress { width: 36px; height: 36px; display: grid; place-items: center; flex: 0 0 auto; }
  .project-progress::after { background: var(--surface); inset: 3px; }
  .project-progress span { z-index: 1; color: var(--muted); font-size: 9px; }
  .task-section { margin-bottom: 26px; }
  .task-section h2 { margin: 0 0 5px 37px; display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; font-weight: 650; }
  .task-section h2 .icon { width: 14px; height: 14px; }
  .task-row { min-height: 48px; display: grid; grid-template-columns: 34px minmax(0, 1fr) 24px; align-items: center; border-bottom: 1px solid var(--border); border-radius: 8px; }
  .task-row:hover, .task-row.selected { background: color-mix(in srgb, var(--blue-soft) 48%, transparent); }
  .check-button { width: 34px; height: 44px; display: grid; place-items: center; }
  .check-button > span, .mini-check { width: 18px; height: 18px; display: grid; place-items: center; border: 1.5px solid var(--faint); border-radius: 50%; background: var(--surface); transition: border-color .15s, background .15s; }
  .check-button:hover > span { border-color: var(--blue); }
  .check-button .icon, .mini-check .icon { width: 12px; height: 12px; stroke-width: 2.5; }
  .task-row.completed .check-button > span { border-color: var(--green); background: var(--green); color: white; }
  .task-row.completed .task-title { color: var(--muted); text-decoration: line-through; }
  .task-main { min-width: 0; min-height: 47px; padding: 7px 4px; display: grid; align-content: center; gap: 4px; text-align: left; }
  .task-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14px; }
  .task-meta { display: flex; align-items: center; gap: 9px; overflow: hidden; color: var(--muted); font-size: 10.5px; }
  .task-meta em { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; font-style: normal; }
  .task-meta .icon { width: 11px; height: 11px; }
  .task-meta .urgent { color: var(--red); }
  .row-chevron { width: 13px; color: var(--faint); opacity: 0; }
  .task-row:hover .row-chevron, .task-row.selected .row-chevron { opacity: 1; }
  .evening-mark { width: 14px; color: #7469b6; }
  .inline-add { min-height: 39px; margin-left: 28px; padding: 8px; display: flex; align-items: center; gap: 7px; border-radius: 7px; color: var(--muted); }
  .inline-add:hover { color: var(--blue); background: var(--blue-soft); }
  .inline-add .icon { width: 16px; height: 16px; }
  .inline-add.compact { margin: 4px 0 0 24px; font-size: 12px; }
  .quick-add-form { min-height: 47px; display: grid; grid-template-columns: 34px 1fr auto; align-items: center; border-bottom: 1px solid var(--border); }
  .check-placeholder { width: 18px; height: 18px; justify-self: center; border: 1.5px solid var(--faint); border-radius: 50%; }
  .quick-add-form input { border: 0; padding-inline: 4px; box-shadow: none; }
  .quick-add-form input:focus { outline: 0; }
  .empty-state { min-height: 280px; display: grid; place-items: center; align-content: center; color: var(--muted); text-align: center; }
  .empty-state > .icon { width: 42px; height: 42px; margin-bottom: 14px; color: var(--faint); }
  .empty-state h2 { margin-bottom: 7px; color: var(--text); font-size: 18px; }
  .empty-state p { max-width: 290px; font-size: 13px; line-height: 1.5; }
  .magic-add { position: absolute; right: 28px; bottom: 25px; width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; background: var(--blue); color: white; box-shadow: 0 8px 24px color-mix(in srgb, var(--blue) 38%, transparent); transition: transform .18s var(--ease), box-shadow .18s; }
  .magic-add:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 30px color-mix(in srgb, var(--blue) 44%, transparent); }
  .magic-add .icon { width: 23px; height: 23px; stroke-width: 2; }
  .inspector { width: var(--inspector-width); height: 100%; overflow: hidden; background: var(--surface); border-left: 1px solid var(--border); transform: translateX(0); }
  .inspector-header { min-height: 54px; padding: 9px 11px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
  .inspector-header > div { display: flex; }
  .inspector-scroll { height: calc(100% - 54px); overflow-y: auto; padding: 22px 22px 90px; }
  .inspector-title { min-height: 42px; padding: 4px 2px 12px; border: 0; border-radius: 0; border-bottom: 1px solid var(--border); font-size: 20px; font-weight: 650; letter-spacing: -.02em; }
  .inspector-title:focus { outline: 0; }
  .inspector-section { padding: 18px 0; border-bottom: 1px solid var(--border); }
  .section-label { margin-bottom: 9px; display: block; color: var(--muted); font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .06em; }
  .checklist-row { min-height: 36px; display: grid; grid-template-columns: 24px 1fr 26px; align-items: center; }
  .mini-check { width: 16px; height: 16px; padding: 0; }
  .checklist-row input { padding: 6px 3px; border: 0; background: transparent; }
  .checklist-row input.done { color: var(--muted); text-decoration: line-through; }
  .remove-button { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 6px; color: var(--faint); opacity: 0; }
  .checklist-row:hover .remove-button { opacity: 1; }
  .remove-button:hover { background: var(--surface-hover); color: var(--red); }
  .remove-button .icon { width: 13px; }
  .notes { min-height: 130px; margin-top: 16px; padding: 0 2px; border: 0; line-height: 1.55; }
  .notes:focus { outline: 0; }
  .detail-fields { display: grid; gap: 12px; }
  .field { display: grid; gap: 5px; color: var(--muted); font-size: 11px; font-weight: 600; }
  .field input, .field textarea, .field select { color: var(--text); font-size: 13px; font-weight: 400; }
  .field small { font-weight: 400; line-height: 1.4; }
  .schedule-buttons { padding: 16px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; border-bottom: 1px solid var(--border); }
  .schedule-buttons button { padding: 9px 4px; display: grid; place-items: center; gap: 4px; border-radius: 8px; color: var(--muted); font-size: 10px; }
  .schedule-buttons button:hover, .schedule-buttons button.active { background: var(--blue-soft); color: var(--blue); }
  .schedule-buttons .icon { width: 17px; height: 17px; }
  .repeat-grid { display: grid; grid-template-columns: 1fr 64px; gap: 7px; }
  .repeat-grid input[type="date"] { grid-column: 1 / -1; }
  .danger-hover:hover, .danger-text { color: var(--red); }
  .full { width: 100%; justify-content: center; margin-bottom: 18px; }
  .button { min-height: 36px; padding: 7px 13px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); font-weight: 600; }
  .button:hover { background: var(--surface-hover); }
  .button.primary { border-color: var(--blue); background: var(--blue); color: white; }
  .button.primary:hover { filter: brightness(.96); }
  .button.danger { border-color: color-mix(in srgb, var(--red) 35%, var(--border)); color: var(--red); }
  .button:disabled { cursor: default; opacity: .55; }
  .button .icon { width: 16px; height: 16px; }
  dialog.dialog { width: min(480px, calc(100vw - 28px)); max-height: min(760px, calc(100dvh - 28px)); padding: 0; overflow: hidden; border: 1px solid var(--border-strong); border-radius: 13px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
  dialog.dialog-wide { width: min(760px, calc(100vw - 28px)); }
  dialog.dialog::backdrop { background: rgba(15, 19, 24, .32); backdrop-filter: blur(2px); }
  .dialog-header { min-height: 56px; padding: 10px 13px 10px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
  .dialog-header h2 { margin: 0; font-size: 17px; }
  .dialog-form { max-height: calc(100dvh - 100px); padding: 20px; display: grid; gap: 15px; overflow-y: auto; }
  .dialog-form footer { padding-top: 5px; display: flex; justify-content: space-between; gap: 8px; }
  .dialog-form footer > span { display: flex; gap: 8px; }
  .dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
  .search-box { margin: 16px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: 9px; padding: 0 10px; }
  .search-box .icon { color: var(--muted); }
  .search-box input { min-height: 44px; border: 0; padding: 0; font-size: 15px; }
  .search-box input:focus { outline: 0; }
  .search-results { min-height: 180px; max-height: 440px; padding: 0 10px 12px; overflow-y: auto; }
  .search-results > button { width: 100%; min-height: 50px; padding: 8px 9px; display: grid; grid-template-columns: 24px 1fr 16px; gap: 9px; align-items: center; border-radius: 8px; text-align: left; }
  .search-results > button:hover { background: var(--blue-soft); }
  .search-results > button > span { min-width: 0; display: grid; gap: 3px; }
  .search-results strong, .search-results small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .search-results small, .search-results > p { color: var(--muted); }
  .search-results > p { padding: 22px; text-align: center; }
  .settings-layout { height: min(590px, calc(100dvh - 100px)); display: grid; grid-template-columns: 165px 1fr; }
  .settings-layout > nav { padding: 14px 9px; border-right: 1px solid var(--border); background: var(--sidebar); }
  .settings-layout > nav button { width: 100%; min-height: 38px; padding: 8px 10px; display: flex; align-items: center; gap: 9px; border-radius: 8px; color: var(--muted); text-align: left; }
  .settings-layout > nav button.active { background: var(--surface-hover); color: var(--text); font-weight: 620; }
  .settings-layout > nav .icon { width: 17px; }
  .settings-layout > section { padding: 24px 28px 40px; overflow-y: auto; }
  .settings-layout h3 { margin-bottom: 5px; font-size: 18px; }
  .settings-layout p { color: var(--muted); line-height: 1.5; }
  .settings-layout .field { margin: 17px 0; }
  .setting-toggle { margin: 18px 0; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .setting-toggle span { display: grid; gap: 3px; }
  .setting-toggle small { color: var(--muted); }
  .setting-toggle input { width: auto; }
  .settings-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .space-editors { display: grid; gap: 8px; }
  .space-editor { display: grid; grid-template-columns: 32px 1fr auto 34px; gap: 8px; align-items: center; }
  .space-editor input[type="color"] { width: 32px; height: 32px; padding: 2px; }
  .space-editor label { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
  .space-editor label input { width: auto; }
  .button-stack { display: flex; flex-wrap: wrap; gap: 9px; }
  .file-button { position: relative; overflow: hidden; cursor: pointer; }
  .file-button input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .auth-screen { min-height: 100%; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 50% 15%, var(--blue-soft), var(--bg) 48%); }
  .auth-card { width: min(440px, 100%); padding: 40px; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); text-align: center; }
  .auth-mark { width: 52px; height: 52px; margin: 0 auto 14px; display: flex; align-items: end; justify-content: center; gap: 4px; padding: 12px; border-radius: 14px; background: var(--blue); }
  .auth-mark span { width: 6px; border-radius: 4px; background: white; }
  .auth-mark span:nth-child(1) { height: 15px; } .auth-mark span:nth-child(2) { height: 26px; } .auth-mark span:nth-child(3) { height: 20px; }
  .auth-brand { color: var(--blue); font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .auth-card h1 { font-size: 29px; letter-spacing: -.03em; }
  .auth-card > p:not(.auth-brand) { color: var(--muted); line-height: 1.55; }
  .auth-submit { width: 100%; margin-top: 16px; }
  .auth-loading { margin-top: 20px; color: var(--muted); }
  .auth-loading span { width: 8px; height: 8px; display: inline-block; margin-right: 6px; border-radius: 50%; background: var(--blue); animation: pulse 1s infinite alternate; }
  .mobile-header, .mobile-only, .scrim { display: none; }
  @keyframes pulse { to { opacity: .3; transform: scale(.75); } }
}

@layer responsive {
  @media (max-width: 1120px) {
    :root { --sidebar-width: 238px; --inspector-width: 320px; }
    .content-inner { padding-inline: 38px; }
  }
  @media (max-width: 880px) {
    .app-shell, .app-shell.inspector-open { display: block; }
    .sidebar { position: fixed; inset: 0 auto 0 0; width: min(310px, 88vw); transform: translateX(-102%); transition: transform .28s var(--ease); box-shadow: var(--shadow); }
    .sidebar.open { transform: translateX(0); }
    .scrim { position: fixed; z-index: 9; inset: 0; display: block; background: rgba(0,0,0,.28); }
    .mobile-header { height: 54px; padding: 8px 12px; position: absolute; z-index: 6; inset: 0 0 auto; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(16px); }
    .mobile-only { display: inline-grid; }
    .content-inner { padding-top: 83px; }
    .inspector { position: fixed; z-index: 20; inset: 0 0 0 auto; width: min(390px, 100vw); box-shadow: var(--shadow); }
    .magic-add { top: 7px; right: 51px; bottom: auto; width: 40px; height: 40px; box-shadow: none; z-index: 7; }
    .magic-add .icon { width: 20px; }
  }
  @media (max-width: 560px) {
    .content-inner { padding: 80px 16px 110px; }
    .view-header { margin-bottom: 24px; }
    .view-title h1 { font-size: 31px; }
    .view-header > p { margin-left: 34px; }
    .project-grid { margin-left: 34px; grid-template-columns: 1fr; }
    .calendar-strip { margin-left: 34px; }
    .task-row { grid-template-columns: 32px minmax(0,1fr) 19px; }
    .row-chevron { display: none; }
    dialog.dialog, dialog.dialog-wide { width: calc(100vw - 16px); max-height: calc(100dvh - 16px); }
    .settings-layout { height: calc(100dvh - 72px); grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .settings-layout > nav { display: flex; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--border); }
    .settings-layout > nav button { width: auto; white-space: nowrap; }
    .settings-layout > section { padding: 20px; }
    .space-editor { grid-template-columns: 32px 1fr 34px; }
    .space-editor label { display: none; }
    .auth-screen { padding: 0; }
    .auth-card { min-height: 100dvh; display: grid; place-content: center; border: 0; border-radius: 0; box-shadow: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
}
`;
