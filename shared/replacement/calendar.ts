import type { CalendarEvent, Project, ToDo, WorkspaceDocument } from "./model.ts";
import { effectiveTagIdsForProject, effectiveTagIdsForToDo, spaceIdForProject, spaceIdForToDo } from "./location.ts";

export type ParsedIcsEvent = Omit<CalendarEvent, "id" | "spaceId"> & { uid: string | null };
export type IcsParseResult = { status: "parsed"; events: ParsedIcsEvent[] } | { status: "rejected"; errors: string[] };

export type AgendaView = { kind: "today" | "tomorrow" | "upcoming"; date: string };
export type AgendaItem =
  | { kind: "calendarEvent"; id: string; title: string; date: string; sortTime: string; actionable: false; item: CalendarEvent }
  | { kind: "project"; id: string; title: string; date: string; sortTime: string; actionable: true; item: Project }
  | { kind: "toDo"; id: string; title: string; date: string; sortTime: string; actionable: true; item: ToDo };

type IcsProperty = { name: string; params: Map<string, string>; value: string };

function unfoldIcs(source: string): string[] {
  const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  return unfolded;
}

function property(line: string): IcsProperty | null {
  const separator = line.indexOf(":");
  if (separator < 1) return null;
  const [name, ...rawParams] = line.slice(0, separator).split(";");
  const params = new Map<string, string>();
  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf("=");
    if (equals > 0) params.set(rawParam.slice(0, equals).toUpperCase(), rawParam.slice(equals + 1));
  }
  return { name: name.toUpperCase(), params, value: line.slice(separator + 1) };
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\[nN]/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function validDateParts(year: number, month: number, day: number, hour: number, minute: number, second: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function timeZoneParts(date: Date, timeZone: string): number[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = new Map<string, string>(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return ["year", "month", "day", "hour", "minute", "second"].map((name) => Number(parts.get(name)));
}

function zonedDateTimeToIso(parts: number[], timeZone: string): string | null {
  const [year, month, day, hour, minute, second] = parts;
  if (!validDateParts(year, month, day, hour, minute, second)) return null;
  try {
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    let instant = desired;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = timeZoneParts(new Date(instant), timeZone);
      const actualValue = Date.UTC(actual[0], actual[1] - 1, actual[2], actual[3], actual[4], actual[5]);
      const correction = desired - actualValue;
      instant += correction;
      if (correction === 0) break;
    }
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

function parseIcsDateTime(item: IcsProperty): { iso: string; allDay: boolean } | null {
  const allDay = item.params.get("VALUE")?.toUpperCase() === "DATE" || /^\d{8}$/.test(item.value);
  if (allDay) {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(item.value);
    if (!match) return null;
    const parts = match.slice(1).map(Number);
    if (!validDateParts(parts[0], parts[1], parts[2], 0, 0, 0)) return null;
    return { iso: new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString(), allDay: true };
  }
  const isUtc = item.value.endsWith("Z");
  const rawValue = isUtc ? item.value.slice(0, -1) : item.value;
  const [datePart, timePart, extraPart] = rawValue.split("T");
  const validShape = extraPart === undefined
    && datePart?.length === 8
    && (timePart?.length === 4 || timePart?.length === 6)
    && [...datePart, ...timePart].every((character) => character >= "0" && character <= "9");
  if (!validShape) return null;
  const parts = [
    datePart.slice(0, 4),
    datePart.slice(4, 6),
    datePart.slice(6, 8),
    timePart.slice(0, 2),
    timePart.slice(2, 4),
    timePart.slice(4, 6) || "0",
  ].map(Number);
  const timeZone = isUtc ? "UTC" : item.params.get("TZID") ?? "UTC";
  const iso = zonedDateTimeToIso(parts, timeZone);
  return iso ? { iso, allDay: false } : null;
}

function addOneDay(iso: string): string {
  return new Date(Date.parse(iso) + 86_400_000).toISOString();
}

export function parseIcsCalendar(source: string): IcsParseResult {
  const lines = unfoldIcs(source);
  if (!lines.some((line) => line.trim().toUpperCase() === "BEGIN:VCALENDAR")) return { status: "rejected", errors: ["This file is not an ICS calendar."] };
  const calendarName = lines.map(property).find((item) => item?.name === "X-WR-CALNAME")?.value || "Imported";
  const blocks: IcsProperty[][] = [];
  let current: IcsProperty[] | null = null;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") { current = []; continue; }
    if (upper === "END:VEVENT") { if (current) blocks.push(current); current = null; continue; }
    const parsed = property(line);
    if (current && parsed) current.push(parsed);
  }
  if (!blocks.length) return { status: "rejected", errors: ["The ICS calendar does not contain any events."] };

  const events: ParsedIcsEvent[] = [];
  const errors: string[] = [];
  const seenUids = new Set<string>();
  const seenEvents = new Set<string>();
  blocks.forEach((block, index) => {
    const label = `Event ${index + 1}`;
    const title = unescapeIcsText(block.find((item) => item.name === "SUMMARY")?.value ?? "").trim();
    const uid = block.find((item) => item.name === "UID")?.value.trim() || null;
    const start = block.find((item) => item.name === "DTSTART");
    const end = block.find((item) => item.name === "DTEND");
    if (!title) errors.push(`${label} has no title.`);
    if (!start) errors.push(`${label} has no start date.`);
    const parsedStart = start ? parseIcsDateTime(start) : null;
    const parsedEnd = end ? parseIcsDateTime(end) : parsedStart ? { iso: parsedStart.allDay ? addOneDay(parsedStart.iso) : parsedStart.iso, allDay: parsedStart.allDay } : null;
    if (start && !parsedStart) errors.push(`${label} has an invalid start date or time zone.`);
    if (end && !parsedEnd) errors.push(`${label} has an invalid end date or time zone.`);
    const invalidRange = parsedStart && parsedEnd && (Date.parse(parsedEnd.iso) < Date.parse(parsedStart.iso)
      || parsedStart.allDay && Date.parse(parsedEnd.iso) === Date.parse(parsedStart.iso));
    if (invalidRange) errors.push(`${label} ends before it starts.`);
    if (uid && seenUids.has(uid)) errors.push(`${label} has duplicate UID “${uid}”.`);
    if (uid) seenUids.add(uid);
    if (!title || !parsedStart || !parsedEnd || invalidRange) return;
    const identity = `${title.toLocaleLowerCase()}|${parsedStart.iso}|${parsedEnd.iso}`;
    if (seenEvents.has(identity)) { errors.push(`${label} duplicates another event in this file.`); return; }
    seenEvents.add(identity);
    events.push({ uid, title, start: parsedStart.iso, end: parsedEnd.iso, calendar: unescapeIcsText(calendarName), allDay: parsedStart.allDay });
  });
  return errors.length ? { status: "rejected", errors } : { status: "parsed", events };
}

function dateAndTimeInTimeZone(iso: string, timeZone: string): { date: string; time: string } {
  try {
    const parts = new Map(new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    return {
      date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
      time: `${parts.get("hour")}:${parts.get("minute")}`,
    };
  } catch {
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

function eventMatchesView(event: CalendarEvent, view: AgendaView, timeZone: string): { matches: boolean; date: string } {
  const localStart = dateAndTimeInTimeZone(event.start, timeZone);
  const localEnd = dateAndTimeInTimeZone(event.end, timeZone);
  const startDate = event.allDay ? event.start.slice(0, 10) : localStart.date;
  const endDate = event.allDay ? event.end.slice(0, 10) : localEnd.date;
  const timedEventContinuesOnEndDate = endDate > view.date || endDate === view.date && localEnd.time > "00:00";
  const spansDate = event.allDay
    ? startDate <= view.date && endDate > view.date
    : startDate <= view.date && timedEventContinuesOnEndDate;
  if (view.kind === "upcoming") return { matches: startDate > view.date, date: startDate };
  return { matches: spansDate, date: view.date };
}

export function agendaForView(
  document: WorkspaceDocument,
  view: AgendaView,
  activeSpaceId: string | null,
  timeZone = "UTC",
  activeTagIds: string[] = [],
): AgendaItem[] {
  const agenda: AgendaItem[] = [];
  if (document.settings.showCalendar) {
    for (const event of document.calendarEvents) {
      if (activeSpaceId && event.spaceId !== activeSpaceId) continue;
      if (activeTagIds.length) continue;
      const match = eventMatchesView(event, view, timeZone);
      const localStart = dateAndTimeInTimeZone(event.start, timeZone);
      if (match.matches) agenda.push({ kind: "calendarEvent", id: event.id, title: event.title, date: match.date, sortTime: event.allDay ? "00:00" : localStart.time, actionable: false, item: event });
    }
  }
  for (const project of document.projects) {
    if (project.outcome !== "open" || project.trashedAt || project.logbookAt || project.schedule.kind !== "scheduled") continue;
    if (activeSpaceId && spaceIdForProject(document, project) !== activeSpaceId) continue;
    if (activeTagIds.some((tagId) => !effectiveTagIdsForProject(document, project).includes(tagId))) continue;
    const matches = view.kind === "today" ? project.schedule.date <= view.date : view.kind === "tomorrow" ? project.schedule.date === view.date : project.schedule.date > view.date;
    if (matches) agenda.push({ kind: "project", id: project.id, title: project.title, date: project.schedule.date, sortTime: "99:00", actionable: true, item: project });
  }
  for (const toDo of document.toDos) {
    if (toDo.outcome !== "open" || toDo.trashedAt || toDo.logbookAt || toDo.schedule.kind !== "scheduled") continue;
    if (activeSpaceId && spaceIdForToDo(document, toDo) !== activeSpaceId) continue;
    if (activeTagIds.some((tagId) => !effectiveTagIdsForToDo(document, toDo).includes(tagId))) continue;
    const matches = view.kind === "today" ? toDo.schedule.date <= view.date : view.kind === "tomorrow" ? toDo.schedule.date === view.date : toDo.schedule.date > view.date;
    if (matches) agenda.push({ kind: "toDo", id: toDo.id, title: toDo.title, date: toDo.schedule.date, sortTime: "99:00", actionable: true, item: toDo });
  }
  const kindOrder: Record<AgendaItem["kind"], number> = { calendarEvent: 0, project: 1, toDo: 2 };
  return agenda.sort((left, right) => left.date.localeCompare(right.date) || left.sortTime.localeCompare(right.sortTime) || kindOrder[left.kind] - kindOrder[right.kind] || left.title.localeCompare(right.title));
}
