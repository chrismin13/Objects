// @ts-nocheck
import { activatePwaUpdate, getPwaStatus, requestNotificationAccess, requestPwaInstall, showTaskReminder } from './pwa';

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
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
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

const ui = {
  state: null,
  user: null,
  view: { type: 'today', id: null },
  selectedTaskId: null,
  saveTimer: null,
  lastCompleted: null,
  focusedSearchIndex: 0,
  activeTag: null,
  markdownPreview: false,
  draggedTaskId: null,
  draggedCheckId: null,
  reminderTimer: null,
  reminderCheckRunning: false,
  pwaUpdateNotified: false,
  syncTimer: null,
};

let app;
let content;
let sidebar;
let sidebarPanel;
let inspector;
let persistState = async () => null;
let performSignOut = async () => {};
let staticEventsBound = false;
let logbookTimer = null;

export function mountObjects(serializedState, options) {
  app = $('#objects-shell') || $('#app'); content = $('#content'); sidebar = $('#sidebar-nav'); sidebarPanel = $('#sidebar'); inspector = $('#inspector');
  persistState = options.saveState; performSignOut = options.signOut; ui.user = options.user;
  try {
    ui.state = JSON.parse(serializedState); normalizeState();
    const logged = applyLogbookPolicy();
    materializeRecurringTasks(); applyTheme(); render(); handleCaptureUrl(); startReminderChecks(); startLogbookChecks();
    if (logged) scheduleSave();
    if (!staticEventsBound) { bindStaticEvents(); staticEventsBound = true; render(); }
    app.setAttribute('aria-busy', 'false');
  } catch (error) {
    content.innerHTML = `<div class="empty-state">${icon('cloud')}<h2>Objects could not start</h2><p>${esc(error.message)}. Refresh this page and try again.</p></div>`;
  }
  return () => { clearInterval(ui.reminderTimer); clearInterval(ui.syncTimer); clearInterval(logbookTimer); clearTimeout(ui.saveTimer); };
}

export function syncObjectsState(serializedState) {
  if (!ui.state || ui.saveTimer) return;
  try {
    const remote = JSON.parse(serializedState);
    if (remote.updatedAt && remote.updatedAt !== ui.state.updatedAt) {
      const selected = ui.selectedTaskId; ui.state = remote; normalizeState();
      const logged = applyLogbookPolicy();
      if (selected && !ui.state.tasks.some((task) => task.id === selected)) ui.selectedTaskId = null;
      render(); showToast('Changes synced from another device');
      if (logged) scheduleSave();
    }
  } catch (_) {}
}

function normalizeState() {
  ui.state.settings ||= { theme: 'system', groupToday: true };
  ui.state.settings.notifications ??= false;
  ui.state.settings.weekStartsOn ??= 1;
  ui.state.settings.showCalendar ??= true;
  if (!['immediately', 'daily', 'manually'].includes(ui.state.settings.logCompletedItems)) ui.state.settings.logCompletedItems = 'daily';
  ui.state.areas ||= [];
  ui.state.projects ||= [];
  ui.state.headings ||= [];
  ui.state.calendarEvents ||= [];
  ui.state.calendarEvents = ui.state.calendarEvents.filter((event) => event && typeof event.start === 'string' && typeof event.title === 'string');
  ui.state.tasks ||= [];
  ui.state.tasks.forEach((task, index) => {
    task.status ||= 'open';
    task.bucket ||= task.scheduledFor ? 'upcoming' : 'anytime';
    task.tags ||= [];
    task.checklist ||= [];
    task.headingId ||= null;
    task.reminderAt ||= null;
    task.repeat ||= null;
    task.reminderSentAt ||= null;
    if (task.status === 'completed' && task.loggedAt === undefined) task.loggedAt = task.completedAt || new Date().toISOString();
    if (task.status !== 'completed') task.loggedAt = null;
    task.order ??= index;
  });
  ui.state.projects.forEach((project, index) => {
    project.tags ||= [];
    project.scheduledFor ||= null;
    project.completedAt ||= null;
    project.repeat ||= null;
    project.repeatTemplateId ||= null;
    if (project.status === 'completed' && project.loggedAt === undefined) project.loggedAt = project.completedAt || new Date().toISOString();
    if (project.status !== 'completed') project.loggedAt = null;
    project.order ??= index;
  });
  ui.state.areas.forEach((area) => { area.tags ||= []; });
}

function isLogged(item) {
  return item?.status === 'completed' && Boolean(item.loggedAt);
}

function isCompletedButVisible(item) {
  return item?.status === 'completed' && !item.loggedAt;
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
  return applyLogbookPolicyToItems([...ui.state.tasks, ...ui.state.projects], 'immediately');
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

function bindLogbookSettings(settings) {
  let field = $('#setting-logbook');
  if (!field) {
    const general = [...$$('.settings-section')].find((section) => $('h3', section)?.textContent === 'General');
    if (!general) return;
    const pending = [...ui.state.tasks, ...ui.state.projects].filter(isCompletedButVisible).length;
    const help = settings.logCompletedItems === 'immediately' ? 'Completed items move to the Logbook as soon as they are checked.' : settings.logCompletedItems === 'manually' ? 'Completed items stay in their original lists until you log them.' : 'Completed items stay visible for the rest of the day and move to the Logbook after midnight.';
    general.insertAdjacentHTML('afterend', `<div class="settings-section"><h3>Logbook</h3><p>${esc(help)}</p><div class="settings-row"><label for="setting-logbook">Log completed items</label><select id="setting-logbook" class="detail-select"><option value="immediately" ${settings.logCompletedItems === 'immediately' ? 'selected' : ''}>Immediately</option><option value="daily" ${settings.logCompletedItems === 'daily' ? 'selected' : ''}>Daily</option><option value="manually" ${settings.logCompletedItems === 'manually' ? 'selected' : ''}>Manually</option></select></div>${pending ? `<button class="button" type="button" data-log-completed-now>Log Completed Now (${pending})</button>` : ''}</div>`);
    field = $('#setting-logbook');
  }
  field.addEventListener('change', (event) => {
    settings.logCompletedItems = event.target.value;
    const logged = applyLogbookPolicy();
    scheduleSave(); render(); openSettings();
    if (logged) showToast(`Logged ${logged} completed item${logged === 1 ? '' : 's'}`);
  });
  const logNow = $('[data-log-completed-now], [data-settings-action="log-now"]');
  if (logNow) {
    logNow.removeAttribute('data-settings-action');
    logNow.setAttribute('data-log-completed-now', '');
    logNow.addEventListener('click', () => {
      const logged = logCompletedNow();
      scheduleSave(); render(); openSettings();
      showToast(`Logged ${logged} completed item${logged === 1 ? '' : 's'}`);
    });
  }
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
  const offset = (date.getDay() + 6) % 7; date.setDate(date.getDate() - offset);
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

function parseNaturalTask(rawTitle) {
  let title = rawTitle.trim();
  const today = localDay();
  const result = { title, bucket: null, scheduledFor: null, evening: false, reminderAt: null, deadline: null, tags: [] };
  const tagMatches = [...title.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)];
  result.tags = tagMatches.map((match) => match[1]);
  title = title.replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim();

  const deadlineMatch = title.match(/\s(?:deadline|due)\s+(today|tomorrow|\d{4}-\d{2}-\d{2})\b/i);
  if (deadlineMatch) {
    result.deadline = deadlineMatch[1].toLowerCase() === 'today' ? today : deadlineMatch[1].toLowerCase() === 'tomorrow' ? addDays(today, 1) : deadlineMatch[1];
    title = title.replace(deadlineMatch[0], '').trim();
  }
  const dateMatch = title.match(/\s(today|tonight|this evening|tomorrow|next week|someday|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i);
  if (dateMatch) {
    const phrase = dateMatch[1].toLowerCase();
    if (phrase === 'someday') result.bucket = 'someday';
    else {
      result.scheduledFor = phrase === 'today' || phrase === 'tonight' || phrase === 'this evening' ? today : phrase === 'tomorrow' ? addDays(today, 1) : phrase === 'next week' ? addDays(today, 7) : /day$/.test(phrase) ? nextWeekday(phrase.replace('next ', '')) : phrase;
      result.bucket = result.scheduledFor === today ? 'today' : 'upcoming';
      result.evening = phrase === 'tonight' || phrase === 'this evening';
    }
    if (dateMatch[2] && result.scheduledFor) {
      let hour = Number(dateMatch[2]);
      const minute = Number(dateMatch[3] || 0);
      const meridiem = (dateMatch[4] || '').toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      result.reminderAt = `${result.scheduledFor}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    title = title.replace(dateMatch[0], '').trim();
  }
  result.title = title || rawTitle.trim();
  return result;
}

function nextWeekday(name) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const target = days.indexOf(name);
  const date = new Date();
  let distance = (target - date.getDay() + 7) % 7;
  if (distance === 0) distance = 7;
  date.setDate(date.getDate() + distance);
  return localDay(date);
}

function handleCaptureUrl() {
  const params = new URLSearchParams(location.search);
  const taskId = params.get('task');
  const requestedView = params.get('view');
  const sharedText = params.get('text');
  const sharedUrl = params.get('url');
  const sharedTitle = params.get('title');
  const title = sharedTitle || sharedText;

  if (requestedView && ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook'].includes(requestedView)) setView(requestedView);
  if (taskId && ui.state.tasks.some((task) => task.id === taskId)) selectTask(taskId);
  if (title) {
    const parsed = parseNaturalTask(title);
    const notes = [params.get('notes'), sharedTitle ? sharedText : null, sharedUrl].filter(Boolean).join('\n');
    createTaskFromParsed(parsed, { notes, projectId: params.get('project') || null, useCurrentView: false });
  }
  if (!taskId && !requestedView && !title && params.get('capture') !== '1') return;
  history.replaceState({}, '', location.pathname);
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
  $('#search-button').innerHTML = icon('search');
  $('#mobile-search').innerHTML = icon('search');
  $('#sidebar-open').innerHTML = icon('menu');
  $('#sidebar-close').innerHTML = icon('x');
  $('#magic-add').innerHTML = icon('plus');
  $('#new-list-button').innerHTML = `${icon('plus')}<span>New list</span>`;
  $('#settings-button').innerHTML = icon('settings');
  $('#search-button').addEventListener('click', openSearch);
  $('#mobile-search').addEventListener('click', openSearch);
  $('#magic-add').addEventListener('click', () => beginQuickAdd(true));
  $('#new-list-button').addEventListener('click', openNewListModal);
  $('#settings-button').addEventListener('click', openSettings);
  $('#theme-button').addEventListener('click', cycleTheme);
  $('#sidebar-open').addEventListener('click', openSidebar);
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-scrim').addEventListener('click', closeSidebar);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  window.matchMedia('(max-width: 820px)').addEventListener('change', syncSidebarAccessibility);

  sidebar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    setView(button.dataset.view, button.dataset.id || null);
  });

  content.addEventListener('click', handleContentClick);
  content.addEventListener('keydown', handleContentKeydown);
  content.addEventListener('dragstart', handleDragStart);
  content.addEventListener('dragover', handleDragOver);
  content.addEventListener('drop', handleDrop);
  content.addEventListener('dragend', handleDragEnd);
  inspector.addEventListener('input', handleInspectorInput);
  inspector.addEventListener('change', handleInspectorChange);
  inspector.addEventListener('click', handleInspectorClick);
  inspector.addEventListener('dragstart', handleChecklistDragStart);
  inspector.addEventListener('dragover', handleChecklistDragOver);
  inspector.addEventListener('drop', handleChecklistDrop);
  document.addEventListener('keydown', handleGlobalKeydown);
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

function applyTheme() {
  if (!ui.state) return;
  const choice = ui.state.settings.theme || 'system';
  const resolved = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = resolved;
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

function openSidebar() { app.classList.add('sidebar-open'); syncSidebarAccessibility(); setTimeout(() => $('#sidebar-close')?.focus(), 20); }
function closeSidebar() { app.classList.remove('sidebar-open'); syncSidebarAccessibility(); if (matchMedia('(max-width: 820px)').matches) setTimeout(() => $('#sidebar-open')?.focus(), 20); }

function syncSidebarAccessibility() {
  const hidden = matchMedia('(max-width: 820px)').matches && !app.classList.contains('sidebar-open');
  sidebarPanel.inert = hidden;
  if (hidden) sidebarPanel.setAttribute('aria-hidden', 'true');
  else sidebarPanel.removeAttribute('aria-hidden');
}

function setView(type, id = null) {
  ui.view = { type, id };
  ui.selectedTaskId = null;
  ui.activeTag = type === 'tag' ? id : null;
  closeSidebar();
  render();
  content.scrollTop = 0;
}

function projectAllowsTask(task) {
  const project = projectById(task.projectId);
  return !project || (!project.repeat && (!project.scheduledFor || project.scheduledFor <= localDay()) && (project.status === 'open' || isCompletedButVisible(project)));
}
function openTasks() { return ui.state.tasks.filter((task) => task.status === 'open' && !task.repeat && projectAllowsTask(task)); }
function sourceTasks() { return ui.state.tasks.filter((task) => (task.status === 'open' || isCompletedButVisible(task)) && !task.repeat && projectAllowsTask(task)); }
function projectById(id) { return ui.state.projects.find((project) => project.id === id); }
function areaById(id) { return ui.state.areas.find((area) => area.id === id); }
function effectiveTags(task) { return [...new Set([...(areaById(task.areaId)?.tags || []), ...(projectById(task.projectId)?.tags || []), ...(task.tags || [])])]; }

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
  const tasks = ui.state.tasks.filter((task) => task.projectId === projectId && task.status !== 'cancelled' && !task.repeat);
  if (!tasks.length) return 0;
  return Math.round(tasks.filter((task) => task.status === 'completed').length / tasks.length * 100);
}

function progressRing(value) {
  const circumference = 38;
  return `<span class="nav-progress"><svg viewBox="0 0 16 16"><circle class="track" cx="8" cy="8" r="6"/><circle class="value" cx="8" cy="8" r="6" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - circumference * value / 100}"/></svg></span>`;
}

function renderSidebar() {
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

  const areasHtml = ui.state.areas.sort((a, b) => a.order - b.order).map((area) => {
    const areaProjects = ui.state.projects.filter((project) => project.areaId === area.id && (project.status === 'open' || isCompletedButVisible(project)) && !project.repeat && (!project.scheduledFor || project.scheduledFor <= today)).sort((a, b) => a.order - b.order);
    return `<li>
      <button class="nav-item ${ui.view.type === 'area' && ui.view.id === area.id ? 'active' : ''}" data-view="area" data-id="${area.id}">
        <span class="nav-symbol" style="color:${esc(area.color || '#999')}">●</span><span class="nav-title">${esc(area.title)}</span><span class="nav-count">${taskCount('area', area.id) || ''}</span>
      </button>
      ${areaProjects.length ? `<ul class="nav-list">${areaProjects.map((project) => `<li><button class="nav-item ${ui.view.type === 'project' && ui.view.id === project.id ? 'active' : ''}" data-view="project" data-id="${project.id}" style="padding-left:37px">${progressRing(projectProgress(project.id))}<span class="nav-title">${esc(project.title)}</span></button></li>`).join('')}</ul>` : ''}
    </li>`;
  }).join('');

  const looseProjects = ui.state.projects.filter((project) => !project.areaId && (project.status === 'open' || isCompletedButVisible(project)) && !project.repeat && (!project.scheduledFor || project.scheduledFor <= today));
  const projectsHtml = looseProjects.map((project) => `<li><button class="nav-item ${ui.view.type === 'project' && ui.view.id === project.id ? 'active' : ''}" data-view="project" data-id="${project.id}">${progressRing(projectProgress(project.id))}<span class="nav-title">${esc(project.title)}</span></button></li>`).join('');

  sidebar.innerHTML = `<ul class="nav-list">${standardHtml}</ul>
    <ul class="nav-list"><li class="nav-section-title"><span>My lists</span></li>${areasHtml || ''}${projectsHtml || ''}</ul>`;
}

function viewDefinition() {
  const today = localDay();
  const taskFilter = (task) => (task.status === 'open' || isCompletedButVisible(task)) && !task.repeat && projectAllowsTask(task);
  const definitions = {
    inbox: { title: 'Inbox', icon: 'inbox', eyebrow: 'Collect now, decide later', subtitle: 'Unsorted thoughts and to-dos waiting for a home.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.bucket === 'inbox') },
    today: { title: 'Today', icon: 'star', eyebrow: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), subtitle: 'Your clear, focused plan for the day.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && (t.bucket === 'today' || (t.scheduledFor && t.scheduledFor <= today && t.bucket !== 'someday' && t.bucket !== 'inbox') || (t.deadline && t.deadline <= today))) },
    upcoming: { title: 'Upcoming', icon: 'calendar', eyebrow: 'Plan ahead', subtitle: 'A calm view of what the next days hold.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.scheduledFor && t.scheduledFor > today), futureProjects: ui.state.projects.filter((p) => (p.status === 'open' || isCompletedButVisible(p)) && p.scheduledFor && p.scheduledFor > today) },
    anytime: { title: 'Anytime', icon: 'layers', eyebrow: 'Available now', subtitle: 'Everything active that you could make progress on.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && (t.bucket === 'anytime' || t.bucket === 'today') && (!t.scheduledFor || t.scheduledFor <= today)) },
    someday: { title: 'Someday', icon: 'archive', eyebrow: 'Ideas for later', subtitle: 'Possibilities worth keeping, without a commitment.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.bucket === 'someday') },
    logbook: { title: 'Logbook', icon: 'check', eyebrow: 'Completed', subtitle: 'A record of the progress you have made.', tasks: ui.state.tasks.filter((t) => isLogged(t)) },
    trash: { title: 'Trash', icon: 'trash', eyebrow: 'Discarded', subtitle: 'To-dos moved here stay available for recovery.', tasks: ui.state.tasks.filter((t) => t.status === 'cancelled') },
    tomorrow: { title: 'Tomorrow', icon: 'calendar', eyebrow: formatDate(addDays(today, 1), { weekday: 'long', month: 'long', day: 'numeric' }), subtitle: 'Everything planned for the next day.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.scheduledFor === addDays(today, 1)) },
    deadlines: { title: 'Deadlines', icon: 'flag', eyebrow: 'Commitments', subtitle: 'Open to-dos ordered by the date they must be finished.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && t.deadline) },
    repeating: { title: 'Repeating', icon: 'repeat', eyebrow: 'Templates', subtitle: 'Routines that create fresh to-dos and projects on their schedule.', tasks: ui.state.tasks.filter((t) => t.status === 'open' && t.repeat), repeatingProjects: ui.state.projects.filter((p) => p.status === 'open' && p.repeat) },
  };
  if (definitions[ui.view.type]) return definitions[ui.view.type];
  if (ui.view.type === 'project') {
    const project = projectById(ui.view.id);
    if (!project) return definitions.today;
    return { title: project.title, icon: project.status === 'completed' ? 'check' : 'list', eyebrow: project.status === 'completed' ? 'Completed project' : areaById(project.areaId)?.title || 'Project', subtitle: project.notes || 'A focused set of steps toward one outcome.', deadline: project.deadline, tasks: ui.state.tasks.filter((t) => t.projectId === project.id && (isLogged(project) ? isLogged(t) : (t.status === 'open' || isCompletedButVisible(t)) && !t.repeat)), project };
  }
  if (ui.view.type === 'area') {
    const area = areaById(ui.view.id);
    if (!area) return definitions.today;
    return { title: area.title, icon: 'circle', eyebrow: 'Area', subtitle: 'An ongoing part of life, with projects and standalone to-dos.', tasks: ui.state.tasks.filter((t) => t.areaId === area.id && taskFilter(t)), area };
  }
  if (ui.view.type === 'tag') {
    return { title: `#${ui.view.id}`, icon: 'tag', eyebrow: 'Tag', subtitle: 'Matching to-dos from every list.', tasks: ui.state.tasks.filter((t) => taskFilter(t) && effectiveTags(t).includes(ui.view.id)) };
  }
  if (ui.view.type === 'allProjects') {
    return { title: 'All Projects', icon: 'list', eyebrow: 'Open projects', subtitle: 'Every active outcome across all areas.', tasks: [], projects: ui.state.projects.filter((p) => p.status === 'open') };
  }
  if (ui.view.type === 'loggedProjects') {
    return { title: 'Logged Projects', icon: 'check', eyebrow: 'Completed projects', subtitle: 'Finished outcomes and their progress history.', tasks: [], projects: ui.state.projects.filter((p) => isLogged(p)) };
  }
  return definitions.today;
}

function render() {
  if (!ui.state) return;
  renderSidebar();
  renderContent();
  renderInspector();
}

function renderContent() {
  const view = viewDefinition();
  const visibleTasks = ui.activeTag ? view.tasks.filter((task) => effectiveTags(task).includes(ui.activeTag)) : view.tasks;
  const sorted = [...visibleTasks].sort((a, b) => {
    if (ui.view.type === 'deadlines') return (a.deadline || '').localeCompare(b.deadline || '');
    if (ui.view.type === 'logbook') return (b.completedAt || '').localeCompare(a.completedAt || '');
    if (ui.view.type === 'repeating') return (a.repeat?.nextDate || '').localeCompare(b.repeat?.nextDate || '');
    return a.order - b.order;
  });
  const headerActions = `${ui.view.type === 'today' ? `<button class="icon-button" data-action="toggle-group" aria-label="Group Today by list">${icon('layers')}</button>` : ''}${ui.view.type === 'project' ? `<button class="icon-button" data-action="new-heading" aria-label="New heading">${icon('heading')}</button><button class="icon-button" data-action="project-menu" aria-label="Project options">${icon('more')}</button>` : ''}${ui.view.type === 'area' ? `<button class="icon-button" data-action="area-menu" aria-label="Area options">${icon('more')}</button>` : ''}`;
  const deadline = view.deadline ? ` · Deadline ${formatDate(view.deadline, { month: 'short', day: 'numeric' })}` : '';
  const progress = view.project ? projectProgress(view.project.id) : null;
  const sections = buildSections(sorted);
  const tags = [...new Set(view.tasks.flatMap((task) => effectiveTags(task)))].sort();
  const calendar = ['today', 'upcoming', 'tomorrow'].includes(ui.view.type) && ui.state.settings.showCalendar ? renderCalendarEvents(ui.view.type) : '';

  content.innerHTML = `<div class="content-inner">
    <header class="view-header">
      <div class="eyebrow">${esc(view.eyebrow)}${deadline}</div>
      <div class="view-title-row">${icon(view.icon, 'view-icon')}<h1>${esc(view.title)}</h1><div class="header-actions">${headerActions}</div></div>
      <p class="view-subtitle">${esc(view.subtitle)}</p>
      ${progress !== null ? `<div class="progress-line" aria-label="Project ${progress}% complete"><span style="width:${progress}%"></span></div>` : ''}
      ${tags.length > 1 && ui.view.type !== 'tag' ? `<div class="filter-bar"><button class="chip ${!ui.activeTag ? 'active' : ''}" data-filter-tag="">All</button>${tags.map((tag) => `<button class="chip ${ui.activeTag === tag ? 'active' : ''}" data-filter-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>` : ''}
    </header>
    ${calendar}
    ${view.projects ? renderProjectCards(view.projects) : `${view.repeatingProjects?.length ? `<section class="section"><div class="section-header"><h2>Projects</h2></div>${renderProjectCards(view.repeatingProjects)}</section>` : ''}${view.futureProjects?.length ? `<section class="section"><div class="section-header"><h2>Scheduled projects</h2></div>${renderProjectCards(view.futureProjects)}</section>` : ''}${sections.length ? sections.map(renderSection).join('') : view.futureProjects?.length || view.repeatingProjects?.length ? '' : renderEmpty(view)}`}
  </div>`;
}

function renderCalendarEvents(viewType) {
  const today = localDay();
  const events = ui.state.calendarEvents.filter((event) => {
    const day = event.start.slice(0, 10);
    if (viewType === 'today') return day === today;
    if (viewType === 'tomorrow') return day === addDays(today, 1);
    return day > today;
  }).sort((a, b) => a.start.localeCompare(b.start)).slice(0, viewType === 'upcoming' ? 8 : 12);
  if (!events.length) return '';
  return `<section class="calendar-strip" aria-label="Calendar events">${events.map((event) => {
    const date = new Date(event.start);
    const time = event.allDay ? 'all day' : Number.isNaN(date.getTime()) ? 'time unavailable' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    return `<div class="calendar-event"><span class="calendar-time">${esc(time)}</span><i class="calendar-line"></i><div><div class="calendar-title">${esc(event.title)}</div><div class="calendar-name">${esc(event.calendar || 'Calendar')}</div></div></div>`;
  }).join('')}</section>`;
}

function renderProjectCards(projects) {
  if (!projects.length) return `<div class="empty-state">${icon('list')}<h2>No projects here</h2><p>Projects will appear here as their status changes.</p></div>`;
  return `<div class="project-card-list">${projects.map((project) => `<button class="project-card" data-project-card="${project.id}"><h2>${esc(project.title)}</h2><p>${project.repeat ? `${esc(repeatLabel(project.repeat))} · ` : ''}${esc(areaById(project.areaId)?.title || 'Project')} · ${projectProgress(project.id)}% complete</p></button>`).join('')}</div>`;
}

function buildSections(tasks) {
  if (ui.view.type === 'project') {
    const groups = groupBy(tasks, (task) => ui.state.headings.some((heading) => heading.id === task.headingId && !heading.archived) ? task.headingId : 'no-heading');
    for (const heading of ui.state.headings.filter((item) => item.projectId === ui.view.id && !item.archived)) {
      if (!groups.has(heading.id)) groups.set(heading.id, []);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'no-heading') return -1;
      if (b === 'no-heading') return 1;
      return (ui.state.headings.find((h) => h.id === a)?.order || 0) - (ui.state.headings.find((h) => h.id === b)?.order || 0);
    }).map(([key, items]) => {
      const heading = ui.state.headings.find((item) => item.id === key);
      return { key, title: heading?.title || (ui.state.headings.some((h) => h.projectId === ui.view.id && !h.archived) ? 'To-dos' : ''), tasks: items, heading };
    });
  }
  if (!tasks.length) return [];
  if (ui.view.type === 'upcoming') {
    const groups = groupBy(tasks, (task) => task.scheduledFor);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({ key: day, title: relativeDateLabel(day), meta: formatDate(day, { month: 'short', day: 'numeric' }), tasks: items }));
  }
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
        const groups = groupBy(items, (task) => task.projectId || task.areaId || 'Standalone');
        for (const [key, group] of groups) {
          const parent = projectById(key) || areaById(key);
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
  if (ui.view.type === 'area') {
    const groups = groupBy(tasks, (task) => task.projectId || 'Standalone');
    return [...groups.entries()].map(([key, items]) => ({ key, title: projectById(key)?.title || 'To-dos', tasks: items }));
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
  const headingActions = section.heading ? `<span class="heading-actions"><button class="icon-button" data-action="heading-menu" data-heading-id="${section.heading.id}" aria-label="Heading options">${icon('more')}</button></span>` : '';
  const title = section.title ? `<div class="section-header ${section.heading ? 'heading-header' : ''}" ${section.heading ? `data-heading-id="${section.heading.id}"` : ''}><h2>${esc(section.title)}</h2>${section.meta ? `<span class="section-meta">${esc(section.meta)}</span>` : ''}${section.symbol ? `<span class="section-symbol">${section.symbol}</span>` : ''}${headingActions}</div>` : '';
  return `<section class="section" data-section="${esc(section.key)}">${title}<ul class="task-list">${section.tasks.map(renderTask).join('')}</ul>${canQuickAdd() ? renderQuickAdd(section.key, section.title || viewDefinition().title) : ''}</section>`;
}

function renderTask(task) {
  const project = projectById(task.projectId);
  const area = areaById(task.areaId);
  const completed = task.status === 'completed';
  const checked = task.status !== 'open';
  const meta = [];
  if (project && ui.view.type !== 'project') meta.push(`<span class="meta-item">${icon('list')}${esc(project.title)}</span>`);
  else if (area && !['area', 'project'].includes(ui.view.type)) meta.push(`<span class="meta-item">${esc(area.title)}</span>`);
  if (task.deadline) meta.push(`<span class="meta-item deadline">${icon('flag')} ${deadlineLabel(task.deadline)}</span>`);
  if (task.reminderAt) meta.push(`<span class="meta-item reminder">${icon('bell')} ${formatReminderTime(task.reminderAt)}</span>`);
  if (task.repeat) meta.push(`<span class="meta-item">${icon('repeat')} ${repeatLabel(task.repeat)}</span>`);
  if (task.checklist?.length) meta.push(`<span class="meta-item">${icon('list')} ${task.checklist.filter((i) => i.done).length}/${task.checklist.length}</span>`);
  if (effectiveTags(task).length) meta.push(...effectiveTags(task).slice(0, 2).map((tag) => `<span class="meta-item"><i class="tag-dot"></i>${esc(tag)}</span>`));
  const star = ui.view.type === 'anytime' && task.bucket === 'today' ? icon('star', 'today-star') : '';
  return `<li class="task-row ${ui.selectedTaskId === task.id ? 'selected' : ''} ${completed ? 'completed' : ''}" data-task-id="${task.id}" draggable="true">
    <button class="check-button ${checked ? 'checked' : ''}" data-action="toggle-task" aria-label="${checked ? 'Restore' : 'Complete'} ${esc(task.title)}">${checked ? icon('check') : ''}</button>
    <div class="task-main" data-action="select-task"><span class="task-title">${star}${esc(task.title)}</span>${task.notes ? `<div class="task-notes-preview">${esc(task.notes)}</div>` : ''}${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}</div>
    ${icon('chevron', 'task-chevron')}
  </li>`;
}

function canQuickAdd() { return !['logbook', 'trash', 'upcoming', 'repeating', 'allProjects', 'loggedProjects'].includes(ui.view.type) && !(ui.view.type === 'project' && projectById(ui.view.id)?.status === 'completed'); }
function renderQuickAdd(key, label = 'this list') { return `<button class="section-add" type="button" data-section-add="${esc(key)}" aria-label="New to-do in ${esc(label)}">${icon('plus')}<span>New to-do</span></button><div class="quick-add-row" hidden data-quick-add="${esc(key)}"><span class="quick-add-dot"></span><input class="quick-add-input" type="text" placeholder="Type a to-do…" aria-label="New to-do title in ${esc(label)}"></div>`; }

function repeatLabel(repeat) {
  if (!repeat) return '';
  const every = Number(repeat.interval) > 1 ? `Every ${repeat.interval} ${repeat.frequency.replace('daily','days').replace('weekly','weeks').replace('monthly','months').replace('yearly','years')}` : ({ daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' }[repeat.frequency] || 'Repeating');
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
function deadlineLabel(day) {
  const today = localDay();
  if (day < today) return 'Overdue';
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return formatDate(day, { month: 'short', day: 'numeric' });
}

function handleContentClick(event) {
  const taskRow = event.target.closest('[data-task-id]');
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'toggle-task' && taskRow) {
    toggleTask(taskRow.dataset.taskId, taskRow);
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
  if (action === 'new-heading') openHeadingModal();
  if (action === 'project-menu') openProjectModal(ui.view.id);
  if (action === 'area-menu') openAreaModal(ui.view.id);
  if (action === 'heading-menu') openHeadingModal(event.target.closest('[data-heading-id]').dataset.headingId);
  const tag = event.target.closest('[data-filter-tag]');
  if (tag) { ui.activeTag = tag.dataset.filterTag || null; renderContent(); }
  const projectCard = event.target.closest('[data-project-card]');
  if (projectCard) setView('project', projectCard.dataset.projectCard);
  const sectionAdd = event.target.closest('[data-section-add]');
  if (sectionAdd) openQuickAdd(sectionAdd.closest('.section')?.querySelector('.quick-add-row'));
}

function handleContentKeydown(event) {
  if (!event.target.matches('.quick-add-input')) return;
  if (event.key === 'Enter' && event.target.value.trim()) {
    createTask(event.target.value.trim(), event.target.closest('[data-quick-add]')?.dataset.quickAdd);
  } else if (event.key === 'Escape') {
    const row = event.target.closest('.quick-add-row');
    row.hidden = true;
    const button = row.closest('.section')?.querySelector('.section-add');
    if (button) button.hidden = false;
    event.target.value = '';
  }
}

function handleDragStart(event) {
  const row = event.target.closest('[data-task-id]');
  if (!row) return;
  ui.draggedTaskId = row.dataset.taskId;
  row.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', ui.draggedTaskId);
}

function handleDragOver(event) {
  const row = event.target.closest('[data-task-id]');
  const section = event.target.closest('[data-section]');
  if (!row && section && ui.draggedTaskId) {
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
  const targetRow = event.target.closest('[data-task-id]');
  const targetSection = event.target.closest('[data-section]');
  const source = ui.state.tasks.find((task) => task.id === ui.draggedTaskId);
  const target = ui.state.tasks.find((task) => task.id === targetRow?.dataset.taskId);
  if (!source || (!target && !targetSection) || source.id === target?.id) return;
  event.preventDefault();
  if (target) {
    const rect = targetRow.getBoundingClientRect();
    source.order = target.order + (event.clientY > rect.top + rect.height / 2 ? 0.5 : -0.5);
    if (ui.view.type === 'project') source.headingId = target.headingId || null;
  } else {
    const sectionKey = targetSection.dataset.section;
    if (ui.view.type === 'project') source.headingId = sectionKey === 'no-heading' ? null : sectionKey;
    const sectionTasks = ui.state.tasks.filter((task) => task.headingId === source.headingId && task.id !== source.id);
    source.order = Math.max(0, ...sectionTasks.map((task) => task.order)) + 1;
  }
  const ordered = [...ui.state.tasks].sort((a, b) => a.order - b.order);
  ordered.forEach((task, index) => { task.order = index; });
  scheduleSave();
  renderContent();
}

function handleDragEnd() {
  ui.draggedTaskId = null;
  $$('.task-row.dragging, .task-row.drag-over', content).forEach((item) => item.classList.remove('dragging', 'drag-over'));
  $$('.section.drop-target', content).forEach((item) => item.classList.remove('drop-target'));
}

function beginQuickAdd(fromMagicButton = false) {
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
  row.hidden = false;
  const button = row.closest('.section')?.querySelector('.section-add');
  if (button) button.hidden = true;
  const input = $('.quick-add-input', row);
  input.focus(); input.select();
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function createTask(title, sectionKey = null) {
  const parsed = parseNaturalTask(title);
  createTaskFromParsed(parsed, { sectionKey });
}

function createTaskFromParsed(parsed, options = {}) {
  const today = localDay();
  const task = {
    id: uid('task'), title: parsed.title, notes: options.notes || '', status: 'open', bucket: 'inbox', scheduledFor: null, evening: false, reminderAt: null, deadline: null,
    projectId: options.projectId || null, headingId: null, areaId: null, tags: parsed.tags || [], checklist: [], repeat: null, createdAt: new Date().toISOString(), completedAt: null, loggedAt: null, order: Date.now(),
  };
  if (options.useCurrentView !== false) {
    if (ui.view.type === 'today') { task.bucket = 'today'; task.scheduledFor = today; }
    else if (ui.view.type === 'anytime') task.bucket = 'anytime';
    else if (ui.view.type === 'someday') task.bucket = 'someday';
    else if (ui.view.type === 'tomorrow') { task.bucket = 'upcoming'; task.scheduledFor = addDays(today, 1); }
    else if (ui.view.type === 'deadlines') { task.bucket = 'anytime'; task.deadline = today; }
    else if (ui.view.type === 'tag') { task.bucket = 'anytime'; task.tags = [...new Set([...task.tags, ui.view.id])]; }
    else if (ui.view.type === 'project') {
      const project = projectById(ui.view.id);
      task.bucket = 'anytime'; task.projectId = project.id; task.areaId = project.areaId; task.headingId = options.sectionKey && options.sectionKey !== 'no-heading' ? options.sectionKey : null;
    } else if (ui.view.type === 'area') { task.bucket = 'anytime'; task.areaId = ui.view.id; }
  }
  if (task.projectId && task.bucket === 'inbox' && options.useCurrentView === false) task.bucket = 'anytime';
  if (task.projectId && !task.areaId) task.areaId = projectById(task.projectId)?.areaId || null;
  if (parsed.bucket) task.bucket = parsed.bucket;
  if (parsed.scheduledFor) task.scheduledFor = parsed.scheduledFor;
  if (parsed.evening) task.evening = true;
  if (parsed.reminderAt) task.reminderAt = parsed.reminderAt;
  if (parsed.deadline) task.deadline = parsed.deadline;
  ui.state.tasks.push(task);
  ui.selectedTaskId = task.id;
  ui.markdownPreview = false;
  app.classList.add('inspector-open');
  scheduleSave();
  render();
  setTimeout(() => $('#inspector-title')?.focus(), 30);
}

function toggleTask(taskId, row) {
  const task = ui.state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  if (task.repeat) { selectTask(task.id); showToast('Edit or pause this repeating template in its details'); return; }
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

function selectTask(taskId) {
  if (ui.selectedTaskId !== taskId) ui.markdownPreview = false;
  ui.selectedTaskId = taskId;
  app.classList.add('inspector-open');
  renderContent();
  renderInspector();
}

function closeInspector() {
  ui.selectedTaskId = null;
  app.classList.remove('inspector-open');
  renderContent();
  inspector.innerHTML = '';
}

function renderInspector() {
  const task = ui.state.tasks.find((item) => item.id === ui.selectedTaskId);
  if (!task) { app.classList.remove('inspector-open'); inspector.innerHTML = ''; return; }
  const schedule = task.bucket === 'today' ? (task.evening ? 'evening' : 'today') : task.bucket;
  const projectOptions = [`<option value="">No project</option>`, ...ui.state.projects.filter((p) => p.status === 'open').map((p) => `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${esc(p.title)}</option>`)].join('');
  const headingOptions = [`<option value="">No heading</option>`, ...ui.state.headings.filter((h) => h.projectId === task.projectId && !h.archived).map((h) => `<option value="${h.id}" ${task.headingId === h.id ? 'selected' : ''}>${esc(h.title)}</option>`)].join('');
  const repeat = task.repeat;
  inspector.innerHTML = `<div class="inspector-scroll">
    <div class="inspector-top"><span class="inspector-status"><i class="sync-state" id="sync-state"></i>${task.status === 'completed' ? 'Completed' : task.status === 'cancelled' ? 'In trash' : 'To-do'}</span><button class="icon-button" data-inspector-action="close" aria-label="Close details">${icon('x')}</button></div>
    <textarea id="inspector-title" class="inspector-title" data-field="title" rows="2" placeholder="To-do title">${esc(task.title)}</textarea>
    ${ui.markdownPreview ? `<div class="markdown-preview">${renderMarkdown(task.notes)}</div>` : `<textarea class="inspector-notes" data-field="notes" placeholder="Notes (Markdown supported)">${esc(task.notes)}</textarea>`}
    <button class="markdown-toggle" data-inspector-action="markdown">${ui.markdownPreview ? 'Edit notes' : 'Preview Markdown'}</button>
    ${!repeat ? `<div class="detail-group"><span class="detail-label">When</span><div class="schedule-chips">
      ${[['inbox','Inbox'],['today','Today'],['evening','This evening'],['anytime','Anytime'],['someday','Someday']].map(([value, label]) => `<button class="chip ${schedule === value ? 'active' : ''}" data-schedule="${value}">${label}</button>`).join('')}
    </div>${task.bucket === 'upcoming' ? `<div class="detail-row" style="margin-top:9px"><input class="detail-input" type="date" data-field="scheduledFor" value="${task.scheduledFor || ''}" aria-label="Start date"></div>` : `<button class="checklist-add" data-inspector-action="schedule-date">Choose a date…</button>`}</div>` : ''}
    <div class="detail-group"><label class="detail-label" for="task-project">Project</label><select id="task-project" class="detail-select" data-field="projectId">${projectOptions}</select></div>
    ${task.projectId ? `<div class="detail-group"><label class="detail-label" for="task-heading">Heading</label><select id="task-heading" class="detail-select" data-field="headingId">${headingOptions}</select></div>` : ''}
    <div class="detail-group"><label class="detail-label" for="task-reminder">Reminder</label><input id="task-reminder" class="detail-input" type="datetime-local" data-field="reminderAt" value="${task.reminderAt || ''}"></div>
    <div class="detail-group"><label class="detail-label" for="task-deadline">Deadline</label><input id="task-deadline" class="detail-input" type="date" data-field="deadline" value="${task.deadline || ''}"></div>
    <div class="detail-group"><label class="detail-label" for="task-tags">Tags</label><input id="task-tags" class="detail-input" type="text" data-field="tags" value="${esc(task.tags.join(', '))}" placeholder="Errand, Focused"></div>
    <div class="detail-group"><span class="detail-label">Checklist</span><div class="checklist">${task.checklist.map((item) => `<div class="checklist-item" data-check-id="${item.id}" draggable="true"><input type="checkbox" data-check-field="done" ${item.done ? 'checked' : ''} aria-label="Complete checklist item"><input type="text" data-check-field="title" value="${esc(item.title)}" aria-label="Checklist item"><button class="checklist-remove" data-inspector-action="remove-check" aria-label="Remove checklist item">×</button></div>`).join('')}</div><button class="checklist-add" data-inspector-action="add-check">+ Add item</button></div>
    <div class="detail-group"><span class="detail-label">Repeat</span>${repeat ? `<div class="repeat-grid"><select class="detail-select" data-repeat-field="mode"><option value="fixed" ${repeat.mode === 'fixed' ? 'selected' : ''}>On schedule</option><option value="afterCompletion" ${repeat.mode === 'afterCompletion' ? 'selected' : ''}>After completion</option></select><select class="detail-select" data-repeat-field="frequency"><option value="daily" ${repeat.frequency === 'daily' ? 'selected' : ''}>Day</option><option value="weekly" ${repeat.frequency === 'weekly' ? 'selected' : ''}>Week</option><option value="monthly" ${repeat.frequency === 'monthly' ? 'selected' : ''}>Month</option><option value="yearly" ${repeat.frequency === 'yearly' ? 'selected' : ''}>Year</option></select><input class="detail-input" type="number" min="1" max="365" data-repeat-field="interval" value="${repeat.interval || 1}" aria-label="Repeat interval"><input class="detail-input" type="date" data-repeat-field="nextDate" value="${repeat.nextDate || localDay()}" aria-label="Next occurrence"></div>${repeat.frequency === 'weekly' ? `<div class="weekday-row">${['S','M','T','W','T','F','S'].map((label, day) => `<button class="chip ${(repeat.weekdays || []).includes(day) ? 'active' : ''}" data-weekday="${day}" aria-label="Repeat on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]}">${label}</button>`).join('')}</div>` : ''}<div class="settings-row"><label for="repeat-paused">Pause schedule</label><input id="repeat-paused" type="checkbox" data-repeat-field="paused" ${repeat.paused ? 'checked' : ''}></div><button class="checklist-add" data-inspector-action="stop-repeat">Stop repeating</button>` : `<button class="checklist-add" data-inspector-action="start-repeat">Make repeating…</button>`}</div>
    <div class="inspector-actions"><button class="button" data-inspector-action="duplicate">Duplicate</button>${task.status === 'cancelled' ? `<button class="button" data-inspector-action="restore">Restore</button><button class="danger-button" data-inspector-action="delete-forever">${icon('trash')} Delete forever</button>` : `<button class="danger-button" data-inspector-action="trash">${icon('trash')} Move to Trash</button>`}</div>
  </div>`;
}

function renderMarkdown(markdown = '') {
  const safe = esc(markdown);
  const lines = safe.split('\n');
  let inList = false;
  const output = [];
  for (const line of lines) {
    if (/^[-*] /.test(line)) {
      if (!inList) { output.push('<ul>'); inList = true; }
      output.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else {
      if (inList) { output.push('</ul>'); inList = false; }
      if (line.startsWith('### ')) output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      else if (line.startsWith('## ')) output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      else if (line.startsWith('# ')) output.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      else if (line) output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  if (inList) output.push('</ul>');
  return output.join('') || '<p>No notes yet.</p>';
}

function inlineMarkdown(text) {
  return text.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function currentTask() { return ui.state.tasks.find((item) => item.id === ui.selectedTaskId); }

function handleChecklistDragStart(event) {
  const row = event.target.closest('[data-check-id]');
  if (!row) return;
  ui.draggedCheckId = row.dataset.checkId;
  event.dataTransfer.effectAllowed = 'move';
}

function handleChecklistDragOver(event) {
  if (event.target.closest('[data-check-id]')) event.preventDefault();
}

function handleChecklistDrop(event) {
  const task = currentTask();
  const targetId = event.target.closest('[data-check-id]')?.dataset.checkId;
  if (!task || !targetId || !ui.draggedCheckId || targetId === ui.draggedCheckId) return;
  event.preventDefault();
  const from = task.checklist.findIndex((item) => item.id === ui.draggedCheckId);
  const to = task.checklist.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return;
  const targetRow = event.target.closest('[data-check-id]');
  const after = event.clientY > targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2;
  const [moved] = task.checklist.splice(from, 1);
  let insertAt = task.checklist.findIndex((item) => item.id === targetId) + (after ? 1 : 0);
  if (insertAt < 0) insertAt = task.checklist.length;
  task.checklist.splice(insertAt, 0, moved);
  ui.draggedCheckId = null; scheduleSave(); renderInspector();
}

function handleInspectorInput(event) {
  const task = currentTask();
  if (!task) return;
  const field = event.target.dataset.field;
  if (field === 'title' || field === 'notes') task[field] = event.target.value;
  if (field === 'tags') task.tags = event.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  const checkRow = event.target.closest('[data-check-id]');
  if (checkRow && event.target.dataset.checkField === 'title') {
    const item = task.checklist.find((check) => check.id === checkRow.dataset.checkId);
    if (item) item.title = event.target.value;
  }
  markSaving();
  scheduleSave(false);
  if (field === 'title') {
    const rowTitle = $(`[data-task-id="${task.id}"] .task-title`, content);
    if (rowTitle) rowTitle.textContent = task.title;
  }
}

function handleInspectorChange(event) {
  const task = currentTask();
  if (!task) return;
  const field = event.target.dataset.field;
  if (['deadline', 'scheduledFor', 'reminderAt'].includes(field)) task[field] = event.target.value || null;
  if (field === 'scheduledFor') {
    moveReminderToDate(task, event.target.value || null);
    task.bucket = event.target.value ? (event.target.value <= localDay() ? 'today' : 'upcoming') : 'anytime';
  }
  if (field === 'reminderAt') { task.reminderSentAt = null; if (task.repeat) task.repeat.reminderTime = task.reminderAt?.slice(11, 16) || ''; }
  if (field === 'deadline' && task.repeat) task.repeat.deadlineOffset = dayDistance(task.repeat.nextDate, task.deadline);
  if (field === 'projectId') {
    task.projectId = event.target.value || null;
    const project = projectById(task.projectId);
    if (project) task.areaId = project.areaId || null;
    if (!project || !ui.state.headings.some((heading) => heading.id === task.headingId && heading.projectId === project.id)) task.headingId = null;
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
  render();
}

function handleInspectorClick(event) {
  const task = currentTask();
  if (!task) return;
  const schedule = event.target.closest('[data-schedule]')?.dataset.schedule;
  if (schedule) {
    const nextDate = ['today', 'evening'].includes(schedule) ? localDay() : null;
    moveReminderToDate(task, nextDate);
    task.evening = schedule === 'evening';
    task.bucket = ['today', 'evening'].includes(schedule) ? 'today' : schedule;
    task.scheduledFor = nextDate;
    scheduleSave(); render(); return;
  }
  const action = event.target.closest('[data-inspector-action]')?.dataset.inspectorAction;
  if (action === 'close') closeInspector();
  if (action === 'trash') { task.status = 'cancelled'; task.completedAt = null; scheduleSave(); closeInspector(); showToast('Moved to Trash'); }
  if (action === 'restore') { task.status = 'open'; scheduleSave(); closeInspector(); showToast('To-do restored'); }
  if (action === 'delete-forever') {
    confirmAction('Delete this to-do forever?', 'This cannot be undone.', 'Delete forever', () => {
      ui.state.tasks = ui.state.tasks.filter((item) => item.id !== task.id); scheduleSave(); closeInspector(); showToast('To-do permanently deleted');
    });
  }
  if (action === 'duplicate') {
    const copy = { ...task, id: uid('task'), title: `${task.title} copy`, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, createdAt: new Date().toISOString(), order: Date.now(), checklist: task.checklist.map((item) => ({ ...item, id: uid('check') })), repeat: task.repeat ? { ...task.repeat, weekdays: [...(task.repeat.weekdays || [])] } : null };
    ui.state.tasks.push(copy); ui.selectedTaskId = copy.id; scheduleSave(); render(); showToast('To-do duplicated');
  }
  if (action === 'markdown') { ui.markdownPreview = !ui.markdownPreview; renderInspector(); }
  if (action === 'start-repeat') { const nextDate = task.scheduledFor || addDays(localDay(), 7); task.repeat = { mode: 'fixed', frequency: 'weekly', interval: 1, weekdays: [], nextDate, reminderTime: task.reminderAt?.slice(11, 16) || '', deadlineOffset: dayDistance(nextDate, task.deadline), paused: false }; task.bucket = 'upcoming'; task.scheduledFor = nextDate; scheduleSave(); render(); }
  if (action === 'stop-repeat') { task.repeat = null; scheduleSave(); render(); }
  if (action === 'add-check') { task.checklist.push({ id: uid('check'), title: '', done: false }); scheduleSave(); renderInspector(); $$('.checklist-item input[type="text"]', inspector).at(-1)?.focus(); }
  if (action === 'remove-check') { const id = event.target.closest('[data-check-id]')?.dataset.checkId; task.checklist = task.checklist.filter((item) => item.id !== id); scheduleSave(); renderInspector(); renderContent(); }
  if (action === 'schedule-date') {
    const tomorrow = addDays(localDay(), 1);
    task.bucket = 'upcoming'; task.scheduledFor = tomorrow; task.evening = false; scheduleSave(); render();
  }
  const weekday = event.target.closest('[data-weekday]');
  if (weekday && task.repeat) {
    const day = Number(weekday.dataset.weekday);
    task.repeat.weekdays ||= [];
    task.repeat.weekdays = task.repeat.weekdays.includes(day) ? task.repeat.weekdays.filter((item) => item !== day) : [...task.repeat.weekdays, day].sort();
    scheduleSave(); renderInspector();
  }
}

function openSearch() {
  ui.focusedSearchIndex = 0;
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><div class="modal quick-find" role="dialog" aria-modal="true" aria-label="Quick find"><div class="modal-header">${icon('search')}<input id="search-input" class="modal-search" type="search" placeholder="Jump to a list or find a to-do…" autocomplete="off"><span class="key-hint">esc</span></div><div id="search-results" class="search-results"></div></div></div>`;
  $('#search-input').addEventListener('input', renderSearchResults);
  $('#search-input').addEventListener('keydown', handleSearchKeydown);
  $('#search-results').addEventListener('click', handleSearchClick);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  renderSearchResults();
  setTimeout(() => $('#search-input')?.focus(), 20);
}

function searchItems(query) {
  const q = query.toLowerCase().trim();
  const lists = [
    ['today','Today','star'], ['inbox','Inbox','inbox'], ['upcoming','Upcoming','calendar'], ['anytime','Anytime','layers'], ['someday','Someday','archive'], ['logbook','Logbook','check']
  ].map(([type,title,iconName]) => ({ kind:'view', type, title, meta:'List', icon:iconName }));
  const special = [
    ['tomorrow','Tomorrow','calendar'], ['deadlines','Deadlines','flag'], ['repeating','Repeating','repeat'], ['allProjects','All Projects','list'], ['loggedProjects','Logged Projects','check']
  ].map(([type,title,iconName]) => ({ kind:'view', type, title, meta:'Special list', icon:iconName }));
  const areas = ui.state.areas.map((area) => ({ kind:'view', type:'area', id:area.id, title:area.title, meta:'Area', icon:'circle' }));
  const projects = ui.state.projects.filter((p) => p.status === 'open' || isCompletedButVisible(p)).map((p) => ({ kind:'view', type:'project', id:p.id, title:p.title, meta:areaById(p.areaId)?.title || 'Project', icon:'list' }));
  const headings = ui.state.headings.filter((h) => !h.archived).map((heading) => ({ kind:'heading', id:heading.id, projectId:heading.projectId, title:heading.title, meta:projectById(heading.projectId)?.title || 'Heading', icon:'heading' }));
  const tags = [...new Set(ui.state.tasks.flatMap((task) => effectiveTags(task)))].map((tag) => ({ kind:'view', type:'tag', id:tag, title:tag, meta:'Tag', icon:'tag' }));
  const taskSource = q ? ui.state.tasks : sourceTasks();
  const tasks = taskSource.map((task) => ({ kind:'task', id:task.id, title:task.title, meta:task.repeat ? 'Repeating template' : isLogged(task) ? 'Logbook' : projectById(task.projectId)?.title || areaById(task.areaId)?.title || 'To-do', icon:task.repeat ? 'repeat' : 'circle', searchText:`${task.title} ${task.notes || ''} ${effectiveTags(task).join(' ')} ${(task.checklist || []).map((i) => i.title).join(' ')}` }));
  return [...lists, ...special, ...areas, ...projects, ...headings, ...tags, ...tasks].filter((item) => !q || `${item.title} ${item.meta} ${item.searchText || ''}`.toLowerCase().includes(q)).slice(0, 24);
}

function renderSearchResults() {
  const input = $('#search-input');
  const results = searchItems(input?.value || '');
  ui.focusedSearchIndex = Math.min(ui.focusedSearchIndex, Math.max(0, results.length - 1));
  const root = $('#search-results');
  root.dataset.results = JSON.stringify(results);
  root.innerHTML = results.length ? results.map((item, index) => `<button class="search-result ${index === ui.focusedSearchIndex ? 'focused' : ''}" data-search-index="${index}">${icon(item.icon)}<span class="search-result-text"><span class="search-result-title">${esc(item.title)}</span><span class="search-result-meta">${esc(item.meta)}</span></span>${icon('chevron')}</button>`).join('') : `<div class="search-empty">No matching to-dos or lists</div>`;
}

function handleSearchKeydown(event) {
  const results = JSON.parse($('#search-results').dataset.results || '[]');
  if (event.key === 'ArrowDown') { event.preventDefault(); ui.focusedSearchIndex = Math.min(results.length - 1, ui.focusedSearchIndex + 1); renderSearchResults(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); ui.focusedSearchIndex = Math.max(0, ui.focusedSearchIndex - 1); renderSearchResults(); }
  if (event.key === 'Enter' && results[ui.focusedSearchIndex]) chooseSearchResult(results[ui.focusedSearchIndex]);
}

function handleSearchClick(event) {
  const button = event.target.closest('[data-search-index]');
  if (!button) return;
  const results = JSON.parse($('#search-results').dataset.results || '[]');
  chooseSearchResult(results[Number(button.dataset.searchIndex)]);
}

function chooseSearchResult(item) {
  closeModal();
  if (item.kind === 'view') setView(item.type, item.id || null);
  else if (item.kind === 'heading') setView('project', item.projectId);
  else {
    const task = ui.state.tasks.find((t) => t.id === item.id);
    if (task.repeat) setView('repeating');
    else if (isLogged(task)) setView('logbook');
    else if (task.status === 'cancelled') setView('trash');
    else if (task.projectId) setView('project', task.projectId);
    else if (task.areaId) setView('area', task.areaId);
    else setView(task.bucket === 'upcoming' ? 'upcoming' : task.bucket);
    selectTask(task.id);
  }
}

function openNewListModal() {
  const areaOptions = [`<option value="">No area</option>`, ...ui.state.areas.map((area) => `<option value="${area.id}">${esc(area.title)}</option>`)].join('');
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><form id="new-list-form" class="modal form-modal" role="dialog" aria-modal="true"><h2>Create a list</h2><p>Use projects for outcomes and areas for the ongoing parts of your life.</p><div class="form-field"><label for="list-type">Type</label><select id="list-type"><option value="project">Project</option><option value="area">Area</option></select></div><div class="form-field"><label for="list-title">Name</label><input id="list-title" required autocomplete="off" placeholder="e.g. Plan summer trip"></div><div class="form-field" id="area-field"><label for="list-area">Area</label><select id="list-area">${areaOptions}</select></div><div class="form-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Create</button></div></form></div>`;
  $('#list-type').addEventListener('change', (event) => { $('#area-field').hidden = event.target.value === 'area'; });
  $('[data-cancel]').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  $('#new-list-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#list-title').value.trim();
    if (!title) return;
    if ($('#list-type').value === 'area') {
      const area = { id: uid('area'), title, color: ['#5b7cfa','#e49b3c','#5ba67a','#b06bd3'][ui.state.areas.length % 4], tags: [], order: ui.state.areas.length };
      ui.state.areas.push(area); closeModal(); setView('area', area.id);
    } else {
      const project = { id: uid('project'), areaId: $('#list-area').value || null, title, notes: '', deadline: null, status: 'open', order: ui.state.projects.length };
      ui.state.projects.push(project); closeModal(); setView('project', project.id);
    }
    scheduleSave();
  });
  setTimeout(() => $('#list-title')?.focus(), 20);
}

function openHeadingModal(headingId = null) {
  const heading = ui.state.headings.find((item) => item.id === headingId);
  const projectId = heading?.projectId || ui.view.id;
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><form id="heading-form" class="modal form-modal" role="dialog" aria-modal="true"><h2>${heading ? 'Edit heading' : 'New heading'}</h2><p>Headings divide a project into clear stages or categories.</p><div class="form-field"><label for="heading-title">Name</label><input id="heading-title" required value="${esc(heading?.title || '')}" placeholder="e.g. Preparation"></div>${heading ? `<div class="settings-section button-row"><button class="button" type="button" data-heading-action="duplicate">Duplicate with to-dos</button><button class="button" type="button" data-heading-action="archive">Archive</button></div>` : ''}<div class="form-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">${heading ? 'Save' : 'Create'}</button></div></form></div>`;
  $('[data-cancel]').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  $('#heading-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#heading-title').value.trim();
    if (!title) return;
    if (heading) heading.title = title;
    else ui.state.headings.push({ id: uid('heading'), projectId, title, archived: false, order: ui.state.headings.filter((item) => item.projectId === projectId).length });
    scheduleSave(); closeModal(); render();
  });
  $$('[data-heading-action]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.headingAction === 'archive') {
      heading.archived = true;
      showToast('Heading archived');
    } else {
      const copy = { ...heading, id: uid('heading'), title: `${heading.title} copy`, order: heading.order + 0.5 };
      ui.state.headings.push(copy);
      ui.state.tasks.filter((task) => task.headingId === heading.id && task.status === 'open').forEach((task) => ui.state.tasks.push({ ...task, id: uid('task'), headingId: copy.id, checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() }));
      showToast('Heading duplicated');
    }
    scheduleSave(); closeModal(); render();
  }));
  setTimeout(() => $('#heading-title')?.focus(), 20);
}

function openProjectModal(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  const areaOptions = [`<option value="">No area</option>`, ...ui.state.areas.map((area) => `<option value="${area.id}" ${project.areaId === area.id ? 'selected' : ''}>${esc(area.title)}</option>`)].join('');
  const archivedHeadings = ui.state.headings.filter((heading) => heading.projectId === project.id && heading.archived);
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><form id="project-form" class="modal form-modal" role="dialog" aria-modal="true"><h2>Project options</h2><p>Edit the outcome, move it, duplicate it, or send it to the Logbook.</p><div class="form-field"><label for="project-title">Name</label><input id="project-title" required value="${esc(project.title)}"></div><div class="form-field"><label for="project-notes">Notes</label><input id="project-notes" value="${esc(project.notes || '')}"></div><div class="form-field"><label for="project-area">Area</label><select id="project-area">${areaOptions}</select></div><div class="repeat-grid"><div class="form-field"><label for="project-start">Start date</label><input id="project-start" type="date" value="${project.scheduledFor || ''}"></div><div class="form-field"><label for="project-deadline">Deadline</label><input id="project-deadline" type="date" value="${project.deadline || ''}"></div></div><div class="form-field"><label for="project-tags">Tags</label><input id="project-tags" value="${esc((project.tags || []).join(', '))}"></div>${archivedHeadings.length ? `<div class="settings-section"><h3>Archived headings</h3><div class="button-row">${archivedHeadings.map((heading) => `<button class="button" type="button" data-restore-heading="${heading.id}">Restore ${esc(heading.title)}</button>`).join('')}</div></div>` : ''}<div class="settings-section"><h3>Repeat</h3>${project.repeat ? `<div class="repeat-grid"><select class="detail-select" data-project-repeat-field="mode"><option value="fixed" ${project.repeat.mode === 'fixed' ? 'selected' : ''}>On schedule</option><option value="afterCompletion" ${project.repeat.mode === 'afterCompletion' ? 'selected' : ''}>After completion</option></select><select class="detail-select" data-project-repeat-field="frequency"><option value="daily" ${project.repeat.frequency === 'daily' ? 'selected' : ''}>Day</option><option value="weekly" ${project.repeat.frequency === 'weekly' ? 'selected' : ''}>Week</option><option value="monthly" ${project.repeat.frequency === 'monthly' ? 'selected' : ''}>Month</option><option value="yearly" ${project.repeat.frequency === 'yearly' ? 'selected' : ''}>Year</option></select><input class="detail-input" type="number" min="1" data-project-repeat-field="interval" value="${project.repeat.interval || 1}" aria-label="Project repeat interval"><input class="detail-input" type="date" data-project-repeat-field="nextDate" value="${project.repeat.nextDate || addDays(localDay(), 7)}" aria-label="Project next occurrence"></div><button class="checklist-add" type="button" data-project-action="stop-repeat">Stop repeating</button>` : `<button class="button" type="button" data-project-action="repeat">Make project repeating…</button>`}</div><div class="settings-section button-row"><button class="button" type="button" data-project-action="duplicate">Duplicate project</button><button class="button" type="button" data-project-action="${project.status === 'completed' ? 'restore' : 'complete'}">${project.status === 'completed' ? 'Restore project' : 'Complete project'}</button><button class="danger-button" type="button" data-project-action="delete">${icon('trash')} Delete project</button></div><div class="form-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Save</button></div></form></div>`;
  $('[data-cancel]').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  $('#project-form').addEventListener('submit', (event) => {
    event.preventDefault();
    project.title = $('#project-title').value.trim() || project.title;
    project.notes = $('#project-notes').value.trim();
    project.areaId = $('#project-area').value || null;
    project.scheduledFor = $('#project-start').value || null;
    project.deadline = $('#project-deadline').value || null;
    project.tags = $('#project-tags').value.split(',').map((value) => value.trim()).filter(Boolean);
    $$('[data-project-repeat-field]').forEach((field) => { project.repeat[field.dataset.projectRepeatField] = field.dataset.projectRepeatField === 'interval' ? Math.max(1, Number(field.value) || 1) : field.value; });
    if (project.repeat) project.repeat.deadlineOffset = dayDistance(project.repeat.nextDate, project.deadline);
    ui.state.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.areaId = project.areaId; });
    scheduleSave(); closeModal(); render();
  });
  $$('[data-restore-heading]').forEach((button) => button.addEventListener('click', () => {
    const heading = ui.state.headings.find((item) => item.id === button.dataset.restoreHeading);
    if (heading) heading.archived = false;
    scheduleSave(); closeModal(); render(); showToast('Heading restored');
  }));
  $$('[data-project-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.projectAction;
    if (action === 'delete') {
      confirmAction('Delete this project?', 'Its to-dos will be kept as standalone items.', 'Delete project', () => {
        ui.state.projects = ui.state.projects.filter((item) => item.id !== project.id);
        ui.state.headings = ui.state.headings.filter((item) => item.projectId !== project.id);
        ui.state.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.projectId = null; task.headingId = null; });
        scheduleSave(); setView('inbox'); showToast('Project deleted; its to-dos were kept');
      });
      return;
    }
    if (action === 'complete') {
      project.status = 'completed'; project.completedAt = new Date().toISOString(); project.loggedAt = null;
      ui.state.tasks.filter((task) => task.projectId === project.id && task.status === 'open' && !task.repeat).forEach((task) => { task.status = 'completed'; task.completedAt = project.completedAt; task.loggedAt = null; task.completedWithProjectId = project.id; });
      if (project.repeatTemplateId) {
        const template = projectById(project.repeatTemplateId);
        if (template?.repeat?.mode === 'afterCompletion') template.repeat.nextDate = nextRepeatDate(localDay(), template.repeat);
      }
      applyLogbookPolicy();
      setView(isLogged(project) ? 'loggedProjects' : 'project', isLogged(project) ? null : project.id); showToast('Project completed');
    } else if (action === 'restore') {
      project.status = 'open'; project.completedAt = null; project.loggedAt = null;
      ui.state.tasks.filter((task) => task.completedWithProjectId === project.id).forEach((task) => { task.status = 'open'; task.completedAt = null; task.loggedAt = null; task.completedWithProjectId = null; });
      setView('project', project.id); showToast('Project restored');
    } else if (action === 'repeat') {
      const nextDate = project.scheduledFor || addDays(localDay(), 7);
      project.repeat = { mode: 'fixed', frequency: 'weekly', interval: 1, nextDate, deadlineOffset: dayDistance(nextDate, project.deadline), paused: false };
      setView('repeating'); showToast('Repeating project template created');
    } else if (action === 'stop-repeat') {
      project.repeat = null; setView('project', project.id); showToast('Project stopped repeating');
    } else {
      duplicateProject(project);
    }
    scheduleSave(); closeModal(); render();
  }));
}

function duplicateProject(project) {
  const copy = { ...project, id: uid('project'), title: `${project.title} copy`, status: 'open', completedAt: null, loggedAt: null, order: ui.state.projects.length };
  ui.state.projects.push(copy);
  const headingMap = new Map();
  ui.state.headings.filter((heading) => heading.projectId === project.id).forEach((heading) => {
    const duplicate = { ...heading, id: uid('heading'), projectId: copy.id };
    headingMap.set(heading.id, duplicate.id); ui.state.headings.push(duplicate);
  });
  ui.state.tasks.filter((task) => task.projectId === project.id && task.status !== 'cancelled').forEach((task) => ui.state.tasks.push({ ...task, id: uid('task'), projectId: copy.id, headingId: headingMap.get(task.headingId) || null, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, checklist: task.checklist.map((item) => ({ ...item, id: uid('check'), done: false })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() }));
  setView('project', copy.id); showToast('Project duplicated');
}

function openAreaModal(areaId) {
  const area = areaById(areaId);
  if (!area) return;
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><form id="area-form" class="modal form-modal" role="dialog" aria-modal="true"><h2>Area options</h2><p>Areas represent ongoing responsibilities that do not finish.</p><div class="form-field"><label for="area-title">Name</label><input id="area-title" required value="${esc(area.title)}"></div><div class="form-field"><label for="area-color">Color</label><input id="area-color" type="color" value="${esc(area.color || '#5b7cfa')}"></div><div class="form-field"><label for="area-tags">Tags inherited by its to-dos</label><input id="area-tags" value="${esc((area.tags || []).join(', '))}"></div><div class="settings-section button-row"><button class="danger-button" type="button" data-area-delete>${icon('trash')} Delete area</button></div><div class="form-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Save</button></div></form></div>`;
  $('[data-cancel]').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  $('#area-form').addEventListener('submit', (event) => { event.preventDefault(); area.title = $('#area-title').value.trim() || area.title; area.color = $('#area-color').value; area.tags = $('#area-tags').value.split(',').map((value) => value.trim()).filter(Boolean); scheduleSave(); closeModal(); render(); });
  $('[data-area-delete]').addEventListener('click', () => {
    confirmAction('Delete this area?', 'Its projects and to-dos will be kept.', 'Delete area', () => {
      ui.state.areas = ui.state.areas.filter((item) => item.id !== area.id);
      ui.state.projects.filter((project) => project.areaId === area.id).forEach((project) => { project.areaId = null; });
      ui.state.tasks.filter((task) => task.areaId === area.id).forEach((task) => { task.areaId = task.projectId ? projectById(task.projectId)?.areaId || null : null; });
      scheduleSave(); setView('inbox'); showToast('Area deleted; its projects and to-dos were kept');
    });
  });
}

function openSettings() {
  const settings = ui.state.settings;
  const pwa = getPwaStatus();
  const pendingLogCount = [...ui.state.tasks, ...ui.state.projects].filter(isCompletedButVisible).length;
  const logbookHelp = settings.logCompletedItems === 'immediately' ? 'Completed items move to the Logbook as soon as they are checked.' : settings.logCompletedItems === 'manually' ? 'Completed items stay in their original lists until you log them.' : 'Completed items stay visible for the rest of the day and move to the Logbook after midnight.';
  const installLabel = pwa.installed ? 'Installed' : pwa.canPromptInstall ? 'Install Objects' : 'Installation help';
  const installHelp = pwa.installed ? 'Objects is running as an installed app.' : pwa.ios ? 'On iPhone or iPad, use Share → Add to Home Screen. Notifications are available only after installation.' : 'Install from this button when available, or use your browser’s Install app / Add to Home Screen menu.';
  const notificationLabel = pwa.notificationPermission === 'unsupported' ? 'Not supported here' : pwa.notificationPermission === 'denied' ? 'Blocked in browser settings' : settings.notifications && pwa.notificationPermission === 'granted' ? 'Disable notifications' : 'Enable notifications';
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><div class="modal form-modal settings-modal" role="dialog" aria-modal="true" aria-label="Settings"><h2>Settings</h2><p>Make Objects fit your workflow and connect it to the rest of your system.</p><div class="settings-section account-section"><h3>Lakebed account</h3><div class="settings-row"><span>Signed in as <strong>${esc(ui.user?.displayName || 'Guest')}</strong></span><button class="button" type="button" data-settings-action="logout">Sign out</button></div></div><div class="settings-section"><h3>General</h3><div class="settings-row"><label for="setting-group">Group Today by project or area</label><input id="setting-group" type="checkbox" ${settings.groupToday ? 'checked' : ''}></div><div class="settings-row"><label for="setting-calendar">Show calendar events</label><input id="setting-calendar" type="checkbox" ${settings.showCalendar ? 'checked' : ''}></div><div class="settings-row"><label for="setting-theme">Appearance</label><select id="setting-theme" class="detail-select"><option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option></select></div></div><div class="settings-section"><h3>Logbook</h3><p>${esc(logbookHelp)}</p><div class="settings-row"><label for="setting-logbook">Log completed items</label><select id="setting-logbook" class="detail-select"><option value="immediately" ${settings.logCompletedItems === 'immediately' ? 'selected' : ''}>Immediately</option><option value="daily" ${settings.logCompletedItems === 'daily' ? 'selected' : ''}>Daily</option><option value="manually" ${settings.logCompletedItems === 'manually' ? 'selected' : ''}>Manually</option></select></div>${pendingLogCount ? `<button class="button" type="button" data-settings-action="log-now">Log Completed Now (${pendingLogCount})</button>` : ''}</div><div class="settings-section"><h3>App</h3><p>${esc(installHelp)}</p><div class="settings-row"><span>Install status</span><button class="button" type="button" data-settings-action="install" ${pwa.installed ? 'disabled' : ''}>${esc(installLabel)}</button></div>${pwa.updateAvailable ? '<button class="button primary" type="button" data-settings-action="update">Update Objects</button>' : ''}</div><div class="settings-section"><h3>Reminders</h3><p>Notifications work on desktop and mobile, including notification taps that reopen the task. Scheduled reminders are reliable while Objects is open; closed-app delivery needs a server push scheduler.</p><button class="button" type="button" data-settings-action="notifications" ${pwa.notificationPermission === 'denied' ? 'disabled' : ''}>${esc(notificationLabel)}</button></div><div class="settings-section"><h3>Calendar</h3><p>Add an event manually or import a standard .ics calendar file. Events remain private in your Objects data.</p><div class="form-field"><label for="event-title">Event</label><input id="event-title" placeholder="Event title"></div><div class="repeat-grid"><div class="form-field"><label for="event-start">Starts</label><input id="event-start" type="datetime-local"></div><div class="form-field"><label for="event-end">Ends</label><input id="event-end" type="datetime-local"></div></div><div class="button-row"><button class="button" type="button" data-settings-action="add-event">Add event</button><label class="button" for="ics-import">Import .ics</label><input class="hidden-file" id="ics-import" type="file" accept=".ics,text/calendar"></div></div><div class="settings-section"><h3>Data</h3><p>Export a complete backup or import one from another Objects installation.</p><div class="button-row"><button class="button" type="button" data-settings-action="export">${icon('download')} Export JSON</button><label class="button" for="json-import">${icon('upload')} Import JSON</label><input class="hidden-file" id="json-import" type="file" accept="application/json,.json"></div></div><div class="settings-section"><h3>Automation</h3><p>Open <code>/?title=Call%20Maya%20tomorrow</code> while signed in, or use the authenticated <code>POST /api/tasks</code> Lakebed endpoint.</p></div><div class="form-actions"><button class="button primary" type="button" data-cancel>Done</button></div></div></div>`;
  $('[data-cancel]').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  $('#setting-group').addEventListener('change', (event) => { settings.groupToday = event.target.checked; scheduleSave(); render(); });
  $('#setting-calendar').addEventListener('change', (event) => { settings.showCalendar = event.target.checked; scheduleSave(); renderContent(); });
  $('#setting-theme').addEventListener('change', (event) => { settings.theme = event.target.value; applyTheme(); scheduleSave(); });
  $$('[data-settings-action]').forEach((button) => button.addEventListener('click', () => handleSettingsAction(button.dataset.settingsAction)));
  $('#json-import').addEventListener('change', importJsonFile);
  $('#ics-import').addEventListener('change', importIcsFile);
  bindLogbookSettings(settings);
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
  if (action === 'add-event') {
    const title = $('#event-title').value.trim();
    const start = $('#event-start').value;
    const end = $('#event-end').value || start;
    if (!title || !start) { showToast('Add an event title and start time'); return; }
    if (end < start) { showToast('The event end must be after its start'); return; }
    ui.state.calendarEvents.push({ id: uid('event'), title, start, end, calendar: 'Objects', allDay: false });
    scheduleSave(); showToast('Calendar event added'); openSettings();
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
      confirmAction('Replace all Objects data?', 'The imported backup will replace the current tasks, projects, areas, settings, and calendar events.', 'Import backup', () => {
        ui.state = state; normalizeState(); scheduleSave(); setView('today'); showToast('Backup imported');
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
      const event = { id, title: title.replace(/\\,/g, ',').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\'), start, end, calendar: 'Imported', allDay: /^\d{8}$/.test(startRaw) };
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

function closeModal() { $('#modal-root').innerHTML = ''; }

function confirmAction(title, message, label, onConfirm) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-close><div class="modal form-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">${esc(title)}</h2><p>${esc(message)}</p><div class="form-actions"><button class="button" type="button" data-confirm-cancel>Cancel</button><button class="button primary" type="button" data-confirm-accept>${esc(label)}</button></div></div></div>`;
  $('[data-confirm-cancel]').addEventListener('click', closeModal);
  $('[data-confirm-accept]').addEventListener('click', () => { closeModal(); onConfirm(); });
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target.hasAttribute('data-modal-close')) closeModal(); });
  setTimeout(() => $('[data-confirm-cancel]')?.focus(), 20);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    if ($('#modal-root').children.length) closeModal();
    else if (ui.selectedTaskId) closeInspector();
    else closeSidebar();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); openSearch(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && ui.selectedTaskId) { event.preventDefault(); toggleTask(ui.selectedTaskId); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && ui.selectedTaskId) { event.preventDefault(); const task = currentTask(); const copy = { ...task, id: uid('task'), title: `${task.title} copy`, status: 'open', completedAt: null, loggedAt: null, completedWithProjectId: null, reminderSentAt: null, repeatTemplateId: null, createdAt: new Date().toISOString(), order: Date.now(), checklist: task.checklist.map((item) => ({ ...item, id: uid('check') })) }; ui.state.tasks.push(copy); selectTask(copy.id); scheduleSave(); showToast('To-do duplicated'); return; }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n' && ui.view.type === 'project') { event.preventDefault(); openHeadingModal(); return; }
  if (!event.metaKey && !event.ctrlKey && !event.altKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); beginQuickAdd(true); }
    if (event.key === '/') { event.preventDefault(); openSearch(); }
  }
}

function markSaving(state = 'saving') {
  const dot = $('#sync-state');
  if (dot) dot.className = `sync-state ${state}`;
}

function scheduleSave(renderAfter = false) {
  markSaving();
  clearTimeout(ui.saveTimer);
  ui.saveTimer = setTimeout(async () => {
    ui.saveTimer = null;
    try {
      ui.state.updatedAt = new Date().toISOString();
      const updatedAt = await persistState(JSON.stringify(ui.state));
      if (updatedAt) ui.state.updatedAt = updatedAt;
      markSaving('');
      if (renderAfter) render();
    } catch (error) {
      markSaving('error');
      showToast('Could not save changes');
    }
  }, 350);
}

function showToast(message, actionLabel, action) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  if (actionLabel) $('button', toast).addEventListener('click', () => { action(); toast.remove(); });
  $('#toast-region').append(toast);
  setTimeout(() => toast.remove(), 4200);
}
