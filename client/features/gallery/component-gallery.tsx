import { useEffect, useRef, useState } from "preact/hooks";
import { webAwesomeReady } from "../../vendor/webawesome/loader";
import { hideWebAwesomeOverlay, OverlayElement, WaButton, WaButtonGroup, WaCheckbox, WaDetails, WaDialog, WaDivider, WaDrawer, WaDropdown, WaDropdownItem, WaOption, WaProgressRing, WaSelect, WaSwitch, WaTab, WaTabGroup, WaTabPanel, WaTag, WaTooltip } from "../../ui/webawesome";
import { componentGalleryStyles } from "./component-gallery-styles";

export function isComponentGalleryLocation(): boolean {
  if (typeof window === "undefined") return false;
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("ui_gallery") === "1" || params.get("ui_harness") === "1";
}

export function ComponentGallery() {
  const dialog = useRef<OverlayElement | null>(null);
  const drawer = useRef<OverlayElement | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  useEffect(() => {
    void webAwesomeReady;
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = theme;
    return () => {
      if (previous) document.documentElement.dataset.theme = previous;
      else delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return <main class="component-gallery">
    <style>{componentGalleryStyles}</style>
    <div class="gallery-shell">
      <header class="gallery-header">
        <div>
          <p class="gallery-kicker">Objects design system</p>
          <h1>Quiet controls, deliberate behavior.</h1>
          <p>This production-themed gallery is the visual contract for Web Awesome, native fields, and Objects-specific interaction surfaces.</p>
        </div>
        <div class="gallery-actions">
          <WaButton appearance="outlined" size="s" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "Dark preview" : "Light preview"}</WaButton>
          <WaTooltip content="Return to the application">
            <WaButton appearance="plain" size="s" aria-label="Return to Objects" onClick={() => window.location.assign("/")}>×</WaButton>
          </WaTooltip>
        </div>
      </header>

      <div class="gallery-grid">
        <section class="gallery-card wide">
          <h2>Actions and overlays</h2>
          <p>Standard actions use one density, one focus language, and library-owned overlay behavior.</p>
          <div class="gallery-row">
            <WaButton variant="brand" onClick={() => dialog.current?.show()}>Create project</WaButton>
            <WaButton appearance="outlined" onClick={() => drawer.current?.setAttribute("open", "")}>Open inspector</WaButton>
            <WaButton appearance="plain">Cancel</WaButton>
            <WaButton variant="danger" appearance="plain">Move to Trash</WaButton>
            <WaDropdown>
              <WaButton slot="trigger" appearance="outlined" with-caret>More</WaButton>
              <WaDropdownItem value="duplicate">Duplicate</WaDropdownItem>
              <WaDropdownItem value="someday">Move to Someday</WaDropdownItem>
              <WaDivider />
              <WaDropdownItem value="trash" variant="danger">Move to Trash</WaDropdownItem>
            </WaDropdown>
          </div>
        </section>

        <section class="gallery-card">
          <h2>Settings controls</h2>
          <p>Commodity choices may change slightly while retaining compact, familiar behavior.</p>
          <div class="gallery-stack">
            <div class="gallery-setting-row">
              <div class="gallery-setting-copy"><strong>Show calendar events</strong><span>Include events in Today and Upcoming.</span></div>
              <WaSwitch checked aria-label="Show calendar events" />
            </div>
            <div class="gallery-setting-row">
              <div class="gallery-setting-copy"><strong>Group Today</strong><span>Organize tasks by project or area.</span></div>
              <WaCheckbox checked aria-label="Group Today by project" />
            </div>
            <WaSelect label="Appearance" value="system" size="s">
              <WaOption value="system">System</WaOption>
              <WaOption value="light">Light</WaOption>
              <WaOption value="dark">Dark</WaOption>
            </WaSelect>
          </div>
        </section>

        <section class="gallery-card">
          <h2>Native fields</h2>
          <p>Text and date entry stay native and share the same theme, validation, and touch sizing.</p>
          <div class="gallery-form-grid">
            <label class="gallery-native-field">Project name<input value="Plan summer trip" /></label>
            <label class="gallery-native-field">Start date<input type="date" value="2026-08-06" /></label>
          </div>
          <WaDivider />
          <div class="gallery-row">
            <WaTag size="s" variant="brand">Focused</WaTag>
            <WaTag size="s">Errand</WaTag>
            <WaTag size="s">Home</WaTag>
          </div>
        </section>

        <section class="gallery-card wide">
          <h2>Structured preferences</h2>
          <p>Tabs are reserved for dense, genuinely separate settings categories—not primary navigation or the Spaces pill.</p>
          <WaTabGroup class="objects-tabs">
            <WaTab slot="nav" panel="general">General</WaTab>
            <WaTab slot="nav" panel="tasks">Tasks</WaTab>
            <WaTab slot="nav" panel="data">Data</WaTab>
            <WaTabPanel name="general">
              <div class="gallery-setting-row"><div class="gallery-setting-copy"><strong>Week starts on</strong><span>Used by Upcoming and repeat rules.</span></div><WaButtonGroup><WaButton size="s" variant="brand">Monday</WaButton><WaButton size="s" appearance="outlined">Sunday</WaButton></WaButtonGroup></div>
            </WaTabPanel>
            <WaTabPanel name="tasks">
              <WaDetails summary="Logbook behavior"><p class="gallery-dialog-copy">Completed items stay visible for the rest of the day and move to the Logbook after midnight.</p></WaDetails>
            </WaTabPanel>
            <WaTabPanel name="data"><p class="gallery-dialog-copy">Export and guarded import remain explicit application workflows.</p></WaTabPanel>
          </WaTabGroup>
        </section>

        <section class="gallery-card">
          <h2>Project status</h2>
          <p>Progress remains quiet and secondary to the project title.</p>
          <div class="gallery-progress">
            <WaProgressRing value="68" style="--size:48px;--track-width:4px">68%</WaProgressRing>
            <div><strong>Launch the new site</strong><span>5 of 7 to-dos complete</span></div>
          </div>
        </section>

        <section class="gallery-card">
          <h2>Density contract</h2>
          <p>Desktop controls remain compact; touch layouts expand targets without inflating the visual hierarchy.</p>
          <div class="gallery-stack">
            <WaDetails summary="Desktop"><p class="gallery-dialog-copy">30–36px controls, 39px task rows, restrained gaps.</p></WaDetails>
            <WaDetails summary="Touch"><p class="gallery-dialog-copy">44px minimum targets and 52px task rows.</p></WaDetails>
          </div>
        </section>
      </div>
    </div>

    <WaDialog ref={dialog} class="objects-dialog" label="Create a project">
      <div class="gallery-stack">
        <label class="gallery-native-field">Name<input autofocus placeholder="Project name" /></label>
        <WaSelect label="Space" value="personal"><WaOption value="personal">Personal</WaOption><WaOption value="work">Work</WaOption></WaSelect>
      </div>
      <div slot="footer" class="gallery-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, () => {})}>Cancel</WaButton><WaButton size="s" variant="brand" onClick={(event: Event) => hideWebAwesomeOverlay(event, () => {})}>Create</WaButton></div>
    </WaDialog>
    <WaDrawer ref={drawer} class="objects-mobile-drawer inspector-drawer" label="To-do details" placement="end">
      <div class="gallery-stack"><label class="gallery-native-field">Title<input value="Review the release checklist" /></label><WaSwitch checked>Today</WaSwitch><WaTag size="s" variant="brand">Focused</WaTag></div>
      <div slot="footer" class="gallery-dialog-actions"><WaButton appearance="plain" onClick={() => drawer.current?.removeAttribute("open")}>Done</WaButton></div>
    </WaDrawer>
  </main>;
}
