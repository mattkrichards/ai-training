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

// Picture reading (OCR) runs in the browser from files served by the hub, not a third-party CDN.
const nm = path.resolve(here, '../node_modules');
const ocr = path.join(out, 'ocr');
fs.mkdirSync(path.join(ocr, 'core'), { recursive: true });
fs.mkdirSync(path.join(ocr, 'lang'), { recursive: true });
fs.copyFileSync(path.join(nm, 'tesseract.js/dist/worker.min.js'), path.join(ocr, 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
  fs.copyFileSync(path.join(nm, 'tesseract.js-core', f), path.join(ocr, 'core', f));
}
fs.copyFileSync(path.join(nm, '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), path.join(ocr, 'lang', 'eng.traineddata.gz'));

for (const page of PAGES) {
  fs.mkdirSync(path.join(out, page), { recursive: true });
  fs.copyFileSync(path.join(out, 'index.html'), path.join(out, page, 'index.html'));
}
console.log(`Published to ${path.relative(process.cwd(), out)}${keepConfig ? ' (kept existing config.js)' : ''}`);
