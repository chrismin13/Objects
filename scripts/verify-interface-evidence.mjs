import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const manifestPath = resolve(repositoryRoot, 'docs/interface-evidence/browser-verification.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];

for (const workflow of manifest.workflows) {
  if (workflow.result !== 'pass') failures.push(`Workflow did not pass: ${workflow.name}`);
}

if (manifest.consoleErrors !== 0 || manifest.consoleWarnings !== 0) {
  failures.push(`Browser logs were not clean: ${manifest.consoleErrors} errors, ${manifest.consoleWarnings} warnings`);
}

for (const screenshot of manifest.screenshots) {
  const screenshotPath = resolve(repositoryRoot, screenshot.path);
  const bytes = await readFile(screenshotPath);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== screenshot.sha256) failures.push(`Screenshot digest changed: ${screenshot.path}`);
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`Verified ${manifest.workflows.length} browser workflows and ${manifest.screenshots.length} screenshots.`);
}
