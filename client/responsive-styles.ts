export const responsiveStyles = `
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

.check-button {
  border: 0;
  background: transparent;
  box-shadow: none;
}
.check-button:hover,
.check-button.checked {
  border: 0;
  background: transparent;
  box-shadow: none;
}
.check-visual {
  width: 19px;
  height: 19px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--faint);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  transition: all .18s var(--ease);
}
.check-button:hover .check-visual {
  border-color: var(--blue);
  background: var(--blue-soft);
  box-shadow: inset 0 0 0 3px var(--surface);
}
.check-button.checked .check-visual {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
  box-shadow: none;
}
.check-visual svg { width: 12px; height: 12px; stroke-width: 3; }

:where(button, [role="button"], input, textarea, select):focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.task-main:focus-visible {
  border-radius: 5px;
}
.modal:focus { outline: none; }
.inspector:focus { outline: none; }
.heading-actions:focus-within { opacity: 1; }

@media (max-width: 820px) {
  .heading-actions { opacity: 1; }
  .sidebar,
  .main-pane {
    touch-action: pan-y;
  }
  .sidebar {
    will-change: transform;
  }
  .scrim {
    display: block;
    position: fixed;
    z-index: 15;
    inset: 0;
    background: rgba(0, 0, 0, .3);
    opacity: 0;
    pointer-events: none;
    transition: opacity .3s var(--ease);
  }
  .app-shell.sidebar-open .scrim {
    opacity: 1;
    pointer-events: auto;
  }
  .app-shell.sidebar-dragging .sidebar {
    transform: translate3d(var(--sidebar-gesture-x, -102%), 0, 0);
    transition: none;
  }
  .app-shell.sidebar-dragging .scrim {
    opacity: var(--sidebar-gesture-progress, 0);
    pointer-events: none;
    transition: none;
  }
  .mobile-header {
    height: calc(60px + var(--safe-area-top));
    padding: calc(8px + var(--safe-area-top)) 8px 8px;
  }
  .content {
    padding-top: calc(90px + var(--safe-area-top));
    padding-bottom: calc(110px + var(--safe-area-bottom));
  }
  .sidebar {
    padding-top: var(--safe-area-top);
    padding-bottom: var(--safe-area-bottom);
  }
  .inspector-scroll {
    padding-top: calc(23px + var(--safe-area-top));
    padding-bottom: calc(30px + var(--safe-area-bottom));
  }
  .icon-button,
  .magic-add {
    width: 44px;
    height: 44px;
  }
  .magic-add {
    top: calc(8px + var(--safe-area-top));
    right: 60px;
  }
  .nav-item,
  .quiet-button,
  .section-add,
  .button,
  .danger-button,
  .chip,
  .markdown-toggle,
  .checklist-add {
    min-height: 44px;
  }
  .task-row {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 1px;
    min-height: 52px;
  }
  .task-main { min-height: 44px; }
  .filter-bar .chip { min-width: 44px; }
  .check-button {
    width: 44px;
    height: 44px;
    margin: -12px 0 -12px -12px;
  }
  .quick-add-input,
  .detail-select,
  .detail-input,
  .form-field input,
  .form-field select {
    min-height: 44px;
    font-size: 16px;
  }
  .form-field textarea,
  .inspector-notes,
  .checklist-item input[type="text"] {
    font-size: 16px;
  }
  .checklist-item {
    grid-template-columns: 24px minmax(0, 1fr) 44px;
    gap: 6px;
  }
  .checklist-item input[type="checkbox"] {
    width: 24px;
    height: 24px;
  }
  .checklist-item input[type="text"] { min-height: 44px; }
  .checklist-remove { width: 44px; height: 44px; }
  .inspector-actions { flex-wrap: wrap; }
  .search-result { min-height: 52px; }
  .toast-region { bottom: calc(18px + var(--safe-area-bottom)); }
}

@media (max-width: 520px) {
  .key-hint { display: none; }
  .auth-card {
    padding-top: calc(28px + var(--safe-area-top));
    padding-bottom: calc(28px + var(--safe-area-bottom));
  }
  .modal-backdrop {
    padding-top: calc(12px + var(--safe-area-top));
    padding-bottom: calc(12px + var(--safe-area-bottom));
  }
}
`;
