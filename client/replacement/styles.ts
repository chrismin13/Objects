export const replacementStyles = `
  :root {
    color-scheme: light dark;
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f7f7f5;
    color: #222321;
  }

  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; }
  button, input, textarea, select { font: inherit; }
  button { color: inherit; }

  .replacement-state {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: radial-gradient(circle at top, #ffffff 0, #f4f3ef 55%, #ecebe7 100%);
  }

  .replacement-state-card {
    width: min(100%, 440px);
    padding: 32px;
    border: 1px solid #deddd8;
    border-radius: 22px;
    background: rgba(255, 255, 255, .9);
    box-shadow: 0 22px 60px rgba(30, 31, 29, .09);
    text-align: center;
  }

  .replacement-kicker { margin: 0 0 8px; color: #3077d8; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .replacement-state-card h1 { margin: 0 0 10px; font-size: clamp(25px, 6vw, 34px); line-height: 1.1; }
  .replacement-state-card p { color: #676863; line-height: 1.55; }
  .replacement-button {
    border: 0;
    border-radius: 10px;
    padding: 10px 15px;
    color: white;
    background: #3077d8;
    cursor: pointer;
  }

  .replacement-shell { min-height: 100dvh; display: grid; grid-template-columns: 270px minmax(0, 1fr); background: #fafaf8; }
  .replacement-sidebar { display: flex; flex-direction: column; gap: 24px; padding: 26px 18px; background: #efefec; border-right: 1px solid #deded9; }
  .replacement-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; font-size: 15px; font-weight: 750; }
  .replacement-brand-mark { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 8px; color: white; background: #3077d8; }
  .replacement-spaces-pill { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 8px; align-items: center; border: 1px solid #d8d8d3; border-radius: 999px; padding: 8px 12px; color: #4b4c48; background: rgba(255,255,255,.62); text-align: left; cursor: pointer; }
  .replacement-spaces-pill > span { grid-row: 1 / 3; width: 10px; height: 10px; border-radius: 50%; }
  .replacement-spaces-pill strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .replacement-spaces-pill small { color: #888984; font-size: 10px; }
  .replacement-badge { margin-left: auto; border-radius: 999px; padding: 3px 7px; color: #62635f; background: #dfdfda; font-size: 10px; text-transform: uppercase; }
  .replacement-nav { display: grid; gap: 3px; }
  .replacement-nav-row { width: 100%; display: flex; justify-content: space-between; border: 0; padding: 9px 11px; border-radius: 9px; color: #4b4c48; background: transparent; font-size: 14px; text-align: left; cursor: pointer; }
  .replacement-nav-row.active { color: #1f5fae; background: #dce9f8; font-weight: 650; }
  .replacement-sidebar-note { margin-top: auto; padding: 12px; border-radius: 12px; color: #666762; background: rgba(255,255,255,.55); font-size: 12px; line-height: 1.45; }
  .replacement-main { padding: clamp(24px, 6vw, 76px); overflow: auto; }
  .replacement-main-inner { max-width: 880px; margin: 0 auto; }
  .replacement-main header { margin-bottom: 32px; }
  .replacement-main h1 { margin: 5px 0 8px; font-size: clamp(34px, 6vw, 54px); letter-spacing: -.04em; }
  .replacement-subtitle { margin: 0; color: #72736e; }
  .replacement-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0 0 26px; }
  .replacement-stat { padding: 18px; border: 1px solid #e0dfda; border-radius: 15px; background: white; }
  .replacement-stat strong { display: block; margin-bottom: 4px; font-size: 28px; }
  .replacement-stat span { color: #71726d; font-size: 13px; }
  .replacement-import { padding: 22px; border: 1px solid #deddd8; border-radius: 17px; background: white; }
  .replacement-import h2 { margin: 0 0 7px; font-size: 18px; }
  .replacement-import p { margin: 0 0 15px; color: #6d6e69; line-height: 1.5; }
  .replacement-import-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .replacement-confirmation { min-width: 230px; flex: 1; border: 1px solid #cfcfca; border-radius: 9px; padding: 9px 11px; background: #fff; color: #222321; }
  .replacement-file { max-width: 100%; font-size: 13px; }
  .replacement-report { margin-top: 16px; padding: 13px; border-radius: 10px; color: #315d34; background: #edf7ee; font-size: 13px; line-height: 1.5; }
  .replacement-report.error { color: #8a3030; background: #fff0f0; }

  .replacement-shell.inspector-open { grid-template-columns: 270px minmax(0, 1fr) minmax(330px, 390px); }
  .replacement-nav-group { display: grid; gap: 3px; }
  .replacement-nav-group h2 { margin: 2px 10px 4px; color: #8a8b86; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .replacement-sidebar-action { margin-top: auto; border: 0; padding: 9px 11px; color: #5f605c; background: transparent; text-align: left; cursor: pointer; }
  .replacement-policy { display: grid; gap: 5px; margin-top: auto; padding: 0 10px; color: #777873; font-size: 11px; }
  .replacement-policy select { width: 100%; border: 1px solid #d1d1cc; border-radius: 8px; padding: 7px; color: inherit; background: rgba(255,255,255,.55); }
  .replacement-policy + .replacement-sidebar-action { margin-top: 0; }
  .replacement-main header { display: flex; flex-direction: column; }
  .replacement-main header .replacement-kicker { order: -1; }
  .replacement-quick-entry { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; margin-bottom: 20px; padding: 12px; border: 1px solid #deddd8; border-radius: 14px; background: white; box-shadow: 0 5px 18px rgba(30,31,29,.05); }
  .replacement-quick-entry input { min-width: 0; border: 0; padding: 7px 8px; outline: none; background: transparent; color: inherit; }
  .replacement-quick-entry p { grid-column: 1 / -1; margin: 0 8px; color: #8b8c87; font-size: 11px; }
  .replacement-list { display: grid; gap: 7px; }
  .replacement-sections { display: grid; gap: 24px; }
  .replacement-section > h2 { margin: 0 0 9px; color: #6d6e69; font-size: 13px; letter-spacing: .02em; }
  .replacement-section .replacement-list:empty { min-height: 54px; border: 1px dashed #d7d7d2; border-radius: 12px; }
  .replacement-row { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 9px; padding: 11px 13px; border: 1px solid #e2e1dc; border-radius: 12px; background: white; touch-action: pan-y; }
  .replacement-row.selected { border-color: #75a8e7; box-shadow: 0 0 0 2px rgba(48,119,216,.12); }
  .replacement-row.bulk-selected { border-color: #75a8e7; background: #f1f7fe; box-shadow: inset 3px 0 #3077d8; }
  .replacement-complete { width: 20px; height: 20px; border: 1.5px solid #aeb0aa; border-radius: 50%; background: transparent; cursor: pointer; }
  .replacement-complete:hover { border-color: #3077d8; background: #e5f0fc; }
  .replacement-outcome { width: 20px; height: 20px; border-radius: 50%; background: #bbb; }
  .replacement-outcome.completed { background: #55a05b; }
  .replacement-outcome.canceled { position: relative; background: #d1854f; }
  .replacement-row-body { min-width: 0; display: grid; gap: 4px; border: 0; padding: 0; background: transparent; text-align: left; cursor: pointer; }
  .replacement-row-body strong { overflow-wrap: anywhere; font-size: 14px; }
  .replacement-row-body span { overflow-wrap: anywhere; color: #858680; font-size: 12px; }
  .replacement-select, .replacement-more { min-width: 34px; min-height: 34px; border: 0; border-radius: 8px; color: #777873; background: transparent; cursor: pointer; }
  .replacement-select[aria-pressed="true"] { color: #1f5fae; background: #dce9f8; font-weight: 800; }
  .replacement-more { letter-spacing: 1px; }
  .replacement-empty { padding: clamp(35px, 8vw, 80px) 20px; color: #858680; text-align: center; }
  .replacement-empty div { width: 52px; height: 52px; display: grid; place-items: center; margin: 0 auto 13px; border-radius: 50%; color: #659665; background: #edf5eb; font-size: 24px; }
  .replacement-empty h2 { margin: 0 0 6px; color: #555650; font-size: 18px; }
  .replacement-empty p { max-width: 430px; margin: 0 auto; line-height: 1.5; }
  .replacement-magic-plus { position: fixed; right: 30px; bottom: 28px; z-index: 5; width: 52px; height: 52px; border: 0; border-radius: 50%; color: white; background: #3077d8; box-shadow: 0 10px 30px rgba(35,88,157,.35); font-size: 30px; cursor: pointer; }
  .inspector-open .replacement-magic-plus { right: 420px; }
  .replacement-inspector { max-height: 100dvh; overflow: auto; padding: 18px; border-left: 1px solid #deded9; background: #f5f5f2; }
  .replacement-inspector-head { position: sticky; top: -18px; z-index: 1; display: flex; align-items: center; justify-content: space-between; margin: -18px -18px 16px; padding: 15px 18px; border-bottom: 1px solid #deded9; background: rgba(245,245,242,.95); font-weight: 700; backdrop-filter: blur(10px); }
  .replacement-icon-button { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; font-size: 24px; cursor: pointer; }
  .replacement-inspector label { display: grid; gap: 5px; margin: 0 0 13px; color: #686964; font-size: 12px; font-weight: 650; }
  .replacement-inspector input:not([type="checkbox"]), .replacement-inspector textarea, .replacement-inspector select { width: 100%; border: 1px solid #d1d1cc; border-radius: 9px; padding: 9px 10px; color: #242522; background: white; font-weight: 400; }
  .replacement-inspector textarea { resize: vertical; line-height: 1.5; }
  .replacement-tabs { display: flex; gap: 3px; margin: 0 0 8px; padding: 3px; border-radius: 9px; background: #e7e7e3; }
  .replacement-tabs button { flex: 1; border: 0; border-radius: 7px; padding: 6px; background: transparent; font-size: 12px; cursor: pointer; }
  .replacement-tabs button.active { background: white; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .replacement-markdown { min-height: 130px; margin-bottom: 13px; padding: 10px; border: 1px solid #deddd8; border-radius: 9px; background: white; font-size: 13px; line-height: 1.5; }
  .replacement-markdown h2, .replacement-markdown h3, .replacement-markdown p { margin: 0 0 8px; }
  .replacement-muted, .replacement-search-result { margin: -6px 0 13px; color: #858680; font-size: 12px; }
  .replacement-inspector fieldset { margin: 4px 0 15px; border: 1px solid #d8d8d3; border-radius: 10px; padding: 10px; }
  .replacement-inspector legend { color: #686964; font-size: 12px; font-weight: 650; }
  .replacement-checklist, .replacement-inspector fieldset form { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; margin-bottom: 6px; }
  .replacement-inspector fieldset form { grid-template-columns: minmax(0, 1fr) auto; margin: 8px 0 0; }
  .replacement-checklist button, .replacement-inspector fieldset button, .replacement-actions button, .replacement-row > button:last-child { border: 1px solid #d2d2cd; border-radius: 8px; padding: 7px 9px; background: white; cursor: pointer; }
  .replacement-inline-check { display: flex !important; grid-template-columns: auto 1fr; align-items: center; }
  .replacement-snooze { margin: -6px 0 13px; border: 0; padding: 0; color: #3077d8; background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
  .replacement-actions { display: flex; flex-wrap: wrap; gap: 7px; padding-top: 7px; }
  .replacement-actions .danger, .replacement-danger-button { color: #a23535; }
  .replacement-danger-button { margin-top: 20px; border: 1px solid #e3bcbc; border-radius: 9px; padding: 9px 12px; background: #fff4f4; cursor: pointer; }
  .replacement-toast { position: fixed; left: 50%; bottom: 24px; z-index: 10; display: flex; align-items: center; gap: 10px; max-width: min(92vw, 620px); transform: translateX(-50%); border-radius: 12px; padding: 10px 12px; color: #eaf4e9; background: #315d34; box-shadow: 0 9px 30px rgba(0,0,0,.2); font-size: 13px; }
  .replacement-toast.error { color: #fff2f2; background: #843535; }
  .replacement-toast button { border: 0; border-radius: 7px; padding: 5px 8px; color: inherit; background: rgba(255,255,255,.14); cursor: pointer; }
  .replacement-tag-filters, .replacement-tool-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
  .replacement-tag-filters button, .replacement-entity-tools button { border: 1px solid #d3d3ce; border-radius: 999px; padding: 6px 10px; background: white; cursor: pointer; font-size: 12px; }
  .replacement-tag-filters button.active { color: #1f5fae; border-color: #8ab5ea; background: #e5f0fc; }
  .replacement-entity-tools { display: grid; gap: 9px; margin: -12px 0 20px; padding: 12px; border: 1px solid #e0dfda; border-radius: 14px; background: rgba(255,255,255,.65); }
  .replacement-tool-row { align-items: center; margin: 0; }
  .replacement-tool-row strong { margin-right: 4px; font-size: 13px; }
  .replacement-entity-tools button.danger, .replacement-tool-list button.danger { color: #a23535; }
  .replacement-entity-tools details { font-size: 12px; }
  .replacement-entity-tools summary { color: #676863; cursor: pointer; }
  .replacement-tool-list { display: grid; gap: 6px; margin-top: 9px; }
  .replacement-tool-list > div { display: flex; align-items: center; gap: 7px; }
  .replacement-tool-list span { min-width: 120px; }
  .replacement-title-row { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
  .replacement-search-label { width: min(270px, 45%); display: grid; gap: 5px; color: #777873; font-size: 11px; font-weight: 650; }
  .replacement-search { width: 100%; border: 1px solid #d1d1cc; border-radius: 10px; padding: 9px 11px; color: inherit; background: white; }
  .replacement-mobile-header, .replacement-mobile-close, .replacement-sidebar-scrim { display: none; }
  .replacement-selection-toolbar { position: fixed; left: 50%; bottom: 22px; z-index: 14; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: 5px; overflow-x: auto; transform: translateX(-50%); border: 1px solid #d8d8d3; border-radius: 14px; padding: 7px; color: #31322f; background: rgba(255,255,255,.96); box-shadow: 0 12px 36px rgba(0,0,0,.2); backdrop-filter: blur(14px); }
  .replacement-selection-toolbar strong { padding: 0 8px; white-space: nowrap; font-size: 12px; }
  .replacement-selection-toolbar button { min-height: 36px; border: 0; border-radius: 8px; padding: 7px 9px; white-space: nowrap; background: #f0f0ec; cursor: pointer; }
  .replacement-selection-toolbar button.danger { color: #a23535; }
  .replacement-context-menu { position: fixed; z-index: 25; width: 210px; display: grid; gap: 2px; border: 1px solid #d6d6d1; border-radius: 12px; padding: 6px; color: #2d2e2b; background: rgba(255,255,255,.98); box-shadow: 0 18px 45px rgba(0,0,0,.22); }
  .replacement-context-menu button { min-height: 36px; border: 0; border-radius: 7px; padding: 7px 10px; background: transparent; text-align: left; cursor: pointer; }
  .replacement-context-menu button:hover, .replacement-context-menu button:focus-visible { background: #eaf2fc; outline: none; }
  .replacement-context-menu button.danger { color: #a23535; }
  .replacement-overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 20px; background: rgba(25,26,24,.35); backdrop-filter: blur(4px); }
  .replacement-wa-dialog::part(dialog) { width: min(calc(100vw - 24px), 470px); padding: 0; border: 0; background: transparent; box-shadow: none; }
  .replacement-wa-dialog::part(body) { padding: 0; }
  .replacement-dialog { width: min(100%, 470px); max-height: min(680px, calc(100dvh - 40px)); overflow: auto; border: 1px solid #d8d8d3; border-radius: 18px; padding: 18px; color: #292a27; background: #fafaf8; box-shadow: 0 24px 70px rgba(0,0,0,.28); }
  .replacement-dialog > header { display: flex; align-items: start; justify-content: space-between; margin-bottom: 14px; }
  .replacement-dialog h2 { margin: 0; font-size: 24px; }
  .replacement-dialog header button { width: 36px; height: 36px; border: 0; border-radius: 9px; background: #ecece8; cursor: pointer; }
  .replacement-choice-list { display: grid; gap: 6px; }
  .replacement-choice-list > button { min-height: 42px; border: 1px solid #deded9; border-radius: 10px; padding: 9px 12px; background: white; text-align: left; cursor: pointer; }
  .replacement-choice-list form, .replacement-tag-form { display: grid; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #deded9; }
  .replacement-choice-list label, .replacement-tag-form label { display: grid; gap: 6px; color: #686964; font-size: 12px; font-weight: 650; }
  .replacement-choice-list input, .replacement-tag-form input { width: 100%; border: 1px solid #d1d1cc; border-radius: 9px; padding: 10px; color: #242522; background: white; }
  .replacement-setting-row { display: grid; gap: 7px; margin-top: 14px; color: #686964; font-size: 12px; font-weight: 650; }
  .replacement-setting-row select { width: 100%; border: 1px solid #d1d1cc; border-radius: 9px; padding: 10px; color: #242522; background: white; }
  .sortable-ghost { opacity: .35; }
  .sortable-chosen { border-color: #75a8e7; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }

  @media (max-width: 720px) {
    .replacement-shell { display: block; }
    .replacement-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 22; width: min(86vw, 330px); display: flex; transform: translateX(-105%); overflow: auto; padding: 22px 16px; border-right: 1px solid #deded9; transition: transform .2s ease; }
    .replacement-shell.sidebar-open .replacement-sidebar { transform: translateX(0); }
    .replacement-mobile-close { width: 36px; height: 36px; display: grid; place-items: center; margin-left: auto; border: 0; border-radius: 9px; background: rgba(0,0,0,.06); font-size: 22px; }
    .replacement-sidebar-scrim { position: fixed; inset: 0; z-index: 21; display: block; border: 0; background: rgba(20,21,19,.35); }
    .replacement-mobile-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; margin: -18px -18px 24px; padding: max(12px, env(safe-area-inset-top)) 14px 12px; border-bottom: 1px solid #deded9; background: rgba(250,250,248,.94); backdrop-filter: blur(12px); }
    .replacement-mobile-header button { width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent; font-size: 20px; }
    .replacement-main { padding: 18px 18px 88px; }
    .replacement-grid { grid-template-columns: 1fr; }
    .replacement-stat { display: flex; align-items: baseline; justify-content: space-between; }
    .replacement-shell.inspector-open { display: block; }
    .replacement-inspector { position: fixed; inset: 0; z-index: 8; max-height: none; border: 0; padding: 18px; }
    .replacement-magic-plus, .inspector-open .replacement-magic-plus { right: 18px; bottom: 18px; }
    .replacement-toast { bottom: 82px; }
    .replacement-title-row { display: grid; }
    .replacement-search-label { width: 100%; }
    .replacement-main h1 { font-size: clamp(32px, 12vw, 48px); overflow-wrap: anywhere; }
    .replacement-row { grid-template-columns: auto minmax(0, 1fr) auto; }
    .replacement-more { display: none; }
    .replacement-row > button:last-child:not(.replacement-select) { grid-column: 2 / -1; justify-self: start; }
    .replacement-selection-toolbar { left: 10px; right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); transform: none; }
    .replacement-selection-toolbar button { min-height: 44px; }
    .replacement-dialog { align-self: end; width: 100%; max-height: min(78dvh, 680px); border-radius: 20px 20px 8px 8px; padding-bottom: max(18px, env(safe-area-inset-bottom)); }
    .replacement-overlay { align-items: end; padding: 10px; }
    .replacement-context-menu { left: 12px !important; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); top: auto !important; width: auto; max-height: 72dvh; overflow: auto; }
  }

  .replacement-dark { color: #ecece8; background: #1c1d1b; }
  .replacement-dark .replacement-state-card, .replacement-dark .replacement-stat, .replacement-dark .replacement-import, .replacement-dark .replacement-row, .replacement-dark .replacement-quick-entry, .replacement-dark .replacement-markdown, .replacement-dark .replacement-entity-tools, .replacement-dark .replacement-dialog, .replacement-dark .replacement-context-menu, .replacement-dark .replacement-selection-toolbar { color: #ecece8; background: #242522; border-color: #383936; }
  .replacement-dark .replacement-confirmation { color: #ecece8; background: #1c1d1b; }
  .replacement-dark .replacement-sidebar { background: #242522; border-color: #383936; }
  .replacement-dark .replacement-spaces-pill { color: #ecece8; background: #1c1d1b; border-color: #454641; }
  .replacement-dark .replacement-inspector, .replacement-dark .replacement-inspector-head { background: #242522; border-color: #383936; }
  .replacement-dark .replacement-inspector input:not([type="checkbox"]), .replacement-dark .replacement-inspector textarea, .replacement-dark .replacement-inspector select, .replacement-dark .replacement-checklist button, .replacement-dark .replacement-inspector fieldset button, .replacement-dark .replacement-actions button, .replacement-dark .replacement-tabs button.active { color: #ecece8; background: #1c1d1b; border-color: #454641; }
  .replacement-dark .replacement-tabs { background: #343531; }
  .replacement-dark .replacement-tag-filters button, .replacement-dark .replacement-entity-tools button { color: #ecece8; background: #1c1d1b; border-color: #454641; }
  .replacement-dark .replacement-search, .replacement-dark .replacement-choice-list > button, .replacement-dark .replacement-choice-list input, .replacement-dark .replacement-tag-form input, .replacement-dark .replacement-setting-row select { color: #ecece8; background: #1c1d1b; border-color: #454641; }
  .replacement-dark .replacement-row.bulk-selected { background: #202d3c; }
  .replacement-dark .replacement-selection-toolbar button, .replacement-dark .replacement-dialog header button { color: #ecece8; background: #343531; }
  .replacement-dark .replacement-mobile-header { background: rgba(28,29,27,.94); border-color: #383936; }
  .replacement-dark .replacement-empty h2 { color: #d7d8d2; }
  .replacement-dark .replacement-sidebar-note { background: rgba(255,255,255,.05); }
  .replacement-dark .replacement-subtitle, .replacement-dark .replacement-stat span, .replacement-dark .replacement-import p, .replacement-dark .replacement-state-card p { color: #a7a8a2; }
`;
