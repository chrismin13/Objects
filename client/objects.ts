// @ts-nocheck
import { h, render as renderPreact } from 'preact';
import { activatePwaUpdate, getPwaStatus, requestNotificationAccess, requestPwaInstall, showTaskReminder } from './pwa';
import { parseNaturalDate as parseNaturalDateCore, parseNaturalTask as parseNaturalTaskCore } from './app/model';
import { reorderChecklist, reorderEntities, reorderTasks } from './app/actions';
import { destroyChecklistSortable, destroyHeadingSortable, destroyTaskSortables, mountChecklistSortable, mountHeadingSortable, mountTaskSortables } from './ui/sortable';
import { QuickFind } from './features/search/quick-find';
import { SettingsDialog } from './features/settings/settings-dialog';
import { AreaDialog, BulkTagsDialog, ConfirmDialog, FinishProjectDialog, HeadingDialog, MoveTasksDialog, NewListDialog, ProjectDialog, RepeatingTemplateDialog, SpacesSettingsDialog, SpaceSwitcherDialog } from './features/entities/entity-dialogs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const icons = {
  inbox: '<path d="M4 5h16v12H4z"/><path d="M4 13h4l2 3h4l2-3h4"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  archive: '<path d="M4 7v14h16V7M2 3h20v4H2zM9 11h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  folder: '<path d="M3 5h6l2 2h10v12H3z"/>',
  area: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  tag: '<path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="6.5" r=".7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  cloud: '<path d="M17.5 19H6a4 4 0 0 1-.4-7.98A6.5 6.5 0 0 1 18 9a5 5 0 0 1-.5 10Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkle: '<path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15a1.7 1.7 0 0 0-1.56-1H3v-4h.09A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3.09V3h4v.09A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 20.91 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
  heading: '<path d="M4 6h10M4 12h10M4 18h10"/><path d="M19 8v8M15 12h8"/>',
  download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>',
  upload: '<path d="M12 17V5m0 0 5 5m-5-5-5 5M5 21h14"/>',
  markdown: '<path d="M3 6h18v12H3zM6 15V9l3 3 3-3v6M17 9v6m-2-2 2 2 2-2"/>',
};

function icon(name, className = '') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.circle}</svg>`;
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

const WEEKDAYS = [
  { value: 0, short: 'Sun', narrow: 'S', label: 'Sunday' },
  { value: 1, short: 'Mon', narrow: 'M', label: 'Monday' },
  { value: 2, short: 'Tue', narrow: 'T', label: 'Tuesday' },
  { value: 3, short: 'Wed', narrow: 'W', label: 'Wednesday' },
  { value: 4, short: 'Thu', narrow: 'T', label: 'Thursday' },
  { value: 5, short: 'Fri', narrow: 'F', label: 'Friday' },
  { value: 6, short: 'Sat', narrow: 'S', label: 'Saturday' },
];

function orderedWeekdays() {
  const firstDay = Number(ui.state?.settings?.weekStartsOn ?? 1) === 0 ? 0 : 1;
  return Array.from({ length: 7 }, (_, index) => WEEKDAYS[(firstDay + index) % 7]);
}

function renderWeekdayPicker(selectedDays = [], dataAttribute = 'data-weekday', ariaPrefix = 'Repeat on') {
  const selected = new Set((selectedDays || []).map(Number));
  return orderedWeekdays().map((day) => `<button class="chip ${selected.has(day.value) ? 'active' : ''}" type="button" ${dataAttribute}="${day.value}" aria-pressed="${selected.has(day.value)}" aria-label="${esc(`${ariaPrefix} ${day.label}`)}"><span class="weekday-long">${day.short}</span><span class="weekday-short">${day.narrow}</span></button>`).join('');
}

function suppressRepeatedActivation(event) {
  if (event.detail < 2 || !event.target.closest?.('button, [role="button"], [data-task-id], [data-view], [data-modal-close], a[href], input[type="checkbox"], input[type="radio"], label[for]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDay(date);
}

function dayDistance(fromDay, toDay) {
  if (!fromDay || !toDay) return null;
  return Math.round((new Date(`${toDay}T12:00:00`) - new Date(`${fromDay}T12:00:00`)) / 86400000);
}

function moveReminderToDate(task, date) {
  if (!task.reminderAt) return;
  task.reminderAt = date ? `${date}T${task.reminderAt.slice(11, 16) || '09:00'}` : null;
  task.reminderSentAt = null;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const ENTITY_KINDS = ['spaces', 'areas', 'projects', 'headings', 'calendarEvents', 'tasks'];

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function recordPatch(previous = {}, current = {}) {
  const patch = {};
  for (const key of new Set([...Object.keys(previous || {}), ...Object.keys(current || {})])) {
    if (key === 'id' || current[key] === undefined || sameValue(previous[key], current[key])) continue;
    patch[key] = current[key];
  }
  return patch;
}

function buildChangeSet() {
  if (!ui.state || !ui.syncedState) return null;
  const changes = { mutationId: uid('mutation'), settings: recordPatch(ui.syncedState.settings, ui.state.settings), entities: {}, deletes: {} };
  let changed = Object.keys(changes.settings).length > 0;
  for (const kind of ENTITY_KINDS) {
    const previous = new Map((ui.syncedState[kind] || []).map((item) => [item.id, item]));
    const current = new Map((ui.state[kind] || []).map((item) => [item.id, item]));
    const patches = [];
    const deletes = [];
    for (const [id, item] of current) {
      const patch = recordPatch(previous.get(id), item);
      if (!previous.has(id)) {
        for (const [key, value] of Object.entries(item)) if (key !== 'id') patch[key] = value;
      }
      if (Object.keys(patch).length) patches.push({ id, patch });
    }
    for (const id of previous.keys()) {
      if (!current.has(id)) deletes.push(id);
    }
    if (patches.length) { changes.entities[kind] = patches; changed = true; }
    if (deletes.length) { changes.deletes[kind] = deletes; changed = true; }
  }
  return changed ? changes : null;
}

function acknowledgeChanges(changes, serializedAck) {
  const ack = JSON.parse(serializedAck);
  const baseline = cloneData(ui.syncedState);
  baseline.settings = { ...baseline.settings, ...(changes.settings || {}) };
  for (const kind of ENTITY_KINDS) {
    const deleted = new Set(changes.deletes?.[kind] || []);
    const items = new Map((baseline[kind] || []).filter((item) => !deleted.has(item.id)).map((item) => [item.id, item]));
    for (const change of changes.entities?.[kind] || []) {
      items.set(change.id, { ...(items.get(change.id) || { id: change.id }), ...cloneData(change.patch) });
    }
    baseline[kind] = [...items.values()];
  }
  baseline.updatedAt = ack.updatedAt;
  baseline.syncMutationId = ack.mutationId;
  ui.syncedState = baseline;
  ui.state.updatedAt = ack.updatedAt;
  ui.state.syncMutationId = ack.mutationId;
  ui.ownMutationIds.delete(ack.mutationId);
}

function mergeRecord(previous, local, remote) {
  if (!remote) return previous ? undefined : local ? cloneData(local) : undefined;
  if (!local) return previous ? undefined : cloneData(remote);
  const merged = { id: remote.id || local.id };
  for (const key of new Set([...Object.keys(previous || {}), ...Object.keys(local), ...Object.keys(remote)])) {
    if (key === 'id') continue;
    const localChanged = !sameValue(local[key], previous?.[key]);
    const value = localChanged ? local[key] : remote[key];
    if (value !== undefined) merged[key] = cloneData(value);
  }
  return merged;
}

function mergeCollection(previousItems = [], localItems = [], remoteItems = []) {
  const previous = new Map(previousItems.map((item) => [item.id, item]));
  const local = new Map(localItems.map((item) => [item.id, item]));
  const remote = new Map(remoteItems.map((item) => [item.id, item]));
  const merged = [];
  for (const id of new Set([...previous.keys(), ...local.keys(), ...remote.keys()])) {
    const item = mergeRecord(previous.get(id), local.get(id), remote.get(id));
    if (item) merged.push(item);
  }
  return merged;
}

const ui = {
  state: null,
  syncedState: null,
  user: null,
  activeSpaceId: 'all',
  view: { type: 'today', id: null },
  selectedTaskId: null,
  selectedTaskIds: new Set(),
  selectionAnchorId: null,
  saveTimer: null,
  saveReady: false,
  saveInFlight: false,
  saveQueued: false,
  saveFailures: 0,
  renderAfterSave: false,
  ownMutationIds: new Set(),
  lastCompleted: null,
  activeTags: new Set(),
  markdownPreview: false,
  draggedTaskId: null,
  draggedHeadingId: null,
  draggedList: null,
  reminderTimer: null,
  reminderCheckRunning: false,
  pwaUpdateNotified: false,
  syncTimer: null,
  noteFindOpen: false,
  noteFindQuery: '',
  noteFindIndex: 0,
  draggingMagicAdd: false,
  sortableTaskDrag: false,
  suppressClickUntil: 0,
  pendingEntry: null,
  launchRulesEnabled: false,
  launchRulesPreferenceLoaded: false,
};

let app;
let content;
let sidebar;
let sidebarPanel;
let inspector;
let persistChanges = async () => null;
let initializePersistentState = async (serialized) => serialized;
let performSignOut = async () => {};
let staticEventsBound = false;
let logbookTimer = null;
let modalReturnFocus = null;
let sidebarGesture = null;
let taskGesture = null;
let contextPress = null;
let modalUsesPreact = false;

function storageIdentity() {
  return ui.user?.userId || ui.user?.displayName || 'guest';
}

function pendingEntryStorageKey() {
  return `objects-pending-entry:${storageIdentity()}`;
}

function spaceSelectionStorageKey() {
  return `objects-active-space:${storageIdentity()}`;
}

function launchRulesStorageKey() {
  return `objects-use-launch-rules:${storageIdentity()}`;
}

function initializeLaunchRulesPreference(legacyValue = false) {
  if (ui.launchRulesPreferenceLoaded) return;
  ui.launchRulesPreferenceLoaded = true;
  try {
    const stored = localStorage.getItem(launchRulesStorageKey());
    if (stored !== null) {
      ui.launchRulesEnabled = stored === 'true';
      return;
    }
    ui.launchRulesEnabled = Boolean(legacyValue);
    localStorage.setItem(launchRulesStorageKey(), String(ui.launchRulesEnabled));
  } catch (_) {
    ui.launchRulesEnabled = Boolean(legacyValue);
  }
}

function setLaunchRulesEnabled(enabled) {
  ui.launchRulesEnabled = Boolean(enabled);
  try { localStorage.setItem(launchRulesStorageKey(), String(ui.launchRulesEnabled)); } catch (_) {}
}

function readRememberedSpace() {
  try { return localStorage.getItem(spaceSelectionStorageKey()) || 'all'; } catch (_) { return 'all'; }
}

function rememberActiveSpace() {
  try { localStorage.setItem(spaceSelectionStorageKey(), ui.activeSpaceId); } catch (_) {}
}

function minutesFromClock(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

function scheduleRuleMatches(rule, date = new Date()) {
  const start = minutesFromClock(rule.start);
  const end = minutesFromClock(rule.end);
  const weekdays = Array.isArray(rule.weekdays) ? rule.weekdays : [];
  if (start === null || end === null || start === end || !weekdays.length) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  if (start < end) return weekdays.includes(date.getDay()) && now >= start && now < end;
  if (now >= start) return weekdays.includes(date.getDay());
  const previousDay = (date.getDay() + 6) % 7;
  return now < end && weekdays.includes(previousDay);
}

function scheduledSpaceOnLaunch() {
  const schedule = ui.state.settings.spaceSchedule;
  if (!ui.launchRulesEnabled) return null;
  const match = (schedule.rules || []).find((rule) => spaceById(rule.spaceId) && scheduleRuleMatches(rule));
  return match?.spaceId || (spaceById(ui.state.settings.defaultSpaceId)?.id ?? 'all');
}

function initializeActiveSpace() {
  const scheduled = scheduledSpaceOnLaunch();
  const remembered = readRememberedSpace();
  ui.activeSpaceId = scheduled || (remembered === 'all' || spaceById(remembered) ? remembered : 'all');
}

function legacyDraftStorageKey() {
  return `objects-quick-draft:${storageIdentity()}`;
}

function readStoredValue(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) { return null; }
}

function writePendingEntry(entry) {
  try {
    if (entry?.task?.id) localStorage.setItem(pendingEntryStorageKey(), JSON.stringify(entry));
    else localStorage.removeItem(pendingEntryStorageKey());
  } catch (_) {}
}

function rememberPendingTask(task) {
  const revision = (ui.pendingEntry?.revision || 0) + 1;
  ui.pendingEntry = { task: cloneData(task), revision, updatedAt: new Date().toISOString() };
  writePendingEntry(ui.pendingEntry);
}

function rememberPendingDeletion(taskId) {
  const revision = (ui.pendingEntry?.revision || 0) + 1;
  ui.pendingEntry = { task: { id: taskId, title: '', __deleted: true }, revision, updatedAt: new Date().toISOString() };
  writePendingEntry(ui.pendingEntry);
}

function recoverPendingEntry() {
  const entry = readStoredValue(pendingEntryStorageKey());
  if (!entry?.task?.id || typeof entry.task.title !== 'string') return false;
  if (entry.task.__deleted) {
    ui.state.tasks = ui.state.tasks.filter((task) => task.id !== entry.task.id);
    ui.pendingEntry = entry;
    return true;
  }
  const index = ui.state.tasks.findIndex((task) => task.id === entry.task.id);
  if (index >= 0) ui.state.tasks[index] = { ...ui.state.tasks[index], ...entry.task };
  else ui.state.tasks.push(entry.task);
  ui.pendingEntry = entry;
  return true;
}

function migrateLegacyDraft(skipCreate = false) {
  const localDraft = readStoredValue(legacyDraftStorageKey());
  const remoteDraft = ui.state.settings.quickDraft;
  const draft = localDraft && (!remoteDraft?.updatedAt || localDraft.updatedAt > remoteDraft.updatedAt) ? localDraft : remoteDraft;
  ui.state.settings.quickDraft = null;
  try { localStorage.removeItem(legacyDraftStorageKey()); } catch (_) {}
  if (!draft?.value?.trim() || skipCreate) return Boolean(draft);
  ui.view = { type: draft.viewType || 'inbox', id: draft.viewId || null };
  const task = createTaskFromParsed(parseNaturalTask(draft.value), { sectionKey: draft.sectionKey, view: ui.view, select: false, render: false });
  rememberPendingTask(task);
  return true;
}

export function mountObjects(serializedState, options) {
  app = $('#objects-shell') || $('#app'); content = $('#content'); sidebar = $('#sidebar-nav'); sidebarPanel = $('#sidebar'); inspector = $('#inspector');
  persistChanges = options.saveChanges; initializePersistentState = options.initializeState; performSignOut = options.signOut; ui.user = options.user;
  try {
    ui.saveReady = false;
    ui.saveQueued = false;
    ui.saveFailures = 0;
    ui.launchRulesEnabled = false;
    ui.launchRulesPreferenceLoaded = false;
    ui.state = JSON.parse(serializedState);
    const receivedState = cloneData(ui.state);
    let migrated = normalizeState();
    ui.syncedState = cloneData(migrated ? receivedState : ui.state);
    const recoveredPending = recoverPendingEntry();
    if (recoveredPending) migrated = normalizeState() || migrated;
    const migratedDraft = migrateLegacyDraft(recoveredPending);
    const logged = applyLogbookPolicy();
    initializeActiveSpace();
    materializeRecurringTasks(); applyTheme(); render(); handleCaptureUrl(); startReminderChecks(); startLogbookChecks();
    const needsInitialSave = logged || recoveredPending || migratedDraft || migrated;
    if (!staticEventsBound) { bindStaticEvents(); staticEventsBound = true; render(); }
    app.setAttribute('aria-busy', 'false');
    void initializePersistentState(JSON.stringify(ui.syncedState)).then((state) => {
      ui.saveReady = true;
      syncObjectsState(state);
      if (needsInitialSave || ui.saveQueued || buildChangeSet()) scheduleSave();
    }).catch(() => {
      ui.saveReady = true;
      showToast('Could not prepare sync');
      if (needsInitialSave || ui.saveQueued || buildChangeSet()) scheduleSave();
    });
  } catch (error) {
    content.innerHTML = `<div class="empty-state">${icon('cloud')}<h2>Objects could not start</h2><p>${esc(error.message)}. Refresh this page and try again.</p></div>`;
  }
  return () => { clearInterval(ui.reminderTimer); clearInterval(ui.syncTimer); clearInterval(logbookTimer); clearTimeout(ui.saveTimer); };
}

export function syncObjectsState(serializedState) {
  if (!ui.state) return;
  try {
    const remote = JSON.parse(serializedState);
    if (!remote.updatedAt || (remote.updatedAt === ui.syncedState?.updatedAt && remote.syncMutationId === ui.syncedState?.syncMutationId)) return;
    const previous = ui.syncedState || remote;
    const local = ui.state;
    const merged = {
      version: remote.version,
      updatedAt: remote.updatedAt,
      syncMutationId: remote.syncMutationId,
      settings: mergeRecord(previous.settings, { id: 'settings', ...local.settings }, { id: 'settings', ...remote.settings })
    };
    delete merged.settings.id;
    for (const kind of ENTITY_KINDS) merged[kind] = mergeCollection(previous[kind], local[kind], remote[kind]);
    ui.syncedState = cloneData(remote);
    ui.state = merged; normalizeState();
    if (ui.activeSpaceId !== 'all' && !spaceById(ui.activeSpaceId)) ui.activeSpaceId = 'all';
    const selected = ui.selectedTaskId;
    const logged = applyLogbookPolicy();
    if (selected && !ui.state.tasks.some((task) => task.id === selected)) ui.selectedTaskId = null;
    ui.selectedTaskIds = new Set([...ui.selectedTaskIds].filter((id) => ui.state.tasks.some((task) => task.id === id)));
    if (remote.syncMutationId) ui.ownMutationIds.delete(remote.syncMutationId);
    render();
    if (logged || buildChangeSet()) scheduleSave();
  } catch (_) {}
}

function normalizeState() {
  const before = JSON.stringify(ui.state);
  ui.state.settings ||= { theme: 'system', groupToday: true };
  ui.state.settings.notifications ??= false;
  ui.state.settings.weekStartsOn ??= 1;
  ui.state.settings.showCalendar ??= true;
  if (ui.state.settings.quickDraft && typeof ui.state.settings.quickDraft.value !== 'string') ui.state.settings.quickDraft = null;
  if (!['immediately', 'daily', 'manually'].includes(ui.state.settings.logCompletedItems)) ui.state.settings.logCompletedItems = 'daily';
  ui.state.version = 7;
  ui.state.spaces ||= [];
  ui.state.areas ||= [];
  ui.state.projects ||= [];
  ui.state.headings ||= [];
  ui.state.calendarEvents ||= [];
  ui.state.calendarEvents = ui.state.calendarEvents.filter((event) => event && typeof event.start === 'string' && typeof event.title === 'string');
  ui.state.tasks ||= [];
  if (!ui.state.spaces.length) {
    const personalArea = ui.state.areas.find((area) => String(area.title || '').trim().toLocaleLowerCase() === 'personal');
    const workArea = ui.state.areas.find((area) => String(area.title || '').trim().toLocaleLowerCase() === 'work');
    const personalSpace = { id: 'space-personal', title: personalArea?.title || 'Personal', color: personalArea?.color || '#e49b3c', pinned: true, order: 0 };
    const workSpace = { id: 'space-work', title: workArea?.title || 'Work', color: workArea?.color || '#5b7cfa', pinned: true, order: 1 };
    ui.state.spaces = [personalSpace, workSpace];
    if (personalArea) personalArea.spaceId = personalSpace.id;
    if (workArea) workArea.spaceId = workSpace.id;
  }
  ui.state.spaces.forEach((space, index) => {
    space.title ||= `Space ${index + 1}`;
    space.color ||= ['#e49b3c', '#5b7cfa', '#5ba67a', '#b06bd3'][index % 4];
    space.pinned ??= index < 2;
    space.order ??= index;
  });
  const personalSpace = ui.state.spaces.find((space) => String(space.title).toLocaleLowerCase() === 'personal') || ui.state.spaces[0];
  const workSpace = ui.state.spaces.find((space) => String(space.title).toLocaleLowerCase() === 'work') || ui.state.spaces[1] || personalSpace;
  if (!spaceById(ui.state.settings.defaultSpaceId)) ui.state.settings.defaultSpaceId = personalSpace?.id || null;
  ui.state.settings.spaceSchedule ||= { enabled: false, rules: workSpace ? [{ id: 'rule-work-weekdays', spaceId: workSpace.id, weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:30' }] : [] };
  initializeLaunchRulesPreference(ui.state.settings.spaceSchedule.enabled);
  delete ui.state.settings.spaceSchedule.enabled;
  ui.state.settings.spaceSchedule.rules = Array.isArray(ui.state.settings.spaceSchedule.rules) ? ui.state.settings.spaceSchedule.rules.filter((rule) => rule && spaceById(rule.spaceId)).map((rule, index) => ({ id: rule.id || uid('space-rule'), spaceId: rule.spaceId, weekdays: Array.isArray(rule.weekdays) ? rule.weekdays : [1, 2, 3, 4, 5], start: rule.start || '09:00', end: rule.end || '17:30', order: rule.order ?? index })) : [];
  ui.state.areas.forEach((area) => { area.spaceId ??= null; });
  ui.state.projects.forEach((project) => { const parentArea = areaById(project.areaId); project.spaceId = parentArea ? parentArea.spaceId : project.spaceId || ui.state.settings.defaultSpaceId || null; });
  ui.state.calendarEvents.forEach((event) => {
    if (event.spaceId === undefined) {
      const namedSpace = ui.state.spaces.find((space) => String(event.calendar || '').toLocaleLowerCase().includes(String(space.title).toLocaleLowerCase()));
      event.spaceId = namedSpace?.id || ui.state.settings.defaultSpaceId || null;
    }
  });
  ui.state.tasks.forEach((task, index) => {
    if (task.status === 'cancelled') task.status = task.trashedAt ? 'trashed' : 'canceled';
    task.status ||= 'open';
    task.bucket ||= task.scheduledFor ? 'upcoming' : 'anytime';
    task.tags ||= [];
    task.checklist ||= [];
    task.headingId ||= null;
    task.reminderAt ||= null;
    task.repeat ||= null;
    task.reminderSentAt ||= null;
    if (['completed', 'canceled'].includes(task.status) && task.loggedAt === undefined) task.loggedAt = task.completedAt || new Date().toISOString();
    if (!['completed', 'canceled'].includes(task.status)) task.loggedAt = null;
    task.order ??= index;
    const parentProject = projectById(task.projectId);
    const parentArea = areaById(task.areaId);
    if (!parentProject && !parentArea && !spaceById(task.spaceId)) task.spaceId = ui.state.settings.defaultSpaceId || null;
  });
  ui.state.projects.forEach((project, index) => {
    if (project.status === 'cancelled') project.status = project.trashedAt ? 'trashed' : 'canceled';
    project.tags ||= [];
    project.scheduledFor ||= null;
    project.completedAt ||= null;
    project.repeat ||= null;
    project.repeatTemplateId ||= null;
    project.bucket ||= project.scheduledFor ? (project.scheduledFor <= localDay() ? 'today' : 'upcoming') : 'anytime';
    if (['completed', 'canceled'].includes(project.status) && project.loggedAt === undefined) project.loggedAt = project.completedAt || new Date().toISOString();
    if (!['completed', 'canceled'].includes(project.status)) project.loggedAt = null;
    project.order ??= index;
  });
  ui.state.headings.forEach((heading, index) => {
    heading.projectId ||= null;
    heading.areaId ||= null;
    heading.archived ??= false;
    heading.order ??= index;
  });
  ui.state.areas.forEach((area) => { area.tags ||= []; });
  const discoveredTags = [...(ui.state.settings.tags || []), ...ui.state.areas.flatMap((area) => area.tags), ...ui.state.projects.flatMap((project) => project.tags), ...ui.state.tasks.flatMap((task) => task.tags)];
  ui.state.settings.tags = cleanTagList(discoveredTags);
  const canonicalTags = new Map(ui.state.settings.tags.map((tag) => [tag.toLocaleLowerCase(), tag]));
  [...ui.state.areas, ...ui.state.projects, ...ui.state.tasks].forEach((item) => {
    item.tags = cleanTagList(item.tags).map((tag) => canonicalTags.get(tag.toLocaleLowerCase()) || tag);
  });
  return before !== JSON.stringify(ui.state);
}

function cleanTagList(tags) {
  const unique = new Map();
  (Array.isArray(tags) ? tags : []).forEach((value) => {
    const tag = String(value || '').trim().replace(/^#+/, '').slice(0, 40);
    const key = tag.toLocaleLowerCase();
    if (tag && !unique.has(key)) unique.set(key, tag);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

function getKnownTags() {
  return cleanTagList(ui.state?.settings?.tags || []);
}

function registerTags(tags) {
  const next = cleanTagList([...(ui.state.settings.tags || []), ...tags]);
  ui.state.settings.tags = next;
  const canonical = new Map(next.map((tag) => [tag.toLocaleLowerCase(), tag]));
  return cleanTagList(tags).map((tag) => canonical.get(tag.toLocaleLowerCase()) || tag);
}

function tagSelectionSummary(tags) {
  if (!tags.length) return 'Choose tags…';
  if (tags.length <= 2) return tags.join(', ');
  return `${tags.length} tags selected`;
}

function renderTagPicker(selectedTags, field) {
  const tags = getKnownTags();
  const selected = new Set(selectedTags || []);
  return `<details class="tag-picker" data-tag-picker="${esc(field)}"><summary><span data-tag-summary>${esc(tagSelectionSummary([...selected]))}</span>${icon('chevron')}</summary><div class="tag-picker-menu" role="group" aria-label="Available tags"><div class="tag-picker-create"><input type="text" maxlength="40" autocomplete="off" data-new-tag="${esc(field)}" placeholder="New tag name" aria-label="New tag name"><button class="button" type="button" data-create-tag="${esc(field)}">Add</button></div><div class="tag-picker-options">${tags.map((tag) => `<label><input type="checkbox" value="${esc(tag)}" data-tag-choice="${esc(field)}" ${selected.has(tag) ? 'checked' : ''}><span>${esc(tag)}</span></label>`).join('')}</div></div></details>`;
}

function selectedPickerTags(root) {
  return $$('[data-tag-choice]:checked', root).map((input) => input.value);
}

function refreshTagPickerSummary(picker) {
  const summary = $('[data-tag-summary]', picker);
  if (summary) summary.textContent = tagSelectionSummary(selectedPickerTags(picker));
}

function createTagInPicker(button) {
  const picker = button.closest('[data-tag-picker]');
  const input = $('[data-new-tag]', picker);
  const requested = cleanTagList([input?.value])[0];
  if (!requested) { showToast('Enter a tag name'); input?.focus(); return picker; }
  let tag = getKnownTags().find((existing) => existing.toLocaleLowerCase() === requested.toLocaleLowerCase());
  const created = !tag;
  if (!tag) tag = registerTags([requested])[0];
  let checkbox = $$('[data-tag-choice]', picker).find((choice) => choice.value.toLocaleLowerCase() === tag.toLocaleLowerCase());
  if (!checkbox) {
    const field = picker.dataset.tagPicker;
    $('.tag-picker-options', picker).insertAdjacentHTML('beforeend', `<label><input type="checkbox" value="${esc(tag)}" data-tag-choice="${esc(field)}" checked><span>${esc(tag)}</span></label>`);
    checkbox = $$('[data-tag-choice]', picker).find((choice) => choice.value === tag);
  }
  checkbox.checked = true;
  input.value = '';
  refreshTagPickerSummary(picker);
  if (created) { scheduleSave(false); showToast(`Added “${tag}”`); }
  return picker;
}

function bindTagPicker(root) {
  $$('[data-create-tag]', root).forEach((button) => button.addEventListener('click', () => createTagInPicker(button)));
  root.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-new-tag]');
    if (input && event.key === 'Enter') {
      event.preventDefault();
      createTagInPicker($(`[data-create-tag="${input.dataset.newTag}"]`, input.closest('[data-tag-picker]')));
    }
  });
  root.addEventListener('change', (event) => {
    const picker = event.target.closest('[data-tag-picker]');
    if (event.target.dataset.tagChoice && picker) refreshTagPickerSummary(picker);
  });
}

function isLogged(item) {
  return ['completed', 'canceled'].includes(item?.status) && Boolean(item.loggedAt);
}

function isTrashed(item) {
  return item?.status === 'trashed' || Boolean(item?.trashedAt);
}

function isCompletedButVisible(item) {
  return ['completed', 'canceled'].includes(item?.status) && !item.loggedAt;
}

export function applyLogbookPolicyToItems(items, policy, now = new Date()) {
  if (policy === 'manually') return 0;
  const today = localDay(now);
  const loggedAt = now.toISOString();
  let count = 0;
  for (const item of items) {
    if (!isCompletedButVisible(item)) continue;
    if (policy === 'daily' && (!item.completedAt || localDay(new Date(item.completedAt)) >= today)) continue;
    item.loggedAt = loggedAt;
    count += 1;
  }
  return count;
}

function logCompletedNow() {
  return applyLogbookPolicyToItems([...ui.state.tasks, ...ui.state.projects].filter(matchesActiveSpace), 'immediately');
}

function applyLogbookPolicy() {
  return applyLogbookPolicyToItems([...ui.state.tasks, ...ui.state.projects], ui.state.settings.logCompletedItems);
}

function startLogbookChecks() {
  clearInterval(logbookTimer);
  logbookTimer = setInterval(() => {
    const logged = applyLogbookPolicy();
    if (logged) { scheduleSave(); render(); }
  }, 30000);
}

function nextRepeatDate(fromDay, repeat) {
  const date = new Date(`${fromDay}T12:00:00`);
  const interval = Math.max(1, Number(repeat.interval) || 1);
  if (repeat.frequency === 'daily') date.setDate(date.getDate() + interval);
  else if (repeat.frequency === 'monthly') {
    const targetDay = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + interval);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(targetDay, lastDay));
  }
  else if (repeat.frequency === 'yearly') {
    const month = date.getMonth(); const targetDay = date.getDate();
    date.setDate(1); date.setFullYear(date.getFullYear() + interval); date.setMonth(month);
    const lastDay = new Date(date.getFullYear(), month + 1, 0).getDate();
    date.setDate(Math.min(targetDay, lastDay));
  }
  else {
    const weekdays = (repeat.weekdays || []).map(Number).sort();
    if (weekdays.length) {
      let candidate = new Date(date);
      const baseWeek = startOfWeek(date);
      do {
        candidate.setDate(candidate.getDate() + 1);
        const weekDistance = Math.round((startOfWeek(candidate) - baseWeek) / 604800000);
        if (weekdays.includes(candidate.getDay()) && (weekDistance === 0 || weekDistance % interval === 0)) break;
      } while (true);
      return localDay(candidate);
    }
    date.setDate(date.getDate() + 7 * interval);
  }
  return localDay(date);
}

function startOfWeek(value) {
  const date = new Date(value); date.setHours(12, 0, 0, 0);
  const weekStartsOn = Number(ui.state?.settings?.weekStartsOn ?? 1);
  const offset = (date.getDay() - weekStartsOn + 7) % 7; date.setDate(date.getDate() - offset);
  return date;
}

function cloneRecurringTask(template, scheduledFor) {
  return {
    ...template,
    id: uid('task'),
    status: 'open',
    bucket: scheduledFor <= localDay() ? 'today' : 'upcoming',
    scheduledFor,
    evening: false,
    reminderAt: template.repeat?.reminderTime ? `${scheduledFor}T${template.repeat.reminderTime}` : null,
    deadline: Number.isFinite(template.repeat?.deadlineOffset) ? addDays(scheduledFor, template.repeat.deadlineOffset) : template.deadline,
    checklist: template.checklist.map((item) => ({ ...item, id: uid('check'), done: false })),
    repeat: null,
    repeatTemplateId: template.id,
    createdAt: new Date().toISOString(),
    completedAt: null,
    loggedAt: null,
    order: Date.now(),
  };
}

function materializeRecurringTasks() {
  const today = localDay();
  let changed = false;
  const templates = ui.state.tasks.filter((task) => task.repeat && !task.repeat.paused && task.status === 'open');
  for (const template of templates) {
    let next = template.repeat.nextDate || template.scheduledFor || today;
    let guard = 0;
    if (template.repeat.mode === 'afterCompletion') {
      const pendingCopy = ui.state.tasks.some((task) => task.repeatTemplateId === template.id && task.status === 'open');
      if (!pendingCopy && next <= today) {
        ui.state.tasks.push(cloneRecurringTask(template, next));
        changed = true;
      }
      continue;
    }
    while (next <= today && guard < 60) {
      const exists = ui.state.tasks.some((task) => task.repeatTemplateId === template.id && task.scheduledFor === next);
      if (!exists) { ui.state.tasks.push(cloneRecurringTask(template, next)); changed = true; }
      next = nextRepeatDate(next, template.repeat);
      guard += 1;
    }
    if (template.repeat.nextDate !== next) { template.repeat.nextDate = next; changed = true; }
  }
  if (materializeRecurringProjects()) changed = true;
  if (changed) scheduleSave();
}

function materializeRecurringProjects() {
  const today = localDay();
  let changed = false;
  for (const template of ui.state.projects.filter((project) => project.repeat && !project.repeat.paused && project.status === 'open')) {
    let next = template.repeat.nextDate || template.scheduledFor || today;
    let guard = 0;
    if (template.repeat.mode === 'afterCompletion') {
      const pendingCopy = ui.state.projects.some((project) => project.repeatTemplateId === template.id && project.status === 'open');
      if (!pendingCopy && next <= today) {
        cloneProjectTemplate(template, next); changed = true;
      }
      continue;
    }
    while (next <= today && guard < 24) {
      if (!ui.state.projects.some((project) => project.repeatTemplateId === template.id && project.scheduledFor === next)) {
        cloneProjectTemplate(template, next); changed = true;
      }
      next = nextRepeatDate(next, template.repeat); guard += 1;
    }
    if (template.repeat.nextDate !== next) { template.repeat.nextDate = next; changed = true; }
  }
  return changed;
}

function cloneProjectTemplate(template, scheduledFor) {
  const copy = { ...template, id: uid('project'), title: template.title, repeat: null, repeatTemplateId: template.id, scheduledFor, deadline: Number.isFinite(template.repeat?.deadlineOffset) ? addDays(scheduledFor, template.repeat.deadlineOffset) : template.deadline, status: 'open', completedAt: null, loggedAt: null, order: Date.now() };
  ui.state.projects.push(copy);
  const headingMap = new Map();
  ui.state.headings.filter((heading) => heading.projectId === template.id).forEach((heading) => {
    const duplicate = { ...heading, id: uid('heading'), projectId: copy.id };
    headingMap.set(heading.id, duplicate.id); ui.state.headings.push(duplicate);
  });
  ui.state.tasks.filter((task) => task.projectId === template.id && task.status === 'open').forEach((task) => ui.state.tasks.push({ ...task, id: uid('task'), projectId: copy.id, headingId: headingMap.get(task.headingId) || null, repeat: null, repeatTemplateId: null, scheduledFor: null, bucket: 'anytime', status: 'open', completedAt: null, loggedAt: null, checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() }));
}

export function parseNaturalTask(rawTitle) {
  return parseNaturalTaskCore(rawTitle, localDay(), Number(ui.state?.settings?.weekStartsOn ?? 1) === 0 ? 0 : 1);
}

function parseNaturalDate(phrase, today = localDay()) {
  return parseNaturalDateCore(phrase, today, Number(ui.state?.settings?.weekStartsOn ?? 1) === 0 ? 0 : 1);
}

function handleCaptureUrl() {
  const params = new URLSearchParams(location.search);
  const showId = params.get('id');
  const taskId = params.get('task') || (ui.state.tasks.some((task) => task.id === showId) ? showId : null);
  const viewAliases = { 'all-projects': 'allProjects', 'logged-projects': 'loggedProjects' };
  let requestedView = params.get('view');
  if (!requestedView && showId) {
    requestedView = viewAliases[showId] || showId;
    if (ui.state.projects.some((project) => project.id === showId)) { requestedView = 'project'; }
    if (ui.state.areas.some((area) => area.id === showId)) { requestedView = 'area'; }
    if (getKnownTags().some((tag) => tag.toLocaleLowerCase() === showId.toLocaleLowerCase())) { requestedView = 'tag'; }
  }
  requestedView = viewAliases[requestedView] || requestedView;
  const sharedText = params.get('text');
  const sharedUrl = params.get('url');
  const sharedTitle = params.get('title') || params.get('titles')?.split(/\r?\n/).find(Boolean);
  const title = sharedTitle || sharedText;

  const snoozeMinutes = Number(params.get('snooze'));
  if (taskId && snoozeMinutes > 0) {
    const task = ui.state.tasks.find((item) => item.id === taskId);
    if (task) {
      const reminder = new Date(Date.now() + Math.min(1440, snoozeMinutes) * 60000);
      task.reminderAt = `${localDay(reminder)}T${String(reminder.getHours()).padStart(2, '0')}:${String(reminder.getMinutes()).padStart(2, '0')}`;
      task.reminderSentAt = null; scheduleSave(); showToast(`Reminder snoozed for ${snoozeMinutes} minutes`);
    }
  }

  if (requestedView === 'project') setView('project', showId);
  else if (requestedView === 'area') setView('area', showId);
  else if (requestedView === 'tag') setView('tag', getKnownTags().find((tag) => tag.toLocaleLowerCase() === showId?.toLocaleLowerCase()) || showId);
  else if (requestedView && ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'trash', 'tomorrow', 'deadlines', 'repeating', 'allProjects', 'loggedProjects'].includes(requestedView)) setView(requestedView);
  else if (params.get('query')) {
    const result = searchItems(params.get('query')).find((item) => ['view', 'heading'].includes(item.kind));
    if (result?.kind === 'view') setView(result.type, result.id || null);
    else if (result?.kind === 'heading') setView(result.projectId ? 'project' : 'area', result.projectId || result.areaId);
  }
  const requestedFilters = cleanTagList((params.get('filter') || '').split(','));
  if (requestedFilters.length && ui.view.type !== 'tag') {
    ui.activeTags = new Set(requestedFilters);
    renderContent();
  }
  if (taskId && ui.state.tasks.some((task) => task.id === taskId)) selectTask(taskId);
  if (title) {
    const parsed = parseNaturalTask(title);
    const notes = [params.get('notes'), sharedTitle ? sharedText : null, sharedUrl].filter(Boolean).join('\n');
    const listTarget = params.get('list-id') || params.get('list') || params.get('project');
    const project = ui.state.projects.find((item) => item.id === listTarget || item.title.toLowerCase() === listTarget?.toLowerCase());
    const area = ui.state.areas.find((item) => item.id === listTarget || item.title.toLowerCase() === listTarget?.toLowerCase());
    const requestedSpace = params.get('space-id') || params.get('space');
    const space = ui.state.spaces.find((item) => item.id === requestedSpace || item.title.toLowerCase() === requestedSpace?.toLowerCase());
    const task = createTaskFromParsed(parsed, { notes, projectId: project?.id || null, spaceId: space?.id || undefined, useCurrentView: false });
    if (area && !project) { task.areaId = area.id; task.spaceId = area.spaceId || task.spaceId; task.bucket = 'anytime'; }
    const headingName = params.get('heading');
    const heading = headingName && ui.state.headings.find((item) => !item.archived && (item.id === headingName || item.title.toLocaleLowerCase() === headingName.toLocaleLowerCase()) && (!project || item.projectId === project.id) && (!area || item.areaId === area.id || item.projectId === project?.id));
    if (heading) { const parent = projectById(heading.projectId); const parentArea = areaById(heading.areaId); task.headingId = heading.id; task.projectId = heading.projectId || null; task.areaId = parent?.areaId || heading.areaId || null; task.spaceId = parent?.spaceId || parentArea?.spaceId || task.spaceId; task.bucket = task.bucket === 'inbox' ? 'anytime' : task.bucket; }
    const when = params.get('when');
    if (when) {
      if (when.toLowerCase() === 'someday') { task.bucket = 'someday'; task.scheduledFor = null; }
      else {
        const day = parseNaturalDate(when);
        if (day) { task.scheduledFor = day; task.bucket = day <= localDay() ? 'today' : 'upcoming'; task.evening = when.toLowerCase() === 'evening'; }
      }
    }
    task.deadline = parseNaturalDate(params.get('deadline')) || task.deadline;
    if (params.get('tags')) task.tags = cleanTagList([...task.tags, ...registerTags(params.get('tags').split(','))]);
    const checklistItems = params.get('checklist-items') || params.get('checklist');
    if (checklistItems) task.checklist = checklistItems.split(/\r?\n/).filter(Boolean).map((item) => ({ id: uid('check'), title: item, done: false }));
    const requestedStatus = params.get('completed') === 'true' ? 'completed' : params.get('canceled') === 'true' ? 'canceled' : params.get('status');
    if (['completed', 'canceled'].includes(requestedStatus)) { task.status = requestedStatus; task.completedAt = params.get('completion-date') || new Date().toISOString(); task.loggedAt = null; applyLogbookPolicy(); }
    if (params.get('creation-date')) task.createdAt = params.get('creation-date');
    scheduleSave(); render();
  }
  if (params.get('search')) setTimeout(() => openSearch(params.get('search')), 0);
  if (!taskId && !requestedView && !params.get('query') && !title && params.get('capture') !== '1') return;
  const localGuest = params.get('lakebed_guest');
  history.replaceState({}, '', localGuest ? `${location.pathname}?lakebed_guest=${encodeURIComponent(localGuest)}` : location.pathname);
  if (params.get('capture') === '1') setTimeout(() => beginQuickAdd(true), 0);
}

function startReminderChecks() {
  clearInterval(ui.reminderTimer);
  void checkReminders();
  ui.reminderTimer = setInterval(() => void checkReminders(), 30000);
}

async function checkReminders() {
  if (ui.reminderCheckRunning) return;
  ui.reminderCheckRunning = true;
  const logged = applyLogbookPolicy();
  if (logged) { scheduleSave(); render(); }
  materializeRecurringTasks();
  if (!ui.state?.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') {
    ui.reminderCheckRunning = false;
    return;
  }
  const now = Date.now();
  let changed = false;
  try {
    for (const task of openTasks()) {
      if (!task.reminderAt || task.reminderSentAt) continue;
      const due = new Date(task.reminderAt).getTime();
      if (due <= now && due > now - 86400000 && await showTaskReminder(task)) {
        task.reminderSentAt = new Date().toISOString();
        changed = true;
      }
    }
  } finally {
    ui.reminderCheckRunning = false;
  }
  if (changed) scheduleSave();
}

function bindStaticEvents() {
  document.addEventListener('click', suppressRepeatedActivation, true);
  $('#search-button').innerHTML = icon('search');
  $('#mobile-search').innerHTML = icon('search');
  $('#sidebar-open').innerHTML = icon('menu');
  $('#sidebar-close').innerHTML = icon('x');
  $('#magic-add').innerHTML = icon('plus');
  $('#magic-add').draggable = true;
  $('#new-list-button').innerHTML = `${icon('plus')}<span>New List</span>`;
  $('#repeating-button').innerHTML = icon('repeat');
  $('#settings-button').innerHTML = icon('settings');
  $('#space-settings-button').innerHTML = icon('clock');
  $('#search-button').addEventListener('click', () => openAfterSidebarClose(openSearch));
  $('#mobile-search').addEventListener('click', () => openSearch());
  $('#magic-add').addEventListener('click', () => beginQuickAdd(true));
  $('#magic-add').addEventListener('dragstart', (event) => {
    ui.draggingMagicAdd = true;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'new-to-do');
    $('#magic-add').classList.add('dragging');
  });
  $('#magic-add').addEventListener('dragend', () => {
    ui.draggingMagicAdd = false;
    $('#magic-add').classList.remove('dragging');
    handleDragEnd();
  });
  $('#new-list-button').addEventListener('click', () => openAfterSidebarClose(openNewListModal));
  $('#repeating-button').addEventListener('click', () => setView('repeating'));
  $('#settings-button').addEventListener('click', () => openAfterSidebarClose(openSettings));
  $('#space-settings-button').addEventListener('click', () => openAfterSidebarClose(openSpaceSettings));
  $('#theme-button').addEventListener('click', cycleTheme);
  $('#sidebar-open').addEventListener('click', openSidebar);
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-scrim').addEventListener('click', closeSidebar);
  window.addEventListener('pointerdown', handleSidebarGestureStart, { passive: true });
  window.addEventListener('pointermove', handleSidebarGestureMove, { passive: false });
  window.addEventListener('pointerup', handleSidebarGestureEnd, { passive: true });
  window.addEventListener('pointercancel', handleSidebarGestureCancel, { passive: true });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  window.matchMedia('(max-width: 820px)').addEventListener('change', syncMobileDrawerLayout);

  sidebar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    setView(button.dataset.view, button.dataset.id || null);
  });
  $('#space-controls').addEventListener('click', (event) => {
    const button = event.target.closest('[data-space-id]');
    if (button) setActiveSpace(button.dataset.spaceId);
    else if (event.target.closest('[data-space-overflow]')) openAfterSidebarClose(openSpaceSwitcher);
  });
  sidebar.addEventListener('dragstart', (event) => {
    const list = event.target.closest('[data-list-kind]');
    if (!list) return;
    ui.draggedList = { kind: list.dataset.listKind, id: list.dataset.id };
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', list.dataset.id);
  });
  sidebar.addEventListener('dragover', (event) => {
    const destination = event.target.closest('[data-view]');
    if (!destination || (!ui.draggedTaskId && !ui.draggedList && !ui.draggingMagicAdd)) return;
    event.preventDefault();
    $$('.nav-item.drop-target', sidebar).forEach((item) => item.classList.remove('drop-target'));
    destination.classList.add('drop-target');
  });
  sidebar.addEventListener('drop', handleSidebarDrop);
  sidebar.addEventListener('dragend', () => { ui.draggedList = null; $$('.nav-item.drop-target', sidebar).forEach((item) => item.classList.remove('drop-target')); });

  content.addEventListener('click', handleContentClick);
  content.addEventListener('input', (event) => { if (event.target.matches('.quick-add-input')) updateInlineTask(event.target); });
  content.addEventListener('focusout', (event) => {
    const input = event.target.closest('.quick-add-input');
    if (!input) return;
    setTimeout(() => {
      if (input.dataset.inlineFinalized || document.activeElement === input) return;
      finalizeInlineTask(input, { renderAfter: !document.activeElement?.matches('.quick-add-input') });
    }, 0);
  });
  content.addEventListener('keydown', handleContentKeydown);
  content.addEventListener('dragstart', handleDragStart);
  content.addEventListener('dragover', handleDragOver);
  content.addEventListener('drop', handleDrop);
  content.addEventListener('dragend', handleDragEnd);
  content.addEventListener('pointerdown', handleTaskGestureStart, { passive: true });
  content.addEventListener('pointermove', handleTaskGestureMove, { passive: false });
  content.addEventListener('pointerup', handleTaskGestureEnd, { passive: true });
  content.addEventListener('pointercancel', handleTaskGestureCancel, { passive: true });
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('pointerdown', handleContextPressStart, { passive: true });
  document.addEventListener('pointermove', handleContextPressMove, { passive: true });
  document.addEventListener('pointerup', handleContextPressEnd, { passive: true });
  document.addEventListener('pointercancel', handleContextPressEnd, { passive: true });
  document.addEventListener('click', handleContextMenuClick);
  window.addEventListener('objects:pwa-status', (event) => {
    if (event.detail?.updateAvailable && !ui.pwaUpdateNotified) {
      ui.pwaUpdateNotified = true;
      showToast('An Objects update is ready', 'Update', () => activatePwaUpdate());
    }
  });
  window.addEventListener('online', () => showToast('Back online'));
  window.addEventListener('offline', () => showToast('You are offline; changes will sync after reconnecting'));
  syncSidebarAccessibility();
}

function contextTarget(element) {
  return element?.closest?.('[data-task-id], [data-project-card], [data-list-kind], [data-heading-id]') || null;
}

function handleContextMenu(event) {
  const target = contextTarget(event.target);
  if (!target || event.target.closest('input, textarea, select')) return;
  event.preventDefault();
  openContextMenu(target, event.clientX, event.clientY);
}

function handleContextPressStart(event) {
  if (event.pointerType === 'mouse' || !event.isPrimary || event.target.closest('button, input, textarea, select, a')) return;
  const target = contextTarget(event.target);
  if (!target) return;
  contextPress = { pointerId: event.pointerId, target, x: event.clientX, y: event.clientY, timer: setTimeout(() => {
    ui.suppressClickUntil = Date.now() + 500;
    if (navigator.vibrate) navigator.vibrate(12);
    openContextMenu(target, event.clientX, event.clientY);
    contextPress = null;
  }, 560) };
}

function handleContextPressMove(event) {
  if (!contextPress || event.pointerId !== contextPress.pointerId) return;
  if (Math.hypot(event.clientX - contextPress.x, event.clientY - contextPress.y) > 9) handleContextPressEnd(event);
}

function handleContextPressEnd(event) {
  if (!contextPress || event.pointerId !== contextPress.pointerId) return;
  clearTimeout(contextPress.timer);
  contextPress = null;
}

function menuButton(action, label, danger = false) {
  return `<wa-dropdown-item value="${action}" data-context-action="${action}" class="${danger ? 'danger' : ''}">${esc(label)}</wa-dropdown-item>`;
}

function bulkContextMenuItems(tasks) {
  const allTrashed = tasks.every(isTrashed);
  const actionable = tasks.some((task) => task.status === 'open' && !task.repeat && !isTrashed(task));
  if (allTrashed) return menuButton('restore', 'Restore selected');
  return (actionable
    ? menuButton('today', 'Move selected to Today')
      + menuButton('someday', 'Move selected to Someday')
      + menuButton('move', 'Move selected…')
      + menuButton('tags', 'Edit tags…')
      + menuButton('complete', 'Complete selected')
      + menuButton('cancel', 'Cancel selected')
    : '')
    + menuButton('trash', 'Move selected to Trash', true);
}

function openContextMenu(target, x, y) {
  const menu = $('#context-menu');
  const trigger = $('.context-menu-trigger', menu);
  const menuItems = $('#context-menu-items', menu);
  let kind = '';
  let id = '';
  let items = '';
  const taskRow = target.closest('[data-task-id]');
  const headingRow = target.closest('[data-heading-id]');
  const list = target.closest('[data-list-kind]');
  const projectCard = target.closest('[data-project-card]');
  if (taskRow) {
    id = taskRow.dataset.taskId;
    if (ui.selectedTaskIds.size > 1 && ui.selectedTaskIds.has(id)) {
      kind = 'bulk-task';
      items = bulkContextMenuItems(selectedTasks());
    } else kind = 'task';
    const task = ui.state.tasks.find((item) => item.id === id);
    if (!task) return;
    if (kind === 'task') items = (task.status === 'open' ? menuButton('today', 'Move to Today') + menuButton('someday', 'Move to Someday') + menuButton('move', 'Move…') : menuButton('restore-task', 'Restore')) + menuButton('duplicate-task', 'Duplicate') + menuButton('trash-task', 'Move to Trash', true);
  } else if (headingRow) {
    kind = 'heading'; id = headingRow.dataset.headingId;
    items = menuButton('edit-heading', 'Edit heading') + menuButton('new-heading-task', 'New to-do here') + menuButton('delete-heading', 'Delete heading', true);
  } else if (projectCard || list?.dataset.listKind === 'project') {
    kind = 'project'; id = projectCard?.dataset.projectCard || list.dataset.id;
    const project = projectById(id);
    if (!project) return;
    items = menuButton('new-project-task', 'New to-do') + menuButton('edit-project', 'Project options…') + (isTrashed(project) ? '' : menuButton('delete-project', 'Move list to Trash', true));
  } else if (list?.dataset.listKind === 'area') {
    kind = 'area'; id = list.dataset.id;
    items = menuButton('new-area-task', 'New standalone to-do') + menuButton('new-area-project', 'New project') + menuButton('new-area-heading', 'New heading') + menuButton('edit-area', 'Area options…') + menuButton('remove-area', 'Remove area', true);
  }
  if (!items) return;
  menu.dataset.kind = kind;
  menu.dataset.id = id;
  menuItems.innerHTML = items;
  trigger.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 228))}px`;
  trigger.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 48))}px`;
  menu.open = true;
  menu.addEventListener('wa-after-show', () => menuItems.querySelector('wa-dropdown-item')?.focus(), { once: true });
}

function closeContextMenu() {
  const menu = $('#context-menu');
  if (!menu) return;
  menu.open = false;
  $('#context-menu-items', menu).innerHTML = '';
}

function handleContextMenuClick(event) {
  const button = event.target.closest('[data-context-action]');
  const menu = $('#context-menu');
  if (!button) { if (!event.target.closest('#context-menu')) closeContextMenu(); return; }
  const { kind, id } = menu.dataset;
  const action = button.dataset.contextAction;
  closeContextMenu();
  if (kind === 'bulk-task') {
    handleBulkAction(action);
    return;
  }
  if (kind === 'task') {
    const task = ui.state.tasks.find((item) => item.id === id);
    if (!task) return;
    if (action === 'today' || action === 'someday') { moveReminderToDate(task, action === 'today' ? localDay() : null); task.bucket = action; task.scheduledFor = action === 'today' ? localDay() : null; task.evening = false; scheduleSave(); render(); }
    if (action === 'move') openMoveTaskModal(task);
    if (action === 'restore-task') { task.status = 'open'; task.completedAt = null; task.loggedAt = null; task.trashedAt = null; scheduleSave(); render(); }
    if (action === 'duplicate-task') { const copy = { ...task, id: uid('task'), title: `${task.title} copy`, status: 'open', completedAt: null, loggedAt: null, trashedAt: null, createdAt: new Date().toISOString(), order: Date.now(), checklist: task.checklist.map((item) => ({ ...item, id: uid('check') })) }; ui.state.tasks.push(copy); scheduleSave(); render(); }
    if (action === 'trash-task') { task.previousStatus = task.status; task.status = 'trashed'; task.trashedAt = new Date().toISOString(); task.loggedAt = null; scheduleSave(); render(); }
  }
  if (kind === 'heading') {
    if (action === 'edit-heading') openHeadingModal(id);
    if (action === 'new-heading-task') {
      const heading = ui.state.headings.find((item) => item.id === id);
      if (heading) { setView(heading.projectId ? 'project' : 'area', heading.projectId || heading.areaId); setTimeout(() => openQuickAdd($(`[data-quick-add="${id}"]`, content)), 0); }
    }
    if (action === 'delete-heading') deleteHeading(id);
  }
  if (kind === 'project') {
    if (action === 'edit-project') openProjectModal(id);
    if (action === 'new-project-task') { setView('project', id); setTimeout(() => beginQuickAdd(), 0); }
    if (action === 'delete-project') moveProjectToTrash(id);
  }
  if (kind === 'area') {
    if (action === 'edit-area') openAreaModal(id);
    if (action === 'new-area-project') openNewListModal({ type: 'project', areaId: id });
    if (action === 'new-area-heading') { setView('area', id); openHeadingModal(); }
    if (action === 'new-area-task') { setView('area', id); setTimeout(() => beginQuickAdd(), 0); }
    if (action === 'remove-area') removeArea(id);
  }
}

function applyTheme() {
  if (!ui.state) return;
  const choice = ui.state.settings.theme || 'system';
  const resolved = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('wa-dark', resolved === 'dark');
  document.documentElement.classList.toggle('wa-light', resolved !== 'dark');
  const themeIcons = { system: 'monitor', light: 'sun', dark: 'moon' };
  $('#theme-button').innerHTML = icon(themeIcons[choice]);
  $('#theme-button').setAttribute('aria-label', `Theme: ${choice}`);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = resolved === 'dark' ? '#222321' : '#f6f5f2';
}

function cycleTheme() {
  const choices = ['system', 'light', 'dark'];
  const current = choices.indexOf(ui.state.settings.theme || 'system');
  ui.state.settings.theme = choices[(current + 1) % choices.length];
  applyTheme();
  scheduleSave();
  showToast(`Theme: ${ui.state.settings.theme}`);
}

function createMobileDrawer(id, label, placement, panel) {
  let drawer = $(`#${id}`);
  if (drawer) return drawer;
  drawer = document.createElement('wa-drawer');
  drawer.id = id;
  drawer.className = `objects-mobile-drawer ${placement === 'start' ? 'sidebar-drawer' : 'inspector-drawer'}`;
  drawer.setAttribute('label', label);
  drawer.setAttribute('placement', placement);
  if (placement === 'start') drawer.setAttribute('without-header', '');
  $('#drawer-root').appendChild(drawer);
  drawer.appendChild(panel);
  return drawer;
}

function showMobileDrawer(drawer, onDismiss) {
  void customElements.whenDefined('wa-drawer').then(() => {
    requestAnimationFrame(() => {
      if (!drawer.isConnected) return;
      drawer.addEventListener('wa-after-show', () => drawer.addEventListener('wa-after-hide', onDismiss, { once: true }), { once: true });
      drawer.setAttribute('open', '');
    });
  });
}

function restorePanel(anchorId, panel, drawer) {
  const anchor = $(`#${anchorId}`);
  if (anchor && panel.parentElement !== anchor.parentElement) anchor.after(panel);
  drawer?.remove();
}

function finalizeSidebarClose({ restoreFocus = true } = {}) {
  const wasOpen = app.classList.contains('sidebar-open');
  app.classList.remove('sidebar-open');
  app.classList.remove('library-sidebar-open');
  restorePanel('sidebar-anchor', sidebarPanel, $('#mobile-sidebar-drawer'));
  syncSidebarAccessibility();
  if (restoreFocus && wasOpen && matchMedia('(max-width: 820px)').matches) setTimeout(() => $('#sidebar-open')?.focus(), 20);
}

function openSidebar() {
  app.classList.add('sidebar-open');
  if (matchMedia('(max-width: 820px)').matches) {
    const drawer = createMobileDrawer('mobile-sidebar-drawer', 'Lists', 'start', sidebarPanel);
    delete drawer.dataset.restoreFocus;
    app.classList.add('library-sidebar-open');
    showMobileDrawer(drawer, () => finalizeSidebarClose({ restoreFocus: drawer.dataset.restoreFocus !== 'false' }));
  }
  syncSidebarAccessibility();
  setTimeout(() => $('#sidebar-close')?.focus(), 20);
}

function closeSidebar(options = {}) {
  const drawer = $('#mobile-sidebar-drawer');
  if (drawer?.hasAttribute('open')) {
    drawer.dataset.restoreFocus = options.restoreFocus === false ? 'false' : 'true';
    drawer.removeAttribute('open');
    return;
  }
  finalizeSidebarClose(options);
}

function openAfterSidebarClose(open) {
  if (matchMedia('(max-width: 820px)').matches && app.classList.contains('sidebar-open')) {
    const drawer = $('#mobile-sidebar-drawer');
    if (drawer) drawer.dataset.restoreFocus = 'false';
    closeSidebar({ restoreFocus: false });
    window.setTimeout(open, 180);
    return;
  }
  open();
}

function syncMobileDrawerLayout() {
  const mobile = matchMedia('(max-width: 820px)').matches;
  if (!mobile) {
    restorePanel('sidebar-anchor', sidebarPanel, $('#mobile-sidebar-drawer'));
    restorePanel('inspector-anchor', inspector, $('#mobile-inspector-drawer'));
    app.classList.remove('library-sidebar-open', 'library-inspector-open');
  } else {
    if (app.classList.contains('sidebar-open')) openSidebar();
    if (app.classList.contains('inspector-open') && ui.selectedTaskId) mountInspectorDrawer();
  }
  syncSidebarAccessibility();
}

function handleSidebarGestureStart(event) {
  if (!matchMedia('(max-width: 820px)').matches || !event.isPrimary) return;
  if (app.classList.contains('inspector-open') || $('#modal-root')?.children.length) return;
  const open = app.classList.contains('sidebar-open');
  const edgeWidth = 32;
  if (!open && event.clientX > edgeWidth) return;

  sidebarGesture = {
    pointerId: event.pointerId,
    open,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    startedAt: performance.now(),
    horizontal: false,
    canceled: false,
  };
}

function handleSidebarGestureMove(event) {
  const gesture = sidebarGesture;
  if (!gesture || event.pointerId !== gesture.pointerId || gesture.canceled) return;
  gesture.currentX = event.clientX;
  gesture.currentY = event.clientY;
  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;

  if (!gesture.horizontal) {
    if (Math.hypot(deltaX, deltaY) < 8) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
      gesture.canceled = true;
      sidebarGesture = null;
      return;
    }
    if ((!gesture.open && deltaX < 0) || (gesture.open && deltaX > 0)) {
      gesture.canceled = true;
      sidebarGesture = null;
      return;
    }
    gesture.horizontal = true;
    app.classList.add('sidebar-dragging');
  }

  event.preventDefault();
  const width = sidebarPanel.getBoundingClientRect().width;
  const offset = Math.max(-width, Math.min(0, (gesture.open ? 0 : -width) + deltaX));
  const progress = 1 + (offset / width);
  app.style.setProperty('--sidebar-gesture-x', `${offset}px`);
  app.style.setProperty('--sidebar-gesture-progress', String(progress));
}

function handleSidebarGestureEnd(event) {
  const gesture = sidebarGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  sidebarGesture = null;
  if (!gesture.horizontal) return;

  const width = sidebarPanel.getBoundingClientRect().width;
  const deltaX = gesture.currentX - gesture.startX;
  const progress = Math.max(0, Math.min(1, (gesture.open ? width : 0) + deltaX) / width);
  const velocity = deltaX / Math.max(1, performance.now() - gesture.startedAt);
  const shouldOpen = gesture.open
    ? progress > 0.65 && velocity > -0.45
    : progress > 0.35 || velocity > 0.45;
  settleSidebarGesture(shouldOpen);
}

function handleSidebarGestureCancel(event) {
  const gesture = sidebarGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  sidebarGesture = null;
  if (gesture.horizontal) settleSidebarGesture(gesture.open);
}

function settleSidebarGesture(open) {
  // Read the dragged position before switching classes so CSS animates from the finger to the nearest resting point.
  sidebarPanel.getBoundingClientRect();
  app.classList.toggle('sidebar-open', open);
  app.classList.remove('sidebar-dragging');
  syncSidebarAccessibility();
  window.setTimeout(() => {
    app.style.removeProperty('--sidebar-gesture-x');
    app.style.removeProperty('--sidebar-gesture-progress');
  }, 320);
}

function syncSidebarAccessibility() {
  const mobile = matchMedia('(max-width: 820px)').matches;
  const inspectorOpen = app.classList.contains('inspector-open');
  const sidebarOpen = app.classList.contains('sidebar-open');
  const hidden = mobile && (!sidebarOpen || inspectorOpen);
  sidebarPanel.inert = hidden;
  if (hidden) sidebarPanel.setAttribute('aria-hidden', 'true');
  else sidebarPanel.removeAttribute('aria-hidden');
  const mainPane = $('.main-pane', app);
  mainPane.inert = mobile && (inspectorOpen || sidebarOpen);
  if (mainPane.inert) mainPane.setAttribute('aria-hidden', 'true');
  else mainPane.removeAttribute('aria-hidden');
  $('#sidebar-open')?.setAttribute('aria-expanded', String(mobile && sidebarOpen));
}

function setView(type, id = null) {
  const inlineInput = $('.quick-add-input[data-inline-task-id]', content);
  if (inlineInput) finalizeInlineTask(inlineInput, { renderAfter: false });
  ui.view = { type, id };
  ui.selectedTaskId = null;
  clearTaskSelection(false);
  ui.activeTags.clear();
  ui.noteFindOpen = false;
  ui.noteFindQuery = '';
  closeSidebar();
  render();
  content.scrollTop = 0;
}

function headingBelongsTo(heading, type, id) {
  return type === 'project' ? heading.projectId === id : type === 'area' ? heading.areaId === id && !heading.projectId : false;
}

function headingsFor(type, id, includeArchived = false) {
  return ui.state.headings.filter((heading) => headingBelongsTo(heading, type, id) && (includeArchived || !heading.archived));
}

function projectAllowsTask(task) {
  const project = projectById(task.projectId);
  return !project || (!project.repeat && project.bucket !== 'someday' && (!project.scheduledFor || project.scheduledFor <= localDay()) && (project.status === 'open' || isCompletedButVisible(project)));
}
function openTasks() { return ui.state.tasks.filter((task) => matchesActiveSpace(task) && task.status === 'open' && !task.repeat && projectAllowsTask(task)); }
function sourceTasks() { return ui.state.tasks.filter((task) => matchesActiveSpace(task) && (task.status === 'open' || isCompletedButVisible(task)) && !task.repeat && projectAllowsTask(task)); }
function projectById(id) { return ui.state.projects.find((project) => project.id === id); }
function areaById(id) { return ui.state.areas.find((area) => area.id === id); }
function spaceById(id) { return ui.state?.spaces?.find((space) => space.id === id); }
function itemSpaceId(item) { const project = projectById(item?.projectId); if (project) return areaById(project.areaId)?.spaceId ?? project.spaceId ?? null; const area = areaById(item?.areaId); if (area) return area.spaceId ?? null; return item?.spaceId ?? null; }
function matchesActiveSpace(item) { return ui.activeSpaceId === 'all' || itemSpaceId(item) === ui.activeSpaceId; }
function currentCreationSpaceId() { return ui.activeSpaceId === 'all' ? ui.state.settings.defaultSpaceId || ui.state.spaces[0]?.id || null : ui.activeSpaceId; }
function spaceLabel(id) { return spaceById(id)?.title || 'Unassigned'; }
function effectiveTags(task) { return [...new Set([...(areaById(task.areaId)?.tags || []), ...(projectById(task.projectId)?.tags || []), ...(task.tags || [])])]; }
function effectiveProjectTags(project) { return [...new Set([...(areaById(project.areaId)?.tags || []), ...(project.tags || [])])]; }
function projectIsActive(project) { return project && matchesActiveSpace(project) && (project.status === 'open' || isCompletedButVisible(project)) && !project.repeat; }
function projectIsToday(project, today = localDay()) { return projectIsActive(project) && (project.bucket === 'today' || (project.scheduledFor && project.scheduledFor <= today) || (project.deadline && project.deadline <= today)); }

function upcomingTaskEntries(today, taskFilter) {
  const dated = ui.state.tasks.filter((task) => taskFilter(task) && ((task.scheduledFor && task.scheduledFor > today) || (task.deadline && task.deadline > today))).map((task) => ({
    ...task,
    agendaDay: task.scheduledFor && task.scheduledFor > today ? task.scheduledFor : task.deadline,
    agendaDeadlineOnly: !(task.scheduledFor && task.scheduledFor > today),
  }));
  const repeating = ui.state.tasks.filter((task) => matchesActiveSpace(task) && task.status === 'open' && task.repeat && !task.repeat.paused && task.repeat.nextDate > today
    && !ui.state.tasks.some((candidate) => candidate.repeatTemplateId === task.id && candidate.scheduledFor === task.repeat.nextDate)
  ).map((task) => ({ ...task, agendaDay: task.repeat.nextDate, agendaPreview: true }));
  return [...dated, ...repeating];
}

function upcomingProjectEntries(today) {
  const dated = ui.state.projects.filter((project) => projectIsActive(project) && ((project.scheduledFor && project.scheduledFor > today) || (project.deadline && project.deadline > today))).map((project) => ({ ...project, agendaDay: project.scheduledFor && project.scheduledFor > today ? project.scheduledFor : project.deadline }));
  const repeating = ui.state.projects.filter((project) => matchesActiveSpace(project) && project.status === 'open' && project.repeat && !project.repeat.paused && project.repeat.nextDate > today
    && !ui.state.projects.some((candidate) => candidate.repeatTemplateId === project.id && candidate.scheduledFor === project.repeat.nextDate)
  ).map((project) => ({ ...project, agendaDay: project.repeat.nextDate, agendaPreview: true }));
  return [...dated, ...repeating];
}

function taskCount(type, id) {
  const today = localDay();
  return openTasks().filter((task) => {
    if (type === 'inbox') return task.bucket === 'inbox';
    if (type === 'today') return task.bucket === 'today' || (task.scheduledFor && task.scheduledFor <= today && task.bucket !== 'someday') || (task.deadline && task.deadline <= today);
    if (type === 'project') return task.projectId === id;
    if (type === 'area') return task.areaId === id;
    return false;
  }).length;
}

function projectProgress(projectId) {
  const tasks = ui.state.tasks.filter((task) => task.projectId === projectId && !isTrashed(task) && task.status !== 'canceled' && !task.repeat);
  if (!tasks.length) return 0;
  return Math.round(tasks.filter((task) => task.status === 'completed').length / tasks.length * 100);
}

function progressRing(value) {
  const circumference = 38;
  return `<span class="nav-progress"><svg viewBox="0 0 16 16"><circle class="track" cx="8" cy="8" r="6"/><circle class="value" cx="8" cy="8" r="6" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - circumference * value / 100}"/></svg></span>`;
}

function setActiveSpace(spaceId) {
  if (spaceId !== 'all' && !spaceById(spaceId)) return;
  ui.activeSpaceId = spaceId;
  rememberActiveSpace();
  ui.activeTags.clear();
  const currentArea = ui.view.type === 'area' ? areaById(ui.view.id) : null;
  const currentProject = ui.view.type === 'project' ? projectById(ui.view.id) : null;
  if ((currentArea && !matchesActiveSpace(currentArea)) || (currentProject && !matchesActiveSpace(currentProject))) ui.view = { type: 'today', id: null };
  if (ui.selectedTaskId && !matchesActiveSpace(currentTask())) closeInspector({ restoreFocus: false });
  render();
}

function renderSpaceControls() {
  const root = $('#space-controls');
  if (!root) return;
  const ordered = [...ui.state.spaces].sort((a, b) => (a.order || 0) - (b.order || 0));
  const pinned = ordered.filter((space) => space.pinned);
  let visible = pinned.slice(0, 2);
  const active = spaceById(ui.activeSpaceId);
  if (active && !visible.some((space) => space.id === active.id)) visible = visible.length < 2 ? [...visible, active] : [visible[0], active].filter(Boolean);
  const hidden = ordered.filter((space) => !visible.some((candidate) => candidate.id === space.id));
  root.innerHTML = `<div class="space-pill" role="tablist" aria-label="Task Space"><button type="button" role="tab" class="space-segment ${ui.activeSpaceId === 'all' ? 'active' : ''}" data-space-id="all" aria-selected="${ui.activeSpaceId === 'all'}">All</button>${visible.map((space) => `<button type="button" role="tab" class="space-segment ${ui.activeSpaceId === space.id ? 'active' : ''}" data-space-id="${esc(space.id)}" aria-selected="${ui.activeSpaceId === space.id}" style="--space-color:${esc(space.color)}">${esc(space.title)}</button>`).join('')}${hidden.length ? `<button type="button" class="space-segment space-overflow ${active && hidden.some((space) => space.id === active.id) ? 'active' : ''}" data-space-overflow aria-label="${hidden.length} more Spaces">+${hidden.length}</button>` : ''}</div>`;
  const scheduleButton = $('#space-settings-button');
  const enabled = ui.launchRulesEnabled;
  scheduleButton?.classList.toggle('schedule-enabled', enabled);
  if (scheduleButton) scheduleButton.setAttribute('aria-label', enabled ? 'Spaces and launch schedule, automatic selection on' : 'Spaces and launch schedule');
}

function renderSidebar() {
  renderSpaceControls();
  const repeatingButton = $('#repeating-button');
  repeatingButton?.classList.toggle('active', ui.view.type === 'repeating');
  repeatingButton?.setAttribute('aria-pressed', String(ui.view.type === 'repeating'));
  const today = localDay();
  const standard = [
    ['inbox', 'Inbox', 'inbox'],
    ['today', 'Today', 'star'],
    ['upcoming', 'Upcoming', 'calendar'],
    ['anytime', 'Anytime', 'layers'],
    ['someday', 'Someday', 'archive'],
    ['logbook', 'Logbook', 'check'],
    ['trash', 'Trash', 'trash'],
  ];
  const standardHtml = standard.map(([type, label, iconName]) => {
    const count = ['inbox', 'today'].includes(type) ? taskCount(type) : 0;
    const active = ui.view.type === type;
    return `<li><button class="nav-item ${active ? 'active' : ''}" data-view="${type}">${icon(iconName)}<span class="nav-title">${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</button></li>`;
  }).join('');

  const renderUserLists = (spaceId, title = '') => {
    const areas = ui.state.areas.filter((area) => area.spaceId === spaceId).sort((a, b) => a.order - b.order);
    const areasHtml = areas.map((area) => {
      const areaProjects = ui.state.projects.filter((project) => project.spaceId === spaceId && project.areaId === area.id && (project.status === 'open' || isCompletedButVisible(project)) && !project.repeat && project.bucket !== 'someday' && (!project.scheduledFor || project.scheduledFor <= today)).sort((a, b) => a.order - b.order);
      return `<li><button class="nav-item ${ui.view.type === 'area' && ui.view.id === area.id ? 'active' : ''}" data-view="area" data-id="${area.id}" data-list-kind="area" draggable="true" style="--area-color:${esc(area.color || spaceById(spaceId)?.color || '#5b7cfa')}">${icon('area', 'nav-area-icon')}<span class="nav-title">${esc(area.title)}</span><span class="nav-count">${taskCount('area', area.id) || ''}</span></button>${areaProjects.length ? `<ul class="nav-list">${areaProjects.map((project) => `<li><button class="nav-item ${ui.view.type === 'project' && ui.view.id === project.id ? 'active' : ''}" data-view="project" data-id="${project.id}" data-list-kind="project" draggable="true" style="padding-left:37px">${progressRing(projectProgress(project.id))}<span class="nav-title">${esc(project.title)}</span></button></li>`).join('')}</ul>` : ''}</li>`;
    }).join('');
    const projects = ui.state.projects.filter((project) => project.spaceId === spaceId && !project.areaId && (project.status === 'open' || isCompletedButVisible(project)) && !project.repeat && project.bucket !== 'someday' && (!project.scheduledFor || project.scheduledFor <= today)).sort((a, b) => a.order - b.order);
    const projectsHtml = projects.map((project) => `<li><button class="nav-item ${ui.view.type === 'project' && ui.view.id === project.id ? 'active' : ''}" data-view="project" data-id="${project.id}" data-list-kind="project" draggable="true">${progressRing(projectProgress(project.id))}<span class="nav-title">${esc(project.title)}</span></button></li>`).join('');
    if (!areasHtml && !projectsHtml) return '';
    return `${title ? `<li class="nav-section-title"><span class="space-title-dot" style="--space-color:${esc(spaceById(spaceId)?.color || '#85878b')}"></span>${esc(title)}</li>` : ''}${areasHtml}${projectsHtml}`;
  };
  let userListsHtml = '';
  if (ui.activeSpaceId === 'all') {
    userListsHtml = [...ui.state.spaces].sort((a, b) => a.order - b.order).map((space) => renderUserLists(space.id, space.title)).join('');
    userListsHtml += renderUserLists(null, 'Unassigned');
  } else userListsHtml = renderUserLists(ui.activeSpaceId);

  sidebar.innerHTML = `<ul class="nav-list">${standardHtml}</ul>
    <ul class="nav-list nav-user-lists">${userListsHtml}</ul>`;
}

function viewDefinition() {
  const today = localDay();
  const taskFilter = (task) => matchesActiveSpace(task) && (task.status === 'open' || isCompletedButVisible(task)) && !task.repeat && projectAllowsTask(task);
  const definitions = {
    inbox: { title: 'Inbox', icon: 'inbox', eyebrow: 'Collect now, decide later', subtitle: 'Unsorted thoughts and to-dos waiting for a home.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.bucket === 'inbox') },
    today: { title: 'Today', icon: 'star', eyebrow: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), subtitle: 'Your clear, focused plan for the day.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && (t.bucket === 'today' || (t.scheduledFor && t.scheduledFor <= today && t.bucket !== 'someday' && t.bucket !== 'inbox') || (t.deadline && t.deadline <= today))), projects: ui.state.projects.filter((p) => projectIsToday(p, today)) },
    upcoming: { title: 'Upcoming', icon: 'calendar', eyebrow: 'Plan ahead', subtitle: 'Start dates, repeating plans, deadlines, and calendar events in one agenda.', tasks: upcomingTaskEntries(today, taskFilter), projects: upcomingProjectEntries(today) },
    anytime: { title: 'Anytime', icon: 'layers', eyebrow: 'Available now', subtitle: 'Everything active that you could make progress on.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && (t.bucket === 'anytime' || t.bucket === 'today') && (!t.scheduledFor || t.scheduledFor <= today)) },
    someday: { title: 'Someday', icon: 'archive', eyebrow: 'Ideas for later', subtitle: 'Possibilities worth keeping, without a commitment.', tasks: ui.state.tasks.filter((t) => matchesActiveSpace(t) && (t.status === 'open' || isCompletedButVisible(t)) && !t.repeat && t.bucket === 'someday'), projects: ui.state.projects.filter((p) => projectIsActive(p) && p.bucket === 'someday') },
    logbook: { title: 'Logbook', icon: 'check', eyebrow: 'Completed', subtitle: 'A record of the progress you have made.', tasks: ui.state.tasks.filter((t) => matchesActiveSpace(t) && isLogged(t)), projects: ui.state.projects.filter((p) => matchesActiveSpace(p) && isLogged(p)) },
    trash: { title: 'Trash', icon: 'trash', eyebrow: 'Discarded', subtitle: 'Items moved here stay available for recovery.', tasks: ui.state.tasks.filter((t) => matchesActiveSpace(t) && isTrashed(t)), projects: ui.state.projects.filter((p) => matchesActiveSpace(p) && isTrashed(p)) },
    tomorrow: { title: 'Tomorrow', icon: 'calendar', eyebrow: formatDate(addDays(today, 1), { weekday: 'long', month: 'long', day: 'numeric' }), subtitle: 'Start dates, repeating plans, and deadlines for the next day.', tasks: upcomingTaskEntries(today, taskFilter).filter((task) => task.agendaDay === addDays(today, 1)), projects: upcomingProjectEntries(today).filter((project) => project.agendaDay === addDays(today, 1)) },
    deadlines: { title: 'Deadlines', icon: 'flag', eyebrow: 'Commitments', subtitle: 'Open items ordered by the date they must be finished.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.deadline), projects: ui.state.projects.filter((p) => projectIsActive(p) && p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)) },
    repeating: { title: 'Repeating', icon: 'repeat', eyebrow: 'Templates', subtitle: 'Routines that create fresh to-dos and projects on their schedule.', tasks: ui.state.tasks.filter((t) => matchesActiveSpace(t) && t.repeat), repeatingProjects: ui.state.projects.filter((p) => matchesActiveSpace(p) && p.repeat) },
  };
  if (definitions[ui.view.type]) return definitions[ui.view.type];
  if (ui.view.type === 'project') {
    const project = projectById(ui.view.id);
    if (!project) return definitions.today;
    return { title: project.title, icon: isLogged(project) ? 'check' : isTrashed(project) ? 'trash' : project.repeat ? 'repeat' : 'list', eyebrow: project.repeat ? (project.repeat.stopped ? 'Stopped Repeating Project Template' : 'Repeating Project Template') : project.status === 'completed' ? 'Completed project' : project.status === 'canceled' ? 'Canceled project' : isTrashed(project) ? 'In Trash' : areaById(project.areaId)?.title || 'Project', subtitle: project.notes || (project.repeat ? 'These contents will be copied into future Project Occurrences.' : 'A focused set of steps toward one outcome.'), deadline: project.deadline, tasks: ui.state.tasks.filter((t) => {
      if (t.projectId !== project.id || t.repeat) return false;
      if (isLogged(project)) return isLogged(t);
      if (isTrashed(project)) return isTrashed(t);
      const archivedHeading = ui.state.headings.some((heading) => heading.id === t.headingId && heading.archived);
      return archivedHeading || t.status === 'open' || isCompletedButVisible(t);
    }), project };
  }
  if (ui.view.type === 'area') {
    const area = areaById(ui.view.id);
    if (!area) return definitions.today;
    return { title: area.title, icon: 'circle', eyebrow: 'Area', subtitle: 'An ongoing part of life, with projects and standalone to-dos.', tasks: ui.state.tasks.filter((t) => t.areaId === area.id && !t.projectId && taskFilter(t)), projects: ui.state.projects.filter((project) => project.areaId === area.id && projectIsActive(project) && project.bucket !== 'someday' && (!project.scheduledFor || project.scheduledFor <= today)), area };
  }
  if (ui.view.type === 'tag') {
    return { title: `#${ui.view.id}`, icon: 'tag', eyebrow: 'Tag', subtitle: 'Matching items from the active Space.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && effectiveTags(t).includes(ui.view.id)), projects: ui.state.projects.filter((p) => projectIsActive(p) && effectiveProjectTags(p).includes(ui.view.id)) };
  }
  if (ui.view.type === 'allProjects') {
    return { title: 'All Projects', icon: 'list', eyebrow: 'Open projects', subtitle: 'Every active outcome in this Space.', tasks: [], projects: ui.state.projects.filter((p) => matchesActiveSpace(p) && p.status === 'open' && !p.workspaceTemplate && !p.repeat) };
  }
  if (ui.view.type === 'loggedProjects') {
    return { title: 'Logged Projects', icon: 'check', eyebrow: 'Completed projects', subtitle: 'Finished outcomes and their progress history.', tasks: [], projects: ui.state.projects.filter((p) => matchesActiveSpace(p) && isLogged(p)) };
  }
  return definitions.today;
}

function render(forceInspector = false) {
  if (!ui.state) return;
  renderSidebar();
  renderContent();
  renderInspector(forceInspector);
}

function renderContent() {
  destroyTaskSortables();
  destroyHeadingSortable();
  const view = viewDefinition();
  const matchesActiveTags = (tags) => [...ui.activeTags].every((tag) => tags.includes(tag));
  const visibleTasks = ui.activeTags.size ? view.tasks.filter((task) => matchesActiveTags(effectiveTags(task))) : view.tasks;
  const visibleProjects = ui.activeTags.size ? (view.projects || []).filter((project) => matchesActiveTags(effectiveProjectTags(project))) : (view.projects || []);
  const sorted = [...visibleTasks].sort((a, b) => {
    if (ui.view.type === 'deadlines') return (a.deadline || '').localeCompare(b.deadline || '');
    if (ui.view.type === 'logbook') return (b.completedAt || '').localeCompare(a.completedAt || '');
    if (ui.view.type === 'repeating') return (a.repeat?.nextDate || '').localeCompare(b.repeat?.nextDate || '');
    return a.order - b.order;
  });
  const headerActions = `${ui.view.type === 'today' ? `<button class="icon-button" data-action="toggle-group" aria-label="Group Today by list" title="Group Today by list">${icon('layers')}</button>` : ''}${ui.view.type === 'trash' && (view.tasks.length || view.projects.length) ? `<button class="button" data-action="empty-trash">Empty Trash</button>` : ''}${ui.view.type === 'project' ? `${view.project?.status === 'open' && !view.project?.repeat?.stopped ? `<button class="icon-button" data-action="new-heading" aria-label="New heading" title="New heading">${icon('heading')}</button>` : ''}<button class="icon-button" data-action="project-menu" aria-label="Project options" title="Project options">${icon('more')}</button>` : ''}${ui.view.type === 'area' ? `<button class="icon-button" data-action="new-heading" aria-label="New heading" title="New heading">${icon('heading')}</button><button class="icon-button" data-action="area-menu" aria-label="Area options" title="Area options">${icon('more')}</button>` : ''}`;
  const deadline = view.deadline ? ` · Deadline ${formatDate(view.deadline, { month: 'short', day: 'numeric' })}` : '';
  const progress = view.project ? projectProgress(view.project.id) : null;
  const sections = buildSections(sorted);
  const tags = [...new Set([...(view.tasks || []).flatMap((task) => effectiveTags(task)), ...(view.projects || []).flatMap((project) => effectiveProjectTags(project))])].sort();
  const calendar = ['today', 'upcoming', 'tomorrow'].includes(ui.view.type) && ui.state.settings.showCalendar ? renderCalendarEvents(ui.view.type) : '';
  const projectSection = visibleProjects.length ? `<section class="section"><div class="section-header"><h2>Projects</h2></div>${renderProjectCards(visibleProjects)}</section>` : '';
  const sectionList = sections.some((section) => section.tasks.length || section.heading || section.agenda) ? `<div class="section-list">${sections.map(renderSection).join('')}</div>` : '';
  const repeatingManagement = ui.view.type === 'repeating' ? renderRepeatingManagement(sorted, view.repeatingProjects || []) : '';

  content.innerHTML = `<div class="content-inner" data-view-type="${esc(ui.view.type)}">
    <header class="view-header">
      <div class="eyebrow">${esc(view.eyebrow)}${deadline}</div>
      <div class="view-title-row">${icon(view.icon, 'view-icon')}<h1>${esc(view.title)}</h1><div class="header-actions">${headerActions}</div></div>
      <p class="view-subtitle">${esc(view.subtitle)}</p>
      ${progress !== null ? `<div class="progress-line" aria-label="Project ${progress}% complete"><span style="width:${progress}%"></span></div>` : ''}
      ${tags.length && ['project', 'area'].includes(ui.view.type) ? `<div class="filter-bar" aria-label="Filter by tags"><button class="chip ${!ui.activeTags.size ? 'active' : ''}" data-filter-tag="">All</button>${tags.map((tag) => `<button class="chip ${ui.activeTags.has(tag) ? 'active' : ''}" data-filter-tag="${esc(tag)}" aria-pressed="${ui.activeTags.has(tag)}">${esc(tag)}</button>`).join('')}</div>` : ''}
    </header>
    ${calendar}
    ${ui.view.type === 'repeating' ? repeatingManagement : `${projectSection}${view.repeatingProjects?.length ? `<section class="section"><div class="section-header"><h2>Repeating projects</h2></div>${renderProjectCards(view.repeatingProjects)}</section>` : ''}${sectionList || projectSection || view.repeatingProjects?.length ? sectionList : renderEmpty(view)}`}
  </div>${renderSelectionToolbar()}`;
  if (ui.view.type !== 'repeating' && !(ui.view.type === 'project' && view.project?.repeat?.stopped)) mountTaskSortables(content, {
    crossSection: ['today', 'upcoming', 'project', 'area'].includes(ui.view.type),
    onStart: (ids) => {
      ui.sortableTaskDrag = true;
      ui.draggedTaskId = ids[0] || null;
    },
    onEnd: ({ movedIds, orderedIds, sectionKey }) => {
      const destination = {};
      if (ui.view.type === 'upcoming') Object.assign(destination, { bucket: sectionKey <= localDay() ? 'today' : 'upcoming', scheduledFor: sectionKey, evening: false });
      if (ui.view.type === 'today') Object.assign(destination, { bucket: 'today', scheduledFor: localDay(), evening: sectionKey.startsWith('evening') });
      if (['project', 'area'].includes(ui.view.type)) Object.assign(destination, { headingId: sectionKey === 'no-heading' ? null : sectionKey });
      reorderTasks(ui.state, movedIds, orderedIds, destination);
      ui.sortableTaskDrag = false;
      ui.draggedTaskId = null;
      scheduleSave();
      renderContent();
    },
  });
  if (['project', 'area'].includes(ui.view.type) && !(ui.view.type === 'project' && view.project?.repeat?.stopped)) {
    mountHeadingSortable(content, (orderedIds) => {
      reorderEntities(headingsFor(ui.view.type, ui.view.id), orderedIds);
      scheduleSave();
      renderContent();
    });
  }
}

function repeatState(item) {
  if (item.repeat?.stopped) return 'stopped';
  if (item.repeat?.paused) return 'paused';
  return 'active';
}

function renderRepeatingManagement(tasks, projects) {
  const groups = [
    ['active', 'Active schedules', 'Creating future Occurrences'],
    ['paused', 'Paused schedules', 'Kept safely, but not creating anything'],
    ['stopped', 'Stopped schedules', 'History only; these schedules cannot restart'],
  ];
  return `<div class="repeating-management">${groups.map(([state, title, description]) => {
    const matchingTasks = tasks.filter((task) => repeatState(task) === state);
    const matchingProjects = projects.filter((project) => repeatState(project) === state);
    const count = matchingTasks.length + matchingProjects.length;
    const taskRows = matchingTasks.length ? `<ul class="task-list">${matchingTasks.map(renderTask).join('')}</ul>` : '';
    const projectRows = matchingProjects.length ? `<div class="repeating-projects"><span class="repeating-kind-label">Projects</span>${renderProjectCards(matchingProjects)}</div>` : '';
    const empty = count ? '' : '<p class="repeating-empty">None</p>';
    return `<section class="section repeating-group" data-repeat-state="${state}"><div class="section-header"><div><h2>${title}</h2><p>${description}</p></div><span class="section-meta">${count}</span></div>${taskRows}${projectRows}${empty}</section>`;
  }).join('')}</div>`;
}

function renderCalendarEvents(viewType) {
  const today = localDay();
  const events = ui.state.calendarEvents.filter((event) => {
    if (!matchesActiveSpace(event)) return false;
    const day = event.start.slice(0, 10);
    if (viewType === 'today') return day === today;
    if (viewType === 'tomorrow') return day === addDays(today, 1);
    return day > today;
  }).sort((a, b) => a.start.localeCompare(b.start)).slice(0, viewType === 'upcoming' ? 8 : 12);
  if (!events.length) return '';
  return `<section class="calendar-strip" aria-label="Calendar events">${events.map((event) => {
    const day = event.start.slice(0, 10);
    const date = new Date(event.start);
    const eventTime = event.allDay ? 'all day' : Number.isNaN(date.getTime()) ? 'time unavailable' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    const time = viewType === 'upcoming' ? `${relativeDateLabel(day)} · ${eventTime}` : eventTime;
    return `<div class="calendar-event"><span class="calendar-time">${esc(time)}</span><i class="calendar-line"></i><div><div class="calendar-title">${esc(event.title)}</div><div class="calendar-name">${esc(event.calendar || 'Calendar')}</div></div></div>`;
  }).join('')}</section>`;
}

function renderProjectCards(projects) {
  if (!projects.length) return `<div class="empty-state">${icon('list')}<h2>No projects here</h2><p>Projects will appear here as their status changes.</p></div>`;
  return `<div class="project-card-list">${projects.map((project) => {
    const template = project.repeatTemplateId ? projectById(project.repeatTemplateId) : null;
    const repeatMeta = project.repeat ? `${esc(repeatLabel(project.repeat))} · ` : template ? `${icon('repeat')} Occurrence of ${esc(template.title)} · ` : '';
    return `<button class="project-card" data-project-card="${project.id}"><h2>${esc(project.title)}</h2><p>${ui.activeSpaceId === 'all' ? `${esc(spaceLabel(project.spaceId))} · ` : ''}${project.agendaDay ? `${esc(relativeDateLabel(project.agendaDay))} · ` : ''}${repeatMeta}${project.deadline ? `Deadline ${esc(deadlineLabel(project.deadline))} · ` : ''}${esc(isTrashed(project) ? 'In Trash' : project.status === 'canceled' ? 'Canceled' : areaById(project.areaId)?.title || 'Project')} · ${projectProgress(project.id)}% complete</p></button>`;
  }).join('')}</div>`;
}

function buildSections(tasks) {
  if (['project', 'area'].includes(ui.view.type)) {
    const viewHeadings = headingsFor(ui.view.type, ui.view.id, true);
    const archivedHeadings = viewHeadings.filter((item) => item.archived).sort((a, b) => a.order - b.order);
    const archivedIds = new Set(archivedHeadings.map((heading) => heading.id));
    const activeHeadings = viewHeadings.filter((item) => !item.archived);
    const activeIds = new Set(activeHeadings.map((heading) => heading.id));
    const groups = groupBy(tasks.filter((task) => !archivedIds.has(task.headingId)), (task) => activeIds.has(task.headingId) ? task.headingId : 'no-heading');
    if (!groups.size) groups.set('no-heading', []);
    for (const heading of activeHeadings) {
      if (!groups.has(heading.id)) groups.set(heading.id, []);
    }
    const activeSections = [...groups.entries()].sort(([a], [b]) => {
      if (a === 'no-heading') return -1;
      if (b === 'no-heading') return 1;
      return (ui.state.headings.find((h) => h.id === a)?.order || 0) - (ui.state.headings.find((h) => h.id === b)?.order || 0);
    }).map(([key, items]) => {
      const heading = ui.state.headings.find((item) => item.id === key);
      const today = localDay();
      items.sort((a, b) => {
        const rank = (task) => task.bucket === 'someday' ? 2 : task.scheduledFor && task.scheduledFor > today ? 1 : 0;
        return rank(a) - rank(b) || a.order - b.order;
      });
      return { key, title: heading?.title || (activeHeadings.length ? 'To-dos' : ''), tasks: items, heading };
    });
    const loggedSections = archivedHeadings.map((heading) => ({
      key: `archived-${heading.id}`,
      title: heading.title,
      meta: 'Logged',
      tasks: tasks.filter((task) => task.headingId === heading.id).sort((a, b) => a.order - b.order),
      heading,
      archived: true,
    }));
    return [...activeSections, ...loggedSections];
  }
  if (ui.view.type === 'upcoming') {
    const groups = groupBy(tasks, (task) => task.agendaDay || task.scheduledFor || task.deadline);
    const today = localDay();
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = addDays(today, offset);
      if (!groups.has(day)) groups.set(day, []);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({ key: day, title: relativeDateLabel(day), meta: formatDate(day, { month: 'short', day: 'numeric' }), tasks: items, agenda: true }));
  }
  if (!tasks.length) return [];
  if (ui.view.type === 'logbook') {
    const groups = groupBy(tasks, (task) => localDay(new Date(task.completedAt || task.createdAt)));
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, items]) => ({ key: day, title: day === localDay() ? 'Today' : formatDate(day, { weekday: 'long' }), meta: formatDate(day, { month: 'short', day: 'numeric' }), tasks: items }));
  }
  if (ui.view.type === 'today') {
    const day = tasks.filter((task) => !task.evening);
    const evening = tasks.filter((task) => task.evening);
    const result = [];
    if (ui.state.settings.groupToday) {
      const addGrouped = (items, eveningMode = false) => {
        const groups = groupBy(items, (task) => task.projectId || task.areaId || (ui.activeSpaceId === 'all' ? task.spaceId : null) || 'Standalone');
        for (const [key, group] of groups) {
          const parent = projectById(key) || areaById(key) || spaceById(key);
          result.push({ key: `${eveningMode ? 'evening-' : ''}${key}`, title: eveningMode ? 'This Evening' : (parent?.title || 'To-dos'), meta: eveningMode && parent ? parent.title : '', tasks: group, symbol: eveningMode ? '☾' : '' });
        }
      };
      addGrouped(day);
      if (evening.length) addGrouped(evening, true);
    } else {
      if (day.length) result.push({ key: 'today', title: 'To-dos', tasks: day });
      if (evening.length) result.push({ key: 'evening', title: 'This Evening', tasks: evening, symbol: '☾' });
    }
    return result;
  }
  if (['anytime', 'someday'].includes(ui.view.type)) {
    const groups = groupBy(tasks, (task) => task.projectId || task.areaId || (ui.activeSpaceId === 'all' ? task.spaceId : null) || 'Standalone');
    const rank = (key) => {
      if (key === 'Standalone') return -1;
      const project = projectById(key);
      if (project) return (areaById(project.areaId)?.order ?? 1000) * 1000 + (project.order ?? 0) + 1;
      const space = spaceById(key);
      if (space) return (space.order ?? 0) - 100;
      return (areaById(key)?.order ?? 1000) * 1000;
    };
    return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([key, items]) => ({ key, title: projectById(key)?.title || areaById(key)?.title || spaceById(key)?.title || 'To-dos', tasks: items }));
  }
  return [{ key: ui.view.type, title: ui.view.type === 'project' ? 'To-dos' : '', tasks }];
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item) || 'Unscheduled';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function renderSection(section) {
  const stoppedProjectTemplate = ui.view.type === 'project' && projectById(ui.view.id)?.repeat?.stopped;
  const headingActions = section.heading && !stoppedProjectTemplate ? `<span class="heading-actions">${section.archived ? `<button class="button heading-restore" data-action="restore-heading" data-heading-id="${section.heading.id}">Restore</button>` : `<button class="icon-button" data-action="heading-menu" data-heading-id="${section.heading.id}" aria-label="Heading options">${icon('more')}</button>`}</span>` : '';
  const title = section.title ? `<div class="section-header ${section.heading ? 'heading-header' : ''} ${section.archived ? 'archived-heading-header' : ''}" ${section.heading && !section.archived ? `data-heading-id="${section.heading.id}"` : ''}>${section.symbol ? `<span class="section-symbol">${section.symbol}</span>` : ''}<h2>${esc(section.title)}</h2>${section.meta ? `<span class="section-meta">${esc(section.meta)}</span>` : ''}${headingActions}</div>` : '';
  const emptyAgenda = section.agenda && !section.tasks.length ? '<p class="agenda-empty">No plans</p>' : '';
  return `<section class="section ${section.archived ? 'archived-section' : ''}" data-section="${esc(section.key)}">${title}<ul class="task-list">${section.tasks.map(renderTask).join('')}</ul>${emptyAgenda}${!section.archived && canQuickAdd() ? renderQuickAdd(section.key, section.title || viewDefinition().title) : ''}</section>`;
}

function renderTask(task) {
  const project = projectById(task.projectId);
  const area = areaById(task.areaId);
  const projectTemplateItem = Boolean(task.workspaceTemplateId);
  const completed = ['completed', 'canceled'].includes(task.status);
  const checked = task.status !== 'open';
  const meta = [];
  if (project && ui.view.type !== 'project') meta.push(`<span class="meta-item">${icon('list')}${esc(project.title)}</span>`);
  else if (area && !['area', 'project'].includes(ui.view.type)) meta.push(`<span class="meta-item">${esc(area.title)}</span>`);
  if (task.deadline) meta.push(`<span class="meta-item deadline">${icon('flag')} ${deadlineLabel(task.deadline)}</span>`);
  if (task.reminderAt) meta.push(`<span class="meta-item reminder">${icon('bell')} ${formatReminderTime(task.reminderAt)}</span>`);
  if (task.bucket === 'someday' && ['project', 'area'].includes(ui.view.type)) meta.push(`<span class="meta-item">${icon('archive')} Someday</span>`);
  else if (task.scheduledFor && !['today', 'upcoming', 'tomorrow'].includes(ui.view.type)) meta.push(`<span class="meta-item ${task.scheduledFor < localDay() ? 'past-date' : ''}">${icon('calendar')} ${esc(scheduleDateLabel(task.scheduledFor))}</span>`);
  if (task.repeat) meta.push(`<span class="meta-item">${icon('repeat')} ${repeatLabel(task.repeat)}</span>`);
  else if (projectTemplateItem) meta.push(`<span class="meta-item">${icon('repeat')} Template item</span>`);
  else if (task.repeatTemplateId) {
    const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
    meta.push(`<span class="meta-item repeat-occurrence">${icon('repeat')} Occurrence${template ? ` of ${esc(template.title)}` : ''}</span>`);
  }
  if (task.agendaDeadlineOnly) meta.push(`<span class="meta-item deadline">Deadline date</span>`);
  if (task.agendaPreview) meta.push(`<span class="meta-item">Upcoming copy</span>`);
  if (task.checklist?.length) meta.push(`<span class="meta-item">${icon('list')} ${task.checklist.filter((i) => i.done).length}/${task.checklist.length}</span>`);
  if (task.tags?.length) meta.push(...task.tags.slice(0, 2).map((tag) => `<span class="meta-item"><i class="tag-dot"></i>${esc(tag)}</span>`));
  const star = ui.view.type === 'anytime' && task.bucket === 'today' ? icon('star', 'today-star') : '';
  const bulkSelected = ui.selectedTaskIds.has(task.id);
  return `<li class="task-row ${ui.selectedTaskId === task.id ? 'selected' : ''} ${bulkSelected ? 'bulk-selected' : ''} ${completed ? 'completed' : ''} ${task.status === 'canceled' ? 'canceled' : ''}" data-task-id="${task.id}" draggable="${!projectTemplateItem}" aria-selected="${bulkSelected}">
    <button class="check-button ${checked ? 'checked' : ''}" data-action="toggle-task" aria-label="${projectTemplateItem ? 'Edit Template item' : checked ? 'Restore' : 'Complete'} ${esc(task.title)}"><span class="check-visual">${checked ? icon('check') : ''}</span></button>
    <div class="task-main" data-action="select-task" role="button" tabindex="0" aria-label="Open details for ${esc(task.title)}"><span class="task-title">${star}${esc(task.title)}</span>${task.notes ? `<div class="task-notes-preview">${esc(task.notes)}</div>` : ''}${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}</div>
    ${projectTemplateItem ? '' : `<button class="task-select ${bulkSelected ? 'active' : ''}" type="button" data-action="select-bulk" aria-label="${bulkSelected ? 'Remove' : 'Add'} ${esc(task.title)} ${bulkSelected ? 'from' : 'to'} selection">${bulkSelected ? icon('check') : ''}</button>`}
    ${icon('chevron', 'task-chevron')}
  </li>`;
}

function handleTaskGestureStart(event) {
  if (!matchMedia('(max-width: 820px)').matches || !event.isPrimary || event.target.closest('button, input, textarea, select, a')) return;
  const row = event.target.closest('[data-task-id]');
  if (!row) return;
  taskGesture = { pointerId: event.pointerId, row, taskId: row.dataset.taskId, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY, horizontal: false };
}

function handleTaskGestureMove(event) {
  const gesture = taskGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  gesture.currentX = event.clientX; gesture.currentY = event.clientY;
  const dx = event.clientX - gesture.startX; const dy = event.clientY - gesture.startY;
  if (!gesture.horizontal) {
    if (Math.hypot(dx, dy) < 10) return;
    if (Math.abs(dy) >= Math.abs(dx)) { taskGesture = null; return; }
    gesture.horizontal = true; gesture.row.classList.add('task-swiping');
  }
  event.preventDefault();
  gesture.row.style.setProperty('--task-swipe-x', `${Math.max(-82, Math.min(82, dx))}px`);
  gesture.row.dataset.swipeAction = dx < 0 ? 'Select' : 'When';
}

function finishTaskGesture(event, canceled = false) {
  const gesture = taskGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  taskGesture = null;
  gesture.row.classList.remove('task-swiping');
  gesture.row.style.removeProperty('--task-swipe-x');
  delete gesture.row.dataset.swipeAction;
  if (!gesture.horizontal || canceled) return;
  const dx = gesture.currentX - gesture.startX;
  ui.suppressClickUntil = Date.now() + 450;
  if (dx <= -56) selectTaskForBulk(gesture.taskId);
  else if (dx >= 56) {
    selectTask(gesture.taskId);
    setTimeout(() => $('[data-field="scheduledFor"]', inspector)?.focus(), 20);
  }
}

function handleTaskGestureEnd(event) { finishTaskGesture(event); }
function handleTaskGestureCancel(event) { finishTaskGesture(event, true); }

function selectedTasks() {
  return ui.state.tasks.filter((task) => ui.selectedTaskIds.has(task.id));
}

function draggedTasks() {
  const primary = ui.state.tasks.find((task) => task.id === ui.draggedTaskId);
  if (!primary) return [];
  if (ui.selectedTaskIds.size > 1 && ui.selectedTaskIds.has(primary.id)) {
    return ui.state.tasks.filter((task) => ui.selectedTaskIds.has(task.id)).sort((a, b) => a.order - b.order);
  }
  return [primary];
}

function clearTaskSelection(renderAfter = true) {
  ui.selectedTaskIds.clear();
  ui.selectionAnchorId = null;
  if (renderAfter && ui.state) renderContent();
}

function selectTaskForBulk(taskId, extendRange = false) {
  if (extendRange && ui.selectionAnchorId) {
    const visibleIds = $$('[data-task-id]', content).map((row) => row.dataset.taskId);
    const anchor = visibleIds.indexOf(ui.selectionAnchorId);
    const target = visibleIds.indexOf(taskId);
    if (anchor >= 0 && target >= 0) {
      visibleIds.slice(Math.min(anchor, target), Math.max(anchor, target) + 1).forEach((id) => ui.selectedTaskIds.add(id));
    }
  } else if (ui.selectedTaskIds.has(taskId)) {
    ui.selectedTaskIds.delete(taskId);
    if (ui.selectionAnchorId === taskId) ui.selectionAnchorId = [...ui.selectedTaskIds].at(-1) || null;
  } else {
    ui.selectedTaskIds.add(taskId);
    ui.selectionAnchorId = taskId;
  }
  if (ui.selectedTaskIds.size) closeInspector({ restoreFocus: false });
  renderContent();
}

function renderSelectionToolbar() {
  const tasks = selectedTasks();
  if (!tasks.length) return '';
  const allTrashed = tasks.every(isTrashed);
  const actionable = tasks.some((task) => task.status === 'open' && !task.repeat && !isTrashed(task));
  return `<div class="selection-toolbar" role="toolbar" aria-label="Actions for ${tasks.length} selected to-do${tasks.length === 1 ? '' : 's'}">
    <strong>${tasks.length} selected</strong>
    ${allTrashed ? `<button class="button" type="button" data-bulk-action="restore">Restore</button>` : ''}
    ${actionable ? `<button class="button" type="button" data-bulk-action="today">Today</button><button class="button" type="button" data-bulk-action="someday">Someday</button><button class="button" type="button" data-bulk-action="move">Move…</button><button class="button" type="button" data-bulk-action="tags">Tags…</button><button class="button" type="button" data-bulk-action="complete">Complete</button><button class="button" type="button" data-bulk-action="cancel">Cancel</button>` : ''}
    ${!allTrashed ? `<button class="danger-button" type="button" data-bulk-action="trash">${icon('trash')} Trash</button>` : ''}
    <button class="icon-button" type="button" data-bulk-action="clear" aria-label="Clear selection">${icon('x')}</button>
  </div>`;
}

function handleBulkAction(action) {
  const tasks = selectedTasks();
  const actionable = tasks.filter((task) => task.status === 'open' && !task.repeat && !isTrashed(task));
  if (action === 'clear') { clearTaskSelection(); return; }
  if (action === 'move') { openMoveTaskModal(actionable); return; }
  if (action === 'tags') { openBulkTagsModal(actionable); return; }
  if (action === 'today' || action === 'someday') {
    actionable.forEach((task) => {
      const nextDate = action === 'today' ? localDay() : null;
      moveReminderToDate(task, nextDate);
      task.bucket = action;
      task.scheduledFor = nextDate;
      task.evening = false;
    });
    scheduleSave(); clearTaskSelection(); showToast(`${actionable.length} to-do${actionable.length === 1 ? '' : 's'} moved to ${action === 'today' ? 'Today' : 'Someday'}`); return;
  }
  if (action === 'complete' || action === 'cancel') {
    const finishedAt = new Date().toISOString();
    actionable.forEach((task) => {
      task.status = action === 'complete' ? 'completed' : 'canceled';
      task.completedAt = finishedAt; task.loggedAt = null; task.completedWithProjectId = null;
      if (task.repeatTemplateId) {
        const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
        if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
      }
    });
    applyLogbookPolicy(); materializeRecurringTasks(); scheduleSave(); clearTaskSelection();
    showToast(`${actionable.length} to-do${actionable.length === 1 ? '' : 's'} ${action === 'complete' ? 'completed' : 'canceled'}`); return;
  }
  if (action === 'restore') {
    tasks.forEach((task) => restoreTrashedTask(task));
    scheduleSave(); clearTaskSelection(); showToast(`${tasks.length} to-do${tasks.length === 1 ? '' : 's'} restored`); return;
  }
  if (action === 'trash') {
    const trashedAt = new Date().toISOString();
    tasks.filter((task) => !isTrashed(task)).forEach((task) => {
      task.previousStatus = task.status; task.status = 'trashed'; task.loggedAt = null; task.trashedAt = trashedAt;
    });
    scheduleSave(); clearTaskSelection(); showToast(`${tasks.length} to-do${tasks.length === 1 ? '' : 's'} moved to Trash`);
  }
}

function openBulkTagsModal(tasks) {
  if (!tasks.length) return;
  const knownTags = getKnownTags();
  const tagStates = knownTags.map((tag) => {
    const count = tasks.filter((task) => task.tags.includes(tag)).length;
    const state = count === tasks.length ? 'all' : count ? 'mixed' : 'none';
    return { tag, state };
  });
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(BulkTagsDialog, { count: tasks.length, tags: tagStates, onClose: closeModal, onSubmit: (states, additions) => {
    const newTags = registerTags(additions);
    tasks.forEach((task) => {
      const next = new Set(task.tags);
      states.forEach(({ tag, state }) => {
        const original = tagStates.find((item) => item.tag === tag)?.state;
        if (state === 'mixed' || (original === 'mixed' && state === original)) return;
        if (state === 'all') next.add(tag);
        else next.delete(tag);
      });
      newTags.forEach((tag) => next.add(tag));
      task.tags = [...next];
    });
    scheduleSave(); closeModal(); clearTaskSelection(); showToast(`Tags updated on ${tasks.length} to-do${tasks.length === 1 ? '' : 's'}`);
  } }), $('#modal-root'));
}

function canQuickAdd() { return !['logbook', 'trash', 'upcoming', 'repeating', 'allProjects', 'loggedProjects'].includes(ui.view.type) && !(ui.view.type === 'project' && (projectById(ui.view.id)?.status !== 'open' || projectById(ui.view.id)?.repeat?.stopped)); }
function renderQuickAdd(key, label = 'this list') {
  return `<button class="section-add" type="button" data-section-add="${esc(key)}" aria-label="New to-do in ${esc(label)}">${icon('plus')}<span>New to-do</span></button><div class="quick-add-row" hidden data-quick-add="${esc(key)}"><span class="quick-add-dot"></span><input class="quick-add-input" type="text" placeholder="Type a to-do…" aria-label="New to-do title in ${esc(label)}"></div>`;
}

function updateInlineTask(input) {
  let task = ui.state.tasks.find((item) => item.id === input.dataset.inlineTaskId);
  if (!task && !input.value.trim()) return;
  const sectionKey = input.closest('[data-quick-add]')?.dataset.quickAdd || 'empty';
  if (!task) {
    task = createTaskFromParsed({ title: input.value, bucket: null, scheduledFor: null, evening: false, reminderAt: null, deadline: null, tags: [] }, { sectionKey, view: { ...ui.view }, select: false, render: false });
    input.dataset.inlineTaskId = task.id;
  } else task.title = input.value;
  rememberPendingTask(task);
  scheduleSave(false);
}

function applyParsedTaskTitle(task, value) {
  const parsed = parseNaturalTask(value);
  task.title = parsed.title;
  if (parsed.tags?.length) task.tags = registerTags([...(task.tags || []), ...parsed.tags]);
  if (parsed.bucket) task.bucket = parsed.bucket;
  if (parsed.scheduledFor) task.scheduledFor = parsed.scheduledFor;
  if (parsed.evening) task.evening = true;
  if (parsed.reminderAt) task.reminderAt = parsed.reminderAt;
  if (parsed.deadline) task.deadline = parsed.deadline;
}

function finalizeInlineTask(input, { renderAfter = true, cancel = false } = {}) {
  if (!input || input.dataset.inlineFinalized) return null;
  input.dataset.inlineFinalized = 'true';
  const taskId = input.dataset.inlineTaskId;
  const task = ui.state.tasks.find((item) => item.id === taskId);
  if (task && (cancel || !input.value.trim())) {
    ui.state.tasks = ui.state.tasks.filter((item) => item.id !== task.id);
    if (ui.syncedState?.tasks?.some((item) => item.id === task.id)) rememberPendingDeletion(task.id);
    else { ui.pendingEntry = null; writePendingEntry(null); }
  } else if (task) {
    applyParsedTaskTitle(task, input.value);
    rememberPendingTask(task);
  }
  scheduleSave(false);
  if (renderAfter) {
    renderSidebar(); renderContent();
    if (task && !cancel && input.value.trim()) setTimeout(() => $(`[data-task-id="${task.id}"] .task-main`, content)?.focus(), 20);
  }
  return task;
}

function repeatLabel(repeat) {
  if (!repeat) return '';
  const every = Number(repeat.interval) > 1 ? `Every ${repeat.interval} ${repeat.frequency.replace('daily','days').replace('weekly','weeks').replace('monthly','months').replace('yearly','years')}` : ({ daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' }[repeat.frequency] || 'Repeating');
  if (repeat.stopped) return `${every} · stopped`;
  return repeat.paused ? `${every} · paused` : every;
}

function formatReminderTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Reminder' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function renderEmpty(view) {
  const messages = {
    today: ['A clear day', 'Nothing is pressing. Choose something from Anytime, or enjoy the space.'],
    inbox: ['Inbox zero', 'Everything has been put where it belongs.'],
    upcoming: ['The horizon is open', 'Schedule a to-do and it will appear here.'],
    someday: ['Room for possibilities', 'Ideas without a date can wait here without getting in the way.'],
    logbook: ['Progress starts here', 'Completed to-dos will collect here over time.'],
    trash: ['Nothing discarded', 'Deleted to-dos will wait here until you restore them.'],
  };
  const [title, text] = messages[ui.view.type] || ['A quiet list', `Add the first to-do to ${view.title}.`];
  return `<div class="empty-state">${icon(ui.view.type === 'today' ? 'sun' : 'sparkle')}<h2>${title}</h2><p>${text}</p></div>${canQuickAdd() ? `<section class="section" data-section="empty">${renderQuickAdd('empty', view.title)}</section>` : ''}`;
}

function formatDate(day, options) {
  const date = new Date(`${day}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : new Intl.DateTimeFormat(undefined, options).format(date);
}
function relativeDateLabel(day) {
  const today = localDay();
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, 2)) return formatDate(day, { weekday: 'long' });
  return formatDate(day, { weekday: 'long' });
}
function scheduleDateLabel(day) {
  const today = localDay();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  if (day < today) return formatDate(day, { month: 'short', day: 'numeric', year: new Date(`${day}T12:00:00`).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  if (day === addDays(today, 1)) return 'Tomorrow';
  return formatDate(day, { month: 'short', day: 'numeric' });
}
function deadlineLabel(day) {
  const today = localDay();
  if (day < today) return 'Overdue';
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return formatDate(day, { month: 'short', day: 'numeric' });
}

function handleContentClick(event) {
  if (Date.now() < ui.suppressClickUntil) { event.preventDefault(); return; }
  const taskRow = event.target.closest('[data-task-id]');
  const action = event.target.closest('[data-action]')?.dataset.action;
  const bulkAction = event.target.closest('[data-bulk-action]')?.dataset.bulkAction;
  if (bulkAction) { handleBulkAction(bulkAction); return; }
  if (action === 'select-bulk' && taskRow) {
    selectTaskForBulk(taskRow.dataset.taskId, event.shiftKey);
    return;
  }
  if (action === 'toggle-task' && taskRow) {
    toggleTask(taskRow.dataset.taskId, taskRow);
    return;
  }
  if (taskRow && (event.metaKey || event.ctrlKey || event.shiftKey)) {
    selectTaskForBulk(taskRow.dataset.taskId, event.shiftKey);
    return;
  }
  if (taskRow && (action === 'select-task' || !event.target.closest('button'))) {
    selectTask(taskRow.dataset.taskId);
    return;
  }
  if (action === 'toggle-group') {
    ui.state.settings.groupToday = !ui.state.settings.groupToday;
    scheduleSave();
    renderContent();
  }
  if (action === 'empty-trash') {
    confirmAction('Empty Trash?', 'Every discarded to-do, project, and heading will be permanently deleted. This cannot be undone.', 'Empty Trash', () => {
      const projectIds = new Set(ui.state.projects.filter((project) => matchesActiveSpace(project) && isTrashed(project)).map((project) => project.id));
      ui.state.tasks = ui.state.tasks.filter((task) => !(matchesActiveSpace(task) && isTrashed(task)) && !projectIds.has(task.projectId));
      ui.state.headings = ui.state.headings.filter((heading) => !projectIds.has(heading.projectId));
      ui.state.projects = ui.state.projects.filter((project) => !projectIds.has(project.id));
      scheduleSave(); render(); showToast('Trash emptied');
    });
  }
  if (action === 'new-heading') openHeadingModal();
  if (action === 'project-menu') openProjectModal(ui.view.id);
  if (action === 'area-menu') openAreaModal(ui.view.id);
  if (action === 'heading-menu') openHeadingModal(event.target.closest('[data-heading-id]').dataset.headingId);
  if (action === 'restore-heading') {
    const heading = ui.state.headings.find((item) => item.id === event.target.closest('[data-heading-id]').dataset.headingId);
    if (heading) { heading.archived = false; scheduleSave(); renderContent(); showToast('Heading restored'); }
  }
  const tag = event.target.closest('[data-filter-tag]');
  if (tag) {
    const value = tag.dataset.filterTag;
    if (!value) ui.activeTags.clear();
    else if (event.metaKey || event.ctrlKey) {
      if (ui.activeTags.has(value)) ui.activeTags.delete(value);
      else ui.activeTags.add(value);
    } else if (ui.activeTags.size === 1 && ui.activeTags.has(value)) ui.activeTags.clear();
    else ui.activeTags = new Set([value]);
    renderContent();
  }
  const projectCard = event.target.closest('[data-project-card]');
  if (projectCard) {
    const project = projectById(projectCard.dataset.projectCard);
    if (ui.view.type === 'repeating' && project?.repeat) openRepeatingProjectEditor(project);
    else setView('project', projectCard.dataset.projectCard);
  }
  const sectionAdd = event.target.closest('[data-section-add]');
  if (sectionAdd) openQuickAdd(sectionAdd.closest('.section')?.querySelector('.quick-add-row'));
}

function handleContentKeydown(event) {
  const taskMain = event.target.closest('.task-main[data-action="select-task"]');
  if (taskMain && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    selectTask(taskMain.closest('[data-task-id]').dataset.taskId);
    return;
  }
  if (!event.target.matches('.quick-add-input')) return;
  if (event.key === 'Enter' && event.target.value.trim()) {
    event.preventDefault();
    finalizeInlineTask(event.target);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    finalizeInlineTask(event.target, { cancel: true });
  }
}

function handleDragStart(event) {
  const heading = event.target.closest('[data-heading-id]');
  if (heading && !event.target.closest('button')) {
    ui.draggedHeadingId = heading.dataset.headingId; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', ui.draggedHeadingId); return;
  }
  const row = event.target.closest('[data-task-id]');
  if (!row) return;
  ui.draggedTaskId = row.dataset.taskId;
  row.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', ui.draggedTaskId);
}

function handleDragOver(event) {
  if (ui.sortableTaskDrag) return;
  const row = event.target.closest('[data-task-id]');
  const section = event.target.closest('[data-section]');
  if (!row && section && (ui.draggedTaskId || ui.draggedHeadingId || ui.draggingMagicAdd)) {
    event.preventDefault();
    $$('.section.drop-target', content).forEach((item) => item.classList.remove('drop-target'));
    section.classList.add('drop-target');
    return;
  }
  if (!row || row.dataset.taskId === ui.draggedTaskId) return;
  event.preventDefault();
  $$('.task-row.drag-over', content).forEach((item) => item.classList.remove('drag-over'));
  row.classList.add('drag-over');
}

function handleDrop(event) {
  if (ui.sortableTaskDrag && event.target.closest('#content')) return;
  const targetRow = event.target.closest('[data-task-id]');
  const targetSection = event.target.closest('[data-section]');
  if (ui.draggingMagicAdd) {
    event.preventDefault();
    ui.draggingMagicAdd = false;
    if (ui.view.type === 'project' && event.clientX < content.getBoundingClientRect().left + 78) openHeadingModal();
    else openQuickAdd(targetSection?.querySelector('.quick-add-row') || $('.quick-add-row', content));
    return;
  }
  const sources = draggedTasks();
  const source = sources[0];
  const target = ui.state.tasks.find((task) => task.id === targetRow?.dataset.taskId);
  if (ui.draggedHeadingId && targetSection && ['project', 'area'].includes(ui.view.type)) {
    event.preventDefault();
    const heading = ui.state.headings.find((item) => item.id === ui.draggedHeadingId);
    const targetHeading = ui.state.headings.find((item) => item.id === targetSection.dataset.section);
    if (heading && targetHeading && heading.id !== targetHeading.id) {
      heading.order = targetHeading.order + (event.clientY > targetSection.getBoundingClientRect().top + targetSection.getBoundingClientRect().height / 2 ? .5 : -.5);
      headingsFor(ui.view.type, ui.view.id).sort((a, b) => a.order - b.order).forEach((item, index) => { item.order = index; });
      scheduleSave(); renderContent();
    }
    ui.draggedHeadingId = null; return;
  }
  if (!source || (!target && !targetSection) || sources.some((item) => item.id === target?.id)) return;
  event.preventDefault();
  const destinationKey = targetSection?.dataset.section || targetRow?.closest('[data-section]')?.dataset.section;
  if (ui.view.type === 'upcoming' && destinationKey) {
    sources.forEach((item) => {
      if (item.repeat) { item.repeat.nextDate = destinationKey; item.scheduledFor = destinationKey; }
      else { moveReminderToDate(item, destinationKey); item.scheduledFor = destinationKey; item.bucket = destinationKey <= localDay() ? 'today' : 'upcoming'; item.evening = false; }
    });
  }
  if (ui.view.type === 'today') {
    const evening = Boolean(target?.evening || destinationKey?.startsWith('evening'));
    sources.forEach((item) => { item.bucket = 'today'; item.scheduledFor = localDay(); item.evening = evening; moveReminderToDate(item, item.scheduledFor); });
  }
  if (target) {
    const rect = targetRow.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    sources.forEach((item, index) => {
      item.order = target.order + (after ? 0.5 : -0.5) + index / 1000;
      if (['project', 'area'].includes(ui.view.type)) item.headingId = target.headingId || null;
    });
  } else {
    const sectionKey = targetSection.dataset.section;
    if (['project', 'area'].includes(ui.view.type)) sources.forEach((item) => { item.headingId = sectionKey === 'no-heading' ? null : sectionKey; });
    const sectionTasks = ui.state.tasks.filter((task) => task.headingId === source.headingId && !sources.some((item) => item.id === task.id));
    const startOrder = Math.max(0, ...sectionTasks.map((task) => task.order)) + 1;
    sources.forEach((item, index) => { item.order = startOrder + index; });
  }
  const ordered = [...ui.state.tasks].sort((a, b) => a.order - b.order);
  ordered.forEach((task, index) => { task.order = index; });
  scheduleSave();
  renderContent();
}

function handleDragEnd() {
  ui.draggedTaskId = null;
  ui.draggedHeadingId = null;
  ui.draggingMagicAdd = false;
  $$('.task-row.dragging, .task-row.drag-over', content).forEach((item) => item.classList.remove('dragging', 'drag-over'));
  $$('.section.drop-target', content).forEach((item) => item.classList.remove('drop-target'));
  $$('.nav-item.drop-target', sidebar).forEach((item) => item.classList.remove('drop-target'));
}

function handleSidebarDrop(event) {
  const destination = event.target.closest('[data-view]');
  if (destination && ui.draggingMagicAdd) {
    event.preventDefault();
    ui.draggingMagicAdd = false;
    const type = destination.dataset.view;
    const id = destination.dataset.id || null;
    if (type === 'area' && id) openNewListModal({ type: 'project', areaId: id });
    else {
      setView(['project', 'area', 'inbox', 'today', 'anytime', 'someday'].includes(type) ? type : 'inbox', id);
      setTimeout(() => beginQuickAdd(true), 0);
    }
    return;
  }
  if (destination && ui.draggedList) {
    event.preventDefault();
    const source = ui.draggedList.kind === 'area' ? areaById(ui.draggedList.id) : projectById(ui.draggedList.id);
    const targetKind = destination.dataset.listKind;
    const target = targetKind === 'area' ? areaById(destination.dataset.id) : targetKind === 'project' ? projectById(destination.dataset.id) : null;
    if (!source || source === target) return;
    if (ui.draggedList.kind === 'project' && targetKind === 'area') { source.areaId = target.id; source.spaceId = target.spaceId || source.spaceId; source.order = Math.max(0, ...ui.state.projects.filter((item) => item.areaId === target.id).map((item) => item.order || 0)) + 1; }
    else if (ui.draggedList.kind === 'project' && targetKind === 'project') { source.areaId = target.areaId || null; source.spaceId = target.spaceId || source.spaceId; source.order = (target.order || 0) + .5; }
    else if (ui.draggedList.kind === 'area' && targetKind === 'area') source.order = (target.order || 0) + .5;
    else return;
    const collection = ui.draggedList.kind === 'area' ? ui.state.areas : ui.state.projects;
    collection.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((item, index) => { item.order = index; });
    if (ui.draggedList.kind === 'project') ui.state.tasks.filter((item) => item.projectId === source.id).forEach((item) => { item.areaId = source.areaId || null; item.spaceId = source.spaceId || item.spaceId; });
    ui.draggedList = null; scheduleSave(); render(); showToast('List moved'); return;
  }
  const tasks = draggedTasks().filter((item) => !item.repeat);
  const task = tasks[0];
  if (!destination || !task) return;
  event.preventDefault();
  const type = destination.dataset.view;
  const id = destination.dataset.id || null;
  if (!['inbox', 'today', 'upcoming', 'anytime', 'someday', 'area', 'project'].includes(type)) return;
  tasks.forEach((item) => {
    if (type === 'inbox') { item.bucket = 'inbox'; item.scheduledFor = null; item.evening = false; item.projectId = null; item.headingId = null; item.areaId = null; moveReminderToDate(item, null); }
    else if (type === 'today') { item.bucket = 'today'; item.scheduledFor = localDay(); item.evening = false; moveReminderToDate(item, item.scheduledFor); }
    else if (type === 'upcoming') { item.bucket = 'upcoming'; item.scheduledFor = item.scheduledFor > localDay() ? item.scheduledFor : addDays(localDay(), 1); item.evening = false; moveReminderToDate(item, item.scheduledFor); }
    else if (type === 'anytime') { item.bucket = 'anytime'; item.scheduledFor = null; item.evening = false; moveReminderToDate(item, null); }
    else if (type === 'someday') { item.bucket = 'someday'; item.scheduledFor = null; item.evening = false; moveReminderToDate(item, null); }
    else if (type === 'area' && id) { const area = areaById(id); item.projectId = null; item.headingId = null; item.areaId = id; item.spaceId = area?.spaceId || item.spaceId; if (item.bucket === 'inbox') item.bucket = 'anytime'; }
    else if (type === 'project' && id) { const project = projectById(id); item.projectId = id; item.headingId = null; item.areaId = project?.areaId || null; item.spaceId = project?.spaceId || item.spaceId; if (item.bucket === 'inbox') item.bucket = 'anytime'; }
  });
  ui.draggedTaskId = null; scheduleSave(); render(); showToast(`Moved “${task.title}”`);
}

function beginQuickAdd(fromMagicButton = false) {
  if (ui.selectedTaskId) closeInspector({ restoreFocus: false });
  if (!canQuickAdd()) setView('inbox');
  let row = $('.quick-add-row:not([hidden])', content) || $('.quick-add-row', content);
  if (!row && fromMagicButton) {
    setView('inbox');
    row = $('.quick-add-row', content);
  }
  if (row) {
    openQuickAdd(row);
  }
}

function openQuickAdd(row) {
  if (!row) return;
  const sectionKey = row.dataset.quickAdd;
  const existing = $('.quick-add-row:not([hidden]) .quick-add-input', content);
  if (existing && existing !== $('.quick-add-input', row)) {
    finalizeInlineTask(existing, { renderAfter: false });
    renderContent();
    row = $$('[data-quick-add]', content).find((candidate) => candidate.dataset.quickAdd === sectionKey);
    if (!row) return;
  }
  row.hidden = false;
  const button = row.closest('.section')?.querySelector('.section-add');
  if (button) button.hidden = true;
  const input = $('.quick-add-input', row);
  input.focus(); input.select();
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function createTaskFromParsed(parsed, options = {}) {
  const today = localDay();
  const targetView = options.view || ui.view;
  const task = {
    id: uid('task'), title: parsed.title, notes: options.notes || '', status: 'open', bucket: 'inbox', scheduledFor: null, evening: false, reminderAt: null, deadline: null,
    projectId: options.projectId || null, headingId: null, areaId: null, spaceId: options.spaceId || currentCreationSpaceId(), tags: registerTags(parsed.tags || []), checklist: [], repeat: null, createdAt: new Date().toISOString(), completedAt: null, loggedAt: null, order: Date.now(),
  };
  if (options.useCurrentView !== false) {
    if (targetView.type === 'today') {
      task.bucket = 'today'; task.scheduledFor = today;
      const parentKey = String(options.sectionKey || '').replace(/^evening-/, '');
      const project = projectById(parentKey);
      const area = areaById(parentKey);
      if (project) { task.projectId = project.id; task.areaId = project.areaId || null; task.spaceId = project.spaceId || task.spaceId; }
      else if (area) { task.areaId = area.id; task.spaceId = area.spaceId || task.spaceId; }
      task.evening = String(options.sectionKey || '').startsWith('evening-');
    }
    else if (targetView.type === 'anytime') task.bucket = 'anytime';
    else if (targetView.type === 'someday') task.bucket = 'someday';
    else if (targetView.type === 'tomorrow') { task.bucket = 'upcoming'; task.scheduledFor = addDays(today, 1); }
    else if (targetView.type === 'deadlines') { task.bucket = 'anytime'; task.deadline = today; }
    else if (targetView.type === 'tag') { task.bucket = 'anytime'; task.tags = [...new Set([...task.tags, targetView.id])]; }
    else if (targetView.type === 'project') {
      const project = projectById(targetView.id);
      task.bucket = 'anytime'; task.projectId = project?.id || null; task.areaId = project?.areaId || null; task.spaceId = project?.spaceId || task.spaceId; task.headingId = project && options.sectionKey && options.sectionKey !== 'no-heading' ? options.sectionKey : null;
      if (project?.repeat) { task.workspaceTemplate = true; task.workspaceTemplateId = project.id; task.workspaceBlueprintKey = uid('repeat-blueprint'); }
    } else if (targetView.type === 'area') {
      const area = areaById(targetView.id);
      task.bucket = 'anytime'; task.areaId = targetView.id; task.spaceId = area?.spaceId || task.spaceId; task.headingId = options.sectionKey && options.sectionKey !== 'no-heading' ? options.sectionKey : null;
    }
  }
  if (task.projectId && task.bucket === 'inbox' && options.useCurrentView === false) task.bucket = 'anytime';
  if (task.projectId && !task.areaId) task.areaId = projectById(task.projectId)?.areaId || null;
  if (task.projectId) task.spaceId = projectById(task.projectId)?.spaceId || task.spaceId;
  if (parsed.bucket) task.bucket = parsed.bucket;
  if (parsed.scheduledFor) task.scheduledFor = parsed.scheduledFor;
  if (parsed.evening) task.evening = true;
  if (parsed.reminderAt) task.reminderAt = parsed.reminderAt;
  if (parsed.deadline) task.deadline = parsed.deadline;
  ui.state.tasks.push(task);
  if (options.select !== false) {
    ui.selectedTaskId = task.id;
    ui.markdownPreview = false;
    app.classList.add('inspector-open');
  }
  scheduleSave();
  if (options.render !== false) render();
  if (options.select !== false) setTimeout(() => $('#inspector-title')?.focus(), 30);
  return task;
}

function toggleTask(taskId, row) {
  const task = ui.state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  if (isTrashed(task)) {
    const restoredProject = restoreTrashedTask(task);
    scheduleSave(); render(); showToast(restoredProject ? 'Project restored' : 'To-do restored');
    return;
  }
  if (task.repeat) { selectTask(task.id); showToast('Edit or pause this repeating template in its details'); return; }
  if (task.workspaceTemplateId) { selectTask(task.id); showToast('Edit this item as part of its Repeating Project Template'); return; }
  if (task.status === 'open') {
    ui.lastCompleted = { id: task.id, status: task.status, completedAt: task.completedAt, loggedAt: task.loggedAt || null, completedWithProjectId: task.completedWithProjectId || null };
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.loggedAt = null;
    task.completedWithProjectId = null;
    if (task.repeatTemplateId) {
      const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
      if (template?.repeat?.mode === 'afterCompletion') {
        ui.lastCompleted.repeatTemplateNextDate = template.repeat.nextDate;
        template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
      }
    }
    applyLogbookPolicy();
    if (isLogged(task)) row?.classList.add('completing');
    if (ui.selectedTaskId === task.id) ui.selectedTaskId = null;
    materializeRecurringTasks();
    scheduleSave();
    showToast('To-do completed', 'Undo', undoComplete);
    if (isLogged(task)) setTimeout(render, 220);
    else render();
  } else {
    task.status = 'open';
    task.completedAt = null;
    task.loggedAt = null;
    task.completedWithProjectId = null;
    scheduleSave();
    render();
  }
}

function undoComplete() {
  if (!ui.lastCompleted) return;
  const task = ui.state.tasks.find((item) => item.id === ui.lastCompleted.id);
  if (task) {
    task.status = ui.lastCompleted.status; task.completedAt = ui.lastCompleted.completedAt; task.loggedAt = ui.lastCompleted.loggedAt; task.completedWithProjectId = ui.lastCompleted.completedWithProjectId;
    if (task.repeatTemplateId && ui.lastCompleted.repeatTemplateNextDate) {
      const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
      if (template?.repeat) template.repeat.nextDate = ui.lastCompleted.repeatTemplateNextDate;
    }
    scheduleSave(); render();
  }
  ui.lastCompleted = null;
}

function restoreTrashedTask(task) {
  const parent = projectById(task.projectId);
  const restoredProject = isTrashed(parent);
  if (restoredProject) {
    parent.status = parent.previousStatus || 'open';
    parent.previousStatus = null;
    parent.trashedAt = null;
    ui.state.tasks.filter((item) => item.projectId === parent.id && isTrashed(item)).forEach((item) => {
      item.status = item.previousStatus || 'open';
      item.previousStatus = null;
      item.trashedAt = null;
    });
  } else {
    task.status = task.previousStatus || 'open';
    task.previousStatus = null;
    task.trashedAt = null;
  }
  applyLogbookPolicy();
  return restoredProject;
}

function selectTask(taskId) {
  if (ui.selectedTaskId !== taskId) {
    ui.markdownPreview = false;
    ui.noteFindOpen = false;
    ui.noteFindQuery = '';
    ui.noteFindIndex = 0;
  }
  ui.selectedTaskId = taskId;
  app.classList.add('inspector-open');
  renderContent();
  renderInspector();
  if (matchMedia('(max-width: 820px)').matches) mountInspectorDrawer();
  syncSidebarAccessibility();
  inspector.tabIndex = -1;
  setTimeout(() => inspector.focus(), 20);
}

function mountInspectorDrawer() {
  const drawer = createMobileDrawer('mobile-inspector-drawer', 'To-do details', 'end', inspector);
  $('[data-inspector-action="close"]', inspector)?.addEventListener('click', () => drawer.removeAttribute('open'), { once: true });
  showMobileDrawer(drawer, () => {
    if (ui.selectedTaskId) closeInspector({ restoreFocus: true, fromDrawer: true });
  });
  app.classList.add('library-inspector-open');
}

function closeInspector({ restoreFocus = true, fromDrawer = false } = {}) {
  const drawer = $('#mobile-inspector-drawer');
  if (!fromDrawer && drawer?.hasAttribute('open')) {
    drawer.removeAttribute('open');
    return;
  }
  const returnTaskId = ui.selectedTaskId;
  ui.selectedTaskId = null;
  destroyChecklistSortable();
  app.classList.remove('inspector-open');
  app.classList.remove('library-inspector-open');
  restorePanel('inspector-anchor', inspector, drawer);
  renderSidebar();
  renderContent();
  inspector.innerHTML = '';
  syncSidebarAccessibility();
  if (restoreFocus) setTimeout(() => $(`[data-task-id="${returnTaskId}"] .task-main`, content)?.focus(), 20);
}

function renderInspector(force = false) {
  const task = ui.state.tasks.find((item) => item.id === ui.selectedTaskId);
  if (!task) { app.classList.remove('inspector-open'); inspector.innerHTML = ''; syncSidebarAccessibility(); return; }
  const previousPane = $('.inspector-scroll', inspector);
  if (!force && previousPane?.dataset.taskId === task.id) { syncSidebarAccessibility(); return; }
  const previousScrollTop = previousPane?.dataset.taskId === task.id ? previousPane.scrollTop : 0;
  const schedule = task.bucket === 'today' ? (task.evening ? 'evening' : 'today') : task.bucket;
  const spaceOptions = ui.state.spaces.map((space) => `<option value="${space.id}" ${itemSpaceId(task) === space.id ? 'selected' : ''}>${esc(space.title)}</option>`).join('');
  const availableProjects = task.workspaceTemplateId
    ? ui.state.projects.filter((project) => project.id === task.workspaceTemplateId)
    : ui.state.projects.filter((project) => project.status === 'open' && !project.workspaceTemplate && !project.repeat);
  const projectOptions = [`<option value="">No project</option>`, ...availableProjects.map((p) => `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${esc(spaceLabel(p.spaceId))} › ${esc(p.title)}${p.repeat ? ' (Repeating Template)' : ''}</option>`)].join('');
  const headingOptions = [`<option value="">No heading</option>`, ...ui.state.headings.filter((h) => !h.archived && (task.projectId ? h.projectId === task.projectId : h.areaId === task.areaId && !h.projectId)).map((h) => `<option value="${h.id}" ${task.headingId === h.id ? 'selected' : ''}>${esc(h.title)}</option>`)].join('');
  const repeat = task.repeat;
  const projectTemplate = task.workspaceTemplateId ? projectById(task.workspaceTemplateId) : null;
  const stoppedTemplate = Boolean(repeat?.stopped || projectTemplate?.repeat?.stopped);
  const occurrenceTemplate = task.repeatTemplateId ? ui.state.tasks.find((item) => item.id === task.repeatTemplateId) : null;
  const occurrenceDate = task.scheduledFor ? formatDate(task.scheduledFor, { weekday: 'long', month: 'long', day: 'numeric' }) : 'its scheduled date';
  inspector.innerHTML = `<div class="inspector-scroll" data-task-id="${esc(task.id)}">
    <div class="inspector-top"><span class="inspector-status">${task.status === 'completed' ? 'Completed' : task.status === 'canceled' ? 'Canceled' : isTrashed(task) ? 'In trash' : task.repeat ? 'Repeating Template' : task.workspaceTemplateId ? 'Repeating Project Template item' : task.repeatTemplateId ? 'Occurrence' : 'To-do'}</span><wa-button class="inspector-close-button" size="s" appearance="plain" data-inspector-action="close" data-drawer="close" aria-label="Close details">${icon('x')}</wa-button></div>
    <textarea id="inspector-title" class="inspector-title" data-field="title" rows="1" placeholder="To-do title" ${stoppedTemplate ? 'disabled' : ''}>${esc(task.title)}</textarea>
    ${task.workspaceTemplateId ? `<div class="occurrence-notice">${icon('repeat')}<div><strong>Part of a Repeating Project Template</strong><p>Changes here affect future Project Occurrences only.${stoppedTemplate ? ' This stopped Template is read-only.' : ''}</p></div></div>` : ''}
    ${task.repeatTemplateId ? `<div class="occurrence-notice">${icon('repeat')}<div><strong>Part of a repeating schedule</strong><p>${occurrenceTemplate ? `Created by “${esc(occurrenceTemplate.title)}”` : 'Created by a Repeating Template'} for ${esc(occurrenceDate)}. Editing this to-do changes only this Occurrence.</p>${occurrenceTemplate ? '<button class="checklist-add" type="button" data-inspector-action="open-repeat-template">Open Repeating Template</button>' : ''}</div></div>` : ''}
    ${ui.markdownPreview ? `<div class="markdown-preview">${renderMarkdown(task.notes)}</div>` : `<textarea class="inspector-notes" data-field="notes" placeholder="Notes (Markdown supported)" ${stoppedTemplate ? 'disabled' : ''}>${esc(task.notes)}</textarea>`}
    ${stoppedTemplate ? '' : `<div class="note-tools"><button class="markdown-toggle" data-inspector-action="markdown">${ui.markdownPreview ? 'Edit notes' : 'Preview Markdown'}</button><button class="markdown-toggle" data-inspector-action="find-text">Find in notes</button></div>`}
    ${ui.noteFindOpen ? `<div class="note-find-bar"><input type="search" data-note-find-query value="${esc(ui.noteFindQuery)}" placeholder="Find in notes" aria-label="Find in notes"><span data-note-find-count>${noteFindLabel(task)}</span><button class="icon-button" data-inspector-action="find-previous" aria-label="Previous match">↑</button><button class="icon-button" data-inspector-action="find-next" aria-label="Next match">↓</button><button class="icon-button" data-inspector-action="close-find" aria-label="Close find">${icon('x')}</button></div>` : ''}
    ${!repeat ? `<div class="detail-group"><span class="detail-label">When</span><div class="schedule-chips">
      ${[['inbox','Inbox'],['today','Today'],['evening','This evening'],['anytime','Anytime'],['someday','Someday']].map(([value, label]) => `<button class="chip ${schedule === value ? 'active' : ''}" data-schedule="${value}">${label}</button>`).join('')}
    </div><div class="detail-row" style="margin-top:9px"><input class="detail-input" type="date" data-field="scheduledFor" value="${task.scheduledFor || ''}" aria-label="Start date"><button class="checklist-add inline-add" type="button" data-inspector-action="clear-date">Clear</button></div></div>` : ''}
    <div class="detail-group"><span class="detail-label">Checklist</span><div class="checklist">${task.checklist.map((item, index) => `<div class="checklist-item" data-check-id="${item.id}" draggable="${!stoppedTemplate}"><span class="checklist-reorder">${stoppedTemplate ? '' : `<button type="button" data-inspector-action="move-check-up" aria-label="Move checklist item up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-inspector-action="move-check-down" aria-label="Move checklist item down" ${index === task.checklist.length - 1 ? 'disabled' : ''}>↓</button>`}</span><input type="checkbox" data-check-field="done" ${item.done ? 'checked' : ''} ${repeat || task.workspaceTemplateId ? 'disabled' : ''} aria-label="${repeat || task.workspaceTemplateId ? 'Checklist items can be completed on generated copies only' : 'Complete checklist item'}"><input type="text" data-check-field="title" value="${esc(item.title)}" aria-label="Checklist item" ${stoppedTemplate ? 'disabled' : ''}>${stoppedTemplate ? '' : '<button class="checklist-remove" data-inspector-action="remove-check" aria-label="Remove checklist item">×</button>'}</div>`).join('')}</div>${repeat || task.workspaceTemplateId ? '<p class="detail-help">Complete checklist items on each generated copy. This Template controls future copies.</p>' : ''}${stoppedTemplate ? '' : '<button class="checklist-add" data-inspector-action="add-check">+ Add item</button>'}</div>
    <div class="detail-group"><label class="detail-label" for="task-space">Space</label><select id="task-space" class="detail-select" data-field="spaceId" ${stoppedTemplate || task.workspaceTemplateId ? 'disabled' : ''}>${spaceOptions}</select><p class="detail-help">${task.workspaceTemplateId ? 'This item belongs to its Repeating Project Template.' : 'Choosing a different Space removes this to-do from its current project or area.'}</p></div>
    <div class="detail-group"><label class="detail-label" for="task-project">Project</label><select id="task-project" class="detail-select" data-field="projectId" ${stoppedTemplate || task.workspaceTemplateId ? 'disabled' : ''}>${projectOptions}</select></div>
    ${task.projectId || task.areaId ? `<div class="detail-group"><label class="detail-label" for="task-heading">Heading</label><select id="task-heading" class="detail-select" data-field="headingId" ${stoppedTemplate ? 'disabled' : ''}>${headingOptions}</select></div>` : ''}
    <div class="detail-group"><label class="detail-label" for="task-reminder">Reminder</label><input id="task-reminder" class="detail-input" type="datetime-local" data-field="reminderAt" value="${task.reminderAt || ''}" ${stoppedTemplate ? 'disabled' : ''}></div>
    <div class="detail-group"><label class="detail-label" for="task-deadline">Deadline</label><input id="task-deadline" class="detail-input" type="date" data-field="deadline" value="${task.deadline || ''}" ${stoppedTemplate ? 'disabled' : ''}></div>
    <div class="detail-group"><span class="detail-label">Tags</span>${stoppedTemplate ? `<p class="detail-help">${task.tags.length ? esc(task.tags.join(', ')) : 'No tags'}</p>` : renderTagPicker(task.tags, 'task')}</div>
    ${!task.repeatTemplateId && !task.workspaceTemplateId ? `<div class="detail-group"><span class="detail-label">Repeat</span>${repeat ? `<div class="repeat-summary"><strong>${esc(repeatLabel(repeat))}</strong><span>Next Occurrence ${esc(scheduleDateLabel(repeat.nextDate))}</span></div>${!repeat.stopped ? '<button class="checklist-add" data-inspector-action="edit-repeat">Edit repeating schedule…</button>' : '<p class="detail-help">This schedule is stopped and kept only as history.</p>'}` : `<button class="checklist-add" data-inspector-action="edit-repeat">Make repeating…</button>`}</div>` : ''}
    <div class="inspector-actions">${task.repeat ? `<button class="button" data-inspector-action="share">Share</button><button class="button" data-inspector-action="copy-link">Copy link</button>${stoppedTemplate ? `<button class="danger-button" data-inspector-action="delete-repeat-template">${icon('trash')} Delete Repeating Template</button>` : ''}` : task.workspaceTemplateId ? `${stoppedTemplate ? '' : `<button class="danger-button" data-inspector-action="remove-template-item">${icon('trash')} Remove from Template</button>`}` : `${!isTrashed(task) ? `<button class="button" data-inspector-action="move">Move…</button><button class="button" data-inspector-action="share">Share</button><button class="button" data-inspector-action="copy-link">Copy link</button><button class="button" data-inspector-action="duplicate">Duplicate</button>${task.status === 'open' && task.repeatTemplateId ? '<button class="button" data-inspector-action="skip-occurrence">Skip Occurrence</button>' : task.status === 'open' ? '<button class="button" data-inspector-action="cancel">Cancel to-do</button>' : ''}` : ''}${isTrashed(task) ? `<button class="button" data-inspector-action="restore">Restore</button><button class="danger-button" data-inspector-action="delete-forever">${icon('trash')} Delete forever</button>` : `<button class="danger-button" data-inspector-action="trash">${icon('trash')} Move to Trash</button>`}`}</div>
  </div>`;
  const nextPane = $('.inspector-scroll', inspector);
  resizeInspectorTitle($('#inspector-title', inspector));
  nextPane?.addEventListener('input', handleInspectorInput);
  nextPane?.addEventListener('change', handleInspectorChange);
  nextPane?.addEventListener('click', handleInspectorClick);
  nextPane?.addEventListener('keydown', handleInspectorKeydown);
  if (nextPane && previousScrollTop) nextPane.scrollTop = previousScrollTop;
  mountChecklistSortable(inspector, (orderedIds) => {
    const activeTask = currentTask();
    if (!activeTask) return;
    reorderChecklist(ui.state, activeTask.id, orderedIds);
    scheduleSave();
    renderInspector(true);
  });
  syncSidebarAccessibility();
}

function renderMarkdown(markdown = '') {
  const safe = esc(markdown);
  const lines = safe.split('\n');
  let listType = null;
  let inCode = false;
  const output = [];
  for (const line of lines) {
    if (/^```/.test(line)) { if (listType) { output.push(`</${listType}>`); listType = null; } output.push(inCode ? '</code></pre>' : '<pre><code>'); inCode = !inCode; continue; }
    if (inCode) { output.push(`${line}\n`); continue; }
    const taskItem = line.match(/^[-*+] \[([ x~])\] (.*)$/i);
    const ordered = line.match(/^\d+\. (.*)$/);
    const bullet = line.match(/^[-*+•] (.*)$/);
    const nextType = taskItem || bullet ? 'ul' : ordered ? 'ol' : null;
    if (nextType) {
      if (listType !== nextType) { if (listType) output.push(`</${listType}>`); output.push(`<${nextType}>`); listType = nextType; }
      if (taskItem) output.push(`<li class="markdown-task ${taskItem[1].toLowerCase() === 'x' ? 'done' : taskItem[1] === '~' ? 'cancelled' : ''}"><span>${taskItem[1].toLowerCase() === 'x' ? '✓' : taskItem[1] === '~' ? '—' : '○'}</span>${inlineMarkdown(taskItem[2])}</li>`);
      else output.push(`<li>${inlineMarkdown((ordered || bullet)[1])}</li>`);
      continue;
    }
    if (listType) { output.push(`</${listType}>`); listType = null; }
    if (/^(?:---+|\*\*\*+)$/.test(line.trim())) output.push('<hr>');
    else if (line.startsWith('> ')) output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
    else if (line.startsWith('### ')) output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) output.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
    else if (line) output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  if (listType) output.push(`</${listType}>`);
  if (inCode) output.push('</code></pre>');
  return output.join('') || '<p>No notes yet.</p>';
}

function inlineMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/::([^:]+)::/g, '<mark>$1</mark>');
}

function currentTask() { return ui.state.tasks.find((item) => item.id === ui.selectedTaskId); }

function noteFindMatches(task) {
  const query = ui.noteFindQuery.trim().toLocaleLowerCase();
  if (!query) return [];
  const text = String(task?.notes || '').toLocaleLowerCase();
  const matches = [];
  let offset = 0;
  while ((offset = text.indexOf(query, offset)) >= 0) {
    matches.push(offset);
    offset += Math.max(1, query.length);
  }
  return matches;
}

function noteFindLabel(task) {
  const matches = noteFindMatches(task);
  return matches.length ? `${Math.min(ui.noteFindIndex + 1, matches.length)} of ${matches.length}` : ui.noteFindQuery ? 'No matches' : '';
}

function updateNoteFind(direction = 0, focusNote = false) {
  const task = currentTask();
  if (!task) return;
  const queryInput = $('[data-note-find-query]', inspector);
  if (queryInput) ui.noteFindQuery = queryInput.value;
  const matches = noteFindMatches(task);
  if (!matches.length) ui.noteFindIndex = 0;
  else if (direction) ui.noteFindIndex = (ui.noteFindIndex + direction + matches.length) % matches.length;
  else ui.noteFindIndex = Math.min(ui.noteFindIndex, matches.length - 1);
  const count = $('[data-note-find-count]', inspector);
  if (count) count.textContent = noteFindLabel(task);
  const notes = $('.inspector-notes', inspector);
  if (notes && matches.length) {
    const start = matches[ui.noteFindIndex];
    notes.setSelectionRange(start, start + ui.noteFindQuery.length);
    if (focusNote) notes.focus();
  }
}

function resizeInspectorTitle(title) {
  if (!title) return;
  title.style.height = '0px';
  const height = Math.min(title.scrollHeight, 132);
  title.style.height = `${height}px`;
  title.style.overflowY = title.scrollHeight > 132 ? 'auto' : 'hidden';
}

function handleInspectorInput(event) {
  const task = currentTask();
  if (!task) return;
  if (event.target.matches('[data-note-find-query]')) {
    ui.noteFindIndex = 0;
    updateNoteFind();
    return;
  }
  const field = event.target.dataset.field;
  if (field === 'title' || field === 'notes') task[field] = event.target.value;
  if (field === 'title') resizeInspectorTitle(event.target);
  const checkRow = event.target.closest('[data-check-id]');
  if (checkRow && event.target.dataset.checkField === 'title') {
    const item = task.checklist.find((check) => check.id === checkRow.dataset.checkId);
    if (item) item.title = event.target.value;
  }
  scheduleSave(false);
  if (field === 'title') {
    const rowTitle = $(`[data-task-id="${task.id}"] .task-title`, content);
    if (rowTitle) rowTitle.textContent = task.title;
  }
}

function handleInspectorChange(event) {
  const task = currentTask();
  if (!task) return;
  if (event.target.dataset.tagChoice === 'task') {
    const picker = event.target.closest('[data-tag-picker]');
    task.tags = selectedPickerTags(picker);
    refreshTagPickerSummary(picker);
    scheduleSave(); renderSidebar(); renderContent();
    return;
  }
  const field = event.target.dataset.field;
  if (['deadline', 'scheduledFor', 'reminderAt'].includes(field)) task[field] = event.target.value || null;
  if (field === 'scheduledFor') {
    moveReminderToDate(task, event.target.value || null);
    task.bucket = event.target.value ? (event.target.value <= localDay() ? 'today' : 'upcoming') : 'anytime';
  }
  if (field === 'reminderAt') {
    task.reminderSentAt = null;
    if (task.reminderAt && !task.repeat) {
      task.scheduledFor = task.reminderAt.slice(0, 10);
      task.bucket = task.scheduledFor <= localDay() ? 'today' : 'upcoming';
      task.evening = false;
    }
    if (task.repeat) task.repeat.reminderTime = task.reminderAt?.slice(11, 16) || '';
  }
  if (field === 'deadline' && task.repeat) task.repeat.deadlineOffset = dayDistance(task.repeat.nextDate, task.deadline);
  if (field === 'projectId') {
    task.projectId = event.target.value || null;
    const project = projectById(task.projectId);
    if (project) { task.areaId = project.areaId || null; task.spaceId = project.spaceId || task.spaceId; }
    if (!project || !ui.state.headings.some((heading) => heading.id === task.headingId && heading.projectId === project.id)) task.headingId = null;
  }
  if (field === 'spaceId') {
    task.spaceId = event.target.value || task.spaceId;
    if (projectById(task.projectId)?.spaceId !== task.spaceId) { task.projectId = null; task.areaId = null; task.headingId = null; }
    else if (areaById(task.areaId)?.spaceId !== task.spaceId) { task.areaId = null; task.headingId = null; }
  }
  if (field === 'headingId') task.headingId = event.target.value || null;
  const repeatField = event.target.dataset.repeatField;
  if (repeatField && task.repeat) {
    if (repeatField === 'paused') task.repeat.paused = event.target.checked;
    else if (repeatField === 'interval') task.repeat.interval = Math.max(1, Number(event.target.value) || 1);
    else task.repeat[repeatField] = event.target.value;
    if (repeatField === 'frequency' && event.target.value !== 'weekly') task.repeat.weekdays = [];
    if (repeatField === 'nextDate') {
      task.scheduledFor = event.target.value;
      task.bucket = event.target.value <= localDay() ? 'today' : 'upcoming';
      moveReminderToDate(task, event.target.value);
      if (Number.isFinite(task.repeat.deadlineOffset)) task.deadline = addDays(event.target.value, task.repeat.deadlineOffset);
    }
  }
  const checkRow = event.target.closest('[data-check-id]');
  if (checkRow && event.target.dataset.checkField === 'done') {
    const item = task.checklist.find((check) => check.id === checkRow.dataset.checkId);
    if (item) item.done = event.target.checked;
  }
  scheduleSave();
  const scheduledForInput = $('[data-field="scheduledFor"]', inspector);
  const reminderAtInput = $('[data-field="reminderAt"]', inspector);
  const deadlineInput = $('[data-field="deadline"]', inspector);
  if (scheduledForInput) scheduledForInput.value = task.scheduledFor || '';
  if (reminderAtInput) reminderAtInput.value = task.reminderAt || '';
  if (deadlineInput) deadlineInput.value = task.deadline || '';
  renderSidebar();
  renderContent();
  if (field === 'projectId' || field === 'spaceId' || repeatField === 'frequency') renderInspector(true);
}

function handleInspectorClick(event) {
  const task = currentTask();
  if (!task) return;
  const occurrenceTemplate = task.repeatTemplateId ? ui.state.tasks.find((item) => item.id === task.repeatTemplateId) : null;
  const closestTarget = (selector) => {
    const direct = event.target.closest?.(selector);
    if (direct) return direct;
    return event.composedPath?.().find((item) => item instanceof Element && item.matches(selector)) || null;
  };
  const createTag = closestTarget('[data-create-tag="task"]');
  if (createTag) {
    const picker = createTagInPicker(createTag);
    task.tags = selectedPickerTags(picker);
    scheduleSave(); renderSidebar(); renderContent();
    return;
  }
  const schedule = closestTarget('[data-schedule]')?.dataset.schedule;
  if (schedule) {
    const nextDate = ['today', 'evening'].includes(schedule) ? localDay() : null;
    moveReminderToDate(task, nextDate);
    task.evening = schedule === 'evening';
    task.bucket = ['today', 'evening'].includes(schedule) ? 'today' : schedule;
    task.scheduledFor = nextDate;
    scheduleSave(); render(true); return;
  }
  const action = closestTarget('[data-inspector-action]')?.dataset.inspectorAction;
  if (action === 'close') closeInspector();
  if (action === 'open-repeat-template' && occurrenceTemplate) { selectTask(occurrenceTemplate.id); return; }
  if (action === 'trash') {
    if (task.repeatTemplateId) {
      const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
      if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
    }
    task.previousStatus = task.status; task.status = 'trashed'; task.loggedAt = null; task.trashedAt = new Date().toISOString(); scheduleSave(); closeInspector(); showToast('Moved to Trash');
  }
  if (action === 'cancel') {
    task.status = 'canceled'; task.completedAt = new Date().toISOString(); task.loggedAt = null; task.completedWithProjectId = null;
    applyLogbookPolicy(); scheduleSave(); closeInspector(); render(); showToast('To-do canceled', 'Undo', () => {
      task.status = 'open'; task.completedAt = null; task.loggedAt = null; scheduleSave(); render();
    });
  }
  if (action === 'skip-occurrence') {
    const template = ui.state.tasks.find((item) => item.id === task.repeatTemplateId);
    task.status = 'canceled'; task.completedAt = new Date().toISOString(); task.loggedAt = task.completedAt; task.completedWithProjectId = null;
    if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
    materializeRecurringTasks(); scheduleSave(); closeInspector(); render(); showToast('Occurrence skipped');
  }
  if (action === 'delete-repeat-template') {
    confirmAction('Delete this Repeating Template forever?', 'Its existing Occurrences remain in your history. This cannot be undone.', 'Delete forever', () => {
      ui.state.tasks = ui.state.tasks.filter((item) => item.id !== task.id);
      scheduleSave(); closeInspector(); render(); showToast('Repeating Template deleted');
    });
  }
  if (action === 'remove-template-item' && task.workspaceTemplateId) {
    confirmAction('Remove this item from the Repeating Project Template?', 'Existing Project Occurrences keep their own copy. Future Occurrences will not include it.', 'Remove item', () => {
      ui.state.tasks = ui.state.tasks.filter((item) => item.id !== task.id);
      scheduleSave(); closeInspector(); render(); showToast('Item removed from Repeating Project Template');
    });
  }
  if (action === 'restore') {
    const restoredProject = restoreTrashedTask(task);
    scheduleSave(); closeInspector(); showToast(restoredProject ? 'Project restored' : 'To-do restored');
  }
  if (action === 'delete-forever') {
    confirmAction('Delete this to-do forever?', 'This cannot be undone.', 'Delete forever', () => {
      ui.state.tasks = ui.state.tasks.filter((item) => item.id !== task.id); scheduleSave(); closeInspector(); showToast('To-do permanently deleted');
    });
  }
  if (action === 'duplicate') {
    const copy = { ...task, id: uid('task'), title: `${task.title} copy`, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, createdAt: new Date().toISOString(), order: Date.now(), checklist: task.checklist.map((item) => ({ ...item, id: uid('check') })), repeat: task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : null };
    ui.state.tasks.push(copy); ui.selectedTaskId = copy.id; scheduleSave(); render(); showToast('To-do duplicated');
  }
  if (action === 'move') { openMoveTaskModal(task); return; }
  if (action === 'share') { void shareTask(task); return; }
  if (action === 'copy-link') { void copyTaskLink(task); return; }
  if (action === 'markdown') { ui.markdownPreview = !ui.markdownPreview; renderInspector(true); }
  if (action === 'find-text') {
    ui.noteFindOpen = true;
    ui.markdownPreview = false;
    renderInspector(true);
    setTimeout(() => $('[data-note-find-query]', inspector)?.focus(), 20);
  }
  if (action === 'find-previous') updateNoteFind(-1, true);
  if (action === 'find-next') updateNoteFind(1, true);
  if (action === 'close-find') { ui.noteFindOpen = false; ui.noteFindQuery = ''; ui.noteFindIndex = 0; renderInspector(true); }
  if (action === 'edit-repeat') { openRepeatingTemplateEditor(task); return; }
  if (action === 'start-repeat') { openRepeatingTemplateEditor(task); return; }
  if (action === 'stop-repeat') { task.repeat = null; scheduleSave(); render(true); }
  if (action === 'add-check') { task.checklist.push({ id: uid('check'), title: '', done: false }); scheduleSave(); renderInspector(true); $$('.checklist-item input[type="text"]', inspector).at(-1)?.focus(); }
  if (action === 'move-check-up' || action === 'move-check-down') {
    const id = closestTarget('[data-check-id]')?.dataset.checkId;
    const from = task.checklist.findIndex((item) => item.id === id);
    const to = from + (action === 'move-check-up' ? -1 : 1);
    if (from >= 0 && to >= 0 && to < task.checklist.length) {
      const [moved] = task.checklist.splice(from, 1); task.checklist.splice(to, 0, moved);
      scheduleSave(); renderInspector(true); renderContent();
      setTimeout(() => $(`[data-check-id="${id}"] [data-inspector-action="${action}"]`, inspector)?.focus(), 20);
    }
  }
  if (action === 'remove-check') { const id = closestTarget('[data-check-id]')?.dataset.checkId; task.checklist = task.checklist.filter((item) => item.id !== id); scheduleSave(); renderInspector(true); renderContent(); }
  if (action === 'clear-date') { moveReminderToDate(task, null); task.bucket = 'anytime'; task.scheduledFor = null; task.evening = false; scheduleSave(); render(true); }
  const weekday = closestTarget('[data-weekday]');
  if (weekday && task.repeat) {
    const day = Number(weekday.dataset.weekday);
    task.repeat.weekdays ||= [];
    task.repeat.weekdays = task.repeat.weekdays.includes(day) ? task.repeat.weekdays.filter((item) => item !== day) : [...task.repeat.weekdays, day].sort();
    scheduleSave(); renderInspector(true);
  }
}

function openRepeatingTemplateEditor(task) {
  const nextDate = task.repeat?.nextDate || task.scheduledFor || addDays(localDay(), 7);
  const nextWeekday = new Date(`${nextDate}T12:00:00`).getDay();
  const initial = task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : { mode: 'fixed', frequency: 'weekly', interval: 1, weekdays: [Number.isNaN(nextWeekday) ? 1 : nextWeekday], nextDate, reminderTime: task.reminderAt?.slice(11, 16) || '', deadlineOffset: dayDistance(nextDate, task.deadline), paused: false };
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(RepeatingTemplateDialog, {
    title: task.title,
    value: initial,
    fallbackDate: nextDate,
    onClose: closeModal,
    onSave: (repeat) => {
      const savedRepeat = { ...repeat, weekdays: [...(repeat.weekdays || [])], stopped: false };
      if (task.repeat) task.repeat = savedRepeat;
      else {
        const templateId = uid('repeat');
        const template = {
          ...cloneData(task), id: templateId, repeat: savedRepeat, repeatTemplateId: null, workspaceTemplate: true,
          status: 'open', previousStatus: null, scheduledFor: repeat.nextDate, bucket: 'upcoming', completedAt: null, loggedAt: null, trashedAt: null,
          checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), order: Number.MAX_SAFE_INTEGER,
        };
        task.repeatTemplateId = templateId;
        ui.state.tasks.push(template);
      }
      task.scheduledFor = repeat.nextDate;
      task.bucket = repeat.nextDate <= localDay() ? 'today' : 'upcoming';
      moveReminderToDate(task, repeat.nextDate);
      if (Number.isFinite(repeat.deadlineOffset)) task.deadline = addDays(repeat.nextDate, repeat.deadlineOffset);
      scheduleSave(); closeModal(); render(true); showToast(savedRepeat.paused ? 'Repeating schedule paused' : 'Repeating schedule saved');
    },
    onStop: () => {
      task.repeat = { ...task.repeat, paused: true, stopped: true };
      scheduleSave(); closeModal(); render(true); showToast('Repeating schedule stopped');
    },
  }), $('#modal-root'));
}

function openRepeatingProjectEditor(project) {
  if (!project?.repeat) return;
  const nextDate = project.repeat.nextDate || project.scheduledFor || addDays(localDay(), 7);
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(RepeatingTemplateDialog, {
    title: project.title,
    value: { ...project.repeat, weekdays: [...(project.repeat.weekdays || [])] },
    fallbackDate: nextDate,
    stopped: Boolean(project.repeat.stopped),
    onClose: closeModal,
    onOpenContents: () => { closeModal(); setView('project', project.id); },
    onSave: (repeat) => {
      project.repeat = { ...repeat, weekdays: [...(repeat.weekdays || [])], stopped: false };
      project.scheduledFor = repeat.nextDate;
      project.bucket = repeat.nextDate <= localDay() ? 'today' : 'upcoming';
      if (Number.isFinite(repeat.deadlineOffset)) project.deadline = addDays(repeat.nextDate, repeat.deadlineOffset);
      scheduleSave(); closeModal(); render(true); showToast(repeat.paused ? 'Repeating Project paused' : 'Repeating Project schedule saved');
    },
    onStop: () => {
      project.repeat = { ...project.repeat, paused: true, stopped: true };
      scheduleSave(); closeModal(); render(true); showToast('Repeating Project stopped');
    },
    onDelete: () => {
      closeModal();
      confirmAction('Delete this Repeating Project Template forever?', 'Existing Project Occurrences remain in history. This cannot be undone.', 'Delete forever', () => {
        ui.state.projects = ui.state.projects.filter((item) => item.id !== project.id);
        ui.state.headings = ui.state.headings.filter((item) => item.workspaceTemplateId !== project.id);
        ui.state.tasks = ui.state.tasks.filter((item) => item.workspaceTemplateId !== project.id);
        scheduleSave(); setView('repeating'); showToast('Repeating Project Template deleted');
      });
    },
  }), $('#modal-root'));
}

function handleInspectorKeydown(event) {
  const input = event.target.closest('[data-new-tag="task"]');
  if (!input || event.key !== 'Enter') return;
  event.preventDefault();
  const task = currentTask();
  if (!task) return;
  const picker = createTagInPicker($('[data-create-tag="task"]', input.closest('[data-tag-picker]')));
  task.tags = selectedPickerTags(picker);
  scheduleSave(); renderSidebar(); renderContent();
}

function taskAsText(task) {
  const lines = [task.title];
  if (task.notes) lines.push('', task.notes);
  if (task.checklist?.length) lines.push('', ...task.checklist.map((item) => `${item.done ? '✓' : '○'} ${item.title}`));
  if (task.deadline) lines.push('', `Deadline: ${task.deadline}`);
  if (effectiveTags(task).length) lines.push(`Tags: ${effectiveTags(task).join(', ')}`);
  return lines.join('\n');
}

async function copyTaskLink(task) {
  const url = new URL(location.href); url.search = ''; url.searchParams.set('task', task.id);
  try { await navigator.clipboard.writeText(url.href); showToast('Link copied'); }
  catch { showToast('Could not copy link'); }
}

async function shareTask(task) {
  const url = new URL(location.href); url.search = ''; url.searchParams.set('task', task.id);
  const data = { title: task.title, text: taskAsText(task), url: url.href };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(`${data.text}\n\n${data.url}`); showToast('To-do copied for sharing'); }
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('Could not share this to-do');
  }
}

function openMoveTaskModal(taskOrTasks) {
  const tasks = (Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks]).filter(Boolean);
  if (!tasks.length) return;
  const task = tasks[0];
  const single = tasks.length === 1;
  const destinations = [
    { value: 'inbox', label: 'Inbox' },
    { value: 'anytime', label: 'No area or project (Anytime)' },
    ...ui.state.areas.flatMap((area) => [
      { value: `area:${area.id}`, label: `${spaceLabel(area.spaceId)} › ${area.title} (Area)` },
      ...ui.state.headings.filter((heading) => heading.areaId === area.id && !heading.projectId && !heading.archived).map((heading) => ({ value: `heading:${heading.id}`, label: `${spaceLabel(area.spaceId)} › ${area.title} › ${heading.title}` }))
    ]),
    ...ui.state.projects.filter((project) => project.status === 'open' && !project.repeat).flatMap((project) => [
      { value: `project:${project.id}`, label: `${spaceLabel(project.spaceId)} › ${project.title} (Project)` },
      ...ui.state.headings.filter((heading) => heading.projectId === project.id && !heading.archived).map((heading) => ({ value: `heading:${heading.id}`, label: `${spaceLabel(project.spaceId)} › ${project.title} › ${heading.title}` }))
    ])
  ];
  const initialValue = single && task.headingId ? `heading:${task.headingId}` : single && task.projectId ? `project:${task.projectId}` : single && task.areaId ? `area:${task.areaId}` : task.bucket === 'inbox' ? 'inbox' : 'anytime';
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(MoveTasksDialog, {
    count: tasks.length,
    options: destinations,
    initialValue,
    onClose: closeModal,
    onSubmit: (value, newTitle) => {
    let destinationProject = null;
    if (newTitle) {
      const selectedAreaId = value.startsWith('area:') ? value.slice(5) : null;
      destinationProject = { id: uid('project'), areaId: selectedAreaId, spaceId: areaById(selectedAreaId)?.spaceId || itemSpaceId(task) || currentCreationSpaceId(), title: newTitle, notes: '', bucket: 'anytime', scheduledFor: null, deadline: null, tags: [], repeat: null, status: 'open', completedAt: null, loggedAt: null, order: ui.state.projects.length };
      ui.state.projects.push(destinationProject);
    }
    tasks.forEach((item) => {
      item.projectId = null; item.headingId = null; item.areaId = null;
      if (destinationProject) { item.projectId = destinationProject.id; item.areaId = destinationProject.areaId; item.spaceId = destinationProject.spaceId; }
      else if (value === 'inbox') { item.bucket = 'inbox'; item.scheduledFor = null; item.evening = false; moveReminderToDate(item, null); }
      else if (value === 'anytime') { if (item.bucket === 'inbox') item.bucket = 'anytime'; }
      else if (value.startsWith('area:')) { const area = areaById(value.slice(5)); item.areaId = area.id; item.spaceId = area.spaceId || item.spaceId; if (item.bucket === 'inbox') item.bucket = 'anytime'; }
      else if (value.startsWith('project:')) { const project = projectById(value.slice(8)); item.projectId = project.id; item.areaId = project.areaId || null; item.spaceId = project.spaceId || item.spaceId; if (item.bucket === 'inbox') item.bucket = 'anytime'; }
      else if (value.startsWith('heading:')) { const heading = ui.state.headings.find((candidate) => candidate.id === value.slice(8)); const project = projectById(heading.projectId); const area = areaById(heading.areaId); item.headingId = heading.id; item.projectId = project?.id || null; item.areaId = project?.areaId || heading.areaId || null; item.spaceId = project?.spaceId || area?.spaceId || item.spaceId; if (item.bucket === 'inbox') item.bucket = 'anytime'; }
    });
    scheduleSave(); closeModal(); clearTaskSelection(); render(true); showToast(newTitle ? `Moved to new project “${newTitle}”` : `${tasks.length === 1 ? 'To-do' : `${tasks.length} to-dos`} moved`);
    }
  }), $('#modal-root'));
}

function openSearch(initialQuery = '') {
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  try {
    renderPreact(h(QuickFind, {
      initialQuery,
      find: searchItems,
      iconHtml: icon,
      onChoose: chooseSearchResult,
      onClose: closeModal,
    }), $('#modal-root'));
  } catch (error) {
    modalUsesPreact = false;
    console.error('Quick Find failed to open', error);
    showToast('Quick Find could not open');
  }
}

function searchItems(query, searchEverything = false) {
  const q = query.toLowerCase().trim();
  const lists = [
    ['today','Today','star'], ['inbox','Inbox','inbox'], ['upcoming','Upcoming','calendar'], ['anytime','Anytime','layers'], ['someday','Someday','archive'], ['logbook','Logbook','check'], ['trash','Trash','trash']
  ].map(([type,title,iconName]) => ({ kind:'view', type, title, meta:'', icon:iconName }));
  const special = [
    ['tomorrow','Tomorrow','calendar'], ['deadlines','Deadlines','flag'], ['repeating','Repeating','repeat'], ['allProjects','All Projects','list'], ['loggedProjects','Logged Projects','check']
  ].map(([type,title,iconName]) => ({ kind:'view', type, title, meta:'Special list', icon:iconName }));
  const spaces = ui.state.spaces.map((space) => ({ kind:'space', id:space.id, title:space.title, meta:'Space', icon:'layers' }));
  const areas = ui.state.areas.map((area) => ({ kind:'view', type:'area', id:area.id, title:area.title, meta:`${spaceLabel(area.spaceId)} · Area`, icon:'circle' }));
  const projects = ui.state.projects.filter((p) => !p.workspaceTemplate && !p.repeat && (p.status === 'open' || isCompletedButVisible(p))).map((p) => ({ kind:'view', type:'project', id:p.id, title:p.title, meta:`${spaceLabel(p.spaceId)} · ${areaById(p.areaId)?.title || 'Project'}`, icon:'list' }));
  const repeatingProjects = ui.state.projects.filter((p) => p.workspaceTemplate || p.repeat).map((p) => ({ kind:'view', type:'repeating', id:p.id, title:p.title, meta:'Repeating Project Template', icon:'repeat' }));
  const headings = ui.state.headings.filter((h) => !h.archived && !h.workspaceTemplateId).map((heading) => { const parent = projectById(heading.projectId) || areaById(heading.areaId); return { kind:'heading', id:heading.id, projectId:heading.projectId, areaId:heading.areaId, title:heading.title, meta:`${spaceLabel(parent?.spaceId)} · ${parent?.title || 'Heading'}`, icon:'heading' }; });
  const tags = [...new Set([...ui.state.tasks.flatMap((task) => effectiveTags(task)), ...ui.state.projects.flatMap((project) => effectiveProjectTags(project)), ...ui.state.areas.flatMap((area) => area.tags || [])])].map((tag) => ({ kind:'view', type:'tag', id:tag, title:tag, meta:'Tag', icon:'tag' }));
  const taskSource = searchEverything ? ui.state.tasks : ui.state.tasks.filter((task) => task.status === 'open' || isCompletedButVisible(task));
  const tasks = taskSource.map((task) => ({ kind:'task', id:task.id, title:task.title, meta:`${spaceLabel(itemSpaceId(task))} · ${task.repeat ? 'Repeating template' : isLogged(task) ? 'Logbook' : projectById(task.projectId)?.title || areaById(task.areaId)?.title || 'To-do'}`, icon:task.repeat ? 'repeat' : 'circle', searchText: searchEverything ? `${task.title} ${task.notes || ''} ${effectiveTags(task).join(' ')} ${(task.checklist || []).map((i) => i.title).join(' ')}` : `${task.title} ${effectiveTags(task).join(' ')}` }));
  const actions = [{ kind:'settings', title:'Settings', meta:'App preferences', icon:'settings' }, { kind:'space-settings', title:'Spaces & Schedule', meta:'Launch-time focus', icon:'clock' }];
  const queryTokens = q.split(/\s+/).filter(Boolean);
  const matches = [...lists, ...special, ...actions, ...spaces, ...areas, ...projects, ...repeatingProjects, ...headings, ...tags, ...tasks].filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.searchText || ''}`.toLowerCase();
    return !q || queryTokens.every((token) => haystack.includes(token));
  }).slice(0, 24);
  if (q && !searchEverything) matches.push({ kind:'continue', title:'Continue Search', meta:'Include notes, checklists, Logbook, and Trash', icon:'search' });
  return matches;
}

function chooseSearchResult(item) {
  closeModal();
  if (item.kind === 'settings') openSettings();
  else if (item.kind === 'space-settings') openSpaceSettings();
  else if (item.kind === 'space') setActiveSpace(item.id);
  else if (item.kind === 'view') setView(item.type, item.id || null);
  else if (item.kind === 'heading') setView(item.projectId ? 'project' : 'area', item.projectId || item.areaId);
  else {
    const task = ui.state.tasks.find((t) => t.id === item.id);
    if (!task) return;
    if (task.repeat) setView('repeating');
    else if (isLogged(task)) setView('logbook');
    else if (isTrashed(task)) setView('trash');
    else if (task.projectId) setView('project', task.projectId);
    else if (task.areaId) setView('area', task.areaId);
    else setView(task.bucket === 'upcoming' ? 'upcoming' : task.bucket);
    selectTask(task.id);
  }
}

function openNewListModal(defaults = {}) {
  const initialSpaceId = areaById(defaults.areaId)?.spaceId || defaults.spaceId || currentCreationSpaceId();
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(NewListDialog, {
    spaces: ui.state.spaces,
    areas: ui.state.areas,
    defaults: { type: defaults.type === 'area' ? 'area' : 'project', spaceId: initialSpaceId, areaId: defaults.areaId || null, title: defaults.title || '' },
    onClose: closeModal,
    onSubmit: ({ type, spaceId: requestedSpaceId, areaId, title }) => {
    const spaceId = requestedSpaceId || currentCreationSpaceId();
    if (type === 'area') {
      const area = { id: uid('area'), spaceId, title, color: spaceById(spaceId)?.color || ['#5b7cfa','#e49b3c','#5ba67a','#b06bd3'][ui.state.areas.length % 4], tags: [], order: ui.state.areas.length };
      ui.state.areas.push(area); closeModal(); setView('area', area.id);
    } else {
      const project = { id: uid('project'), spaceId: areaById(areaId)?.spaceId || spaceId, areaId, title, notes: '', bucket: 'anytime', scheduledFor: null, deadline: null, tags: [], repeat: null, status: 'open', completedAt: null, loggedAt: null, order: ui.state.projects.length };
      ui.state.projects.push(project); closeModal(); setView('project', project.id);
    }
    scheduleSave();
    }
  }), $('#modal-root'));
}

function openHeadingModal(headingId = null) {
  const heading = ui.state.headings.find((item) => item.id === headingId);
  const templateProject = projectById(heading?.workspaceTemplateId || (ui.view.type === 'project' ? ui.view.id : null));
  const defaultParent = heading?.projectId ? `project:${heading.projectId}` : heading?.areaId ? `area:${heading.areaId}` : `${ui.view.type}:${ui.view.id}`;
  const normalParentOptions = [
    ...ui.state.areas.map((area) => ({ value: `area:${area.id}`, label: `${spaceLabel(area.spaceId)} › ${area.title} (Area)` })),
    ...ui.state.projects.filter((project) => project.status === 'open' && !project.repeat).map((project) => ({ value: `project:${project.id}`, label: `${spaceLabel(project.spaceId)} › ${project.title} (Project)` }))
  ];
  const parentOptions = templateProject?.repeat
    ? [{ value: `project:${templateProject.id}`, label: `${spaceLabel(templateProject.spaceId)} › ${templateProject.title} (Repeating Template)` }]
    : normalParentOptions;
  const initialParent = parentOptions.some((option) => option.value === defaultParent) ? defaultParent : parentOptions[0]?.value || '';
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(HeadingDialog, {
    heading: heading || null,
    isTemplate: Boolean(templateProject?.repeat),
    parents: parentOptions,
    initialParent,
    onClose: closeModal,
    onSave: (title, parent) => {
      const [parentType, parentId] = parent.split(':');
      if (heading) {
        heading.title = title;
        if (parentId !== (heading.projectId || heading.areaId)) {
          heading.projectId = parentType === 'project' ? parentId : null;
          heading.areaId = parentType === 'area' ? parentId : null;
          const destination = parentType === 'project' ? projectById(parentId) : null;
          const destinationArea = parentType === 'area' ? areaById(parentId) : null;
          ui.state.tasks.filter((task) => task.headingId === heading.id).forEach((task) => {
            task.projectId = destination?.id || null;
            task.areaId = destination?.areaId || (parentType === 'area' ? parentId : null);
            task.spaceId = destination?.spaceId || destinationArea?.spaceId || task.spaceId;
          });
        }
      } else ui.state.headings.push({ id: uid('heading'), projectId: parentType === 'project' ? parentId : null, areaId: parentType === 'area' ? parentId : null, title, archived: false, order: headingsFor(parentType, parentId, true).length, ...(templateProject?.repeat ? { workspaceTemplateId: templateProject.id, workspaceBlueprintKey: uid('repeat-heading-blueprint') } : {}) });
      scheduleSave(); closeModal(); render();
    },
    onAction: (action) => {
      if (!heading) return;
      if (action === 'delete') { closeModal(); deleteHeading(heading.id); return; }
      if (action === 'archive') {
      const unfinished = ui.state.tasks.filter((task) => task.headingId === heading.id && task.status === 'open' && !task.repeat);
      if (unfinished.length) {
        showToast(`Complete or move ${unfinished.length} unfinished to-do${unfinished.length === 1 ? '' : 's'} first`);
        return;
      }
      heading.archived = true;
      showToast('Heading archived');
      } else if (action === 'convert') {
      const sourceProject = projectById(heading.projectId);
      const projectAreaId = sourceProject?.areaId || heading.areaId || null;
      const project = { id: uid('project'), spaceId: sourceProject?.spaceId || areaById(projectAreaId)?.spaceId || currentCreationSpaceId(), areaId: projectAreaId, title: heading.title, notes: '', bucket: 'anytime', scheduledFor: null, deadline: null, tags: [], repeat: null, status: 'open', completedAt: null, loggedAt: null, order: ui.state.projects.length };
      ui.state.projects.push(project);
      ui.state.tasks.filter((task) => task.headingId === heading.id).forEach((task) => { task.projectId = project.id; task.headingId = null; task.areaId = project.areaId; task.spaceId = project.spaceId; });
      ui.state.headings = ui.state.headings.filter((item) => item.id !== heading.id);
      scheduleSave(); closeModal(); setView('project', project.id); showToast('Heading converted to project'); return;
      } else {
      const copy = { ...heading, id: uid('heading'), title: `${heading.title} copy`, order: heading.order + 0.5 };
      ui.state.headings.push(copy);
      ui.state.tasks.filter((task) => task.headingId === heading.id && task.status === 'open').forEach((task) => ui.state.tasks.push({ ...task, id: uid('task'), headingId: copy.id, tags: [...(task.tags || [])], repeat: task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : null, checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() }));
      showToast('Heading duplicated');
      }
      scheduleSave(); closeModal(); render();
    }
  }), $('#modal-root'));
}

function deleteHeading(headingId) {
  const heading = ui.state.headings.find((item) => item.id === headingId);
  if (!heading) return;
  const taskCount = ui.state.tasks.filter((task) => task.headingId === heading.id).length;
  confirmAction(`Delete “${heading.title}”?`, `${taskCount ? `${taskCount} to-do${taskCount === 1 ? '' : 's'} will remain in the parent list without a heading. ` : ''}The heading itself will be permanently deleted.`, 'Delete heading', () => {
    ui.state.tasks.filter((task) => task.headingId === heading.id).forEach((task) => { task.headingId = null; });
    ui.state.headings = ui.state.headings.filter((item) => item.id !== heading.id);
    scheduleSave(); render(); showToast('Heading deleted');
  });
}

function moveProjectToTrash(projectId) {
  const project = projectById(projectId);
  if (!project || isTrashed(project)) return;
  confirmAction(`Move “${project.title}” to Trash?`, 'The list and all to-dos inside it can be restored from Trash.', 'Move to Trash', () => {
    if (project.repeatTemplateId) {
      const template = projectById(project.repeatTemplateId);
      if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
    }
    project.previousStatus = project.status; project.status = 'trashed'; project.trashedAt = new Date().toISOString(); project.loggedAt = null;
    ui.state.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.previousStatus = task.status; task.status = 'trashed'; task.trashedAt = project.trashedAt; task.loggedAt = null; });
    scheduleSave(); setView('trash'); showToast('List moved to Trash');
  });
}

function openProjectModalPreact(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  if (project.repeat) { openRepeatingProjectEditor(project); return; }
  const archivedHeadings = ui.state.headings.filter((heading) => heading.projectId === project.id && heading.archived);
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(ProjectDialog, {
    project,
    spaces: ui.state.spaces,
    areas: ui.state.areas,
    archivedHeadings,
    fallbackRepeatDate: project.scheduledFor || addDays(localDay(), 7),
    onClose: closeModal,
    onSave: (draft) => {
      project.title = draft.title || project.title;
      project.notes = draft.notes || '';
      project.areaId = draft.areaId || null;
      project.spaceId = areaById(project.areaId)?.spaceId || draft.spaceId || project.spaceId;
      project.bucket = draft.bucket;
      project.scheduledFor = draft.scheduledFor || null;
      if (project.bucket === 'today') project.scheduledFor = localDay();
      if (['anytime', 'someday'].includes(project.bucket)) project.scheduledFor = null;
      if (project.bucket === 'upcoming' && !project.scheduledFor) project.scheduledFor = addDays(localDay(), 1);
      project.deadline = draft.deadline || null;
      project.tags = cleanTagList(draft.tags || []);
      const savedRepeat = draft.repeat ? { ...draft.repeat, weekdays: [...(draft.repeat.weekdays || [])], deadlineOffset: dayDistance(draft.repeat.nextDate, project.deadline), stopped: false } : null;
      if (!project.repeat && savedRepeat) {
        const templateId = uid('repeat-project');
        const template = { ...cloneData(project), id: templateId, repeat: savedRepeat, repeatTemplateId: null, workspaceTemplate: true, status: 'open', previousStatus: null, completedAt: null, loggedAt: null, trashedAt: null, order: Number.MAX_SAFE_INTEGER };
        ui.state.projects.push(template);
        const headingMap = new Map();
        ui.state.headings.filter((heading) => heading.projectId === project.id && !heading.workspaceTemplateId).forEach((heading) => {
          const templateHeading = { ...cloneData(heading), id: uid('repeat-heading'), projectId: templateId, workspaceTemplateId: templateId, workspaceBlueprintKey: heading.id };
          headingMap.set(heading.id, templateHeading.id);
          ui.state.headings.push(templateHeading);
        });
        ui.state.tasks.filter((task) => task.projectId === project.id && !task.workspaceTemplateId).forEach((task) => {
          ui.state.tasks.push({
            ...cloneData(task), id: uid('repeat-task'), projectId: templateId, headingId: task.headingId ? headingMap.get(task.headingId) || null : null,
            workspaceTemplate: true, workspaceTemplateId: templateId, workspaceBlueprintKey: task.id, repeat: null, repeatTemplateId: null,
            status: 'open', previousStatus: null, completedAt: null, loggedAt: null, trashedAt: null,
            checklist: task.checklist.map((item) => ({ ...item, id: uid('repeat-check'), done: false })),
          });
        });
        project.repeatTemplateId = templateId;
        project.repeat = null;
      } else if (project.repeat && !savedRepeat) project.repeat = { ...project.repeat, paused: true, stopped: true };
      else project.repeat = savedRepeat;
      if (project.repeatTemplateId && savedRepeat) {
        project.scheduledFor = savedRepeat.nextDate;
        project.bucket = savedRepeat.nextDate <= localDay() ? 'today' : 'upcoming';
      }
      ui.state.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.areaId = project.areaId; task.spaceId = project.spaceId; });
      scheduleSave(); closeModal(); render();
    },
    onRestoreHeading: (headingId) => {
      const heading = ui.state.headings.find((item) => item.id === headingId);
      if (heading) heading.archived = false;
      scheduleSave(); closeModal(); render(); showToast('Heading restored');
    },
    onAction: (action) => {
      if (action === 'trash') { closeModal(); moveProjectToTrash(project.id); return; }
      if (action === 'restore-trash') {
        project.status = project.previousStatus || 'open'; project.previousStatus = null; project.trashedAt = null;
        ui.state.tasks.filter((task) => task.projectId === project.id && isTrashed(task)).forEach((task) => { task.status = task.previousStatus || 'open'; task.previousStatus = null; task.trashedAt = null; });
        applyLogbookPolicy(); scheduleSave(); closeModal(); setView(isLogged(project) ? 'logbook' : 'project', isLogged(project) ? null : project.id); showToast('Project restored'); return;
      }
      if (action === 'delete-forever') {
        closeModal();
        confirmAction('Delete this project forever?', 'The project, its headings, and every to-do inside it will be permanently deleted.', 'Delete forever', () => {
          ui.state.projects = ui.state.projects.filter((item) => item.id !== project.id);
          ui.state.headings = ui.state.headings.filter((item) => item.projectId !== project.id);
          ui.state.tasks = ui.state.tasks.filter((task) => task.projectId !== project.id);
          scheduleSave(); setView('trash'); showToast('Project permanently deleted');
        });
        return;
      }
      if (action === 'complete') { closeModal(); resolveProjectCompletion(project); return; }
      if (action === 'skip') {
        const skippedAt = new Date().toISOString();
        project.status = 'canceled'; project.completedAt = skippedAt; project.loggedAt = skippedAt;
        ui.state.tasks.filter((task) => task.projectId === project.id && task.status === 'open' && !task.repeat).forEach((task) => {
          task.status = 'canceled'; task.completedAt = skippedAt; task.loggedAt = skippedAt; task.completedWithProjectId = project.id;
        });
        const template = projectById(project.repeatTemplateId);
        if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
        scheduleSave(); closeModal(); setView('upcoming'); showToast('Project Occurrence skipped'); return;
      }
      if (action === 'cancel') finishProject(project, 'canceled', 'canceled');
      else if (action === 'restore') {
        project.status = 'open'; project.completedAt = null; project.loggedAt = null;
        ui.state.tasks.filter((task) => task.completedWithProjectId === project.id).forEach((task) => { task.status = 'open'; task.completedAt = null; task.loggedAt = null; task.completedWithProjectId = null; });
        setView('project', project.id); showToast('Project restored');
      } else duplicateProject(project);
      scheduleSave(); closeModal(); render();
    }
  }), $('#modal-root'));
}

function openProjectModal(projectId) {
  return openProjectModalPreact(projectId);
}

function resolveProjectCompletion(project) {
  const remaining = ui.state.tasks.filter((task) => task.projectId === project.id && task.status === 'open' && !task.repeat);
  if (!remaining.length) { finishProject(project, 'completed', 'completed'); return; }
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(FinishProjectDialog, { count: remaining.length, onClose: closeModal, onFinish: (status) => { closeModal(); finishProject(project, 'completed', status); } }), $('#modal-root'));
}

function finishProject(project, projectStatus, remainingStatus) {
  const finishedAt = new Date().toISOString();
  project.status = projectStatus; project.completedAt = finishedAt; project.loggedAt = null;
  ui.state.tasks.filter((task) => task.projectId === project.id && task.status === 'open' && !task.repeat).forEach((task) => {
    task.status = remainingStatus; task.completedAt = finishedAt; task.loggedAt = null; task.completedWithProjectId = project.id;
  });
  if (project.repeatTemplateId) {
    const template = projectById(project.repeatTemplateId);
    if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
  }
  applyLogbookPolicy(); scheduleSave();
  setView(isLogged(project) ? 'loggedProjects' : 'project', isLogged(project) ? null : project.id);
  showToast(projectStatus === 'canceled' ? 'Project canceled' : 'Project completed');
}

function duplicateProject(project) {
  const copy = { ...project, id: uid('project'), title: `${project.title} copy`, tags: [...(project.tags || [])], repeat: project.repeat ? { ...project.repeat, weekdays: [...(project.repeat.weekdays || [])] } : null, status: 'open', completedAt: null, loggedAt: null, order: ui.state.projects.length };
  ui.state.projects.push(copy);
  const headingMap = new Map();
  ui.state.headings.filter((heading) => heading.projectId === project.id).forEach((heading) => {
    const duplicate = { ...heading, id: uid('heading'), projectId: copy.id };
    headingMap.set(heading.id, duplicate.id); ui.state.headings.push(duplicate);
  });
  ui.state.tasks.filter((task) => task.projectId === project.id && !isTrashed(task)).forEach((task) => ui.state.tasks.push({ ...task, id: uid('task'), projectId: copy.id, headingId: headingMap.get(task.headingId) || null, tags: [...(task.tags || [])], repeat: task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : null, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() }));
  setView('project', copy.id); showToast('Project duplicated');
}

function removeArea(areaId) {
  const area = areaById(areaId);
  if (!area) return;
  confirmAction(`Remove “${area.title}”?`, 'Its projects and to-dos will stay in the same Space. Projects become top-level lists, standalone to-dos become unfiled, and the area’s headings will be removed.', 'Remove area', () => {
    ui.state.areas = ui.state.areas.filter((item) => item.id !== area.id);
    ui.state.projects.filter((project) => project.areaId === area.id).forEach((project) => { project.areaId = null; });
    const headingIds = new Set(headingsFor('area', area.id, true).map((heading) => heading.id));
    ui.state.tasks.filter((task) => task.areaId === area.id).forEach((task) => { task.areaId = task.projectId ? projectById(task.projectId)?.areaId || null : null; if (headingIds.has(task.headingId)) task.headingId = null; });
    ui.state.headings = ui.state.headings.filter((heading) => !headingIds.has(heading.id));
    scheduleSave(); setView('inbox'); showToast('Area removed; its projects and to-dos were kept');
  });
}

function openAreaModalPreact(areaId) {
  const area = areaById(areaId);
  if (!area) return;
  const archivedHeadings = headingsFor('area', area.id, true).filter((heading) => heading.archived);
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(AreaDialog, {
    area,
    spaces: ui.state.spaces,
    archivedHeadings,
    onClose: closeModal,
    onSave: (draft) => {
      area.title = draft.title || area.title;
      area.spaceId = draft.spaceId || area.spaceId;
      area.color = draft.color;
      area.tags = cleanTagList(draft.tags || []);
      ui.state.projects.filter((project) => project.areaId === area.id).forEach((project) => { project.spaceId = area.spaceId; ui.state.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.spaceId = area.spaceId; }); });
      ui.state.tasks.filter((task) => task.areaId === area.id).forEach((task) => { task.spaceId = area.spaceId; });
      scheduleSave(); closeModal(); render();
    },
    onRestoreHeading: (headingId) => {
      const heading = ui.state.headings.find((item) => item.id === headingId);
      if (heading) heading.archived = false;
      scheduleSave(); closeModal(); render(); showToast('Heading restored');
    },
    onAction: (action) => {
      closeModal();
      if (action === 'new-heading') { setView('area', area.id); openHeadingModal(); }
      else removeArea(area.id);
    }
  }), $('#modal-root'));
}

function openAreaModal(areaId) {
  return openAreaModalPreact(areaId);
}

function openSpaceSwitcher() {
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(SpaceSwitcherDialog, {
    spaces: [...ui.state.spaces].sort((a, b) => a.order - b.order),
    activeId: ui.activeSpaceId,
    onClose: closeModal,
    onChoose: (id) => { closeModal(); setActiveSpace(id); },
    onManage: () => { closeModal(); setTimeout(openSpaceSettings, 0); },
  }), $('#modal-root'));
}

function applySpaceSettingsDraft(draft) {
  const spaces = draft.spaces.map((space, index) => ({ ...space, title: space.title.trim() || `Space ${index + 1}`, order: index }));
  let pinnedCount = 0;
  spaces.forEach((space) => { space.pinned = Boolean(space.pinned) && pinnedCount < 2; if (space.pinned) pinnedCount += 1; });
  if (!spaces.some((space) => space.pinned)) spaces.slice(0, 2).forEach((space) => { space.pinned = true; });
  ui.state.spaces = spaces;
  setLaunchRulesEnabled(Boolean(draft.enabled));
  ui.state.settings.defaultSpaceId = spaces.some((space) => space.id === draft.defaultId) ? draft.defaultId : spaces[0]?.id || null;
  ui.state.settings.spaceSchedule.rules = draft.rules
    .filter((rule) => rule.weekdays.length && spaces.some((space) => space.id === rule.spaceId))
    .map((rule, index) => ({ ...rule, weekdays: [...rule.weekdays].sort(), order: index }));
}

function openSpaceSettings() {
  const spaces = [...ui.state.spaces].sort((a, b) => a.order - b.order);
  const rules = [...(ui.state.settings.spaceSchedule.rules || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(SpacesSettingsDialog, {
    initial: { spaces, rules, enabled: ui.launchRulesEnabled, defaultId: ui.state.settings.defaultSpaceId },
    onClose: closeModal,
    makeSpace: (index, pinned) => ({ id: uid('space'), title: `Space ${index + 1}`, color: ['#5ba67a', '#b06bd3', '#e49b3c', '#5b7cfa'][index % 4], pinned, order: index }),
    makeRule: (index, spaceId) => ({ id: uid('space-rule'), spaceId, weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:30', order: index }),
    onSave: (draft) => {
      applySpaceSettingsDraft(draft);
      scheduleSave(); closeModal(); render(); showToast('Space settings saved');
    },
    onDeleteSpace: (spaceId, draft) => {
      const space = draft.spaces.find((candidate) => candidate.id === spaceId);
      if (!space || draft.spaces.length < 2) return;
      closeModal();
      confirmAction(`Delete “${space.title}”?`, 'Its areas, projects, to-dos, and calendar events will move to the default remaining Space.', 'Delete Space', () => {
        applySpaceSettingsDraft(draft);
        const fallback = ui.state.spaces.find((candidate) => candidate.id !== space.id && candidate.id === ui.state.settings.defaultSpaceId) || ui.state.spaces.find((candidate) => candidate.id !== space.id);
        if (!fallback) return;
        [...ui.state.areas, ...ui.state.projects, ...ui.state.tasks, ...ui.state.calendarEvents].filter((item) => item.spaceId === space.id).forEach((item) => { item.spaceId = fallback.id; });
        ui.state.spaces = ui.state.spaces.filter((candidate) => candidate.id !== space.id);
        ui.state.settings.spaceSchedule.rules = ui.state.settings.spaceSchedule.rules.filter((rule) => rule.spaceId !== space.id);
        if (ui.state.settings.defaultSpaceId === space.id) ui.state.settings.defaultSpaceId = fallback.id;
        if (ui.activeSpaceId === space.id) { ui.activeSpaceId = fallback.id; rememberActiveSpace(); }
        scheduleSave(); render(); openSpaceSettings(); showToast(`Deleted “${space.title}”`);
      });
    },
  }), $('#modal-root'));
}

function openSettings() {
  const settings = ui.state.settings;
  const pwa = getPwaStatus();
  const pendingLogCount = [...ui.state.tasks, ...ui.state.projects].filter((item) => matchesActiveSpace(item) && isCompletedButVisible(item)).length;
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalUsesPreact = true;
  renderPreact(h(SettingsDialog, {
    settings,
    userName: ui.user?.displayName || 'Guest',
    spacesCount: ui.state.spaces.length,
    launchRulesEnabled: ui.launchRulesEnabled,
    tags: getKnownTags(),
    pendingLogCount,
    pwa,
    onClose: closeModal,
    onSetting: (key, value) => {
      settings[key] = value;
      if (key === 'theme') applyTheme();
      else if (key === 'showCalendar') renderContent();
      else if (key === 'groupToday') render();
      else if (key === 'logCompletedItems') {
        const logged = applyLogbookPolicy();
        render();
        openSettings();
        if (logged) showToast(`Logged ${logged} completed item${logged === 1 ? '' : 's'}`);
      }
      scheduleSave();
    },
    onAction: handleSettingsAction,
    onManageSpaces: () => { closeModal(); setTimeout(openSpaceSettings, 0); },
    onAddEvent: ({ title, start, end }) => {
      const cleanTitle = title.trim();
      const cleanEnd = end || start;
      if (!cleanTitle || !start) { showToast('Add an event title and start time'); return; }
      if (cleanEnd < start) { showToast('The event end must be after its start'); return; }
      ui.state.calendarEvents.push({ id: uid('event'), spaceId: currentCreationSpaceId(), title: cleanTitle, start, end: cleanEnd, calendar: 'Objects', allDay: false });
      scheduleSave(); showToast('Calendar event added'); openSettings();
    },
    onAddTag: addTag,
    onRenameTag: renameTag,
    onRemoveTag: removeTag,
    onImportJson: importJsonFile,
    onImportIcs: importIcsFile,
  }), $('#modal-root'));
}

function updateTagsEverywhere(transform) {
  ui.state.settings.tags = cleanTagList((ui.state.settings.tags || []).map(transform).filter(Boolean));
  [...ui.state.areas, ...ui.state.projects, ...ui.state.tasks].forEach((item) => { item.tags = cleanTagList((item.tags || []).map(transform).filter(Boolean)); });
}

function addTag(value) {
  const tag = cleanTagList([value])[0];
  if (!tag) { showToast('Enter a tag name'); return; }
  if (getKnownTags().some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) { showToast(`“${tag}” already exists`); return; }
  registerTags([tag]); scheduleSave(); openSettings(); showToast(`Added “${tag}”`);
}

function renameTag(from, to) {
  const normalized = cleanTagList([to])[0];
  if (!normalized || normalized === from) { openSettings(); return; }
  updateTagsEverywhere((tag) => tag === from ? normalized : tag); scheduleSave(); openSettings(); showToast(`Renamed “${from}” to “${normalized}”`);
}

function removeTag(tag) {
  closeModal();
  confirmAction(`Remove “${tag}”?`, 'The tag will be removed from every area, project, and to-do. The items themselves will not be deleted.', 'Remove tag', () => {
    updateTagsEverywhere((value) => value === tag ? null : value); scheduleSave(); openSettings(); showToast(`Removed “${tag}”`);
  });
}

async function handleSettingsAction(action) {
  if (action === 'logout') {
    closeModal(); await performSignOut();
    return;
  }
  if (action === 'notifications') {
    if (ui.state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
      ui.state.settings.notifications = false;
      scheduleSave(); openSettings(); showToast('Notifications disabled in Objects');
      return;
    }
    const permission = await requestNotificationAccess();
    ui.state.settings.notifications = permission === 'granted';
    scheduleSave(); openSettings(); showToast(permission === 'granted' ? 'Notifications enabled' : permission === 'denied' ? 'Notifications are blocked in browser settings' : 'Notifications are not supported here');
  }
  if (action === 'install') {
    const result = await requestPwaInstall();
    openSettings();
    if (result === 'accepted') showToast('Objects was installed');
    if (result === 'dismissed') showToast('Installation cancelled');
    if (result === 'instructions') showToast(getPwaStatus().ios ? 'Use Share → Add to Home Screen' : 'Use your browser menu → Install app');
  }
  if (action === 'update') {
    if (!activatePwaUpdate()) showToast('The update will be applied on the next launch');
  }
  if (action === 'log-now') {
    const logged = logCompletedNow();
    scheduleSave(); render(); openSettings();
    showToast(`Logged ${logged} completed item${logged === 1 ? '' : 's'}`);
  }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify(ui.state, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `objects-backup-${localDay()}.json`; anchor.click(); URL.revokeObjectURL(anchor.href);
  }
}

function importJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const state = JSON.parse(reader.result);
      if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.projects) || !Array.isArray(state.areas)) throw new Error('Invalid backup');
      closeModal();
      confirmAction('Replace all Objects data?', 'The imported backup will replace the current Spaces, tasks, projects, areas, settings, and calendar events.', 'Import backup', () => {
        ui.state = state; normalizeState(); initializeActiveSpace(); scheduleSave(); setView('today'); showToast('Backup imported');
      });
    } catch (error) { showToast('This file is not a valid Objects backup'); }
  };
  reader.readAsText(file);
}

function importIcsFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result).replace(/\r?\n[ \t]/g, '');
    const blocks = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    let added = 0;
    for (const block of blocks) {
      const get = (name) => block.match(new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, 'm'))?.[1]?.trim();
      const title = get('SUMMARY'); const startRaw = get('DTSTART');
      if (!title || !startRaw) continue;
      const start = parseIcsDate(startRaw); const end = parseIcsDate(get('DTEND') || startRaw);
      const id = get('UID') || uid('event');
      const event = { id, spaceId: currentCreationSpaceId(), title: title.replace(/\\,/g, ',').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\'), start, end, calendar: 'Imported', allDay: /^\d{8}$/.test(startRaw) };
      const existing = ui.state.calendarEvents.findIndex((item) => item.id === id);
      if (existing >= 0) ui.state.calendarEvents[existing] = event;
      else ui.state.calendarEvents.push(event);
      added += 1;
    }
    scheduleSave(); showToast(`Imported ${added} calendar event${added === 1 ? '' : 's'}`); openSettings();
  };
  reader.readAsText(file);
}

function parseIcsDate(value) {
  if (/^\d{8}$/.test(value)) return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00`;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?/);
  if (!match) return value;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}${match[7] || ''}`;
  return iso;
}


function closeModal() {
  const returnFocus = modalReturnFocus;
  if (modalUsesPreact) renderPreact(null, $('#modal-root'));
  else $('#modal-root').innerHTML = '';
  modalUsesPreact = false;
  modalReturnFocus = null;
  setTimeout(() => {
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus();
  }, 20);
}

function confirmAction(title, message, label, onConfirm) {
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  $('#modal-root').innerHTML = '';
  modalUsesPreact = true;
  renderPreact(h(ConfirmDialog, {
    title,
    message,
    label,
    danger: /delete|remove|trash|replace/i.test(`${label} ${title}`),
    onClose: closeModal,
    onConfirm,
  }), $('#modal-root'));
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    if ($('#context-menu')?.open) return;
    else if ($('wa-dialog[open]', $('#modal-root'))) return;
    else if ($('#modal-root').children.length) closeModal();
    else if (ui.noteFindOpen) { ui.noteFindOpen = false; ui.noteFindQuery = ''; ui.noteFindIndex = 0; renderInspector(true); }
    else if (ui.selectedTaskIds.size) clearTaskSelection();
    else if (ui.selectedTaskId) closeInspector();
    else closeSidebar();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    if (document.activeElement?.matches('.inspector-notes, [data-check-field="title"]')) {
      ui.noteFindOpen = true; ui.markdownPreview = false; renderInspector(true);
      setTimeout(() => $('[data-note-find-query]', inspector)?.focus(), 20);
    } else openSearch();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $$('[data-task-id]', content).forEach((row) => ui.selectedTaskIds.add(row.dataset.taskId));
    ui.selectionAnchorId = [...ui.selectedTaskIds][0] || null;
    if (ui.selectedTaskIds.size) closeInspector({ restoreFocus: false });
    renderContent(); return;
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); beginQuickAdd(true); return; }
  if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); openNewListModal(); return; }
  if ((event.metaKey || event.ctrlKey) && /^[1-6]$/.test(event.key)) {
    const destinations = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook'];
    event.preventDefault(); setView(destinations[Number(event.key) - 1]); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && ui.selectedTaskId) { event.preventDefault(); toggleTask(ui.selectedTaskId); return; }
  if ((event.metaKey || event.ctrlKey) && event.key === '.' && ui.selectedTaskId) { event.preventDefault(); toggleTask(ui.selectedTaskId); return; }
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 't' && ui.selectedTaskId) {
    event.preventDefault(); const task = currentTask(); task.bucket = 'today'; task.scheduledFor = localDay(); task.evening = false; moveReminderToDate(task, task.scheduledFor); scheduleSave(); render(true); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === 't' && ui.selectedTaskId) {
    event.preventDefault(); const task = currentTask(); task.bucket = 'today'; task.scheduledFor = localDay(); task.evening = true; moveReminderToDate(task, task.scheduledFor); scheduleSave(); render(true); return;
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 's' && ui.selectedTaskId) {
    event.preventDefault(); renderInspector(); setTimeout(() => $('[data-field="scheduledFor"]', inspector)?.focus(), 20); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd' && ui.selectedTaskId) {
    event.preventDefault(); renderInspector(); setTimeout(() => $('[data-field="deadline"]', inspector)?.focus(), 20); return;
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'r' && ui.selectedTaskId) {
    event.preventDefault(); renderInspector(); setTimeout(() => $('[data-field="scheduledFor"]', inspector)?.focus(), 20); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r' && ui.selectedTaskId) {
    event.preventDefault(); const task = currentTask(); if (!task.repeatTemplateId) openRepeatingTemplateEditor(task); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && ['f', 'm'].includes(event.key.toLowerCase()) && (ui.selectedTaskId || ui.selectedTaskIds.size)) { event.preventDefault(); openMoveTaskModal(ui.selectedTaskIds.size ? selectedTasks() : currentTask()); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); const logged = logCompletedNow(); scheduleSave(); render(); showToast(`Logged ${logged} completed item${logged === 1 ? '' : 's'}`); return; }
  if (event.altKey && event.key === 'Backspace' && ui.selectedTaskId && currentTask()?.status === 'open') {
    event.preventDefault(); const task = currentTask(); task.status = 'canceled'; task.completedAt = new Date().toISOString(); task.loggedAt = null; applyLogbookPolicy(); scheduleSave(); closeInspector(); render(); showToast('To-do canceled'); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && ui.selectedTaskId) { event.preventDefault(); const task = currentTask(); const copy = { ...task, id: uid('task'), title: `${task.title} copy`, tags: [...(task.tags || [])], repeat: task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : null, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, createdAt: new Date().toISOString(), order: Date.now(), checklist: task.checklist.map((item) => ({ ...item, id: uid('check') })) }; ui.state.tasks.push(copy); selectTask(copy.id); scheduleSave(); showToast('To-do duplicated'); return; }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n' && ui.view.type === 'project') { event.preventDefault(); openHeadingModal(); return; }
  if (!event.metaKey && !event.ctrlKey && !event.altKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    if (event.key === '/') { event.preventDefault(); openSearch(); return; }
    if (event.key.length === 1 && !event.isComposing && event.key.trim()) { event.preventDefault(); openSearch(event.key); }
  }
}

function scheduleSave(renderAfter = false) {
  ui.renderAfterSave ||= renderAfter;
  if (!ui.saveReady) { ui.saveQueued = true; return; }
  clearTimeout(ui.saveTimer);
  ui.saveTimer = setTimeout(flushSave, 350);
}

async function flushSave() {
  ui.saveTimer = null;
  if (ui.saveInFlight) { ui.saveQueued = true; return; }
  const changes = buildChangeSet();
  if (!changes) {
    if (ui.renderAfterSave) { ui.renderAfterSave = false; render(); }
    return;
  }
  ui.saveInFlight = true;
  ui.saveQueued = false;
  const pendingSnapshot = ui.pendingEntry ? cloneData(ui.pendingEntry) : null;
  ui.ownMutationIds.add(changes.mutationId);
  let retryDelay = 0;
  try {
    const serializedAck = await persistChanges(JSON.stringify(changes));
    acknowledgeChanges(changes, serializedAck);
    if (ui.saveFailures) showToast('Changes saved');
    ui.saveFailures = 0;
    if (pendingSnapshot && ui.pendingEntry?.revision === pendingSnapshot.revision) {
      const taskChanged = (changes.entities?.tasks || []).some((change) => change.id === pendingSnapshot.task.id);
      const taskDeleted = (changes.deletes?.tasks || []).includes(pendingSnapshot.task.id);
      if (taskChanged || taskDeleted) {
        ui.pendingEntry = null;
        writePendingEntry(null);
      }
    }
  } catch (error) {
    ui.ownMutationIds.delete(changes.mutationId);
    ui.saveFailures += 1;
    retryDelay = Math.min(30_000, 1000 * (2 ** Math.min(ui.saveFailures - 1, 5)));
    if (ui.saveFailures === 1) showToast('Could not save changes — retrying');
    console.error('Objects save failed', error);
  } finally {
    ui.saveInFlight = false;
    if (ui.saveQueued || buildChangeSet()) {
      clearTimeout(ui.saveTimer);
      ui.saveTimer = setTimeout(flushSave, retryDelay);
    } else {
      if (ui.renderAfterSave) { ui.renderAfterSave = false; render(); }
    }
  }
}

function showToast(message, actionLabel, action) {
  const region = $('#toast-region');
  while (region.children.length >= 2) region.firstElementChild?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  if (actionLabel) $('button', toast).addEventListener('click', () => { action(); toast.remove(); });
  region.append(toast);
  setTimeout(() => toast.remove(), 4200);
}
