import { useRef, useState } from "preact/hooks";
import type { ObjectsSettings } from "../../../shared/state";
import { eventChecked, eventValue, hideWebAwesomeOverlay, OverlayElement, useWebAwesomeChecked, useWebAwesomeOverlay, ValueElement, WaButton, WaDialog, WaOption, WaSelect, WaSwitch, WaTab, WaTabGroup, WaTabPanel } from "../../ui/webawesome";

export type SettingsPwaSnapshot = {
  installed: boolean;
  canPromptInstall: boolean;
  ios: boolean;
  updateAvailable: boolean;
  notificationPermission: NotificationPermission | "unsupported";
};

export type CalendarDraft = { title: string; start: string; end: string };

export function SettingsDialog({
  settings,
  userName,
  spacesCount,
  launchRulesEnabled,
  tags,
  pendingLogCount,
  pwa,
  onClose,
  onSetting,
  onAction,
  onManageSpaces,
  onAddEvent,
  onAddTag,
  onRenameTag,
  onRemoveTag,
  onImportJson,
  onImportIcs,
}: {
  settings: ObjectsSettings;
  userName: string;
  spacesCount: number;
  launchRulesEnabled: boolean;
  tags: string[];
  pendingLogCount: number;
  pwa: SettingsPwaSnapshot;
  onClose(): void;
  onSetting<K extends keyof ObjectsSettings>(key: K, value: ObjectsSettings[K]): void;
  onAction(action: "logout" | "notifications" | "install" | "update" | "log-now" | "export"): void;
  onManageSpaces(): void;
  onAddEvent(draft: CalendarDraft): void;
  onAddTag(value: string): void;
  onRenameTag(from: string, to: string): void;
  onRemoveTag(tag: string): void;
  onImportJson(event: Event): void;
  onImportIcs(event: Event): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const groupTodaySwitch = useRef<ValueElement | null>(null);
  const calendarSwitch = useRef<ValueElement | null>(null);
  const jsonInput = useRef<HTMLInputElement | null>(null);
  const icsInput = useRef<HTMLInputElement | null>(null);
  const [eventDraft, setEventDraft] = useState<CalendarDraft>({ title: "", start: "", end: "" });
  const [newTag, setNewTag] = useState("");

  useWebAwesomeOverlay(dialog, onClose);
  useWebAwesomeChecked(groupTodaySwitch, settings.groupToday);
  useWebAwesomeChecked(calendarSwitch, settings.showCalendar);

  const logbookHelp = settings.logCompletedItems === "immediately"
    ? "Completed items move to the Logbook as soon as they are checked."
    : settings.logCompletedItems === "manually"
      ? "Completed items stay in their original lists until you log them."
      : "Completed items stay visible for the rest of the day and move to the Logbook after midnight.";
  const installLabel = pwa.installed ? "Installed" : pwa.canPromptInstall ? "Install Objects" : "Installation help";
  const installHelp = pwa.installed
    ? "Objects is running as an installed app."
    : pwa.ios
      ? "On iPhone or iPad, use Share → Add to Home Screen. Notifications are available after installation."
      : "Install from this button when available, or use your browser’s Install app menu.";
  const notificationLabel = pwa.notificationPermission === "unsupported"
    ? "Not supported here"
    : pwa.notificationPermission === "denied"
      ? "Blocked in browser settings"
      : settings.notifications && pwa.notificationPermission === "granted"
        ? "Disable notifications"
        : "Enable notifications";

  return <WaDialog ref={dialog} class="objects-dialog dialog-settings settings-workspace-dialog" label="Settings" light-dismiss>
    <div class="settings-workspace">
      <p class="settings-intro">Make Objects fit your workflow and connect it to the rest of your system.</p>
      <WaTabGroup class="objects-tabs settings-tabs">
        <WaTab slot="nav" panel="general">General</WaTab>
        <WaTab slot="nav" panel="app">App</WaTab>
        <WaTab slot="nav" panel="data">Data</WaTab>

        <WaTabPanel name="general">
          <div class="settings-panel">
            <section class="settings-card">
              <h3>Lakebed account</h3>
              <div class="settings-control-row"><span>Signed in as <strong>{userName}</strong></span><WaButton size="s" appearance="outlined" onClick={() => onAction("logout")}>Sign out</WaButton></div>
            </section>
            <section class="settings-card">
              <h3>Spaces</h3>
              <p>Separate areas of life while keeping everything searchable and editable.</p>
              <div class="settings-control-row"><span>{spacesCount} Space{spacesCount === 1 ? "" : "s"} · {launchRulesEnabled ? "automatic launch selection" : "manual selection"}</span><WaButton size="s" appearance="outlined" onClick={onManageSpaces}>Manage</WaButton></div>
            </section>
            <section class="settings-card">
              <h3>Preferences</h3>
              <div class="settings-control-row"><div class="settings-control-copy"><strong>Group Today</strong><small>Group to-dos by project or area.</small></div><WaSwitch ref={groupTodaySwitch} aria-label="Group Today by project or area" onInput={(event: Event) => onSetting("groupToday", eventChecked(event))} /></div>
              <div class="settings-control-row"><div class="settings-control-copy"><strong>Calendar events</strong><small>Show events in Today and Upcoming.</small></div><WaSwitch ref={calendarSwitch} aria-label="Show calendar events" onInput={(event: Event) => onSetting("showCalendar", eventChecked(event))} /></div>
              <div class="settings-control-row"><span>Week starts on</span><WaSelect value={String(settings.weekStartsOn)} size="s" aria-label="Week starts on" onChange={(event: Event) => onSetting("weekStartsOn", Number(eventValue(event)) as 0 | 1)}><WaOption value="1">Monday</WaOption><WaOption value="0">Sunday</WaOption></WaSelect></div>
              <div class="settings-control-row"><span>Appearance</span><WaSelect value={settings.theme} size="s" aria-label="Appearance" onChange={(event: Event) => onSetting("theme", eventValue(event) as ObjectsSettings["theme"])}><WaOption value="system">System</WaOption><WaOption value="light">Light</WaOption><WaOption value="dark">Dark</WaOption></WaSelect></div>
            </section>
            <section class="settings-card">
              <h3>Logbook</h3><p>{logbookHelp}</p>
              <div class="settings-control-row"><span>Log completed items</span><WaSelect value={settings.logCompletedItems} size="s" aria-label="Log completed items" onChange={(event: Event) => onSetting("logCompletedItems", eventValue(event) as ObjectsSettings["logCompletedItems"])}><WaOption value="immediately">Immediately</WaOption><WaOption value="daily">Daily</WaOption><WaOption value="manually">Manually</WaOption></WaSelect></div>
              {pendingLogCount > 0 && <div class="settings-inline-actions"><WaButton size="s" appearance="outlined" onClick={() => onAction("log-now")}>Log Completed Now ({pendingLogCount})</WaButton></div>}
            </section>
          </div>
        </WaTabPanel>

        <WaTabPanel name="app">
          <div class="settings-panel">
            <section class="settings-card"><h3>Installation</h3><p>{installHelp}</p><div class="settings-inline-actions"><WaButton size="s" appearance="outlined" disabled={pwa.installed} onClick={() => onAction("install")}>{installLabel}</WaButton>{pwa.updateAvailable && <WaButton size="s" variant="brand" onClick={() => onAction("update")}>Update Objects</WaButton>}</div></section>
            <section class="settings-card"><h3>Reminders</h3><p>Notifications work on desktop and mobile. Closed-app delivery still requires a server push scheduler.</p><div class="settings-inline-actions"><WaButton size="s" appearance="outlined" disabled={pwa.notificationPermission === "denied"} onClick={() => onAction("notifications")}>{notificationLabel}</WaButton></div></section>
            <section class="settings-card">
              <h3>Calendar</h3><p>Add an event manually or import a standard .ics calendar file. Events remain private in your Objects data.</p>
              <div class="settings-native-grid">
                <label class="settings-native-field full">Event<input value={eventDraft.title} placeholder="Event title" onInput={(event) => setEventDraft({ ...eventDraft, title: event.currentTarget.value })} /></label>
                <label class="settings-native-field">Starts<input type="datetime-local" value={eventDraft.start} onInput={(event) => setEventDraft({ ...eventDraft, start: event.currentTarget.value })} /></label>
                <label class="settings-native-field">Ends<input type="datetime-local" value={eventDraft.end} onInput={(event) => setEventDraft({ ...eventDraft, end: event.currentTarget.value })} /></label>
              </div>
              <div class="settings-inline-actions"><WaButton size="s" variant="brand" onClick={() => onAddEvent(eventDraft)}>Add event</WaButton><WaButton size="s" appearance="outlined" onClick={() => icsInput.current?.click()}>Import .ics</WaButton><input ref={icsInput} class="settings-hidden-file" type="file" accept=".ics,text/calendar" onChange={(event) => onImportIcs(event as unknown as Event)} /></div>
            </section>
          </div>
        </WaTabPanel>

        <WaTabPanel name="data">
          <div class="settings-panel">
            <section class="settings-card">
              <h3>Tags</h3><p>Create tags here, then choose them from the tag dropdown on a to-do. Renames and removals apply everywhere.</p>
              <form class="settings-tag-form" onSubmit={(event) => { event.preventDefault(); onAddTag(newTag); }}><input value={newTag} maxLength={40} autoComplete="off" placeholder="New tag name" aria-label="New tag name" onInput={(event) => setNewTag(event.currentTarget.value)} /><WaButton type="submit" size="s" variant="brand">Add tag</WaButton></form>
              <div class="settings-tag-list">{tags.length ? tags.map((tag) => <div class="settings-tag-row" key={tag}><input defaultValue={tag} aria-label={`Rename ${tag}`} onChange={(event) => onRenameTag(tag, event.currentTarget.value.trim())} /><WaButton size="s" appearance="plain" variant="danger" onClick={() => onRemoveTag(tag)}>Remove</WaButton></div>) : <p class="settings-empty">No tags yet.</p>}</div>
            </section>
            <section class="settings-card"><h3>Backup</h3><p>Export a complete backup or replace this workspace from another Objects installation.</p><div class="settings-inline-actions"><WaButton size="s" appearance="outlined" onClick={() => onAction("export")}>Export JSON</WaButton><WaButton size="s" appearance="outlined" onClick={() => jsonInput.current?.click()}>Import JSON</WaButton><input ref={jsonInput} class="settings-hidden-file" type="file" accept="application/json,.json" onChange={(event) => onImportJson(event as unknown as Event)} /></div></section>
            <section class="settings-card"><h3>Automation</h3><p class="settings-automation">Open <code>/?title=Call%20Maya%20tomorrow</code> while signed in, or use the authenticated <code>POST /api/tasks</code> endpoint.</p></section>
          </div>
        </WaTabPanel>
      </WaTabGroup>
    </div>
    <div slot="footer" class="settings-footer"><WaButton variant="brand" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Done</WaButton></div>
  </WaDialog>;
}
