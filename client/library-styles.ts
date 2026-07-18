export const libraryStyles = `
:root {
  --wa-font-family-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --wa-font-family-heading: var(--wa-font-family-body);
  --wa-color-brand-50: var(--blue);
  --wa-focus-ring-color: color-mix(in srgb, var(--blue) 32%, transparent);
}

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
.objects-dialog::part(dialog) {
  max-height: calc(100dvh - 24px);
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.objects-dialog::part(body) { padding: 0; }
.objects-dialog .modal-backdrop {
  position: static;
  display: block;
  padding: 0;
  overflow: visible;
  background: transparent;
  backdrop-filter: none;
  animation: none;
}
.objects-dialog .modal {
  width: 100%;
  max-width: none;
  max-height: calc(100dvh - 24px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  animation: none;
}
.objects-dialog .quick-find { margin: 0; }
.objects-dialog .space-settings-modal { max-height: calc(100dvh - 24px); }

@media (max-width: 520px) {
  .objects-dialog { --width: calc(100vw - 16px); }
  .objects-dialog::part(dialog) { max-height: calc(100dvh - 16px); border-radius: 13px; }
  .objects-dialog .modal, .objects-dialog .space-settings-modal { max-height: calc(100dvh - 16px); }
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
