import { sortableReady } from "../vendor/sortablejs/loader";

type SortableInstance = { destroy(): void };

let workspaceToDoInstance: SortableInstance | null = null;
let workspaceToDoRequest = 0;

export type WorkspaceToDoSortEvent = {
  movedIds: string[];
  orderedIds: string[];
  sectionKey: string;
};

export function mountWorkspaceToDoSortable(
  root: ParentNode,
  selectedIds: string[],
  onEnd: (event: WorkspaceToDoSortEvent) => void,
): void {
  destroyWorkspaceToDoSortable();
  const request = workspaceToDoRequest;
  const lists = [...root.querySelectorAll<HTMLElement>(".replacement-list[data-section]")];
  if (!lists.length) return;
  void sortableReady.then((Sortable: any) => {
    if (request !== workspaceToDoRequest) return;
    const instances = lists.filter((list) => list.isConnected).map((list) => {
      const instance = Sortable.create(list, {
        animation: 150,
        draggable: "[data-todo-id]",
        handle: ".replacement-row-body",
        group: "objects-workspace-todos",
        multiDrag: true,
        selectedClass: "bulk-selected",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        fallbackTolerance: 5,
        onEnd: (event: { item: HTMLElement; items?: HTMLElement[]; to: HTMLElement }) => {
          const elements = event.items?.length ? event.items : [event.item];
          onEnd({
            movedIds: elements.map((item) => item.dataset.todoId).filter(Boolean) as string[],
            orderedIds: [...event.to.querySelectorAll<HTMLElement>("[data-todo-id]")]
              .map((item) => item.dataset.todoId)
              .filter(Boolean) as string[],
            sectionKey: event.to.dataset.section ?? "view",
          });
        },
      });
      for (const row of list.querySelectorAll<HTMLElement>("[data-todo-id]")) {
        if (row.dataset.todoId && selectedIds.includes(row.dataset.todoId)) Sortable.utils.select(row);
      }
      return instance;
    });
    workspaceToDoInstance = { destroy: () => { for (const instance of instances) instance.destroy(); } };
  });
}

export function destroyWorkspaceToDoSortable(): void {
  workspaceToDoRequest += 1;
  workspaceToDoInstance?.destroy();
  workspaceToDoInstance = null;
}
