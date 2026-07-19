export const libraryStyles = `
:root {
  --wa-font-family-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --wa-font-family-heading: var(--wa-font-family-body);
  --wa-color-brand-50: var(--blue);
  --wa-color-surface-default: var(--surface);
  --wa-color-surface-raised: var(--surface);
  --wa-color-surface-lowered: var(--bg);
  --wa-color-surface-border: var(--border-strong);
  --wa-color-text-normal: var(--text);
  --wa-color-text-quiet: var(--muted);
  --wa-color-text-link: var(--blue);
  --wa-form-control-height: var(--control-default);
  --wa-form-control-border-radius: var(--radius-control);
  --wa-form-control-background-color: var(--bg);
  --wa-form-control-border-color: var(--border-strong);
  --wa-form-control-value-color: var(--text);
  --wa-form-control-label-color: var(--muted);
  --wa-form-control-activated-color: var(--blue);
  --wa-panel-border-radius: var(--radius-control);
  --wa-border-radius-s: var(--radius-small);
  --wa-border-radius-m: var(--radius-control);
  --wa-border-radius-l: var(--radius-panel);
  --wa-space-xs: var(--space-1);
  --wa-space-s: var(--space-2);
  --wa-space-m: var(--space-3);
  --wa-space-l: var(--space-4);
  --wa-space-xl: var(--space-5);
  --wa-transition-fast: var(--duration-fast);
  --wa-transition-normal: var(--duration-default);
  --wa-transition-slow: var(--duration-slow);
  --wa-transition-easing: var(--ease);
  --wa-focus-ring-color: color-mix(in srgb, var(--blue) 32%, transparent);
}

wa-button::part(base) { font-weight: 590; box-shadow: none; }
wa-button[variant="brand"]::part(base) { background: var(--blue); border-color: var(--blue); color: #fff; }
wa-button[appearance="outlined"]::part(base) { background: var(--surface); border-color: var(--border-strong); color: var(--text); }
wa-button[appearance="outlined"]:hover::part(base),
wa-button[appearance="plain"]:hover::part(base) { background: var(--surface-subtle); }
wa-button[variant="danger"]::part(base) { color: var(--red); }
wa-select::part(combobox) { box-shadow: none; }
wa-select::part(form-control-label) { margin-bottom: 6px; color: var(--muted); font-size: 11px; font-weight: 630; line-height: 1.2; }
wa-select:focus-within::part(combobox) { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
wa-checkbox, wa-switch { --checked-icon-color: #fff; }
wa-checkbox::part(label), wa-switch::part(label) { color: var(--text); font-size: 13px; }
wa-tag::part(base) { border-color: var(--border-strong); background: var(--surface-subtle); color: var(--muted); font-weight: 590; }
wa-tag[variant="brand"]::part(base) { border-color: color-mix(in srgb, var(--blue) 32%, transparent); background: var(--blue-soft); color: var(--blue); }
wa-progress-ring { color: var(--blue); }
.inspector-close-button::part(base) { width: 34px; min-width: 34px; height: 34px; padding: 0; border-radius: 50%; color: var(--muted); }
.inspector-close-button svg { width: 18px; height: 18px; }
wa-divider { --color: var(--border); margin-block: var(--space-4); }
wa-details::part(base) { border-color: var(--border); border-radius: var(--radius-control); background: var(--surface); }
wa-details::part(header) { min-height: var(--control-default); padding: var(--space-2) var(--space-3); font-size: 13px; font-weight: 590; }
wa-details::part(body) { padding: 0 var(--space-3) var(--space-3); }
.objects-tabs::part(nav) { gap: var(--space-1); border-bottom-color: var(--border); }
.objects-tabs wa-tab::part(base) { min-height: var(--control-default); padding: var(--space-2) var(--space-3); color: var(--muted); font-size: 13px; }
.objects-tabs wa-tab[active]::part(base) { color: var(--text); }
.objects-tabs wa-tab-panel::part(base) { padding: var(--space-4) 0 0; }

.objects-dialog {
  --width: min(440px, calc(100vw - 24px));
  --spacing: 0;
  --show-duration: 150ms;
  --hide-duration: 120ms;
  --backdrop-filter: blur(5px);
  color: var(--text);
}
.objects-dialog.dialog-quick-find { --width: min(580px, calc(100vw - 24px)); }
.objects-dialog.dialog-settings { --width: min(610px, calc(100vw - 24px)); }
.objects-dialog.dialog-spaces { --width: min(860px, calc(100vw - 24px)); }
.objects-dialog.dialog-project { --width: min(650px, calc(100vw - 24px)); }
.objects-dialog::part(dialog) {
  max-height: calc(100dvh - 24px);
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.objects-dialog::part(body) { padding: 0; }
.objects-dialog .quick-find { margin: 0; }

@media (max-width: 520px) {
  .objects-dialog { --width: calc(100vw - 16px); }
  .objects-dialog::part(dialog) { max-height: calc(100dvh - 16px); border-radius: 13px; }
}

.objects-mobile-drawer { --wa-focus-ring-width: 0; }
.objects-mobile-drawer::part(dialog) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: var(--shadow);
}
.objects-mobile-drawer::part(body) { padding: 0; }
.objects-mobile-drawer.sidebar-drawer::part(dialog) { width: min(300px, 82vw); }
.objects-mobile-drawer.inspector-drawer::part(dialog) { width: min(430px, 100vw); }
.objects-mobile-drawer.inspector-drawer .inspector-close-button { display: none; }

@media (max-width: 820px) {
  .app-shell.library-sidebar-open .scrim { display: none; }
  .objects-mobile-drawer .sidebar,
  .objects-mobile-drawer .inspector {
    position: relative;
    inset: auto;
    width: 100%;
    height: 100%;
    max-height: none;
    border: 0;
    border-radius: 0;
    opacity: 1;
    transform: none;
    box-shadow: none;
  }
}
`;
