export const replacementStyles = `
  :root {
    color-scheme: light dark;
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f7f7f5;
    color: #222321;
  }

  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; }
  button, input { font: inherit; }

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
  .replacement-badge { margin-left: auto; border-radius: 999px; padding: 3px 7px; color: #62635f; background: #dfdfda; font-size: 10px; text-transform: uppercase; }
  .replacement-nav { display: grid; gap: 3px; }
  .replacement-nav-row { display: flex; justify-content: space-between; padding: 9px 11px; border-radius: 9px; color: #4b4c48; font-size: 14px; }
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

  @media (max-width: 720px) {
    .replacement-shell { display: block; }
    .replacement-sidebar { position: sticky; top: 0; z-index: 2; flex-direction: row; align-items: center; padding: 14px 16px; border-right: 0; border-bottom: 1px solid #deded9; }
    .replacement-nav, .replacement-sidebar-note { display: none; }
    .replacement-main { padding: 30px 18px 60px; }
    .replacement-grid { grid-template-columns: 1fr; }
    .replacement-stat { display: flex; align-items: baseline; justify-content: space-between; }
  }

  @media (prefers-color-scheme: dark) {
    :root { background: #191a18; color: #ecece8; }
    .replacement-state { background: radial-gradient(circle at top, #292a27 0, #191a18 70%); }
    .replacement-state-card, .replacement-stat, .replacement-import { color: #ecece8; background: #242522; border-color: #383936; }
    .replacement-shell, .replacement-confirmation { color: #ecece8; background: #1c1d1b; }
    .replacement-sidebar { background: #242522; border-color: #383936; }
    .replacement-sidebar-note { background: rgba(255,255,255,.05); }
    .replacement-subtitle, .replacement-stat span, .replacement-import p, .replacement-state-card p { color: #a7a8a2; }
  }
`;
