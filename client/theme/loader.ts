import { objectsThemeCompressed } from "./packed";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function loadObjectsTheme(): Promise<string> {
  const compressed = decodeBase64(objectsThemeCompressed);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export const objectsThemeReady = loadObjectsTheme();
