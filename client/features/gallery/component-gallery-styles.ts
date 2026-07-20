export const componentGalleryStyles = `
.component-gallery {
  min-height: 100dvh;
  overflow-y: auto;
  padding: clamp(24px, 4vw, 56px);
  background: var(--bg);
  color: var(--text);
}
.gallery-shell { width: min(1120px, 100%); margin: 0 auto; }
.gallery-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}
.gallery-kicker { margin: 0 0 6px; color: var(--blue); font-size: 11px; font-weight: 720; letter-spacing: .11em; text-transform: uppercase; }
.gallery-header h1 { margin: 0; font-size: clamp(30px, 4vw, 42px); letter-spacing: -.04em; }
.gallery-header p:last-child { max-width: 660px; margin: 10px 0 0; color: var(--muted); line-height: 1.55; }
.gallery-actions { display: flex; gap: var(--space-2); }
.gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.gallery-card {
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .03);
}
.gallery-card.wide { grid-column: 1 / -1; }
.gallery-card h2 { margin: 0; font-size: 16px; letter-spacing: -.015em; }
.gallery-card > p { margin: 7px 0 var(--space-4); color: var(--muted); font-size: 12px; line-height: 1.5; }
.gallery-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.gallery-stack { display: grid; gap: var(--space-3); }
.gallery-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.gallery-native-field { display: grid; gap: 6px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 620; }
.gallery-native-field input {
  width: 100%;
  height: var(--control-default);
  padding: 0 11px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--bg);
}
.gallery-native-field input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 16%, transparent); }
.gallery-setting-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: 42px; }
.gallery-setting-copy { min-width: 0; }
.gallery-setting-copy strong { display: block; font-size: 13px; }
.gallery-setting-copy span { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }
.gallery-progress { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-4); }
.gallery-progress strong { display: block; font-size: 14px; }
.gallery-progress span { color: var(--muted); font-size: 12px; }
.gallery-dialog-copy { margin: 0; color: var(--muted); line-height: 1.55; }
.gallery-dialog-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }

@media (max-width: 720px) {
  .component-gallery { padding: 22px 14px calc(28px + var(--safe-area-bottom)); }
  .gallery-header { align-items: stretch; flex-direction: column; }
  .gallery-grid { grid-template-columns: 1fr; }
  .gallery-card.wide { grid-column: auto; }
  .gallery-form-grid { grid-template-columns: 1fr; }
  .gallery-actions { justify-content: flex-start; }
}
`;
