export type ObjectsState = {
  version: number;
  updatedAt: string;
  settings: Record<string, unknown>;
  spaces: Array<Record<string, unknown>>;
  areas: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  headings: Array<Record<string, unknown>>;
  calendarEvents: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
};

function isoDay(offset = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function isObjectsState(value: unknown): value is ObjectsState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ObjectsState>;
  return Array.isArray(state.tasks) && Array.isArray(state.projects) && Array.isArray(state.areas);
}

export function createSeed(): ObjectsState {
  const createdAt = new Date().toISOString();
  return {
    version: 7,
    updatedAt: "seed-v7",
    settings: { theme: "system", groupToday: true, notifications: false, weekStartsOn: 1, showCalendar: true, logCompletedItems: "daily", tags: ["Creative", "Deep work", "Errand", "Focused", "Home", "Quick"], defaultSpaceId: "space-personal", spaceSchedule: { enabled: false, rules: [{ id: "rule-work-weekdays", spaceId: "space-work", weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:30" }] } },
    spaces: [
      { id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 },
      { id: "space-work", title: "Work", color: "#5b7cfa", pinned: true, order: 1 }
    ],
    areas: [],
    projects: [
      { id: "project-launch", spaceId: "space-work", areaId: null, title: "Launch the new site", notes: "Everything needed for a quiet, confident launch.", bucket: "anytime", scheduledFor: null, deadline: isoDay(9), tags: ["Focused"], status: "open", completedAt: null, order: 0 },
      { id: "project-home", spaceId: "space-personal", areaId: null, title: "Refresh the studio", notes: "Make the room feel lighter and easier to use.", bucket: "anytime", scheduledFor: null, deadline: null, tags: ["Home"], status: "open", completedAt: null, order: 1 },
      { id: "project-trip", spaceId: "space-personal", areaId: null, title: "Weekend in Hydra", notes: "", bucket: "anytime", scheduledFor: null, deadline: isoDay(18), tags: [], status: "open", completedAt: null, order: 2 }
    ],
    headings: [{ id: "heading-launch-polish", projectId: "project-launch", title: "Final polish", archived: false, order: 0 }],
    calendarEvents: [{ id: "event-design-sync", spaceId: "space-work", title: "Design sync", start: `${isoDay()}T11:00:00`, end: `${isoDay()}T11:45:00`, calendar: "Work" }],
    tasks: [
      { id: "task-brief", spaceId: "space-work", title: "Review launch brief", notes: "Check the final scope with Maya before the afternoon sync.", status: "open", bucket: "today", scheduledFor: isoDay(), evening: false, reminderAt: null, deadline: isoDay(2), projectId: "project-launch", headingId: null, areaId: null, tags: ["Focused"], checklist: [{ id: "check-1", title: "Read final copy", done: true }, { id: "check-2", title: "Confirm analytics events", done: false }], repeat: null, createdAt, completedAt: null, order: 0 },
      { id: "task-prototype", spaceId: "space-work", title: "Polish mobile prototype", notes: "", status: "open", bucket: "today", scheduledFor: isoDay(), evening: false, reminderAt: null, deadline: null, projectId: "project-launch", headingId: "heading-launch-polish", areaId: null, tags: ["Deep work"], checklist: [], repeat: null, createdAt, completedAt: null, order: 1 },
      { id: "task-groceries", spaceId: "space-personal", title: "Pick up groceries", notes: "Olive oil, lemons, sourdough, coffee.", status: "open", bucket: "today", scheduledFor: isoDay(), evening: true, reminderAt: null, deadline: null, projectId: null, headingId: null, areaId: null, tags: ["Errand"], checklist: [], repeat: null, createdAt, completedAt: null, order: 2 },
      { id: "task-inbox", spaceId: "space-personal", title: "Book a table for Friday", notes: "", status: "open", bucket: "inbox", scheduledFor: null, evening: false, reminderAt: null, deadline: null, projectId: null, headingId: null, areaId: null, tags: [], checklist: [], repeat: null, createdAt, completedAt: null, order: 3 },
      { id: "task-photos", spaceId: "space-work", title: "Select homepage photography", notes: "", status: "open", bucket: "upcoming", scheduledFor: isoDay(1), evening: false, reminderAt: null, deadline: isoDay(4), projectId: "project-launch", headingId: null, areaId: null, tags: ["Creative"], checklist: [], repeat: null, createdAt, completedAt: null, order: 4 },
      { id: "task-shelf", spaceId: "space-personal", title: "Measure wall for the new shelf", notes: "", status: "open", bucket: "upcoming", scheduledFor: isoDay(3), evening: false, reminderAt: null, deadline: null, projectId: "project-home", headingId: null, areaId: null, tags: ["Home"], checklist: [], repeat: null, createdAt, completedAt: null, order: 5 },
      { id: "task-ferry", spaceId: "space-personal", title: "Check ferry times", notes: "", status: "open", bucket: "anytime", scheduledFor: null, evening: false, reminderAt: null, deadline: isoDay(14), projectId: "project-trip", headingId: null, areaId: null, tags: ["Quick"], checklist: [], repeat: null, createdAt, completedAt: null, order: 6 },
      { id: "task-chair", spaceId: "space-personal", title: "Find a reading chair", notes: "Something compact, warm, and comfortable.", status: "open", bucket: "someday", scheduledFor: null, evening: false, reminderAt: null, deadline: null, projectId: "project-home", headingId: null, areaId: null, tags: ["Home"], checklist: [], repeat: null, createdAt, completedAt: null, order: 7 },
      { id: "task-weekly-review-template", spaceId: "space-work", title: "Weekly review", notes: "Clear the Inbox, scan every project, and choose next week’s priorities.", status: "open", bucket: "upcoming", scheduledFor: isoDay(5), evening: false, reminderAt: null, deadline: null, projectId: null, headingId: null, areaId: null, tags: ["Focused"], checklist: [{ id: "check-review-1", title: "Process Inbox", done: false }, { id: "check-review-2", title: "Review projects", done: false }], repeat: { mode: "fixed", frequency: "weekly", interval: 1, weekdays: [], nextDate: isoDay(5), reminderTime: "09:00", paused: false }, createdAt, completedAt: null, order: 8 },
      { id: "task-done", spaceId: "space-work", title: "Send weekly update", notes: "", status: "completed", bucket: "today", scheduledFor: isoDay(-1), evening: false, reminderAt: null, deadline: null, projectId: "project-launch", headingId: null, areaId: null, tags: [], checklist: [], repeat: null, createdAt, completedAt: new Date(Date.now() - 86400000).toISOString(), loggedAt: new Date(Date.now() - 86400000).toISOString(), order: 9 }
    ]
  };
}

export function addCapturedTask(state: ObjectsState, input: Record<string, unknown>): Record<string, unknown> {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 500) : "";
  if (!title) throw new Error("A title is required");
  const scheduledFor = typeof input.scheduledFor === "string" ? input.scheduledFor : null;
  const projectId = typeof input.projectId === "string" ? input.projectId : null;
  const areaId = typeof input.areaId === "string" ? input.areaId : null;
  const project = state.projects.find((item) => item.id === projectId);
  const area = state.areas.find((item) => item.id === areaId);
  const requestedSpaceId = typeof input.spaceId === "string" ? input.spaceId : null;
  const defaultSpaceId = typeof state.settings.defaultSpaceId === "string" ? state.settings.defaultSpaceId : null;
  const bucket = typeof input.bucket === "string" ? input.bucket : scheduledFor ? (scheduledFor <= isoDay() ? "today" : "upcoming") : projectId || areaId ? "anytime" : "inbox";
  const checklist = Array.isArray(input.checklist) ? input.checklist.slice(0, 200).map((item, index) => {
    if (typeof item === "string") return { id: `check-${Date.now().toString(36)}-${index}`, title: item.slice(0, 1000), done: false };
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { id: `check-${Date.now().toString(36)}-${index}`, title: typeof value.title === "string" ? value.title.slice(0, 1000) : "", done: Boolean(value.done) };
  }).filter((item) => item.title.trim()) : [];
  const task = {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    notes: typeof input.notes === "string" ? input.notes.slice(0, 20000) : "",
    status: "open",
    bucket,
    scheduledFor,
    evening: Boolean(input.evening),
    reminderAt: typeof input.reminderAt === "string" ? input.reminderAt : null,
    deadline: typeof input.deadline === "string" ? input.deadline : null,
    projectId,
    headingId: typeof input.headingId === "string" ? input.headingId : null,
    areaId: areaId ?? (typeof project?.areaId === "string" ? project.areaId : null),
    spaceId: requestedSpaceId ?? (typeof project?.spaceId === "string" ? project.spaceId : null) ?? (typeof area?.spaceId === "string" ? area.spaceId : null) ?? defaultSpaceId,
    tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 50) : [],
    checklist,
    repeat: input.repeat && typeof input.repeat === "object" ? input.repeat : null,
    createdAt: new Date().toISOString(), completedAt: null, loggedAt: null, order: Date.now()
  };
  state.tasks.push(task);
  state.updatedAt = new Date().toISOString();
  return task;
}
