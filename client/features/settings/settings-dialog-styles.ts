export const settingsDialogStyles = `
.settings-workspace { color: var(--text); }
.settings-intro { margin: 0 0 var(--space-4); color: var(--muted); font-size: 12px; line-height: 1.5; }
.settings-tabs { min-height: 0; }
.settings-panel { display: grid; gap: var(--space-4); padding-bottom: var(--space-2); }
.settings-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg);
}
.settings-card h3 { margin: 0; font-size: 14px; letter-spacing: -.01em; }
.settings-card > p { margin: -5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.settings-control-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: var(--control-default); }
.settings-control-row > span, .settings-control-copy { min-width: 0; }
.settings-control-copy strong { display: block; font-size: 13px; }
.settings-control-copy small { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.35; }
.settings-control-row wa-select { width: min(190px, 48%); }
.settings-inline-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.settings-native-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.settings-native-field { display: grid; gap: 6px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 630; }
.settings-native-field.full { grid-column: 1 / -1; }
.settings-native-field input {
  width: 100%;
  height: var(--control-default);
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--surface);
}
.settings-native-field input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
.settings-tag-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); }
.settings-tag-list { display: grid; gap: 6px; }
.settings-tag-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-2); }
.settings-tag-row input, .settings-tag-form input {
  min-width: 0;
  height: var(--control-default);
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--surface);
}
.settings-tag-row input:focus, .settings-tag-form input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
.settings-empty { margin: 0; color: var(--muted); font-size: 12px; }
.settings-automation { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.settings-automation code { padding: 2px 4px; border-radius: 4px; background: var(--surface-subtle); color: var(--text); overflow-wrap: anywhere; }
.settings-footer { display: flex; justify-content: flex-end; }
.settings-hidden-file { display: none; }

@media (max-width: 560px) {
  .settings-tabs { min-height: 0; }
  .settings-card { padding: var(--space-3); }
  .settings-native-grid { grid-template-columns: 1fr; }
  .settings-native-field.full { grid-column: auto; }
  .settings-control-row { gap: var(--space-2); flex-wrap: wrap; }
  .settings-control-row:has(wa-select) { align-items: flex-start; flex-direction: column; }
  .settings-control-row wa-select { width: 100%; }
  .settings-control-row wa-switch, .settings-control-row wa-checkbox { align-self: auto; flex: none; }
}
`;
