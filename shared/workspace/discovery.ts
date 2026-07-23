import type { EntityId, ToDo, WorkspaceDocument } from "./model.ts";
import { addDaysToDate as datePlus } from "./dates.ts";
import { spaceIdForProject, spaceIdForRepeatingTemplate, spaceIdForToDo } from "./location.ts";
import type { WorkspaceView } from "./workspace.ts";

export const SPECIAL_VIEW_KINDS = [
  "inbox", "today", "thisEvening", "tomorrow", "upcoming", "anytime", "someday", "deadlines", "logbook", "trash", "repeating",
] as const;

export type SpecialViewKind = typeof SPECIAL_VIEW_KINDS[number];
export type DirectTarget =
  | { kind: "view"; viewKind: SpecialViewKind }
  | { kind: "space" | "area" | "project" | "heading" | "tag" | "toDo" | "repeatingTemplate"; id: EntityId };

export type SearchGroup = "Lists & views" | "Organization" | "Tags" | "Active work" | "History" | "Trash" | "Repeating Previews" | "Repeating Templates";

export type SearchResult = {
  id: string;
  group: SearchGroup;
  title: string;
  detail: string;
  match: string;
  target: DirectTarget;
};

export type ResolvedDirectTarget = {
  status: "resolved";
  view: WorkspaceView;
  selectedToDoId: EntityId | null;
  tagIds: EntityId[];
  repeatingTemplateId: EntityId | null;
  activeSpaceId: EntityId | null;
};

export type MissingDirectTarget = { status: "missing"; message: string };
export type RecoveredDirectTarget = { target: DirectTarget; resolved: ResolvedDirectTarget | MissingDirectTarget };

const VIEW_LABELS: Record<SpecialViewKind, string> = {
  inbox: "Inbox",
  today: "Today",
  thisEvening: "This Evening",
  tomorrow: "Tomorrow",
  upcoming: "Upcoming",
  anytime: "Anytime",
  someday: "Someday",
  deadlines: "Deadlines",
  logbook: "Logbook",
  trash: "Trash",
  repeating: "Repeating",
};

const GROUP_ORDER: SearchGroup[] = ["Lists & views", "Organization", "Tags", "Active work", "History", "Trash", "Repeating Previews", "Repeating Templates"];

function searchableText(values: Array<string | undefined>): string {
  return values.filter(Boolean).join("\n").toLocaleLowerCase();
}

function matchText(query: string, values: Array<string | undefined>): string | null {
  const lowered = query.toLocaleLowerCase();
  return searchableText(values).includes(lowered) ? values.find((value) => value?.toLocaleLowerCase().includes(lowered)) ?? values[0] ?? "" : null;
}

function toDoSearchText(toDo: ToDo, document: WorkspaceDocument): string[] {
  return [
    toDo.title,
    toDo.notes,
    ...toDo.checklist.map((item) => item.title),
    ...toDo.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title),
  ].filter((value): value is string => Boolean(value));
}

function result(group: SearchGroup, title: string, detail: string, match: string, target: DirectTarget, id?: string): SearchResult {
  return { id: id ?? `${target.kind}:${"id" in target ? target.id : target.viewKind}`, group, title, detail, match, target };
}

function hasOccurrenceOnNextDate(document: WorkspaceDocument, templateId: EntityId, nextDate: string): boolean {
  return document.toDos.some((toDo) => toDo.occurrence?.templateId === templateId && toDo.occurrence.scheduledDate === nextDate)
    || document.projects.some((project) => project.occurrence?.templateId === templateId && project.occurrence.scheduledDate === nextDate);
}

export function searchWorkspace(document: WorkspaceDocument, rawQuery: string, today: string, limit = 80): SearchResult[] {
  const query = rawQuery.trim();
  if (!query) return SPECIAL_VIEW_KINDS.map((viewKind) => result("Lists & views", VIEW_LABELS[viewKind], "Special view", VIEW_LABELS[viewKind], { kind: "view", viewKind }));
  const results: SearchResult[] = [];

  for (const viewKind of SPECIAL_VIEW_KINDS) {
    const title = VIEW_LABELS[viewKind];
    const match = matchText(query, [title]);
    if (match !== null) results.push(result("Lists & views", title, "Special view", match, { kind: "view", viewKind }));
  }

  const organization = [
    ...document.spaces.map((item) => ({ item, kind: "space" as const, label: "Space", values: [item.title] })),
    ...document.areas.map((item) => ({ item, kind: "area" as const, label: "Area", values: [item.title] })),
    ...document.headings.map((item) => ({ item, kind: "heading" as const, label: item.archivedAt ? "Archived Heading" : "Heading", values: [item.title] })),
  ];
  for (const entry of organization) {
    const match = matchText(query, entry.values);
    if (match !== null) results.push(result("Organization", entry.item.title, entry.label, match, { kind: entry.kind, id: entry.item.id }));
  }

  for (const project of document.projects) {
    const match = matchText(query, [project.title, project.notes]);
    if (match === null) continue;
    const group: SearchGroup = project.trashedAt ? "Trash" : project.logbookAt || project.outcome !== "open" ? "History" : "Organization";
    const detail = group === "Trash" ? "Project in Trash" : group === "History" ? "Project in Logbook or completed work" : "Project";
    results.push(result(group, project.title, detail, match, { kind: "project", id: project.id }));
  }

  for (const tag of document.tags) {
    const match = matchText(query, [tag.title]);
    if (match !== null) results.push(result("Tags", tag.title, "Tag", match, { kind: "tag", id: tag.id }));
  }

  for (const toDo of document.toDos) {
    const match = matchText(query, toDoSearchText(toDo, document));
    if (match === null) continue;
    const group: SearchGroup = toDo.trashedAt ? "Trash" : toDo.logbookAt || toDo.outcome !== "open" ? "History" : "Active work";
    const detail = group === "Trash" ? "To-do in Trash" : group === "History" ? "To-do in Logbook or completed work" : "Active to-do";
    results.push(result(group, toDo.title, detail, match, { kind: "toDo", id: toDo.id }));
  }

  for (const template of document.repeatingTemplates) {
    const projectContents = template.projectContents;
    const values = [
      template.title,
      template.notes,
      template.nextDate,
      ...template.checklist.map((item) => item.title),
      ...(projectContents?.headings.map((heading) => heading.title) ?? []),
      ...(projectContents?.toDos.flatMap((toDo) => [toDo.title, toDo.notes, ...toDo.checklist.map((item) => item.title)]) ?? []),
    ];
    const match = matchText(query, values);
    if (match === null) continue;
    const target = { kind: "repeatingTemplate" as const, id: template.id };
    const hasBlockedAfterCompletionPreview = template.mode === "after-completion" && hasOccurrenceOnNextDate(document, template.id, template.nextDate);
    if (template.state === "active" && template.nextDate >= today && !hasBlockedAfterCompletionPreview) {
      results.push(result("Repeating Previews", template.title, `${template.nextDate} · ${template.itemKind === "toDo" ? "To-do" : "Project"} preview`, match, target, `preview:${template.id}:${template.nextDate}`));
    }
    results.push(result("Repeating Templates", template.title, `${template.state} ${template.itemKind === "toDo" ? "to-do" : "Project"} Template`, match, target));
  }

  return results
    .sort((left, right) => GROUP_ORDER.indexOf(left.group) - GROUP_ORDER.indexOf(right.group) || left.title.localeCompare(right.title))
    .slice(0, limit);
}

function missing(label: string): MissingDirectTarget {
  return { status: "missing", message: `This ${label} is no longer available or you do not have access to it.` };
}

function viewForToDo(toDo: ToDo, today: string): WorkspaceView {
  if (toDo.trashedAt) return { kind: "trash", date: today };
  if (toDo.logbookAt || toDo.outcome !== "open") return { kind: "logbook", date: today };
  if (toDo.schedule.kind === "scheduled") return toDo.schedule.date <= today ? { kind: "today", date: today } : { kind: "upcoming", date: today };
  return { kind: toDo.schedule.kind, date: today };
}

export function resolveDirectTarget(document: WorkspaceDocument, target: DirectTarget, today: string): ResolvedDirectTarget | MissingDirectTarget {
  if (target.kind === "view") {
    const date = target.viewKind === "tomorrow" ? datePlus(today, 1) : today;
    return { status: "resolved", view: { kind: target.viewKind, date }, selectedToDoId: null, tagIds: [], repeatingTemplateId: null, activeSpaceId: document.settings.defaultSpaceId };
  }
  if (target.kind === "space") {
    if (!document.spaces.some((item) => item.id === target.id)) return missing("Space");
    return { status: "resolved", view: { kind: "space", id: target.id, date: today }, selectedToDoId: null, tagIds: [], repeatingTemplateId: null, activeSpaceId: target.id };
  }
  if (target.kind === "area") {
    const area = document.areas.find((item) => item.id === target.id);
    if (!area) return missing("Area");
    return { status: "resolved", view: { kind: "area", id: target.id, date: today }, selectedToDoId: null, tagIds: [], repeatingTemplateId: null, activeSpaceId: area.spaceId };
  }
  if (target.kind === "project") {
    const project = document.projects.find((item) => item.id === target.id);
    if (!project) return missing("Project");
    const view: WorkspaceView = project.trashedAt
      ? { kind: "trash", date: today }
      : project.logbookAt || project.outcome !== "open" ? { kind: "logbook", date: today } : { kind: "project", id: target.id, date: today };
    return { status: "resolved", view, selectedToDoId: null, tagIds: [], repeatingTemplateId: null, activeSpaceId: spaceIdForProject(document, project) };
  }
  if (target.kind === "heading") {
    const heading = document.headings.find((item) => item.id === target.id);
    if (!heading) return missing("Heading");
    const location = heading.location;
    const activeSpaceId = location.kind === "area"
      ? document.areas.find((area) => area.id === location.areaId)?.spaceId ?? null
      : spaceIdForProject(document, location.projectId);
    return { status: "resolved", view: { kind: "heading", id: target.id, date: today }, selectedToDoId: null, tagIds: [], repeatingTemplateId: null, activeSpaceId };
  }
  if (target.kind === "tag") {
    if (!document.tags.some((item) => item.id === target.id)) return missing("Tag");
    return { status: "resolved", view: { kind: "today", date: today }, selectedToDoId: null, tagIds: [target.id], repeatingTemplateId: null, activeSpaceId: document.settings.defaultSpaceId };
  }
  if (target.kind === "repeatingTemplate") {
    const template = document.repeatingTemplates.find((item) => item.id === target.id);
    if (!template) return missing("Repeating Template");
    return { status: "resolved", view: { kind: "repeating", date: today }, selectedToDoId: null, tagIds: [], repeatingTemplateId: target.id, activeSpaceId: spaceIdForRepeatingTemplate(document, template) ?? document.settings.defaultSpaceId };
  }
  const toDo = document.toDos.find((item) => item.id === target.id);
  if (!toDo) return missing("to-do");
  return { status: "resolved", view: viewForToDo(toDo, today), selectedToDoId: toDo.id, tagIds: [], repeatingTemplateId: null, activeSpaceId: spaceIdForToDo(document, toDo) };
}

export function directTargetUrl(target: DirectTarget, base: string): string {
  const url = new URL(base);
  url.search = "";
  url.searchParams.set("open", target.kind);
  if (target.kind === "view") url.searchParams.set("view", target.viewKind);
  else url.searchParams.set("id", target.id);
  return url.toString();
}

export function parseDirectTarget(search: string): DirectTarget | null {
  const params = new URLSearchParams(search);
  const kind = params.get("open");
  if (kind === "view") {
    const viewKind = params.get("view") as SpecialViewKind | null;
    return viewKind && SPECIAL_VIEW_KINDS.includes(viewKind) ? { kind, viewKind } : null;
  }
  if (["space", "area", "project", "heading", "tag", "toDo", "repeatingTemplate"].includes(kind ?? "")) {
    const id = params.get("id");
    return id ? { kind: kind as Exclude<DirectTarget["kind"], "view">, id } : null;
  }
  return null;
}

export function recoverDirectTargetAfterLoad(document: WorkspaceDocument, search: string, today: string): RecoveredDirectTarget | null {
  const target = parseDirectTarget(search);
  return target ? { target, resolved: resolveDirectTarget(document, target, today) } : null;
}

export function moveQuickFindSelection(index: number, resultCount: number, key: "ArrowDown" | "ArrowUp" | "Home" | "End"): number {
  if (resultCount < 1) return 0;
  if (key === "Home") return 0;
  if (key === "End") return resultCount - 1;
  return key === "ArrowDown" ? Math.min(resultCount - 1, index + 1) : Math.max(0, index - 1);
}
