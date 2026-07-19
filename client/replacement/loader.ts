import { replacementRuntimeCompressed } from "./packed";

import type { WorkspaceSyncAdapter } from "../../shared/replacement/sync";

export type ReplacementRuntime = {
  mountReplacement(root: Element, adapter: WorkspaceSyncAdapter, showReminder: (toDo: { id: string; title: string; notes?: string }) => Promise<boolean>): () => void;
};

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function loadRuntime(): Promise<ReplacementRuntime> {
  const compressed = decodeBase64(replacementRuntimeCompressed);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    return await import(moduleUrl) as ReplacementRuntime;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

export const replacementRuntimeReady = loadRuntime();
