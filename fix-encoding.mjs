import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

// Fix double-encoded UTF-8: read as UTF-8, encode as Latin-1, re-decode as UTF-8
function fixDoubleEncoding(str) {
  try {
    // Encode the string as Latin-1 bytes (each char code maps directly to a byte for 0x00-0xFF)
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code > 0xFF) return null; // Has real Unicode > Latin-1 range, skip
      bytes[i] = code;
    }
    // Decode those bytes as UTF-8
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function processFile(filePath) {
  const ext = extname(filePath);
  if (![".ts", ".tsx", ".css"].includes(ext)) return;

  const raw = readFileSync(filePath);

  // Detect BOM
  let hasBOM = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;

  const content = new TextDecoder("utf-8").decode(raw);

  // Check if double-encoded: look for the Ã pattern (C3 83 = Ã)
  const stripped = hasBOM ? content.slice(1) : content; // strip BOM char U+FEFF

  // Try to detect double-encoding by checking for common garbled French patterns
  if (!stripped.includes("Ã") && !stripped.includes("â€")) return;

  const fixed = fixDoubleEncoding(stripped);
  if (!fixed || fixed === stripped) return;

  // Write back as UTF-8 without BOM
  writeFileSync(filePath, new TextEncoder().encode(fixed));
  console.log("Fixed:", filePath);
}

function walkDir(dir) {
  const skip = ["node_modules", ".git", "dist", "drizzle"];
  for (const entry of readdirSync(dir)) {
    if (skip.includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkDir(full);
    } else {
      processFile(full);
    }
  }
}

const root = "C:/Users/salig/OneDrive/Bureau/medboard/client/src";
walkDir(root);

// Also fix shared and server dirs
walkDir("C:/Users/salig/OneDrive/Bureau/medboard/shared");

console.log("Done.");
