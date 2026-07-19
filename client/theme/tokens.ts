export const designTokens = `
:root {
  color-scheme: light;
  --sidebar-width: 268px;
  --inspector-width: 340px;

  --bg: #f4f4f4;
  --surface: #ffffff;
  --surface-subtle: #f2f3f4;
  --surface-hover: #e8e9ea;
  --sidebar: #f3f4f5;
  --text: #202124;
  --muted: #85878b;
  --faint: #bec1c5;
  --border: rgba(35, 38, 42, .075);
  --border-strong: rgba(35, 38, 42, .14);
  --blue: #1686ed;
  --blue-soft: #e8f3fd;
  --yellow: #f4c82f;
  --red: #ef476f;
  --green: #43b979;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --control-compact: 30px;
  --control-default: 36px;
  --control-touch: 44px;
  --radius-small: 7px;
  --radius-control: 9px;
  --radius-panel: 15px;
  --shadow: 0 22px 70px rgba(27, 28, 26, .17), 0 3px 12px rgba(27, 28, 26, .08);
  --ease: cubic-bezier(.2, .8, .2, 1);
  --duration-fast: 120ms;
  --duration-default: 180ms;
  --duration-slow: 300ms;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #1c1c1e;
  --surface: #1c1c1e;
  --surface-subtle: #292a2d;
  --surface-hover: #323337;
  --sidebar: #19191b;
  --text: #f4f4f5;
  --muted: #9a9b9e;
  --faint: #626469;
  --border: rgba(255, 255, 255, .075);
  --border-strong: rgba(255, 255, 255, .14);
  --blue: #4aa2ff;
  --blue-soft: #20384f;
  --yellow: #f0bf43;
  --red: #f07870;
  --green: #66bd86;
  --shadow: 0 22px 70px rgba(0, 0, 0, .36), 0 3px 12px rgba(0, 0, 0, .22);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-default: 0ms;
    --duration-slow: 0ms;
  }
}
`;
