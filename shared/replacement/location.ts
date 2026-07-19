import type { EntityId, Project, RepeatingTemplate, ToDo, ToDoLocation, WorkspaceDocument } from "./model.ts";

export function spaceIdForProject(document: WorkspaceDocument, projectOrId: Project | EntityId): EntityId | null {
  const project = typeof projectOrId === "string"
    ? document.projects.find((item) => item.id === projectOrId)
    : projectOrId;
  if (!project) return null;
  if (project.location.kind === "space") return project.location.spaceId;
  const areaId = project.location.areaId;
  return document.areas.find((area) => area.id === areaId)?.spaceId ?? null;
}

function locationIdsForToDoLocation(document: WorkspaceDocument, location: ToDoLocation): {
  spaceId: EntityId | null;
  areaId: EntityId | null;
  projectId: EntityId | null;
} {
  if (location.kind === "unfiled") return { spaceId: location.spaceId, areaId: null, projectId: null };
  if (location.kind === "area") {
    const area = document.areas.find((item) => item.id === location.areaId);
    return { spaceId: area?.spaceId ?? null, areaId: location.areaId, projectId: null };
  }
  const heading = location.kind === "heading" ? document.headings.find((item) => item.id === location.headingId) : null;
  const projectId = location.kind === "project"
    ? location.projectId
    : heading?.location.kind === "project" ? heading.location.projectId : null;
  if (projectId) {
    const project = document.projects.find((item) => item.id === projectId);
    if (!project) return { spaceId: null, areaId: null, projectId };
    return {
      spaceId: spaceIdForProject(document, project),
      areaId: project.location.kind === "area" ? project.location.areaId : null,
      projectId,
    };
  }
  const areaId = heading?.location.kind === "area" ? heading.location.areaId : null;
  const area = areaId ? document.areas.find((item) => item.id === areaId) : null;
  return { spaceId: area?.spaceId ?? null, areaId, projectId: null };
}

export function locationIdsForToDo(document: WorkspaceDocument, toDo: ToDo): {
  spaceId: EntityId | null;
  areaId: EntityId | null;
  projectId: EntityId | null;
} {
  return locationIdsForToDoLocation(document, toDo.location);
}

export function spaceIdForToDo(document: WorkspaceDocument, toDo: ToDo): EntityId | null {
  return locationIdsForToDo(document, toDo).spaceId;
}

export function effectiveTagIdsForProject(document: WorkspaceDocument, project: Project): EntityId[] {
  const areaId = project.location.kind === "area" ? project.location.areaId : null;
  const areaTags = areaId ? document.areas.find((area) => area.id === areaId)?.tags ?? [] : [];
  return [...new Set([...areaTags, ...project.tags])];
}

export function effectiveTagIdsForToDo(document: WorkspaceDocument, toDo: ToDo): EntityId[] {
  const location = locationIdsForToDo(document, toDo);
  const areaTags = location.areaId ? document.areas.find((area) => area.id === location.areaId)?.tags ?? [] : [];
  const projectTags = location.projectId ? document.projects.find((project) => project.id === location.projectId)?.tags ?? [] : [];
  return [...new Set([...areaTags, ...projectTags, ...toDo.tags])];
}

export function spaceIdForRepeatingTemplate(document: WorkspaceDocument, template: RepeatingTemplate): EntityId | null {
  if (template.itemKind === "toDo") return locationIdsForToDoLocation(document, template.location).spaceId;
  if (template.location.kind === "space") return template.location.spaceId;
  const areaId = template.location.areaId;
  return document.areas.find((area) => area.id === areaId)?.spaceId ?? null;
}

export function effectiveTagIdsForRepeatingTemplate(document: WorkspaceDocument, template: RepeatingTemplate): EntityId[] {
  if (template.itemKind === "project") {
    const areaId = template.location.kind === "area" ? template.location.areaId : null;
    const areaTags = areaId ? document.areas.find((area) => area.id === areaId)?.tags ?? [] : [];
    return [...new Set([...areaTags, ...template.tags])];
  }
  const location = locationIdsForToDoLocation(document, template.location);
  const areaTags = location.areaId ? document.areas.find((area) => area.id === location.areaId)?.tags ?? [] : [];
  const projectTags = location.projectId ? document.projects.find((project) => project.id === location.projectId)?.tags ?? [] : [];
  return [...new Set([...areaTags, ...projectTags, ...template.tags])];
}
