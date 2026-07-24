export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_COOKIE = "objects-theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// The cookie is a device-level cache of the last applied theme choice. The
// synced workspace setting stays the source of truth; the cookie only covers
// the pre-auth window so the boot screens render in the right theme.
export function readThemeChoice(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  const value = match?.[1] ?? "";
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function writeThemeChoice(choice: ThemeChoice): void {
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeToDocument(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("wa-dark", resolved === "dark");
  root.classList.toggle("wa-light", resolved !== "dark");
  // Interim background and color scheme on <html> so the page never flashes
  // the wrong theme while the packed theme CSS is still decoding.
  root.style.backgroundColor = resolved === "dark" ? "#1c1c1e" : "#f4f4f4";
  root.style.colorScheme = resolved;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", resolved === "dark" ? "#222321" : "#f6f5f2");
  return resolved;
}

let booted = false;

// Runs at the top of the client entry, before the first render, so the boot
// skeleton matches the device theme (or the cookie override) immediately.
export function initThemeBoot(): void {
  if (booted) return;
  booted = true;
  applyThemeToDocument(readThemeChoice());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readThemeChoice() === "system") applyThemeToDocument("system");
  });
}
