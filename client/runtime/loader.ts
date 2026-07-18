import { runtimeCompressed } from "./packed";

export type ObjectsRuntime = {
  mountObjects(serializedState: string, options: Record<string, unknown>): () => void;
  syncObjectsState(serializedState: string): void;
};

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function loadRuntime(): Promise<ObjectsRuntime> {
  const compressed = decodeBase64(runtimeCompressed);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    return await import(moduleUrl) as ObjectsRuntime;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

export const objectsRuntimeReady = loadRuntime();
