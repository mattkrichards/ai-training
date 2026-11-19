// Turns whatever the user pastes or drops into plain text (or, for spreadsheets, rows).
// Heavy readers load only when needed. OCR files are served from /meeting-runner/ocr/
// (copied there by scripts/publish.mjs) so nothing depends on a third-party CDN.

const BASE = import.meta.env.BASE_URL;

export const ACCEPT = ".txt,.md,.csv,.tsv,.docx,.pdf,.xlsx,.png,.jpg,.jpeg,.webp,.bmp,.gif";

const ext = (name = "") => name.toLowerCase().split(".").pop();
export const isImage = (file) => /^image\//.test(file.type) || ["png", "jpg", "jpeg", "webp", "bmp", "gif"].includes(ext(file.name));
export const isSpreadsheet = (file) => ext(file.name) === "xlsx";

let ocrWorker = null;
export async function imageToText(blob, onProgress) {
  const { createWorker } = await import("tesseract.js");
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng", 1, {
      workerPath: `${BASE}ocr/worker.min.js`,
      corePath: `${BASE}ocr/core`,
      langPath: `${BASE}ocr/lang`,
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100));
      },
    });
  }
  const { data } = await ocrWorker.recognize(blob);
  return data.text || "";
}

async function docxToText(file) {
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

async function pdfToText(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Rebuild lines from y positions; keep x gaps as tabs so tables survive.
    const rows = new Map();
    for (const it of content.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], w: it.width, s: it.str });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => {
        parts.sort((a, b) => a.x - b.x);
        let line = "";
        let end = null;
        for (const part of parts) {
          if (end !== null) line += part.x - end > 12 ? "\t" : part.x - end > 1 ? " " : "";
          line += part.s;
          end = part.x + part.w;
        }
        return line;
      });
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

export async function readSpreadsheetRows(file) {
  const readXlsxFile = (await import("read-excel-file")).default;
  const rows = await readXlsxFile(file);
  return rows.map((r) => r.map((c) => (c instanceof Date ? c : c === null || c === undefined ? "" : c)));
}

// Returns { text } for most files, or { rows } for .xlsx.
export async function extractFromFile(file, onProgress) {
  if (isImage(file)) return { text: await imageToText(file, onProgress) };
  const e = ext(file.name);
  if (e === "docx") return { text: await docxToText(file) };
  if (e === "pdf") return { text: await pdfToText(file) };
  if (e === "xlsx") return { rows: await readSpreadsheetRows(file) };
  if (e === "doc") throw new Error("Old .doc files can't be read here. Save it as .docx or PDF, or copy the text and paste it.");
  return { text: await file.text() };
}

// Pulls an image or file out of a paste event, if there is one.
export function fileFromClipboard(e) {
  const items = [...(e.clipboardData?.items || [])];
  const fileItem = items.find((i) => i.kind === "file");
  return fileItem ? fileItem.getAsFile() : null;
}

// Plain text that came from Excel/Sheets keeps its tabs; also return the HTML table if present.
export function htmlTableFromClipboard(e) {
  const html = e.clipboardData?.getData("text/html");
  if (!html || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  return [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td,th")].map((td) => td.textContent.trim()));
}
