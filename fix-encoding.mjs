import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? process.cwd());
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html", ".json", ".md"]);
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".corepack", "dist", "drizzle"]);
const MOJIBAKE = /Ã|Â|â(?:€|„|œ|•|†|‡|‰|Š|‹|Œ|Ž|˜|™|š|›|ž|Ÿ|‚)|ðŸ|ï¸/u;

const WINDOWS_1252 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function mojibakeScore(value) {
  return (value.match(/Ã|Â|â|ðŸ|ï¸|�/gu) ?? []).length;
}

function decodeWindows1252AsUtf8(value) {
  try {
    const bytes = [];
    for (const char of value) {
      const codePoint = char.codePointAt(0);
      const byte = WINDOWS_1252.get(codePoint) ?? codePoint;
      if (byte > 0xff) return null;
      bytes.push(byte);
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return mojibakeScore(decoded) < mojibakeScore(value) ? decoded : null;
  } catch {
    return null;
  }
}

function processFile(filePath) {
  if (!EXTENSIONS.has(extname(filePath))) return;
  const original = readFileSync(filePath, "utf8");
  if (!MOJIBAKE.test(original)) return;

  const fixed = original
    .split(/(\r?\n)/u)
    .map(part => (MOJIBAKE.test(part) ? decodeWindows1252AsUtf8(part) ?? part : part))
    .join("");

  if (fixed !== original) {
    writeFileSync(filePath, fixed, "utf8");
    console.log(`Fixed: ${filePath}`);
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) walk(fullPath);
    else processFile(fullPath);
  }
}

walk(ROOT);
console.log("Encoding repair complete.");
