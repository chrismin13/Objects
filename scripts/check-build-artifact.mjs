import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifactPath = resolve('.lakebed/artifacts/Objects.anonymous.json');
const lakebedMaximumBytes = 2_097_152;
const projectMaximumBytes = 2_080_000;

let artifact;
try {
  artifact = await stat(artifactPath);
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error('Build artifact not found. Run `npx lakebed build . --target anonymous --json` first.');
    process.exitCode = 1;
  } else {
    throw error;
  }
}

if (artifact) {
  const projectHeadroom = projectMaximumBytes - artifact.size;
  const lakebedHeadroom = lakebedMaximumBytes - artifact.size;

  console.log(`Anonymous artifact: ${artifact.size.toLocaleString()} bytes`);
  console.log(`Lakebed headroom: ${lakebedHeadroom.toLocaleString()} bytes`);

  if (artifact.size > projectMaximumBytes) {
    console.error(
      `Artifact exceeds the Objects safety limit by ${Math.abs(projectHeadroom).toLocaleString()} bytes. `
      + 'Reduce the delivery bundle before deploying.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Objects safety headroom: ${projectHeadroom.toLocaleString()} bytes`);
  }
}
