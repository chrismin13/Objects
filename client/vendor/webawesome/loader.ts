import { webAwesomeCompressed } from "./packed";

let loading: Promise<void> | null = null;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function loadWebAwesome(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const compressed = decodeBase64(webAwesomeCompressed);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source = await new Response(stream).text();
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  })();
  return loading;
}

export const webAwesomeReady = loadWebAwesome();
