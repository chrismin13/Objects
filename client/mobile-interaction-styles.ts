// Final coarse-pointer interaction policy. This layer intentionally loads after
// component styles so iOS cannot reintroduce focus zoom with a smaller field
// font. Mouse/trackpad-only browsers do not match this media query.
export const mobileInteractionStyles = `
@media (any-pointer: coarse) {
  /* iOS magnifies focused form controls rendered below 16px. Keep prominent
     title fields at their existing size and raise every smaller editor to the
     platform-safe baseline. */
  input:not(.inspector-title),
  textarea,
  select {
    font-size: 16px !important;
  }

  /* Remove double-tap zoom from activation surfaces without blocking a
     deliberate pinch gesture. To-do rows retain their narrower pan-y policy
     for the app's horizontal swipe interaction. */
  :where(
    button,
    [role="button"],
    a[href],
    summary,
    label[for],
    input,
    textarea,
    select,
    wa-button,
    wa-checkbox,
    wa-dropdown-item,
    wa-select,
    wa-switch,
    wa-tab
  ) {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* The shell owns the viewport; nested panes own scrolling. Containment keeps
     a boundary gesture from moving the page or the surface behind an overlay. */
  html,
  body {
    overscroll-behavior: none;
  }
  :where(
    .content,
    .sidebar-nav,
    .inspector-scroll,
    .search-results,
    .selection-toolbar,
    .filter-bar,
    .tag-picker-menu
  ) {
    overscroll-behavior: contain;
  }
  .objects-dialog::part(body) {
    overscroll-behavior: contain;
  }

  /* These surfaces use tap, swipe, drag, or a custom long-press menu. Native
     text selection and callouts remain available in editors and note content. */
  :where(
    .sidebar,
    .mobile-header,
    .task-row,
    .section-header,
    .selection-toolbar,
    [data-project-card]
  ) {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  :where(input, textarea, select, .markdown-preview) {
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
  }

  :where(
    .nav-item,
    .icon-button,
    .quiet-button,
    .section-add,
    .chip,
    .task-main,
    .task-select,
    .project-card
  ):active {
    opacity: .78;
  }
}
`;
