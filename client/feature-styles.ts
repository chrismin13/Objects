export const featureStyles = `
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
.completion-choices { display: grid; gap: 8px; margin: 20px 0; }
.tag-manager { display: grid; gap: 8px; }
.tag-manager-row { gap: 8px; }
.tag-manager-row .detail-input { min-width: 0; }
.form-field textarea {
  width: 100%;
  resize: vertical;
  min-height: 80px;
  border: 1px solid var(--faint);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  background: var(--surface);
  font: inherit;
}
`;
