import { sortableCompressed } from "./packed";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function loadSortable() {
  const compressed = decodeBase64(sortableCompressed);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const module = await import(moduleUrl);
    return module.default;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

export const sortableReady = loadSortable();
