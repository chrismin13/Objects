import { captureInputFromRecord } from "./capture.ts";
import type { IsoDateTime, WorkspaceDocument } from "./model.ts";
import { resolveSyncCommand, type WorkspaceSyncSnapshot } from "./sync.ts";
import { createWorkspace } from "./workspace.ts";

export type HttpCaptureResult =
  | { status: "created" | "duplicate"; next: WorkspaceSyncSnapshot | null; toDo: WorkspaceDocument["toDos"][number] | undefined }
  | { status: "invalid"; errors: string[] }
  | { status: "conflict" };

export function captureIntoSnapshot(
  current: WorkspaceSyncSnapshot | null,
  initialDocument: WorkspaceDocument,
  input: Record<string, unknown>,
  dependencies: {
    now: IsoDateTime;
    today: string;
    createId: (kind: string) => string;
  },
): HttpCaptureResult {
  const parsed = captureInputFromRecord(initialDocument, input, dependencies.today);
  if ("errors" in parsed) return { status: "invalid", errors: parsed.errors };

  const workspace = createWorkspace(initialDocument, {
    now: () => dependencies.now,
    createId: dependencies.createId,
  });
  const changed = workspace.change({ type: "captureToDo", capture: parsed.input });
  if (changed.status === "rejected") return { status: "invalid", errors: changed.errors };

  const document = workspace.read();
  const resolved = resolveSyncCommand(current, {
    expectedRevision: current?.revision ?? 0,
    mutationId: `capture-${parsed.input.submissionId}`,
    document,
  }, dependencies.now);
  if (resolved.result.status === "conflict") return { status: "conflict" };
  if (resolved.result.status === "rejected") return { status: "invalid", errors: resolved.result.errors };

  const toDoId = changed.affected.find((item) => item.kind === "toDo")?.id;
  return {
    status: changed.outcome === "capture-reused" ? "duplicate" : "created",
    next: resolved.next,
    toDo: document.toDos.find((item) => item.id === toDoId),
  };
}
