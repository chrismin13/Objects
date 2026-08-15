// Final coarse-pointer interaction policy. This layer intentionally loads after
// component styles so iOS cannot reintroduce focus zoom with a smaller field
// font. Mouse/trackpad-only browsers do not match this media query.
export const mobileInteractionStyles = `
html.objects-ios-standalone,
html.objects-ios-standalone body,
html.objects-ios-standalone #app {
  overflow-x: hidden;
  overflow-x: clip;
}
html.objects-ios-standalone .app-shell {
  touch-action: pan-x pan-y;
}

@media (any-pointer: coarse) {
  /* iOS magnifies focused form controls rendered below 16px. Keep prominent
     title fields at their existing size and raise every smaller editor to the
     platform-safe baseline. */
  input:not(.inspector-title),
  textarea,
  select {
    font-size: 16px !important;
  }

  /* Remove double-tap zoom from activation surfaces while regular browser
     sessions retain deliberate pinch zoom. Installed iOS PWAs use the stricter
     root policy above. To-do rows retain pan-y for horizontal app swipes. */
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

  /* Vertical panes must not become sideways scroll containers when an iOS
     temporal control reports a large intrinsic width. Explicit horizontal
     rails such as filter bars remain independently scrollable. */
  :where(.content, .sidebar-nav, .inspector-scroll) {
    overflow-x: hidden;
  }
  :where(.detail-group, .detail-row, .detail-group > :not(.detail-label)) {
    min-width: 0;
  }
  :where(.detail-input, .detail-select) {
    max-width: 100%;
  }
  input:is(
    [type="date"],
    [type="time"],
    [type="datetime-local"],
    [type="month"],
    [type="week"]
  ) {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
  input:is(
    [type="date"],
    [type="time"],
    [type="datetime-local"],
    [type="month"],
    [type="week"]
  )::-webkit-datetime-edit {
    min-width: 0;
    overflow: hidden;
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
    overflow-x: hidden;
    overscroll-behavior: contain;
  }

  /* These surfaces use tap, swipe, drag, or a mouse context menu. Native text
     selection and callouts remain available in editors and note content. */
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

  /* Programmatic focus after a tap must not look like keyboard selection.
     Physical keyboard navigation opts back into the shared focus treatment. */
  html:not(.objects-keyboard-navigation) {
    --wa-focus-ring-width: 0px;
  }
  html:not(.objects-keyboard-navigation) :where(input, textarea, select):focus {
    outline: none;
    box-shadow: none;
  }
  html:not(.objects-keyboard-navigation) wa-select:focus-within::part(combobox) {
    box-shadow: none;
  }

  /* iOS can synthesize hover while a finger is down. Rows in scrolling panes
     stay visually neutral until a real tap changes application state. */
  .nav-item:not(.active):hover {
    background: transparent;
  }
  .task-row:not(.selected):not(.bulk-selected):hover {
    background: transparent;
  }
  .project-card:hover {
    border-color: var(--border);
    background: var(--bg);
  }
}
`;
