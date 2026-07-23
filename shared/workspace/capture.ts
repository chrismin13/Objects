import type { Schedule, ToDoLocation, WorkspaceDocument } from "./model.ts";
import { addDaysToDate, isIsoDate, isIsoDateTime } from "./dates.ts";

export type CapturedToDoInput = {
  submissionId: string;
  title: string;
  notes: string;
  location?: ToDoLocation;
  schedule: Schedule;
  reminderAt: string | null;
  deadline: string | null;
  tags: string[];
  checklist: string[];
};

export type CaptureParseResult =
  | { ok: true; input: CapturedToDoInput }
  | { ok: false; errors: string[] };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown, limit: number): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const unique: string[] = [];
  for (const item of values) {
    const clean = item && typeof item === "object" && !Array.isArray(item)
      ? text((item as Record<string, unknown>).title)
      : text(item);
    if (clean && !unique.some((existing) => existing.toLocaleLowerCase() === clean.toLocaleLowerCase())) unique.push(clean);
    if (unique.length === limit) break;
  }
  return unique;
}

function locationFromRecord(document: WorkspaceDocument, input: Record<string, unknown>, errors: string[]): ToDoLocation | undefined {
  const rawLocation = input.location;
  if (rawLocation && typeof rawLocation === "object" && !Array.isArray(rawLocation)) {
    const location = rawLocation as Record<string, unknown>;
    input = {
      ...input,
      ...(location.kind === "heading" ? { headingId: location.headingId } : {}),
      ...(location.kind === "project" ? { projectId: location.projectId } : {}),
      ...(location.kind === "area" ? { areaId: location.areaId } : {}),
      ...(location.kind === "unfiled" || location.kind === "space" ? { spaceId: location.spaceId } : {}),
    };
  } else if (typeof rawLocation === "string" && rawLocation.includes(":")) {
    const separator = rawLocation.indexOf(":");
    const kind = rawLocation.slice(0, separator);
    const id = rawLocation.slice(separator + 1);
    input = {
      ...input,
      ...(kind === "heading" ? { headingId: id } : {}),
      ...(kind === "project" ? { projectId: id } : {}),
      ...(kind === "area" ? { areaId: id } : {}),
      ...(kind === "space" ? { spaceId: id } : {}),
    };
  }
  const headingId = text(input.headingId ?? input.heading);
  if (headingId) {
    if (!document.headings.some((heading) => heading.id === headingId)) errors.push("The selected Heading is not available in this Workspace.");
    return { kind: "heading", headingId };
  }
  const projectId = text(input.projectId ?? input.project);
  if (projectId) {
    if (!document.projects.some((project) => project.id === projectId)) errors.push("The selected Project is not available in this Workspace.");
    return { kind: "project", projectId };
  }
  const areaId = text(input.areaId ?? input.area);
  if (areaId) {
    if (!document.areas.some((area) => area.id === areaId)) errors.push("The selected Area is not available in this Workspace.");
    return { kind: "area", areaId };
  }
  const spaceId = text(input.spaceId ?? input.space);
  if (spaceId) {
    if (!document.spaces.some((space) => space.id === spaceId)) errors.push("The selected Space is not available in this Workspace.");
    return { kind: "unfiled", spaceId };
  }
  return undefined;
}

function scheduleFromRecord(input: Record<string, unknown>, today: string, errors: string[]): Schedule {
  const rawSchedule = input.schedule;
  if (rawSchedule && typeof rawSchedule === "object" && !Array.isArray(rawSchedule)) {
    const schedule = rawSchedule as Record<string, unknown>;
    input = {
      ...input,
      when: schedule.kind,
      ...(schedule.kind === "scheduled" ? { scheduledFor: schedule.date, evening: schedule.evening } : {}),
    };
  }
  const scheduledFor = text(input.scheduledFor);
  const when = text(input.when ?? input.list ?? input.bucket).toLocaleLowerCase();
  const evening = input.evening === true || text(input.evening).toLocaleLowerCase() === "true" || when === "this evening" || when === "evening";
  if (scheduledFor) {
    if (!isIsoDate(scheduledFor)) errors.push("The scheduled date must use YYYY-MM-DD.");
    return { kind: "scheduled", date: scheduledFor, evening };
  }
  if (!when) return { kind: "inbox" };
  if (when === "inbox" || when === "anytime" || when === "someday") return { kind: when };
  if (when === "today" || when === "this evening" || when === "evening") return { kind: "scheduled", date: today, evening };
  if (when === "tomorrow") return { kind: "scheduled", date: addDaysToDate(today, 1), evening };
  if (isIsoDate(when)) return { kind: "scheduled", date: when, evening };
  errors.push("The Schedule must be Inbox, Anytime, Someday, Today, Tomorrow, This Evening, or YYYY-MM-DD.");
  return { kind: "inbox" };
}

export function captureInputFromRecord(
  document: WorkspaceDocument,
  input: Record<string, unknown>,
  today: string,
): CaptureParseResult {
  const errors: string[] = [];
  if (!isIsoDate(today)) errors.push("Capture needs a valid local date.");
  const submissionId = text(input.submissionId ?? input.submission ?? input.idempotencyKey);
  if (!submissionId || submissionId.length > 200) errors.push("Capture needs a submission identity of 200 characters or fewer.");

  const sharedText = text(input.text);
  const sharedUrl = text(input.url);
  const title = text(input.title) || sharedText.split(/\r?\n/, 1)[0] || sharedUrl;
  if (!title || title.length > 500) errors.push("Capture needs a title of 500 characters or fewer.");

  const noteParts = [text(input.notes)];
  if (sharedText && sharedText !== title) noteParts.push(sharedText);
  if (sharedUrl && sharedUrl !== title && !noteParts.some((part) => part.includes(sharedUrl))) noteParts.push(sharedUrl);
  const notes = noteParts.filter(Boolean).join("\n\n");
  if (notes.length > 20_000) errors.push("Capture notes must be 20,000 characters or fewer.");

  const reminderAt = text(input.reminderAt ?? input.reminder) || null;
  if (reminderAt && !isIsoDateTime(reminderAt)) errors.push("The Reminder must be an ISO date and time.");
  const deadline = text(input.deadline) || null;
  if (deadline && !isIsoDate(deadline)) errors.push("The Deadline must use YYYY-MM-DD.");

  const location = locationFromRecord(document, input, errors);
  const schedule = scheduleFromRecord(input, today, errors);
  const tags = list(input.tags, 50);
  const checklist = list(input.checklist, 200);
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { submissionId, title, notes, location, schedule, reminderAt, deadline, tags, checklist } };
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function captureInputFromUrl(document: WorkspaceDocument, search: string, today: string): CaptureParseResult {
  const input: Record<string, string> = {};
  for (const part of search.replace(/^\?/, "").split("&")) {
    if (!part) continue;
    const separator = part.indexOf("=");
    const key = decodeQueryPart(separator < 0 ? part : part.slice(0, separator));
    const value = decodeQueryPart(separator < 0 ? "" : part.slice(separator + 1));
    input[key] = value;
  }
  return captureInputFromRecord(document, input, today);
}
