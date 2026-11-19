// Copies the Vite build (dist/) into the hub site's /meeting-runner/ folder.
// Keeps the live meeting-runner/config.js (its settings are edited on GitHub) and
// gives each page its own folder so links like /meeting-runner/Timer/?id=… load on GitHub Pages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const out = path.resolve(here, '../../../meeting-runner');
const PAGES = ['Timer'];

const liveConfig = path.join(out, 'config.js');
const keepConfig = fs.existsSync(liveConfig) ? fs.readFileSync(liveConfig) : null;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });
if (keepConfig) fs.writeFileSync(liveConfig, keepConfig);

for (const page of PAGES) {
  fs.mkdirSync(path.join(out, page), { recursive: true });
  fs.copyFileSync(path.join(out, 'index.html'), path.join(out, page, 'index.html'));
}
console.log(`Published to ${path.relative(process.cwd(), out)}${keepConfig ? ' (kept existing config.js)' : ''}`);
