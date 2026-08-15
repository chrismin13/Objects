/**
 * CalDAV ↔ Workspace domain mapping.
 *
 * One list per Project, one per Area, plus the special Inbox list for
 * unfiled to-dos. Resources are `<uuid>.ics`, allocated at first render and
 * stable for the to-do's lifetime. All inbound writes become typed
 * `WorkspaceChange`s (see ADR 0002); the failure mode of any bug here is
 * staleness, never corruption.
 */

import type { IsoDateTime, ToDo, ToDoLocation, WorkspaceDocument } from "../model.ts";
import { icsUtc, renderVTodo, vtodoEtag, type IcsDue, type ParsedVTodo } from "./ics.ts";

export const CALDAV_INBOX = "inbox";

export type CalDavListContainer =
  | { kind: "inbox" }
  | { kind: "project"; id: string }
  | { kind: "area"; id: string };

export type CalDavList = {
  name: string;
  displayName: string;
  color: string;
  container: CalDavListContainer;
};

export type CalDavAnchorFields = {
  title: string;
  notes: string;
  due: IcsDue | null;
  status: "NEEDS-ACTION" | "COMPLETED";
  categories: string[];
  reminder: { date: string; time: string } | null;
};

export type CalDavAnchor = {
  resource: string;
  toDoId: string;
  /** Path segment of the list the resource was last served in. */
  list: string;
  /** Last-served field values — the merge base for inbound PUTs. */
  served: CalDavAnchorFields;
};

export type CalDavTombstone = { resource: string; revision: number };

const PROJECT_LIST = /^project-([A-Za-z0-9_-]+)$/;
const AREA_LIST = /^area-([A-Za-z0-9_-]+)$/;

export function listNameForContainer(container: CalDavListContainer): string {
  if (container.kind === "inbox") return CALDAV_INBOX;
  return container.kind === "project" ? `project-${container.id}` : `area-${container.id}`;
}

function containerForListName(name: string): CalDavListContainer | null {
  if (name === CALDAV_INBOX) return { kind: "inbox" };
  const project = PROJECT_LIST.exec(name);
  if (project) return { kind: "project", id: project[1] };
  const area = AREA_LIST.exec(name);
  if (area) return { kind: "area", id: area[1] };
  return null;
}

/** The lists exposed in the home set: Inbox, live Projects, live Areas. */
export function calDavLists(
  document: WorkspaceDocument,
  scopeSpaceId: string | null = null,
): CalDavList[] {
  if (scopeSpaceId !== null && !document.spaces.some((space) => space.id === scopeSpaceId))
    return [];
  const lists: CalDavList[] = [
    { name: CALDAV_INBOX, displayName: "Inbox", color: "#8e8e93", container: { kind: "inbox" } },
  ];
  const spaceColor = (spaceId: string | null | undefined) =>
    document.spaces.find((space) => space.id === spaceId)?.color ?? "#8e8e93";
  for (const project of [...document.projects].sort((left, right) => left.order - right.order)) {
    if (project.trashedAt) continue;
    const projectLocation = project.location;
    const spaceId =
      projectLocation.kind === "space"
        ? projectLocation.spaceId
        : (document.areas.find((area) => area.id === projectLocation.areaId)?.spaceId ?? null);
    if (scopeSpaceId !== null && spaceId !== scopeSpaceId) continue;
    lists.push({
      name: listNameForContainer({ kind: "project", id: project.id }),
      displayName: project.title,
      color: spaceColor(spaceId),
      container: { kind: "project", id: project.id },
    });
  }
  for (const area of [...document.areas].sort((left, right) => left.order - right.order)) {
    const space = document.spaces.find((candidate) => candidate.id === area.spaceId);
    if (!space || (scopeSpaceId !== null && space.id !== scopeSpaceId)) continue;
    lists.push({
      name: listNameForContainer({ kind: "area", id: area.id }),
      displayName: area.title,
      color: space.color,
      container: { kind: "area", id: area.id },
    });
  }
  return lists;
}

export function calDavList(
  document: WorkspaceDocument,
  name: string,
  scopeSpaceId: string | null = null,
): CalDavList | null {
  if (!containerForListName(name)) return null;
  return calDavLists(document, scopeSpaceId).find((list) => list.name === name) ?? null;
}

/**
 * The list a to-do belongs in: its resolved Project or Area, or Inbox for
 * unfiled to-dos. Heading-parented to-dos render in their Project/Area list.
 * Returns null when the to-do or its container chain is trashed or missing.
 */
export function listNameForToDo(document: WorkspaceDocument, toDo: ToDo): string | null {
  if (toDo.trashedAt) return null;
  const location = toDo.location;
  if (location.kind === "unfiled") return CALDAV_INBOX;
  if (location.kind === "project") {
    const project = document.projects.find((item) => item.id === location.projectId);
    if (!project || project.trashedAt) return null;
    return listNameForContainer({ kind: "project", id: project.id });
  }
  if (location.kind === "area") {
    const area = document.areas.find((item) => item.id === location.areaId);
    if (!area) return null;
    return listNameForContainer({ kind: "area", id: area.id });
  }
  const heading = document.headings.find((item) => item.id === location.headingId);
  if (!heading) return null;
  const headingLocation = heading.location;
  if (headingLocation.kind === "project") {
    const project = document.projects.find((item) => item.id === headingLocation.projectId);
    if (!project || project.trashedAt) return null;
    return listNameForContainer({ kind: "project", id: project.id });
  }
  const area = document.areas.find((item) => item.id === headingLocation.areaId);
  if (!area) return null;
  return listNameForContainer({ kind: "area", id: area.id });
}

/** Members of a list: live to-dos whose Location resolves to the container. */
export function toDosInList(
  document: WorkspaceDocument,
  list: CalDavList,
  scopeSpaceId: string | null = null,
): ToDo[] {
  return document.toDos
    .filter(
      (toDo) =>
        listNameForToDo(document, toDo) === list.name &&
        (scopeSpaceId === null ||
          list.container.kind !== "inbox" ||
          (toDo.location.kind === "unfiled" && toDo.location.spaceId === scopeSpaceId)),
    )
    .sort((left, right) => left.order - right.order);
}

/** Outbound field values for a to-do — also the anchor's served shape. */
export function servedFieldsFor(document: WorkspaceDocument, toDo: ToDo): CalDavAnchorFields {
  let due: IcsDue | null = null;
  let reminder: { date: string; time: string } | null = null;
  if (toDo.schedule.kind === "scheduled") {
    due = { date: toDo.schedule.date, time: null };
    if (toDo.reminder && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(toDo.reminder.at)) {
      reminder = { date: toDo.reminder.at.slice(0, 10), time: toDo.reminder.at.slice(11, 19) };
      // A timed to-do renders its DUE at the reminder's wall time.
      due = { date: reminder.date, time: reminder.time };
    }
  }
  return {
    title: toDo.title,
    notes: toDo.notes,
    due,
    status: toDo.outcome === "open" ? "NEEDS-ACTION" : "COMPLETED",
    categories: toDo.tags
      .map((tagId) => document.tags.find((tag) => tag.id === tagId)?.title ?? "")
      .filter(Boolean),
    reminder,
  };
}

export type RenderedResource = {
  body: string;
  etag: string;
  served: CalDavAnchorFields;
};

/** Deterministic render of a to-do as a VTODO resource. */
export function renderToDoResource(
  document: WorkspaceDocument,
  toDo: ToDo,
  resource: string,
  stampUtc: string,
): RenderedResource {
  const served = servedFieldsFor(document, toDo);
  const body = renderVTodo({
    uid: resource.replace(/\.ics$/, ""),
    title: served.title,
    notes: served.notes,
    due: served.due,
    status: served.status,
    completedUtc: toDo.completedAt ? icsUtc(toDo.completedAt) : null,
    percentComplete: toDo.outcome === "completed",
    categories: served.categories,
    reminder: served.reminder,
    createdAtUtc: icsUtc(toDo.createdAt) ?? "19700101T000000Z",
    stampUtc,
  });
  return { body, etag: vtodoEtag(body), served };
}

function reminderFromAlarm(parsed: ParsedVTodo): string | null {
  const alarm = parsed.alarm;
  if (!alarm) return null;
  if (alarm.kind === "absolute") return `${alarm.date}T${alarm.time}.000Z`;
  if (alarm.kind === "relative" && parsed.due?.time) {
    const [hour, minute, second] = parsed.due.time.split(":").map(Number);
    const shifted = new Date(
      Date.parse(`${parsed.due.date}T00:00:00.000Z`) +
        alarm.seconds * 1_000 +
        hour * 3_600_000 +
        minute * 60_000 +
        second * 1_000,
    );
    return `${shifted.toISOString().slice(0, 19)}.000Z`;
  }
  return null;
}

type InboundSchedule = {
  schedule: { kind: "inbox" } | { kind: "scheduled"; date: string; evening: false };
  reminderAt: string | null;
};

/**
 * Maps an inbound DUE (and, for dateless items, an absolute alarm) to a
 * Schedule plus Reminder. Floating/TZID times are stored as wall-time
 * fake-UTC (ADR 0003); a timed DUE is the time carrier, so it always
 * produces a Reminder.
 */
function scheduleFromParsed(parsed: ParsedVTodo): InboundSchedule {
  if (!parsed.due) {
    // Apple's Siri form: dateless DUE with an absolute trigger — the alarm
    // carries the schedule.
    const fromAlarm = reminderFromAlarm(parsed);
    if (fromAlarm)
      return {
        schedule: { kind: "scheduled", date: fromAlarm.slice(0, 10), evening: false },
        reminderAt: fromAlarm,
      };
    return { schedule: { kind: "inbox" }, reminderAt: null };
  }
  if (!parsed.due.time)
    return {
      schedule: { kind: "scheduled", date: parsed.due.date, evening: false },
      reminderAt: null,
    };
  return {
    schedule: { kind: "scheduled", date: parsed.due.date, evening: false },
    reminderAt: `${parsed.due.date}T${parsed.due.time}.000Z`,
  };
}

/** The Workspace Location a list maps to (Inbox → unfiled in the scoped/default Space). */
export function locationForList(
  document: WorkspaceDocument,
  list: CalDavList,
  scopeSpaceId: string | null = null,
): ToDoLocation | null {
  const container = list.container;
  if (container.kind === "project") {
    return document.projects.some((project) => project.id === container.id && !project.trashedAt)
      ? { kind: "project", projectId: container.id }
      : null;
  }
  if (container.kind === "area") {
    return document.areas.some((area) => area.id === container.id)
      ? { kind: "area", areaId: container.id }
      : null;
  }
  const inboxSpaceId = scopeSpaceId ?? document.settings.defaultSpaceId;
  return inboxSpaceId ? { kind: "unfiled", spaceId: inboxSpaceId } : null;
}

export type InboundChange = {
  kind: "create" | "follow" | "change";
  change: Record<string, unknown>;
};

function anchorFieldsFromParsed(parsed: ParsedVTodo): CalDavAnchorFields {
  return {
    title: parsed.summary ?? "",
    notes: parsed.description ?? "",
    due: parsed.due,
    status: parsed.status === "COMPLETED" ? "COMPLETED" : "NEEDS-ACTION",
    categories: parsed.categories,
    reminder: null,
  };
}

function sameDue(left: IcsDue | null, right: IcsDue | null): boolean {
  return left?.date === right?.date && (left?.time ?? null) === (right?.time ?? null);
}

function sameCategories(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Builds the `WorkspaceChange`s for an inbound PUT, implementing the
 * per-field three-way merge ("Objects wins ties"):
 *
 * - phone value == anchor value → no-op (stale echoes cannot clobber newer
 *   Objects writes);
 * - phone value ≠ anchor → apply the phone's value;
 * - missing anchor → degrade to Objects-wins.
 *
 * The returned `served` becomes the new anchor: per field, the phone's value
 * when it was applied, otherwise the previous anchor value (what the phone
 * still holds).
 */
export function changesForInboundPut(
  document: WorkspaceDocument,
  anchor: CalDavAnchor | null,
  parsed: ParsedVTodo,
  list: CalDavList,
  scopeSpaceId: string | null = null,
): { changes: InboundChange[]; served: CalDavAnchorFields } {
  const location = locationForList(document, list, scopeSpaceId);

  if (!anchor) {
    // Create: PUT with If-None-Match:* on an unknown resource.
    const { schedule, reminderAt } = scheduleFromParsed(parsed);
    const changes: InboundChange[] = [
      {
        kind: "create",
        change: {
          type: "createToDo",
          title: parsed.summary?.trim() || "Untitled to-do",
          notes: parsed.description ?? "",
          location: location ?? undefined,
          schedule,
          reminderAt,
        },
      },
    ];
    if (parsed.status === "COMPLETED")
      changes.push({ kind: "follow", change: { type: "completeToDo", id: "" } });
    if (parsed.categories.length)
      changes.push({
        kind: "follow",
        change: { type: "setToDoTags", id: "", titles: parsed.categories },
      });
    return { changes, served: anchorFieldsFromParsed(parsed) };
  }

  const toDo = document.toDos.find((item) => item.id === anchor.toDoId);
  if (!toDo) return { changes: [], served: anchor.served };

  const served = anchor.served;
  const phoneTitle = parsed.summary ?? served.title;
  const phoneNotes = parsed.description ?? served.notes;
  const phoneDue = parsed.due ?? null;
  const phoneStatus = parsed.status === "COMPLETED" ? "COMPLETED" : "NEEDS-ACTION";
  const phoneCategories = parsed.categories;

  const changes: InboundChange[] = [];
  const nextServed: CalDavAnchorFields = { ...served };

  if (phoneTitle !== served.title) {
    changes.push({
      kind: "change",
      change: { type: "updateToDo", id: toDo.id, changes: { title: phoneTitle } },
    });
    nextServed.title = phoneTitle;
  }
  if (phoneNotes !== served.notes) {
    changes.push({
      kind: "change",
      change: { type: "updateToDo", id: toDo.id, changes: { notes: phoneNotes } },
    });
    nextServed.notes = phoneNotes;
  }
  if (!sameDue(phoneDue, served.due)) {
    const { schedule, reminderAt } = scheduleFromParsed(parsed);
    changes.push({
      kind: "change",
      change: {
        type: "updateToDo",
        id: toDo.id,
        changes: {
          schedule,
          reminder: reminderAt ? { at: reminderAt, sentAt: null } : null,
        },
      },
    });
    nextServed.due = phoneDue;
    nextServed.reminder = reminderAt
      ? { date: reminderAt.slice(0, 10), time: reminderAt.slice(11, 19) }
      : null;
  }
  if (phoneStatus !== served.status) {
    if (phoneStatus === "COMPLETED" && toDo.outcome === "open")
      changes.push({ kind: "change", change: { type: "completeToDo", id: toDo.id } });
    // Un-checking a canceled to-do is ignored (reopening canceled is
    // Objects-only); un-checking a completed one reopens.
    else if (phoneStatus === "NEEDS-ACTION" && toDo.outcome === "completed")
      changes.push({ kind: "change", change: { type: "reopenToDo", id: toDo.id } });
    nextServed.status = phoneStatus;
  }
  if (!sameCategories(phoneCategories, served.categories)) {
    changes.push({
      kind: "change",
      change: { type: "setToDoTags", id: toDo.id, titles: phoneCategories },
    });
    nextServed.categories = phoneCategories;
  }
  if (anchor.list !== list.name && location) {
    changes.push({
      kind: "change",
      change: { type: "updateToDo", id: toDo.id, changes: { location } },
    });
  }

  return { changes, served: nextServed };
}

/** ISO timestamp (iCalendar render clock) in `YYYYMMDDTHHMMSSZ` form. */
export function stampFor(now: IsoDateTime): string {
  return `${now.slice(0, 19).replace(/[-:]/g, "")}Z`;
}
