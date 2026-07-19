import { createSeed } from "../../shared/state";
import { reorderChecklist, reorderEntities, reorderTasks } from "./actions";
import { parseNaturalDate, parseNaturalTask } from "./model";

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

  const state = createSeed();
  const checklistTask = state.tasks.find((task) => task.id === "task-brief")!;
  const reversedChecklist = checklistTask.checklist.map((item) => item.id).reverse();
  reorderChecklist(state, checklistTask.id, reversedChecklist);
  results.push(check("checklist ordering", checklistTask.checklist[0]?.id === reversedChecklist[0]));

  reorderTasks(state, [checklistTask.id], ["task-inbox", checklistTask.id], { bucket: "upcoming", scheduledFor: "2026-07-26", evening: false });
  results.push(check("drag scheduling", checklistTask.bucket === "upcoming" && checklistTask.scheduledFor === "2026-07-26" && checklistTask.order === 1));

  const projects = state.projects.slice(0, 2);
  reorderEntities(projects, [projects[1].id, projects[0].id]);
  results.push(check("entity ordering", projects[1].order === 0 && projects[0].order === 1));
  return results;
}
