import Sortable from "../vendor/sortablejs/sortable.js";

type SortableInstance = { destroy(): void };

let checklistInstance: SortableInstance | null = null;
let taskInstances: SortableInstance[] = [];
let headingInstance: SortableInstance | null = null;

export type TaskSortEvent = {
  movedIds: string[];
  orderedIds: string[];
  sectionKey: string;
};

export function mountTaskSortables(
  root: ParentNode,
  options: {
    crossSection: boolean;
    onStart(movedIds: string[]): void;
    onEnd(event: TaskSortEvent): void;
  },
): void {
  destroyTaskSortables();
  const lists = [...root.querySelectorAll<HTMLElement>(".section[data-section] > .task-list")];
  for (const list of lists) {
    if (!list.isConnected) continue;
    const sectionKey = list.closest<HTMLElement>("[data-section]")?.dataset.section || "list";
    taskInstances.push(
      Sortable.create(list, {
        animation: 150,
        delay: 180,
        delayOnTouchOnly: true,
        touchStartThreshold: 8,
        draggable: ".task-row",
        handle: ".task-main",
        group: options.crossSection ? "objects-tasks" : `objects-${sectionKey}`,
        multiDrag: true,
        selectedClass: "bulk-selected",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        fallbackTolerance: 5,
        onStart: (event: { item: HTMLElement; items?: HTMLElement[] }) => {
          const elements = event.items?.length ? event.items : [event.item];
          options.onStart(elements.map((item) => item.dataset.taskId).filter(Boolean) as string[]);
        },
        onEnd: (event: { item: HTMLElement; items?: HTMLElement[]; to: HTMLElement }) => {
          const elements = event.items?.length ? event.items : [event.item];
          const targetSection = event.to.closest<HTMLElement>("[data-section]");
          options.onEnd({
            movedIds: elements.map((item) => item.dataset.taskId).filter(Boolean) as string[],
            orderedIds: [...event.to.querySelectorAll<HTMLElement>("[data-task-id]")]
              .map((item) => item.dataset.taskId)
              .filter(Boolean) as string[],
            sectionKey: targetSection?.dataset.section || sectionKey,
          });
        },
      }),
    );
  }
}

export function destroyTaskSortables(): void {
  for (const instance of taskInstances) instance.destroy();
  taskInstances = [];
}

export function mountHeadingSortable(
  root: ParentNode,
  options: { onStart(): void; onOrder(orderedIds: string[]): void },
): void {
  headingInstance?.destroy();
  headingInstance = null;
  const sections = root.querySelector<HTMLElement>(".section-list");
  if (!sections || sections.querySelectorAll(".heading-header").length < 2) return;
  if (!sections.isConnected) return;
  headingInstance = Sortable.create(sections, {
    animation: 150,
    delay: 180,
    delayOnTouchOnly: true,
    touchStartThreshold: 8,
    draggable: ".section:has(.heading-header)",
    handle: ".heading-header",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    fallbackTolerance: 5,
    onStart: options.onStart,
    onEnd: () =>
      options.onOrder(
        [
          ...sections.querySelectorAll<HTMLElement>(
            ":scope > .section[data-section]:has(.heading-header)",
          ),
        ]
          .map((section) => section.dataset.section)
          .filter((id): id is string => Boolean(id)),
      ),
  });
}

export function destroyHeadingSortable(): void {
  headingInstance?.destroy();
  headingInstance = null;
}

export function mountChecklistSortable(
  root: ParentNode,
  onOrder: (orderedIds: string[]) => void,
): void {
  checklistInstance?.destroy();
  checklistInstance = null;
  const checklist = root.querySelector<HTMLElement>(".checklist");
  if (!checklist || checklist.children.length < 2) return;
  if (!checklist.isConnected) return;
  checklistInstance = Sortable.create(checklist, {
    animation: 140,
    delay: 180,
    delayOnTouchOnly: true,
    touchStartThreshold: 8,
    draggable: ".checklist-item",
    handle: ".checklist-reorder",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    fallbackTolerance: 5,
    onEnd: () => {
      onOrder(
        [...checklist.querySelectorAll<HTMLElement>("[data-check-id]")]
          .map((item) => item.dataset.checkId)
          .filter((id): id is string => Boolean(id)),
      );
    },
  });
}

export function destroyChecklistSortable(): void {
  checklistInstance?.destroy();
  checklistInstance = null;
}
