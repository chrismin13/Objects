import { createSeed } from "../../shared/state";
import {
  completeProject,
  completeTasks,
  convertHeadingToProject,
  createHeading,
  createProject,
  createSpace,
  deleteSpace,
  duplicateProject,
  moveTasks,
  reorderChecklist,
  reorderTasks,
  restoreTasks,
  scheduleTasks,
  trashTasks,
} from "./actions";
import {
  addDays,
  applyLogbookPolicy,
  buildChangeSet,
  cloneState,
  localDay,
  materializeRepeats,
  mergeRemoteState,
  nextRepeatDate,
  normalizeState,
  parseNaturalDate,
  parseNaturalTask,
} from "./model";

export type DomainTestResult = { name: string; passed: boolean; detail?: string };

function check(name: string, condition: boolean, detail?: string): DomainTestResult {
  return { name, passed: condition, detail: condition ? undefined : detail || "Assertion failed" };
}

export function runDomainTests(): DomainTestResult[] {
  const results: DomainTestResult[] = [];
  const today = "2026-07-19";

  const parsed = parseNaturalTask("Prepare brief tomorrow at 2pm due in 3 weeks #Focused", today);
  results.push(check("natural capture", parsed.title === "Prepare brief" && parsed.scheduledFor === "2026-07-20" && parsed.reminderAt === "2026-07-20T14:00" && parsed.deadline === "2026-08-09" && parsed.tags[0] === "Focused", JSON.stringify(parsed)));
  results.push(check("relative months", parseNaturalDate("January 31 + 1 month", "2026-01-01") === "2026-02-28"));
  results.push(check("next weekday", parseNaturalDate("next Friday", today) === "2026-07-24"));
  results.push(check("ordinal weekday", parseNaturalDate("last Monday July 2026", today) === "2026-07-27"));

  const state = normalizeState(createSeed());
  const inbox = state.tasks.find((task) => task.id === "task-inbox")!;
  scheduleTasks(state, [inbox.id], "upcoming", "2026-07-23");
  results.push(check("schedule action", inbox.bucket === "upcoming" && inbox.scheduledFor === "2026-07-23"));

  const heading = createHeading(state, "Next", { projectId: "project-home" });
  moveTasks(state, [inbox.id], { kind: "heading", id: heading.id });
  results.push(check("heading move", inbox.projectId === "project-home" && inbox.headingId === heading.id && inbox.spaceId === "space-personal"));

  state.settings.logCompletedItems = "immediately";
  completeTasks(state, [inbox.id], "completed", new Date("2026-07-19T12:00:00"));
  results.push(check("completion and Logbook", inbox.status === "completed" && inbox.loggedAt === inbox.completedAt));
  trashTasks(state, [inbox.id]);
  restoreTasks(state, [inbox.id]);
  results.push(check("Trash restoration", inbox.status === "completed" && !inbox.trashedAt));

  const checklistTask = state.tasks.find((task) => task.id === "task-brief")!;
  const reversedChecklist = checklistTask.checklist.map((item) => item.id).reverse();
  reorderChecklist(state, checklistTask.id, reversedChecklist);
  results.push(check("checklist ordering", checklistTask.checklist[0]?.id === reversedChecklist[0]));
  reorderTasks(state, [checklistTask.id], [inbox.id, checklistTask.id], { bucket: "upcoming", scheduledFor: "2026-07-26", evening: false });
  results.push(check("drag scheduling action", checklistTask.bucket === "upcoming" && checklistTask.scheduledFor === "2026-07-26" && checklistTask.order === 1));

  const project = createProject(state, { title: "Typed project", spaceId: "space-personal" });
  const projectHeading = createHeading(state, "Phase", { projectId: project.id });
  moveTasks(state, [checklistTask.id], { kind: "heading", id: projectHeading.id });
  const projectCopy = duplicateProject(state, project.id)!;
  results.push(check("project duplication", state.tasks.some((task) => task.projectId === projectCopy.id) && state.headings.some((item) => item.projectId === projectCopy.id)));
  completeProject(state, project.id, "completed", "move-anytime", new Date("2026-07-19T13:00:00"));
  results.push(check("project completion resolution", project.status === "completed" && checklistTask.projectId === null && checklistTask.bucket === "anytime"));

  const standaloneHeading = createHeading(state, "Promote me", { areaId: null });
  const converted = convertHeadingToProject(state, standaloneHeading.id);
  results.push(check("heading conversion", converted?.title === "Promote me" && !state.headings.some((item) => item.id === standaloneHeading.id)));

  const extraSpace = createSpace(state, "Studio", "#abcdef");
  checklistTask.spaceId = extraSpace.id;
  deleteSpace(state, extraSpace.id);
  results.push(check("Space deletion rehomes data", !state.spaces.some((space) => space.id === extraSpace.id) && checklistTask.spaceId !== extraSpace.id));

  const repeat = { mode: "fixed" as const, frequency: "weekly" as const, interval: 1, weekdays: [1, 5], nextDate: today, paused: false };
  results.push(check("repeat next date", nextRepeatDate(today, repeat) === "2026-07-20"));
  const repeating = state.tasks.find((task) => task.id === "task-weekly-review-template")!;
  repeating.repeat = repeat;
  const repeated = materializeRepeats(state, today);
  results.push(check("repeat materialization", repeated.tasks.some((task) => task.repeatTemplateId === repeating.id && task.scheduledFor === today)));

  const daily = normalizeState(createSeed());
  daily.settings.logCompletedItems = "daily";
  const done = daily.tasks.find((task) => task.id === "task-done")!;
  done.loggedAt = null;
  done.completedAt = "2026-07-18T12:00:00Z";
  const logged = applyLogbookPolicy(daily, new Date("2026-07-19T12:00:00"));
  results.push(check("daily Logbook policy", Boolean(logged.tasks.find((task) => task.id === done.id)?.loggedAt)));

  const baseline = normalizeState(createSeed());
  const local = cloneState(baseline);
  const remote = cloneState(baseline);
  local.tasks[0].title = "Local title";
  remote.tasks[0].notes = "Remote notes";
  remote.updatedAt = new Date().toISOString();
  const merged = mergeRemoteState(baseline, local, remote);
  results.push(check("field-level remote merge", merged.tasks[0].title === "Local title" && merged.tasks[0].notes === "Remote notes"));

  const changes = buildChangeSet(baseline, local);
  results.push(check("field-level ChangeSet", Boolean(changes?.entities.tasks?.some((change) => change.id === local.tasks[0].id && change.patch.title === "Local title"))));
  results.push(check("date helper", addDays(today, 1) === "2026-07-20" && localDay(new Date("2026-07-19T12:00:00")) === today));

  return results;
}
