import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const [inputPath, outputPath, exportName] = process.argv.slice(2);
if (!inputPath || !outputPath || !exportName) {
  throw new Error("Usage: node scripts/pack-runtime.mjs <input> <output> <export-name>");
}

const source = readFileSync(inputPath);
const packed = gzipSync(source, { level: 9, mtime: 0 }).toString("base64");
writeFileSync(outputPath, `export const ${exportName} = \`\n${packed}\n\`;\n`);
