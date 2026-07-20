export const entityDialogStyles = `
.entity-dialog { display: grid; gap: var(--space-4); color: var(--text); }
.entity-dialog > p { margin: -6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.entity-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.entity-native-field { display: grid; gap: 6px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 630; }
.entity-native-field.full,
.entity-form-grid > .full { grid-column: 1 / -1; }
.entity-native-field input,
.entity-native-field textarea,
.entity-native-field select {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--bg);
}
.entity-native-field input, .entity-native-field select { height: var(--control-default); }
.entity-native-field textarea { min-height: 96px; padding-block: 9px; resize: vertical; }
.entity-native-field select[size] { height: 200px; padding: 6px; }
.entity-native-field input:focus,
.entity-native-field textarea:focus,
.entity-native-field select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
.entity-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }
.entity-pause-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: 11px 12px; border: 1px solid var(--border); border-radius: 9px; }
.entity-pause-row span { display: grid; gap: 2px; }
.entity-pause-row strong { font-size: 12px; }
.entity-pause-row small { color: var(--muted); font-size: 11px; line-height: 1.35; }
.entity-pause-row input { width: 17px; height: 17px; accent-color: var(--blue); }
.entity-danger-zone { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border); }
.entity-danger-zone strong { font-size: 12px; }
.entity-danger-zone p { margin: 2px 0 0; color: var(--muted); font-size: 11px; line-height: 1.35; }
.entity-repeat-stopped { display: grid; gap: 4px; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface-soft); }
.entity-repeat-stopped span { color: var(--muted); font-size: 11px; }
.entity-secondary-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding-top: var(--space-1); }
.entity-secondary-actions wa-button[variant="danger"]::part(base),
.entity-danger-zone wa-button[variant="danger"]::part(base) { border: 1px solid color-mix(in srgb, var(--red) 28%, var(--border)); background: color-mix(in srgb, var(--red) 5%, transparent); }
.entity-tags-field { display: grid; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 630; }
.entity-tags-list { display: flex; min-height: var(--control-default); flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 7px; border: 1px solid var(--border-strong); border-radius: var(--radius-control); background: var(--bg); }
.entity-tags-list:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
.entity-tags-list input { flex: 1 1 120px; min-width: 100px; height: 24px; padding: 0 3px; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-weight: 450; }
.entity-repeat-editor { display: grid; gap: var(--space-3); padding-top: var(--space-2); }
.entity-weekdays { display: flex; flex-wrap: wrap; gap: 6px; }
.entity-weekdays button { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 50%; background: var(--surface); color: var(--muted); font: inherit; font-size: 10px; font-weight: 700; }
.entity-weekdays button.active { border-color: color-mix(in srgb, var(--blue) 38%, transparent); background: color-mix(in srgb, var(--blue) 12%, var(--surface)); color: var(--blue); }
.entity-color-input { padding: 4px !important; }
.entity-completion-actions { display: grid; gap: var(--space-2); }
.entity-bulk-tags { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.entity-empty-note { color: var(--muted); font-size: 12px; }
.entity-space-list { display: grid; gap: 4px; }
.entity-space-list button { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 10px; min-height: var(--control-default); padding: 5px 10px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--text); text-align: left; font: inherit; }
.entity-space-list button:hover { background: var(--surface-subtle); }
.entity-space-list button.active { background: var(--blue-soft); color: var(--blue); font-weight: 650; }
.entity-space-list i { width: 10px; height: 10px; border-radius: 50%; background: var(--entity-space-color); box-shadow: inset 0 0 0 1px color-mix(in srgb, #000 12%, transparent); }
.entity-space-list b { font-size: 12px; }
.entity-space-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.spaces-editor { gap: var(--space-5); }
.spaces-editor-section { display: grid; gap: var(--space-3); }
.spaces-editor-section > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.spaces-editor-section h3 { margin: 0; font-size: 13px; }
.spaces-editor-section header span, .spaces-editor-help { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
.spaces-editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.spaces-editor-card { display: grid; grid-template-columns: 34px minmax(90px, 1fr) auto auto; align-items: center; gap: var(--space-2); padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface-soft); }
.spaces-editor-color { width: 32px; height: 32px; padding: 3px; border: 1px solid var(--border-strong); border-radius: var(--radius-small); background: var(--bg); }
.spaces-editor-name { min-width: 0; height: var(--control-default); padding: 0 9px; border: 1px solid var(--border-strong); border-radius: var(--radius-control); background: var(--bg); color: var(--text); font: inherit; }
.spaces-editor-add { min-height: 50px; border: 1px dashed var(--border-strong); border-radius: var(--radius-control); background: transparent; color: var(--muted); font: inherit; font-weight: 590; }
.spaces-editor-add:hover { border-color: var(--blue); color: var(--blue); }
.spaces-default-row { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr); align-items: end; gap: var(--space-3); }
.spaces-rules { display: grid; gap: var(--space-2); }
.spaces-rule-card { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(238px, 1.4fr) 96px 96px auto; align-items: end; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface-soft); }
.spaces-rule-days { display: grid; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 630; }
.spaces-rule-card .entity-weekdays { flex-wrap: nowrap; gap: 4px; }
.spaces-rule-card .entity-weekdays button { width: 30px; height: 30px; }
.entity-confirm-copy,
.entity-danger-copy { padding: var(--space-3); border-radius: var(--radius-control); background: color-mix(in srgb, var(--red) 8%, var(--surface)); color: var(--muted); font-size: 12px; line-height: 1.5; }
.entity-confirm-copy { background: var(--surface-soft); }

@media (max-width: 520px) {
  .entity-form-grid { grid-template-columns: 1fr; }
  .entity-native-field.full,
  .entity-form-grid > .full { grid-column: auto; }
  .entity-native-field input, .entity-native-field select { min-height: var(--control-touch); font-size: 16px; }
  .entity-weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .entity-weekdays button { width: 100%; max-width: 40px; height: 40px; justify-self: center; }
  .spaces-editor-grid, .spaces-default-row { grid-template-columns: 1fr; }
  .spaces-editor-card { grid-template-columns: 34px minmax(0, 1fr) auto; }
  .spaces-editor-card wa-checkbox { grid-column: 2; }
  .spaces-editor-card wa-button { grid-column: 3; grid-row: 1 / span 2; }
  .spaces-rule-card { grid-template-columns: 1fr 1fr; }
  .spaces-rule-card wa-select, .spaces-rule-days, .spaces-rule-card wa-button { grid-column: 1 / -1; }
  .spaces-rule-card .entity-weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .spaces-rule-card .entity-weekdays button { width: 100%; max-width: 40px; height: 40px; }
}
`;
